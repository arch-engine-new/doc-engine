/**
 * In-memory serial scheduler for compiled graphs.
 *
 * Why: Uses Kahn's algorithm to compute ready set from precomputed adjacency.
 * Default: serial (one ready node per step). Optional parallelExecution runs
 * the entire ready set as a batch (fan-out); fan-in uses in-degree barriers.
 * Supports HITL (Human-in-the-Loop) nodes that pause execution awaiting human input.
 */

import type { CompiledGraph } from "../graph/types.js";
import type { ExecutionContext, NodeExecutionRecord, RunStatus } from "./state.js";
import { getExecutor, type NodeExecutor, type NodeResult, BUILTIN_EXECUTORS } from "./node-executors.js";
import { createInitialChannels, mergeChannels, getChannel, serializeChannels } from "./state.js";
import type { CheckpointService, WriteCheckpointOptions } from "./checkpoint-service.js";
import type { HitlGateway } from "../hitl/gateway.js";
import type { LlmProvider } from "../llm/provider.js";
import type { CompiledGraph as CompiledGraphType } from "../graph/types.js";

/** Scheduler options. */
export interface SchedulerOptions {
  /** Maximum total nodes to execute before forcing halt (safety). */
  maxSteps?: number;
  /** Custom executor map (merged with built-ins). */
  executors?: Map<string, NodeExecutor>;
  /** Called when a node starts executing (for observability). */
  onNodeStart?: (record: NodeExecutionRecord) => Promise<void> | void;
  /** Called after each node completes (for observability). */
  onNodeComplete?: (record: NodeExecutionRecord) => Promise<void> | void;
  /** Called if a node fails (for observability/retry). */
  onNodeError?: (record: NodeExecutionRecord, error: Error) => Promise<void> | void;
  /** Called when a checkpoint is written (for observability). */
  onCheckpoint?: (checkpoint: { runId: string; seq: number; nodeId: string | null; phase: string; metadata?: Record<string, unknown> }) => Promise<void> | void;
  /** Optional checkpoint service for crash recovery. */
  checkpointService?: CheckpointService;
  /** Run ID for checkpointing (required if checkpointService provided). */
  runId?: string;
  // HITL gateway for human-in-the-loop interrupts.
  hitlGateway?: HitlGateway;
  /** Called when a HITL interrupt is created (run pauses). */
  onHitlInterrupt?: (interrupt: { token: string; nodeId: string; payload: unknown }) => Promise<void> | void;
  /** Called when the run completes (completed/failed/cancelled). */
  onRunComplete?: (result: SchedulerResult) => Promise<void> | void;
  /**
   * When true, all nodes in the current ready set run concurrently (fan-out batch).
   * Fan-in join nodes still wait until all predecessors complete (in-degree barrier).
   * HITL nodes always run alone (never batched).
   */
  parallelExecution?: boolean;
  /** Resolve nested graphs for subgraph nodes. */
  getCompiledGraph?: (graphId: string) => CompiledGraphType | undefined;
  /** LLM provider for llm nodes (defaults to FakeLlmProvider). */
  llmProvider?: LlmProvider;
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
    onNodeStart,
    onNodeComplete,
    onNodeError,
    onCheckpoint,
    checkpointService,
    runId,
    hitlGateway,
    onHitlInterrupt,
    parallelExecution = false,
    getCompiledGraph,
    llmProvider,
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
  const seqRef = { value: 0 };

