/**
 * ControlPlane: In-process control API for agent-runtime.
 *
 * Why: Provides a clean programmatic interface for compiling graphs,
 * starting/managing runs, HITL resumption, and trace retrieval.
 * This is the primary API for embedders and the HTTP adapter.
 */

import { compileGraph, GraphCompileError } from "../graph/compiler.js";
import type { CompiledGraph, GraphDefinition } from "../graph/types.js";
import { RunManager, type StartRunOptions } from "../runtime/run-manager.js";
import type { SchedulerResult, SchedulerOptions } from "../runtime/scheduler.js";
import type { RunMetadata, RunStatus, NodeExecutionRecord } from "../runtime/state.js";
import type { StateStore } from "../persistence/types.js";
import { SQLiteStateStore } from "../persistence/sqlite-store.js";
import { HitlGateway, type HitlDecision, createHitlGateway } from "../hitl/gateway.js";
import { EventLog, type EventRow, type EventType, createEventLog } from "../obs/event-log.js";
import type { CheckpointService } from "../runtime/checkpoint-service.js";
import { ToolExecutor } from "../runtime/node-executors.js";
import { ToolRuntime, getDefaultRegistry } from "../tools/runtime.js";

/** Result of compiling a graph. */
export interface CompileResult {
  /** Unique graph identifier. */
  graphId: string;
  /** The compiled graph. */
  compiled: CompiledGraph;
}

/** View of a run returned by the control plane. */
export interface RunView {
  /** Run metadata. */
  metadata: RunMetadata;
  /** Event trace. */
  trace: EventRow[];
}

/** Options for starting a run via control plane. */
export interface StartRunControlOptions {
  /** Graph identifier (must be compiled first). */
  graphId: string;
  /** Initial input to the graph. */
  input: unknown;
  /** Optional run ID (generated if omitted). */
  runId?: string;
  /** Optional thread ID for conversation grouping. */
  threadId?: string;
  /** If true, resume from latest checkpoint. */
  resume?: boolean;
  /** StateStore for persistence (required if resume=true). */
  store?: StateStore;
  /** HITL gateway for human-in-the-loop interrupts. */
  hitlGateway?: HitlGateway;
}

/** Result of starting a run. */
export interface StartRunResult {
  /** Unique run identifier. */
  runId: string;
  /** Initial run status. */
  status: RunStatus;
  /** HITL interrupt info if run paused at HITL node. */
  hitlInterrupt?: {
    token: string;
    nodeId: string;
    payload: unknown;
    expiresAt: string | null;
  };
}

/** Options for HITL resume. */
export interface ResumeHitlOptions {
  /** Run identifier. */
  runId: string;
  /** HITL interrupt token. */
  token: string;
  /** Human decision. */
  decision: HitlDecision;
}

/** Result of HITL resume. */
export interface ResumeHitlResult {
  /** Updated run status. */
  status: RunStatus;
  /** Scheduler result if run completed. */
  result?: SchedulerResult;
}

/** Options for listing runs from store. */
export interface ListRunsFromStoreOptions {
  /** Filter by graph ID. */
  graphId?: string;
  /** Filter by status. */
  status?: RunStatus;
  /** Maximum number of results. */
  limit?: number;
  /** Offset for pagination. */
  offset?: number;
}

/** ControlPlane class - main in-process API. */
export class ControlPlane {
  private runManager: RunManager;
  private eventLog: EventLog;
  private graphCache = new Map<string, CompiledGraph>();
  private store?: StateStore;
  private hitlGateway?: HitlGateway;

  /**
   * Create a ControlPlane.
   * @param runManager - RunManager instance
   * @param eventLog - EventLog instance
   * @param store - Optional StateStore for persistence
   * @param hitlGateway - Optional HitlGateway for HITL support
   */
  constructor(
    runManager: RunManager,
    eventLog: EventLog,
    store?: StateStore,
    hitlGateway?: HitlGateway,
  ) {
    this.runManager = runManager;
    this.eventLog = eventLog;
    this.store = store;
    this.hitlGateway = hitlGateway;
  }

  /**
   * Get the underlying RunManager.
   */
  getRunManager(): RunManager {
    return this.runManager;
  }

  /**
   * Get the underlying EventLog.
   */
  getEventLog(): EventLog {
    return this.eventLog;
  }

