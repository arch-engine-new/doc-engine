/**
 * RunManager: in-memory run lifecycle and metadata store.
 *
 * Why: Centralizes run state (created→running→completed/failed/cancelled),
 * provides getRun/cancelRun, and integrates compileGraph + scheduler.
 * Supports checkpoint-based crash recovery (Task 5).
 */

import { compileGraph, GraphCompileError } from "../graph/compiler.js";
import type { CompiledGraph, GraphDefinition } from "../graph/types.js";
import { runGraph, type SchedulerOptions, type SchedulerResult } from "./scheduler.js";
import type { RunMetadata, RunStatus, NodeExecutionRecord, ExecutionContext, ChannelMap } from "./state.js";
import type { StateStore } from "../persistence/types.js";
import { CheckpointService, type ResumeResult } from "./checkpoint-service.js";
import { BUILTIN_EXECUTORS, getExecutor, type NodeExecutor, type NodeResult, BranchExecutor } from "./node-executors.js";
import { executeWithRetry } from "./scheduler.js";
import { mergeChannels, getChannel, serializeChannels, createInitialChannels } from "./state.js";
import { ToolRuntime, getDefaultRegistry } from "../tools/runtime.js";
import { getLastTerminalOutput } from "./scheduler.js";
import type { HitlGateway, HitlDecision } from "../hitl/gateway.js";
import { getDefaultLlmProvider } from "../llm/provider.js";

/** In-memory run store entry. */
interface RunEntry {
  metadata: RunMetadata;
  abortController: AbortController;
  schedulerPromise: Promise<SchedulerResult>;
  hitlGateway?: HitlGateway;
  schedulerOptions?: SchedulerOptions;
  channels: ChannelMap;
  store?: StateStore;
}

/** Options for starting a run. */
export interface StartRunOptions {
  /** Initial input to the graph (becomes "input" channel). */
  input: unknown;
  /** Optional run ID (generated if omitted). */
  runId?: string;
  /** Scheduler options (executors, callbacks, maxSteps). */
  schedulerOptions?: SchedulerOptions;
  /** If true, compile the graph definition first (default: true). */
  compile?: boolean;
  /** If true, resume from latest checkpoint for the given runId. */
  resume?: boolean;
  /** StateStore for persistence (required if resume=true). */
  store?: StateStore;
  /** Optional thread ID for conversation grouping. */
  threadId?: string;
  /** HITL gateway for human-in-the-loop interrupts. */
  hitlGateway?: HitlGateway;
}

/** Result of startRun. */
export interface StartRunResult {
  runId: string;
  status: RunStatus;
}

/** RunManager manages the lifecycle of graph executions. */
export class RunManager {
  private runs = new Map<string, RunEntry>();
  private graphCache = new Map<string, CompiledGraph>();

