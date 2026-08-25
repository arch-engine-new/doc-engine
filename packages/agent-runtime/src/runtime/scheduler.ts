/**
 * In-memory serial scheduler for compiled graphs.
 *
 * Why: Uses Kahn's algorithm to compute ready set from precomputed adjacency.
 * Executes one node at a time (serial), merging channel updates after each.
 * Fan-out/fan-in barrier is prepared for future parallel execution but runs serial now.
 * Supports HITL (Human-in-the-Loop) nodes that pause execution awaiting human input.
 */

import type { CompiledGraph } from "../graph/types.js";
import type { ExecutionContext, NodeExecutionRecord, RunStatus } from "./state.js";
import { getExecutor, type NodeExecutor, type NodeResult, BUILTIN_EXECUTORS } from "./node-executors.js";
import { createInitialChannels, mergeChannels, getChannel, serializeChannels } from "./state.js";
import type { CheckpointService, WriteCheckpointOptions } from "./checkpoint-service.js";
import type { HitlGateway, HitlDecision } from "../hitl/gateway.js";

/** Scheduler options. */
export interface SchedulerOptions {
  /** Maximum total nodes to execute before forcing halt (safety). */
  maxSteps?: number;
  /** Custom executor map (merged with built-ins). */
  executors?: Map<string, NodeExecutor>;
  /** Called after each node completes (for observability). */
  onNodeComplete?: (record: NodeExecutionRecord) => void;
  /** Called if a node fails (for observability/retry). */
  onNodeError?: (record: NodeExecutionRecord, error: Error) => void;
  /** Optional checkpoint service for crash recovery. */
  checkpointService?: CheckpointService;
  /** Run ID for checkpointing (required if checkpointService provided). */
  runId?: string;
  // HITL gateway for human-in-the-loop interrupts.
  hitlGateway?: HitlGateway;
  /** Called when a HITL interrupt is created (run pauses). */
  onHitlInterrupt?: (interrupt: { token: string; nodeId: string; payload: unknown }) => void;
}

/** Result of a scheduler run. */
export interface SchedulerResult {
  /** Final run status. */
  status: RunStatus;
  /** Final channel state (all channels). */
  channels: Map<string, { value: unknown; version: number }>;
  /** Execution history. */
  history: NodeExecutionRecord[];
  /** Error if failed. */
  error?: { message: string; code?: string; cause?: unknown };
  /** Output channel value (from "output" channel or last terminal node). */
  output?: unknown;
  /** HITL interrupt info if status is "waiting_hitl". */
  hitlInterrupt?: {
    token: string;
    nodeId: string;
    payload: unknown;
    expiresAt: string | null;
  };
}

/**
 * Run a compiled graph to completion (or failure/cancellation/HITL pause).
 * Serial execution: picks one ready node at a time, runs it, merges updates, repeats.
 * If a HITL node is encountered and hitlGateway is provided, pauses and returns waiting_hitl.
 */