  /**
   * Compile a graph definition and cache it.
   *
   * @param def - Graph definition to compile (wrapped in { definition })
   * @returns CompileResult with graphId and compiled graph
   * @throws GraphCompileError if compilation fails
   */
  compileGraph(def: { definition: GraphDefinition }): CompileResult {
    const compiled = compileGraph(def.definition);
    this.graphCache.set(compiled.graphId, compiled);

    // Also cache in runManager for consistency
    this.runManager.compileAndCache(def.definition);

    return { graphId: compiled.graphId, compiled };
  }

  /**
   * Get a cached compiled graph by ID.
   *
   * @param graphId - Graph identifier
   * @returns CompiledGraph or undefined if not cached
   */
  getCompiledGraph(graphId: string): CompiledGraph | undefined {
    return this.graphCache.get(graphId) ?? this.runManager.getCompiledGraph(graphId);
  }

  /**
   * Start a new run for a compiled graph.
   *
   * @param options - Run start options
   * @returns Run ID, initial status, and HITL interrupt if paused
   * @throws Error if graphId not found
   */
  async startRun(options: StartRunControlOptions): Promise<StartRunResult> {
    const { graphId, input, runId, threadId, resume, store, hitlGateway } = options;

    // Get compiled graph
    const compiledGraph = this.getCompiledGraph(graphId);
    if (!compiledGraph) {
      throw new Error(`Graph not found: ${graphId}. Call compileGraph first.`);
    }

    // Use provided store or fallback to control plane store
    const effectiveStore = store ?? this.store;
    const effectiveHitlGateway = hitlGateway ?? this.hitlGateway;

    // Generate runId early so we can use it in callbacks
    const actualRunId = runId ?? `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;

    // Emit run_started event
    await this.eventLog.append({
      runId: actualRunId,
      eventType: "run_started" as EventType,
      payload: { graphId, input, threadId },
    });

    // Persist the run row up front so listRunsFromStore and queries see it
    if (effectiveStore) {
      const now = new Date().toISOString();
      await effectiveStore.createRun({
        runId: actualRunId,
        graphId,
        threadId: threadId ?? null,
        status: "running",
        inputJson: input,
        outputJson: null,
        errorJson: null,
        currentNodeId: null,
        parentRunId: null,
        startedAt: now,
        finishedAt: null,
      });
    }

    // Create checkpoint service if store provided
    let checkpointService: CheckpointService | undefined;
    if (effectiveStore) {
      const { CheckpointService } = await import("../runtime/checkpoint-service.js");
      checkpointService = new CheckpointService(effectiveStore);
    }

    // Tool executor wired to emit tool_call events into the run trace
    const toolRuntime = new ToolRuntime(getDefaultRegistry(), effectiveStore);
    toolRuntime.onToolCall = async (record) => {
      await this.eventLog.append({
        runId: actualRunId,
        eventType: "tool_call",
        payload: {
          toolName: record.toolName,
          request: record.request,
          response: record.response ?? undefined,
          error: record.error ?? undefined,
          durationMs: record.durationMs,
          idempotencyKey: record.idempotencyKey,
        },
      });
    };
    const toolExecutor = new ToolExecutor(toolRuntime);

// Start run via RunManager (non-blocking; returns immediately)
    await this.runManager.startRun(compiledGraph, {
      input,
      runId: actualRunId,
      threadId,
      resume,
      store: effectiveStore,
      hitlGateway: effectiveHitlGateway,
      schedulerOptions: {
        checkpointService,
        runId: actualRunId,
        hitlGateway: effectiveHitlGateway,
        executors: new Map([["tool", toolExecutor]]),
        onNodeStart: async (record: NodeExecutionRecord) => {
          await this.eventLog.append({
            runId: actualRunId,
            eventType: "node_start",
            payload: {
              nodeId: record.nodeId,
              nodeType: record.nodeType,
              input: record.input,
              attempt: record.attempt,
            },
          });
        },
        onNodeComplete: async (record: NodeExecutionRecord) => {
          await this.eventLog.append({
            runId: actualRunId,
            eventType: "node_end",
            payload: {
              nodeId: record.nodeId,
              nodeType: record.nodeType,
              output: record.output,
              error: record.error,
              status: record.status,
              attempt: record.attempt,
            },
          });

          // Emit checkpoint event after node completion
          if (checkpointService) {
            await this.eventLog.append({
              runId: actualRunId,
              eventType: "checkpoint",
              payload: {
                seq: record.attempt,
                nodeId: record.nodeId,
                phase: "node_complete",
                metadata: { completedNodes: [record.nodeId] },
              },
            });
          }
        },
        onNodeError: async (record: NodeExecutionRecord, error: Error) => {
          await this.eventLog.append({
            runId: actualRunId,
            eventType: "node_end",
            payload: {
              nodeId: record.nodeId,
              nodeType: record.nodeType,
              error: { message: error.message, code: (error as Error & { code?: string }).code },
              status: "failed",
              attempt: record.attempt,
            },
          });
        },
        onHitlInterrupt: async (interrupt: { token: string; nodeId: string; payload: unknown }) => {
          await this.eventLog.append({
            runId: actualRunId,
            eventType: "hitl",
            payload: {
              nodeId: interrupt.nodeId,
              token: interrupt.token,
              action: "created",
              payload: interrupt.payload,
            },
          });
        },
        onCheckpoint: async (checkpoint: { runId: string; seq: number; nodeId: string | null; phase: string; metadata?: Record<string, unknown> }) => {
          await this.eventLog.append({
            runId: actualRunId,
            eventType: "checkpoint",
            payload: {
              seq: checkpoint.seq,
              nodeId: checkpoint.nodeId,
              phase: checkpoint.phase,
              metadata: checkpoint.metadata,
            },
          });
        },
      } as SchedulerOptions,
    });

    // Terminal handler: emit the final event and persist final state once the
    // scheduler settles. Skipped for waiting_hitl because the HITL resume path
    // emits its own terminal events.
    const terminalHandler = this.runManager.waitForRun(actualRunId).then(async (schedulerResult) => {
      if (!schedulerResult || schedulerResult.status === "waiting_hitl") {
        return;
      }
      await this.emitTerminalEvent(actualRunId, schedulerResult);
      if (effectiveStore) {
        const now = new Date().toISOString();
        await effectiveStore.updateRun(actualRunId, {
          status: schedulerResult.status,
          outputJson: schedulerResult.output ?? null,
          errorJson: schedulerResult.error ?? null,
          finishedAt: now,
          updatedAt: now,
        });
      }
    });

    // HITL probe: if the run paused at a HITL node immediately, surface the
    // interrupt so callers can resume.
    const settled = await Promise.race([
      this.runManager.waitForRun(actualRunId),
      new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 50)),
    ]);
    if (settled && settled.status === "waiting_hitl" && settled.hitlInterrupt) {
      return {
        runId: actualRunId,
        status: "waiting_hitl",
        hitlInterrupt: {
          token: settled.hitlInterrupt.token,
          nodeId: settled.hitlInterrupt.nodeId,
          payload: settled.hitlInterrupt.payload,
          expiresAt: settled.hitlInterrupt.expiresAt,
        },
      };
    }
    if (settled && settled.status !== "running") {
      // Run already settled (fast-completing graph): wait for terminal events
      // so the trace is complete before startRun returns.
      await terminalHandler;
    }

    return {
      runId: actualRunId,
      status: "running",
    };
  }

  /**
   * Emit terminal event (completed/failed/cancelled) for a run.
   */
  private async emitTerminalEvent(runId: string, result: SchedulerResult): Promise<void> {
    const history = result.history ?? [];
    const nodeCount = history.length;
    const durationMs = history.length > 0
      ? Date.now() - new Date(history[0].startedAt).getTime()
      : undefined;

    switch (result.status) {
      case "completed":
        await this.eventLog.appendRunCompleted(runId, result.output, durationMs, nodeCount);
        break;
      case "failed":
        await this.eventLog.appendRunFailed(runId, result.error ?? { message: "Unknown error" }, durationMs, nodeCount);
        break;
      case "cancelled":
        await this.eventLog.appendRunCancelled(runId, result.error?.message ?? "Cancelled", durationMs, nodeCount);
        break;
    }
  }

  /**
   * Get a run view by ID (includes metadata and trace).
   *
   * @param runId - Run identifier
   * @returns RunView or undefined if not found
   */
  async getRun(runId: string): Promise<RunView | undefined> {
    const metadata = this.runManager.getRun(runId);
    if (!metadata) return undefined;

    const trace = await this.eventLog.getTrace(runId);
    return { metadata, trace };
  }

  /**
   * Wait for a run to complete and return the full result.
   *
   * @param runId - Run identifier
   * @returns SchedulerResult or undefined if not found
   */
  async waitForRun(runId: string): Promise<SchedulerResult | undefined> {
    return this.runManager.waitForRun(runId);
  }

  /**
   * Cancel a running run.
   *
   * @param runId - Run identifier
   * @returns true if cancellation was requested, false if not found or not running
   */
  async cancelRun(runId: string): Promise<boolean> {
    const metadata = this.runManager.getRun(runId);
    if (!metadata) return false;

    // run_cancelled event is emitted by the startRun terminal handler when the
    // scheduler settles after abort.
    return this.runManager.cancelRun(runId);
  }

  /**
   * Resume a HITL interrupt.
   *
   * @param options - Resume options (runId, token, decision)
   * @returns Updated run status and result if completed
   * @throws Error if interrupt not found, expired, or run not waiting_hitl
   */
  async resumeHitl(options: ResumeHitlOptions): Promise<ResumeHitlResult> {
    const { runId, token, decision } = options;

    // Delegate to RunManager which verifies interrupt existence (errors first),
    // token/runId match, expiry, idempotency, and resumes from the checkpoint
    // with the decision injected into channels.
    const result = await this.runManager.resumeHitl(runId, token, decision);
    if (!result) {
      throw new Error(`Run not found: ${runId}`);
    }

    // Emit hitl resumed event
    const interrupt = await this.hitlGateway?.getInterrupt(token);
    const hitlNodeId = interrupt?.nodeId ?? result.history.find((r) => r.nodeType === "hitl")?.nodeId ?? "";
    await this.eventLog.appendHitl(runId, hitlNodeId, token, "resumed", undefined, decision);

    // Emit terminal event if the run finished (no resume-into-another-HITL)
    if (result.status === "waiting_hitl") {
      // Still waiting on another HITL node; nothing to emit yet
    } else {
      await this.emitTerminalEvent(runId, result);
      if (this.store) {
        const now = new Date().toISOString();
        await this.store.updateRun(runId, {
          status: result.status,
          outputJson: result.output ?? null,
          errorJson: result.error ?? null,
          finishedAt: now,
          updatedAt: now,
        });
      }
    }

    return {
      status: result.status,
      result,
    };
  }

  /**
   * Get the full event trace for a run.
   *
   * @param runId - Run identifier
   * @param fromSeq - Optional sequence to start from
   * @returns Array of event rows ordered by seq
   */
  async getTrace(runId: string, fromSeq?: number): Promise<EventRow[]> {
    return this.eventLog.getTrace(runId, fromSeq);
  }

  /**
   * List all runs from memory (optionally filtered).
   *
   * @param status - Optional status filter
   * @returns Array of run views
   */
  listRuns(status?: RunStatus): RunView[] {
    const runs = this.runManager.listRuns(status);
    return runs.map((m) => ({ metadata: m, trace: [] }));
  }

  /**
   * List runs from persistent store.
   *
   * @param options - Query options
   * @returns Array of stored runs
   */
  async listRunsFromStore(options?: ListRunsFromStoreOptions): Promise<Array<{
    runId: string;
    graphId: string;
    threadId: string | null;
    status: RunStatus;
    input: unknown;
    output: unknown;
    error: unknown;
    createdAt: string;
    updatedAt: string;
  }>> {
    if (!this.store) {
      throw new Error("StateStore required for listRunsFromStore");
    }
    const runs = await this.store.listRuns({
      graphId: options?.graphId,
      status: options?.status,
      limit: options?.limit,
      offset: options?.offset,
      order: "DESC",
    });
    return runs.map((r) => ({
      runId: r.runId,
      graphId: r.graphId,
      threadId: r.threadId,
      status: r.status,
      input: r.inputJson,
      output: r.outputJson,
      error: r.errorJson,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  /**
   * Delete a run from memory.
   *
   * @param runId - Run identifier
   * @returns true if deleted, false if not found
   */
  deleteRun(runId: string): boolean {
    return this.runManager.deleteRun(runId);
  }

  /**
   * Clear all runs and cache.
   */
  clear(): void {
    this.runManager.clear();
    this.graphCache.clear();
    this.eventLog.clearAllCache();
  }
}

/**
 * Create a ControlPlane with default dependencies.
 * Convenience function for quick setup.
 *
 * @param store - Optional StateStore for persistence
 * @returns ControlPlane instance
 */
export async function createControlPlane(store?: StateStore): Promise<ControlPlane> {
  const runManager = new RunManager();
  let eventLog: EventLog;
  let hitlGateway: HitlGateway | undefined;

  if (store) {
    eventLog = createEventLog(store);
    hitlGateway = createHitlGateway(store);
  } else {
    const newStore = new SQLiteStateStore(":memory:");
    await newStore.initialize();
    eventLog = createEventLog(newStore);
  }

  return new ControlPlane(runManager, eventLog, store, hitlGateway);
}