  // Build in-degree map
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
    getCompiledGraph,
    llmProvider,
  };

  const completed = new Set<string>();

  // Write initial checkpoint (before any node executes)
  if (checkpointService && runId) {
    await checkpointService.write({
      runId,
      seq: seqRef.value++,
      nodeId: null,
      channels,
      metadata: { phase: "initial" },
    });

    if (onCheckpoint) {
      await onCheckpoint({
        runId,
        seq: seqRef.value - 1,
        nodeId: null,
        phase: "initial",
      });
    }
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

    const sortedReady = [...ready].sort();
    let batch: string[];
    if (parallelExecution && sortedReady.length > 1) {
      const hasHitl = sortedReady.some((id) => compiledGraph.nodes.get(id)?.type === "hitl");
      batch = hasHitl ? [sortedReady[0]!] : sortedReady;
    } else {
      batch = [sortedReady[0]!];
    }
    for (const id of batch) ready.delete(id);

    if (parallelExecution && batch.length > 1) {
      const batchResults = await Promise.all(
        batch.map((nodeId) =>
          executeReadyNode(nodeId, {
            compiledGraph,
            channels,
            history,
            context,
            executorMap,
            adjacency,
            inDegree,
            ready,
            completed,
            checkpointService,
            runId,
            hitlGateway,
            onNodeStart,
            onNodeComplete,
            onNodeError,
            onCheckpoint,
            onHitlInterrupt,
            seqRef,
          }),
        ),
      );
      for (const br of batchResults) {
        if (br.kind === "return") return br.result;
        if (br.kind === "halt") break;
      }
      steps += batch.length;
      continue;
    }

    const nodeId = batch[0]!;
    const single = await executeReadyNode(nodeId, {
      compiledGraph,
      channels,
      history,
      context,
      executorMap,
      adjacency,
      inDegree,
      ready,
      completed,
      checkpointService,
      runId,
      hitlGateway,
      onNodeStart,
      onNodeComplete,
      onNodeError,
      onCheckpoint,
      onHitlInterrupt,
      seqRef,
    });
    if (single.kind === "return") return single.result;
    if (single.kind === "halt") break;
    steps++;
    continue;
  }

  if (steps >= maxSteps) {
    return failRun(new Error(`Max steps (${maxSteps}) exceeded`), "MAX_STEPS");
  }

  const status: RunStatus = abortSignal.aborted ? "cancelled" : "completed";
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

type NodeStepOutcome =
  | { kind: "continue"; seq: number }
  | { kind: "halt"; seq: number }
  | { kind: "return"; result: SchedulerResult };

interface ExecuteReadyNodeParams {
  compiledGraph: CompiledGraph;
  channels: Map<string, { value: unknown; version: number }>;
  history: NodeExecutionRecord[];
  context: ExecutionContext;
  executorMap: Map<string, NodeExecutor>;
  adjacency: ReadonlyMap<string, readonly string[]>;
  inDegree: Map<string, number>;
  ready: Set<string>;
  completed: Set<string>;
  checkpointService?: CheckpointService;
  runId?: string;
  hitlGateway?: HitlGateway;
  onNodeStart?: SchedulerOptions["onNodeStart"];
  onNodeComplete?: SchedulerOptions["onNodeComplete"];
  onNodeError?: SchedulerOptions["onNodeError"];
  onCheckpoint?: SchedulerOptions["onCheckpoint"];
  onHitlInterrupt?: SchedulerOptions["onHitlInterrupt"];
  seqRef: { value: number };
}