export async function runGraph(
  compiledGraph: CompiledGraph,
  input: unknown,
  abortSignal: AbortSignal,
  options: SchedulerOptions = {},
): Promise<SchedulerResult> {
  const {
    maxSteps = 1000,
    executors = new Map(),
    onNodeComplete,
    onNodeError,
    checkpointService,
    runId,
    hitlGateway,
    onHitlInterrupt,
  } = options;

  // Merge custom executors with built-ins (custom wins)
  const executorMap = new Map(BUILTIN_EXECUTORS);
  for (const [key, value] of executors) {
    executorMap.set(key, value);
  }

  // Initialize state
  const channels = createInitialChannels(input);
  const history: NodeExecutionRecord[] = [];
  let steps = 0;
  let seq = 0;

  // Build in-degree map for Kahn's algorithm (only normal edges)
  const inDegree = new Map<string, number>();
  const adjacency = compiledGraph.adjacency;

  for (const nodeId of compiledGraph.nodes.keys()) {
    inDegree.set(nodeId, 0);
  }
  for (const [from, tos] of adjacency) {
    for (const to of tos) {
      inDegree.set(to, (inDegree.get(to) ?? 0) + 1);
    }
  }

  // Ready queue: nodes with in-degree 0
  const ready = new Set<string>();
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) {
      ready.add(nodeId);
    }
  }

  // Execution context (mutates channels/history)
  const context: ExecutionContext = {
    compiledGraph,
    channels,
    metadata: {
      runId: runId ?? "",
      graphId: compiledGraph.graphId,
      status: "running",
      createdAt: new Date().toISOString(),
      input,
      nodeHistory: history,
    },
    abortSignal,
    runId: runId ?? "",
    threadId: undefined,
    nodeExecutionId: undefined,
    attempt: 1,
  };

  // Track completed nodes for fan-in (future: wait for all predecessors)
  const completed = new Set<string>();

  // Write initial checkpoint (before any node executes)
  if (checkpointService && runId) {
    await checkpointService.write({
      runId,
      seq: seq++,
      nodeId: null,
      channels,
      metadata: { phase: "initial" },
    });
  }

  while (ready.size > 0 && steps < maxSteps) {
    if (abortSignal.aborted) {
      return {
        status: "cancelled",
        channels,
        history,
        error: { message: "Run cancelled via abort signal", code: "CANCELLED" },
      };
    }

    // Pick a ready node (deterministic: first by id)
    const nodeId = [...ready].sort()[0]!;
    ready.delete(nodeId);

    const node = compiledGraph.nodes.get(nodeId)!;

    // Handle HITL node: pause execution and create interrupt
    if (node.type === "hitl") {
      if (!hitlGateway || !runId) {
        const error = new Error(`HITL node "${nodeId}" requires hitlGateway and runId in options`);
        return failRun(error, "HITL_CONFIG_MISSING");
      }
      const config = node.config ?? {};
      const payload = config.payload ?? { nodeId, message: "Human input required" };

      const { token, interrupt } = await hitlGateway.createInterrupt(runId, nodeId, payload);

      // Record the HITL node as waiting (not completed)
      const record: NodeExecutionRecord = {
        nodeId,
        nodeType: "hitl",
        startedAt: new Date().toISOString(),
        status: "running",
        input: getNodeInput(node, channels),
        attempt: 1,
      };
      history.push(record);

      // Write checkpoint for HITL pause (so we can resume from here)
      if (checkpointService) {
        await checkpointService.write({
          runId,
          seq: seq++,
          nodeId,
          channels,
          metadata: { phase: "hitl_waiting", hitlToken: token, hitlNodeId: nodeId, completedNodes: [...completed, nodeId] },
        });
      }

      // Notify about interrupt creation
      onHitlInterrupt?.({ token, nodeId, payload: interrupt.payload });

      // Return waiting_hitl status with interrupt info
      return {
        status: "waiting_hitl",
        channels,
        history,
        hitlInterrupt: {
          token,
          nodeId,
          payload: interrupt.payload,
          expiresAt: interrupt.expiresAt,
        },
      };
    }

    const executor = executorMap.get(node.type);
    if (!executor) {
      const error = new Error(`No executor for node type "${node.type}"`);
      return failRun(error, "NO_EXECUTOR");
    }

    // Record execution start
    const record: NodeExecutionRecord = {
      nodeId,
      nodeType: node.type,
      startedAt: new Date().toISOString(),
      status: "running",
      input: getNodeInput(node, channels),
      attempt: 1,
    };
    history.push(record);

    try {
      // Execute with retry policy
      const result = await executeWithRetry(node, executor, context, node.retry);

      // Update record
      record.finishedAt = new Date().toISOString();
      record.status = "completed";
      record.output = result.updates;

      // Merge channel updates
      mergeChannels(channels, result.updates);

      // Write checkpoint after successful node execution
      if (checkpointService && runId) {
        await checkpointService.write({
          runId,
          seq: seq++,
          nodeId,
          channels,
          metadata: { phase: "node_complete", completedNodes: [...completed, nodeId] },
        });
      }

      // Handle explicit nextNodeIds (branch) or normal adjacency
      let nextNodes: readonly string[];
      if (result.nextNodeIds && result.nextNodeIds.length > 0) {
        nextNodes = result.nextNodeIds;
      } else {
        nextNodes = adjacency.get(nodeId) ?? [];
      }

      // Decrement in-degree for successors
      for (const nextId of nextNodes) {
        const newDegree = (inDegree.get(nextId) ?? 1) - 1;
        inDegree.set(nextId, newDegree);
        if (newDegree === 0) {
          ready.add(nextId);
        }
      }

      completed.add(nodeId);

      // Halt signal (end node or explicit halt)
      if (result.halt || node.type === "end") {
        break;
      }

      onNodeComplete?.(record);
      steps++;
    } catch (error) {
      record.finishedAt = new Date().toISOString();
      record.status = "failed";
      record.error = { message: (error as Error).message, code: (error as Error & { code?: string }).code };

      onNodeError?.(record, error as Error);

      // Check for onError edges
      const errorEdges = compiledGraph.edges.filter(
        (e) => e.from === nodeId && e.onError,
      );
      if (errorEdges.length > 0) {
        // Route to first error handler
        const errorTarget = errorEdges[0]!.to;
        ready.add(errorTarget);
        continue;
      }

      return failRun(error as Error, "NODE_ERROR");
    }
  }

  if (steps >= maxSteps) {
    return failRun(new Error(`Max steps (${maxSteps}) exceeded`), "MAX_STEPS");
  }

  // Determine final status
  const status: RunStatus = abortSignal.aborted ? "cancelled" : "completed";

  // Get output from "output" channel or last terminal node's output channel
  const output = getChannel(channels, "output") ?? getLastTerminalOutput(compiledGraph, channels);

  return { status, channels, history, output };

  function failRun(error: Error, code: string): SchedulerResult {
    return {
      status: "failed",
      channels,
      history,
      error: { message: error.message, code, cause: error },
    };
  }
}