  /**
   * Start a new run for a graph definition or compiled graph.
   * Compiles if needed, creates run metadata, kicks off scheduler.
   * If resume=true and runId exists, loads latest checkpoint and continues from next ready node.
   */
  async startRun(
    graph: GraphDefinition | CompiledGraph,
    options: StartRunOptions,
  ): Promise<StartRunResult> {
    const runId = options.runId ?? `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;

    // Get or compile graph
    let compiledGraph: CompiledGraph;
    if ("definition" in graph) {
      // Already a CompiledGraph
      compiledGraph = graph;
      // Cache by graphId
      this.graphCache.set(compiledGraph.graphId, compiledGraph);
    } else {
      // GraphDefinition - compile (or use cached)
      const cacheKey = graph.graphId ?? "anonymous";
      if (this.graphCache.has(cacheKey) && options.compile !== false) {
        compiledGraph = this.graphCache.get(cacheKey)!;
      } else {
        compiledGraph = compileGraph(graph);
        this.graphCache.set(compiledGraph.graphId, compiledGraph);
      }
    }

    // Create abort controller for cancellation
    const abortController = new AbortController();

    // Initialize metadata
    const now = new Date().toISOString();
    const metadata: RunMetadata = {
      runId,
      graphId: compiledGraph.graphId,
      threadId: options.threadId ?? null,
      status: "created",
      createdAt: now,
      input: options.input,
      nodeHistory: [],
    };

    // Initialize channels
    const channels = createInitialChannels(options.input);

    // Create scheduler promise (starts immediately)
    const schedulerPromise = this.runScheduler(compiledGraph, metadata, abortController.signal, options);

    // Store run entry
    const entry: RunEntry = {
      metadata,
      abortController,
      schedulerPromise,
      hitlGateway: options.hitlGateway,
      schedulerOptions: options.schedulerOptions,
      channels,
      store: options.store,
    };
    this.runs.set(runId, entry);

    // Update channels when scheduler completes or pauses
    schedulerPromise.then((result) => {
      entry.channels = result.channels;
      metadata.status = result.status;
      if (result.status !== "running" && result.status !== "waiting_hitl") {
        metadata.finishedAt = new Date().toISOString();
      }
      metadata.nodeHistory = result.history;
      metadata.output = result.output;
      if (result.error) {
        metadata.error = result.error;
      }
    });

    // Update status to running
    metadata.status = "running";
    metadata.startedAt = new Date().toISOString();

    return { runId, status: "running" };
  }

  /**
   * Internal: run scheduler and update metadata on completion.
   * Handles resume from checkpoint if options.resume is true.
   */
  private async runScheduler(
    compiledGraph: CompiledGraph,
    metadata: RunMetadata,
    abortSignal: AbortSignal,
    options: StartRunOptions,
  ): Promise<SchedulerResult> {
    // Pass runId into context via metadata reference
    metadata.runId = metadata.runId; // already set

    // Prepare checkpoint service if store provided
    let checkpointService: CheckpointService | undefined;
    if (options.store) {
      checkpointService = new CheckpointService(options.store);
    }

    // If resuming, load checkpoint and restore state
    let resumeResult: ResumeResult | null = null;
    if (options.resume && options.store && checkpointService) {
      resumeResult = await checkpointService.resume(metadata.runId, compiledGraph);
    }

    // Prepare scheduler options with checkpoint integration
    const schedulerOptions: SchedulerOptions = {
      ...options.schedulerOptions,
      checkpointService,
      runId: metadata.runId,
      hitlGateway: options.hitlGateway,
      getCompiledGraph: (graphId) => this.graphCache.get(graphId),
      llmProvider: options.schedulerOptions?.llmProvider ?? getDefaultLlmProvider(),
    };

    // If we have a resume result, we need to run a modified scheduler that skips completed nodes
    if (resumeResult) {
      return this.runSchedulerWithResume(
        compiledGraph,
        metadata,
        abortSignal,
        schedulerOptions,
        resumeResult,
      );
    }

    // Normal execution (no resume)
    const result = await runGraph(compiledGraph, options.input, abortSignal, schedulerOptions);

    // Update metadata with final state
    metadata.status = result.status;
    metadata.finishedAt = new Date().toISOString();
    metadata.nodeHistory = result.history;
    metadata.output = result.output;
    if (result.error) {
      metadata.error = result.error;
    }

    return result;
  }

  /**
   * Run scheduler with resume capability: skip already completed nodes.
   * Uses restored channels and history from checkpoint.
   * For completed branch nodes, re-evaluates condition to determine taken path.
   * If hitlNodeId is provided, treats all its successors as ready (for HITL resume).
   */
  private async runSchedulerWithResume(
    compiledGraph: CompiledGraph,
    metadata: RunMetadata,
    abortSignal: AbortSignal,
    schedulerOptions: SchedulerOptions,
    resumeResult: ResumeResult,
    hitlNodeId?: string,
  ): Promise<SchedulerResult> {
    const {
      maxSteps = 1000,
      executors = new Map(),
      onNodeComplete,
      onNodeError,
      checkpointService,
      runId,
      hitlGateway,
    } = schedulerOptions;

    // Merge custom executors with built-ins (custom wins)
    const executorMap = new Map(BUILTIN_EXECUTORS);
    for (const [key, value] of executors) {
      executorMap.set(key, value);
    }

    // Initialize state from resume
    const channels = resumeResult.channels;
    const history = [...resumeResult.history];
    let steps = 0;
    let seq = resumeResult.nextSeq;
    const completedArray = resumeResult.completedNodeIds;
    const completed = new Set(completedArray);

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

    // Ready queue: nodes with in-degree 0 that are NOT already completed
    const ready = new Set<string>();
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0 && !completed.has(nodeId)) {
        ready.add(nodeId);
      }
    }

    // Process completed nodes to decrement in-degree of their ACTUAL taken successors
    // For branch nodes, re-evaluate condition using restored channels to find taken edge.
    // For other nodes, only successors that are also completed were on the taken path.
    for (const completedNodeId of completedArray) {
      const node = compiledGraph.nodes.get(completedNodeId);
      if (!node) continue;

      let actualSuccessors: string[] = [];
      if (node.type === "branch") {
        // Re-evaluate branch condition using restored channel state
        const branchExecutor = executorMap.get("branch") as BranchExecutor | undefined;
        if (branchExecutor && node.config?.condition) {
          // Create a temporary context with restored channels for condition evaluation
          const tempContext: ExecutionContext = {
            compiledGraph,
            channels,
            metadata: {
              runId: metadata.runId,
              graphId: compiledGraph.graphId,
              status: "running",
              createdAt: metadata.createdAt,
              input: metadata.input,
              nodeHistory: history,
            },
            abortSignal,
            runId: metadata.runId,
            threadId: metadata.threadId ?? undefined,
            nodeExecutionId: undefined,
            attempt: 1,
          };
          try {
            const channelValues = serializeChannels(channels);
            const conditionFn = node.config?.condition as ((channels: Record<string, unknown>, context: ExecutionContext) => string | Promise<string>) | undefined;
            if (!conditionFn) throw new Error("No condition function");
            const conditionResult = await conditionFn(channelValues, tempContext);
            // Find matching edge
            const edges = compiledGraph.edges.filter((e) => e.from === completedNodeId && !e.onError);
            for (const edge of edges) {
              if (edge.condition === undefined) {
                if (!actualSuccessors.length) actualSuccessors = [edge.to];
              } else if (edge.condition === conditionResult) {
                actualSuccessors = [edge.to];
                break;
              }
            }
          } catch {
            // If condition evaluation fails, fall back to completed successors
            const allSuccessors = adjacency.get(completedNodeId) ?? [];
            actualSuccessors = allSuccessors.filter((s) => completed.has(s));
          }
        } else {
          // No condition function, fall back to completed successors
          const allSuccessors = adjacency.get(completedNodeId) ?? [];
          actualSuccessors = allSuccessors.filter((s) => completed.has(s));
        }
      } else {
        // Non-branch nodes: only successors that are also completed were on the taken path
        const allSuccessors = adjacency.get(completedNodeId) ?? [];
        // If this is the HITL node, all its successors should be treated as taken
        if (hitlNodeId && completedNodeId === hitlNodeId) {
          actualSuccessors = [...allSuccessors];
        } else {
          actualSuccessors = [...allSuccessors].filter((s) => completed.has(s));
        }
      }

      for (const nextId of actualSuccessors) {
        const newDegree = (inDegree.get(nextId) ?? 1) - 1;
        inDegree.set(nextId, newDegree);
        if (newDegree === 0 && !completed.has(nextId)) {
          ready.add(nextId);
        }
      }
    }

    // Execution context
    const context: ExecutionContext = {
      compiledGraph,
      channels,
      metadata: {
        runId: metadata.runId,
        graphId: compiledGraph.graphId,
        status: "running",
        createdAt: metadata.createdAt,
        input: metadata.input,
        nodeHistory: history,
      },
      abortSignal,
      runId: metadata.runId,
      threadId: metadata.threadId ?? undefined,
      nodeExecutionId: undefined,
      attempt: 1,
    };

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
      if (node.type === "hitl" && hitlGateway && runId) {
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

        // Write checkpoint for HITL pause
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
        schedulerOptions.onHitlInterrupt?.({ token, nodeId, payload: interrupt.payload });

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
          if (newDegree === 0 && !completed.has(nextId)) {
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

    // Update metadata with final state
    metadata.status = status;
    metadata.finishedAt = new Date().toISOString();
    metadata.nodeHistory = history;
    metadata.output = output;

    return { status, channels, history, output };

    function failRun(error: Error, code: string): SchedulerResult {
      metadata.status = "failed";
      metadata.finishedAt = new Date().toISOString();
      metadata.nodeHistory = history;
      metadata.error = { message: error.message, code, cause: error };
      return {
        status: "failed",
        channels,
        history,
        error: { message: error.message, code, cause: error },
      };
    }
  }

  /**
   * Get run metadata by ID (does not wait for completion).
   * Includes hitlInterrupt if status is "waiting_hitl".
   */
  getRun(runId: string): RunMetadata | undefined {
    const entry = this.runs.get(runId);
    if (!entry) return undefined;
    const metadata = entry.metadata;
    // If waiting_hitl, include hitlInterrupt info from scheduler result if available
    if (metadata.status === "waiting_hitl") {
      // The hitlInterrupt info is in the scheduler result, which we can't easily access here
      // For now, return metadata as-is; the caller can use waitForRun to get full result
    }
    return metadata;
  }

  /**
   * Wait for a run to complete and return full result.
   */
  async waitForRun(runId: string): Promise<SchedulerResult | undefined> {
    const entry = this.runs.get(runId);
    if (!entry) return undefined;
    return entry.schedulerPromise;
  }

  /**
   * Cancel a running run by ID.
   * Returns true if run was found and cancellation requested.
   */
  cancelRun(runId: string): boolean {
    const entry = this.runs.get(runId);
    if (!entry) return false;

    if (entry.metadata.status === "running") {
      entry.abortController.abort();
      entry.metadata.status = "cancelled";
      entry.metadata.finishedAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  /**
   * List all runs (optionally filtered by status).
   */
  listRuns(status?: RunStatus): RunMetadata[] {
    const all = [...this.runs.values()].map((e) => e.metadata);
    return status ? all.filter((m) => m.status === status) : all;
  }

  /**
   * Delete a run from memory (for cleanup).
   */
  deleteRun(runId: string): boolean {
    return this.runs.delete(runId);
  }

  /**
   * Clear all runs and graph cache.
   */
  clear(): void {
    this.runs.clear();
    this.graphCache.clear();
  }

  /**
   * Get cached compiled graph by ID.
   */
  getCompiledGraph(graphId: string): CompiledGraph | undefined {
    return this.graphCache.get(graphId);
  }

  /**
   * Pre-compile and cache a graph definition.
   */
  compileAndCache(def: GraphDefinition): CompiledGraph {
    const compiled = compileGraph(def);
    this.graphCache.set(compiled.graphId, compiled);
    return compiled;
  }

  /**
   * Remove a graph from cache.
   */
  evictGraph(graphId: string): boolean {
    return this.graphCache.delete(graphId);
}

/**
 * Resume a run that is waiting on a HITL interrupt.
 *
 * Loads the interrupt by token, verifies it matches the runId,
 * marks it as resumed with the human decision, and continues
 * execution from the node after the HITL node by loading the
 * latest checkpoint and injecting the decision into channels.
 *
 * @param runId - Run identifier
 * @param token - HITL interrupt token from createInterrupt
 * @param decision - Human decision (action, optional data)
 * @returns Scheduler result (completed/failed/cancelled/waiting_hitl)
 */
async resumeHitl(
  runId: string,
  token: string,
  decision: HitlDecision,
): Promise<SchedulerResult | undefined> {
  const entry = this.runs.get(runId);
  if (!entry) {
    throw new Error(`Run not found: ${runId}`);
  }

  // Get hitlGateway and store from entry
  const hitlGateway = entry.hitlGateway;
  const store = entry.store;
  if (!hitlGateway || !store) {
    throw new Error(`Run ${runId} has no HITL gateway or store configured`);
  }

  // Get the interrupt and verify it matches
  const interrupt = await hitlGateway.getInterrupt(token);
  if (!interrupt) {
    throw new Error(`HITL interrupt not found for token: ${token}`);
  }
  if (interrupt.runId !== runId) {
    throw new Error(`HITL interrupt token does not match runId`);
  }

  // Idempotent: if interrupt already resumed, return current run result
  if (interrupt.status === "resumed") {
    return entry.schedulerPromise;
  }

  if (interrupt.status !== "pending") {
    throw new Error(`HITL interrupt already ${interrupt.status}`);
  }
  if (interrupt.expiresAt && new Date(interrupt.expiresAt) < new Date()) {
    // Mark as expired in the gateway
    await hitlGateway.updateHitlInterrupt(token, { status: "expired", updatedAt: new Date().toISOString() });
    throw new Error(`HITL interrupt expired`);
  }

  // Verify run is in waiting_hitl state (for fresh resume)
  if (entry.metadata.status !== "waiting_hitl") {
    throw new Error(`Run ${runId} is not waiting for HITL (status: ${entry.metadata.status})`);
  }

  // Mark interrupt as resumed (idempotent)
  const resumed = await hitlGateway.resume(token, decision);
  if (!resumed) {
    throw new Error(`Failed to resume HITL interrupt`);
  }

  // Get the compiled graph
  const compiledGraph = this.graphCache.get(entry.metadata.graphId);
  if (!compiledGraph) {
    throw new Error(`Compiled graph not found for run ${runId}`);
  }

  // Load the latest checkpoint (should be the hitl_waiting one)
  const checkpointService = new CheckpointService(entry.store!);
  const resumeResult = await checkpointService.resume(runId, compiledGraph);
  if (!resumeResult) {
    throw new Error(`No checkpoint found for run ${runId}`);
  }

  // Inject the HITL decision into channels so downstream nodes can access it
  const hitlNodeId = interrupt.nodeId;
  mergeChannels(resumeResult.channels, {
    [`hitl_decision_${hitlNodeId}`]: decision,
    [`hitl_token_${hitlNodeId}`]: token,
    [`hitl_resumed_at_${hitlNodeId}`]: new Date().toISOString(),
  });

  // Create new abort controller for the resumed run
  const abortController = new AbortController();
  entry.abortController = abortController;

  // Prepare scheduler options
  const schedulerOptions: SchedulerOptions = {
    ...entry.schedulerOptions,
    checkpointService,
    runId: entry.metadata.runId,
    hitlGateway,
  };

  // Run scheduler with resume (uses checkpoint data + injected decision)
  const result = await this.runSchedulerWithResume(
    compiledGraph,
    entry.metadata,
    abortController.signal,
    schedulerOptions,
    resumeResult,
    hitlNodeId,
  );

  // Update entry with new scheduler promise and metadata
  entry.schedulerPromise = Promise.resolve(result);
  entry.channels = result.channels;

  return result;
}
}

/** Extract input channels for a node (for history). */
function getNodeInput(
  node: import("../graph/types.js").GraphNode,
  channels: ChannelMap,
): Record<string, unknown> {
  const config = node.config ?? {};
  const inputChannels: string[] = (config.inputChannels as string[]) ?? ["input"];
  const input: Record<string, unknown> = {};
  for (const ch of inputChannels) {
    input[ch] = getChannel(channels, ch);
  }
  return input;
}

/** Default singleton instance for convenience. */
export const defaultRunManager = new RunManager();

/**
 * Convenience function: compile + run in one call using default manager.
 * Returns runId immediately; use waitForRun to get result.
 */
export async function startRun(
  graph: GraphDefinition | CompiledGraph,
  options: StartRunOptions,
): Promise<StartRunResult> {
  return defaultRunManager.startRun(graph, options);
}

/**
 * Convenience: get run metadata from default manager.
 */
export function getRun(runId: string): RunMetadata | undefined {
  return defaultRunManager.getRun(runId);
}

/**
 * Convenience: cancel run via default manager.
 */
export function cancelRun(runId: string): boolean {
  return defaultRunManager.cancelRun(runId);
}

/**
 * Convenience: wait for run via default manager.
 */
export async function waitForRun(runId: string): Promise<SchedulerResult | undefined> {
  return defaultRunManager.waitForRun(runId);
}

/** Re-export GraphCompileError for callers. */
export { GraphCompileError } from "../graph/compiler.js";