async function executeReadyNode(
  nodeId: string,
  params: ExecuteReadyNodeParams,
): Promise<NodeStepOutcome> {
  const {
    compiledGraph,
    channels,
    history,
    context,
    executorMap,
    adjacency,
    inDegree,
    ready,
    completed,
    checkpointService,
    runId,
    hitlGateway,
    onNodeStart,
    onNodeComplete,
    onNodeError,
    onCheckpoint,
    onHitlInterrupt,
    seqRef,
  } = params;

  let seq = seqRef.value;
  const node = compiledGraph.nodes.get(nodeId)!;

  const failStep = (error: Error, code: string): NodeStepOutcome => ({
    kind: "return",
    result: {
      status: "failed",
      channels,
      history,
      error: { message: error.message, code, cause: error },
    },
  });

  if (node.type === "hitl") {
    if (!hitlGateway || !runId) {
      return failStep(
        new Error(`HITL node "${nodeId}" requires hitlGateway and runId in options`),
        "HITL_CONFIG_MISSING",
      );
    }
    const config = node.config ?? {};
    const payload = config.payload ?? { nodeId, message: "Human input required" };
    const { token, interrupt } = await hitlGateway.createInterrupt(runId, nodeId, payload);

    const record: NodeExecutionRecord = {
      nodeId,
      nodeType: "hitl",
      startedAt: new Date().toISOString(),
      status: "running",
      input: getNodeInput(node, channels),
      attempt: 1,
    };
    history.push(record);

    if (checkpointService) {
      await checkpointService.write({
        runId,
        seq: seq++,
        nodeId,
        channels,
        metadata: { phase: "hitl_waiting", hitlToken: token, hitlNodeId: nodeId, completedNodes: [...completed, nodeId] },
      });
      if (onCheckpoint) {
        await onCheckpoint({
          runId,
          seq: seq - 1,
          nodeId,
          phase: "hitl_waiting",
          metadata: { hitlToken: token, hitlNodeId: nodeId, completedNodes: [...completed, nodeId] },
        });
      }
    }

    onHitlInterrupt?.({ token, nodeId, payload: interrupt.payload });
    seqRef.value = seq;

    return {
      kind: "return",
      result: {
        status: "waiting_hitl",
        channels,
        history,
        hitlInterrupt: {
          token,
          nodeId,
          payload: interrupt.payload,
          expiresAt: interrupt.expiresAt,
        },
      },
    };
  }

  const executor = executorMap.get(node.type);
  if (!executor) {
    return failStep(new Error(`No executor for node type "${node.type}"`), "NO_EXECUTOR");
  }

  const record: NodeExecutionRecord = {
    nodeId,
    nodeType: node.type,
    startedAt: new Date().toISOString(),
    status: "running",
    input: getNodeInput(node, channels),
    attempt: 1,
  };
  history.push(record);

  if (onNodeStart) {
    await onNodeStart(record);
  }

  try {
    const result = await executeWithRetry(node, executor, context, node.retry);

    record.finishedAt = new Date().toISOString();
    record.status = "completed";
    record.output = result.updates;
    mergeChannels(channels, result.updates);

    if (checkpointService && runId) {
      await checkpointService.write({
        runId,
        seq: seq++,
        nodeId,
        channels,
        metadata: { phase: "node_complete", completedNodes: [...completed, nodeId] },
      });
      if (onCheckpoint) {
        await onCheckpoint({
          runId,
          seq: seq - 1,
          nodeId,
          phase: "node_complete",
          metadata: { completedNodes: [...completed, nodeId] },
        });
      }
    }

    const nextNodes =
      result.nextNodeIds && result.nextNodeIds.length > 0 ? result.nextNodeIds : (adjacency.get(nodeId) ?? []);

    for (const nextId of nextNodes) {
      const newDegree = (inDegree.get(nextId) ?? 1) - 1;
      inDegree.set(nextId, newDegree);
      if (newDegree === 0) {
        ready.add(nextId);
      }
    }

    completed.add(nodeId);

    if (onNodeComplete) {
      await onNodeComplete(record);
    }

    seqRef.value = seq;

    if (result.halt || node.type === "end") {
      return { kind: "halt", seq };
    }

    return { kind: "continue", seq };
  } catch (error) {
    record.finishedAt = new Date().toISOString();
    record.status = "failed";
    record.error = { message: (error as Error).message, code: (error as Error & { code?: string }).code };

    if (onNodeError) {
      await onNodeError(record, error as Error);
    }

    const errorEdges = compiledGraph.edges.filter((e) => e.from === nodeId && e.onError);
    if (errorEdges.length > 0) {
      ready.add(errorEdges[0]!.to);
      seqRef.value = seq;
      return { kind: "continue", seq };
    }

    return failStep(error as Error, "NODE_ERROR");
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