/**
 * Execute a node with retry policy.
 */
export async function executeWithRetry(
  node: import("../graph/types.js").GraphNode,
  executor: NodeExecutor,
  context: ExecutionContext,
  retryPolicy?: import("../graph/types.js").RetryPolicy,
): Promise<NodeResult> {
  const maxAttempts = retryPolicy?.maxAttempts ?? 1;
  const backoffMs = retryPolicy?.backoffMs ?? 100;
  const jitter = retryPolicy?.jitter ?? false;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Update context with current attempt
    context.attempt = attempt;
    try {
      const result = await executor.execute(node, context);
      return result;
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        const delay = backoffMs * Math.pow(2, attempt - 1) + (jitter ? Math.random() * backoffMs : 0);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError!;
}

/** Extract input channels for a node (for history). */
function getNodeInput(
  node: import("../graph/types.js").GraphNode,
  channels: Map<string, { value: unknown; version: number }>,
): Record<string, unknown> {
  const config = node.config ?? {};
  const inputChannels: string[] = (config.inputChannels as string[]) ?? ["input"];
  const input: Record<string, unknown> = {};
  for (const ch of inputChannels) {
    input[ch] = getChannel(channels, ch);
  }
  return input;
}

/** Get output from last terminal node's default output channel. */
export function getLastTerminalOutput(
  compiledGraph: CompiledGraph,
  channels: Map<string, { value: unknown; version: number }>,
): unknown {
  for (const terminalId of compiledGraph.terminalNodeIds) {
    const val = getChannel(channels, terminalId);
    if (val !== undefined) return val;
  }
  return getChannel(channels, "input");
}