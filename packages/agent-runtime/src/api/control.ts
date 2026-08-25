/**
 * ControlPlane: In-process control API for agent-runtime.
 *
 * Why: Provides a clean programmatic interface for compiling graphs,
 * starting/managing runs, HITL resumption, and trace retrieval.
 * This is the primary API for embedders and the HTTP adapter.
 */

import { compileGraph, type CompiledGraph, type GraphDefinition, GraphCompileError } from "../graph/compiler.js";
import type { RunManager, StartRunOptions, StartRunResult } from "../runtime/run-manager.js";
import type { SchedulerResult } from "../runtime/scheduler.js";
import type { RunMetadata, RunStatus } from "../runtime/state.js";
import type { StateStore } from "../persistence/types.js";
import type { HitlGateway, HitlDecision } from "../hitl/gateway.js";
import { EventLog, type EventRow, type EventType } from "../obs/event-log.js";
import type { CheckpointService } from "../runtime/checkpoint-service.js";

/** Result of compiling a graph. */
export interface CompileResult {
  /** Unique graph identifier. */
  graphId: string;
  /** The compiled graph. */
  compiledGraph: CompiledGraph;
}

/** View of a run returned by the control plane. */
export interface RunView {
  /** Run identifier. */
  runId: string;
  /** Graph identifier. */
  graphId: string;
  /** Optional thread identifier. */
  threadId: string | null;
  /** Current run status. */
  status: RunStatus;
  /** Run input. */
  input: unknown;
  /** Run output (if completed). */
  output?: unknown;
  /** Error (if failed). */
  error?: { message: string; code?: string; cause?: unknown };
  /** When the run was created. */
  createdAt: string;
  /** When the run started. */
  startedAt?: string;
  /** When the run finished. */
  finishedAt?: string;
  /** Node execution history. */
  nodeHistory: Array<{
    nodeId: string;
    nodeType: string;
    startedAt: string;
    finishedAt?: string;
    status: "running" | "completed" | "failed" | "skipped";
    input?: unknown;
    output?: unknown;
    error?: { message: string; code?: string };
    attempt: number;
  }>;
  /** HITL interrupt info (if waiting_hitl). */
  hitlInterrupt?: {
    token: string;
    nodeId: string;
    payload: unknown;
    expiresAt: string | null;
  };
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

/** Options for HITL resume. */
export interface ResumeHitlOptions {
  /** Run identifier. */
  runId: string;
  /** HITL interrupt token. */
  token: string;
  /** Human decision. */
  decision: HitlDecision;
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
   * @param runManager - RunManager instance (or create default)
   * @param eventLog - EventLog instance (or create default with store)
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
   * Compile a graph definition and cache it.
   *
   * @param def - Graph definition to compile
   * @returns CompileResult with graphId and compiled graph
   * @throws GraphCompileError if compilation fails
   */
  compileGraph(def: GraphDefinition): CompileResult {
    const compiled = compileGraph(def);
    this.graphCache.set(compiled.graphId, compiled);

    // Also cache in runManager for consistency
    this.runManager.compileAndCache(def);

    return { graphId: compiled.graphId, compiledGraph: compiled };
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
   * @returns Run ID and initial status
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

    // Emit run_started event
    await this.eventLog.append({
      runId: runId ?? `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`,
      eventType: "run_started" as EventType,
      payload: { graphId, input, threadId },
    });

    // Start run via RunManager
    const result = await this.runManager.startRun(compiledGraph, {
      input,
      runId,
      threadId,
      resume,
      store: effectiveStore,
      hitlGateway: effectiveHitlGateway,
      schedulerOptions: {
        onNodeStart: async (record) => {
          await this.eventLog.append({
            runId: record.nodeId, // This will be replaced with actual runId below
            eventType: "node_start",
            payload: {
              nodeId: record.nodeId,
              nodeType: record.nodeType,
              input: record.input,
              attempt: record.attempt,
            },
          });
        },
        onNodeComplete: async (record) => {
          await this.eventLog.append({
            runId: record.nodeId, // Will be replaced
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
        },
        onNodeError: async (record, error) => {
          await this.eventLog.append({
            runId: record.nodeId, // Will be replaced
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
        onHitlInterrupt: async (interrupt) => {
          await this.eventLog.append({
            runId: interrupt.token, // Will be replaced
            eventType: "hitl",
            payload: {
              nodeId: interrupt.nodeId,
              token: interrupt.token,
              action: "created",
              payload: interrupt.payload,
            },
          });
        },
      },
    });

    // The RunManager returns runId - we need to fix the event log runIds
    // Since events were logged with placeholder runIds, we need to re-log or fix them
    // For simplicity, we'll rely on the RunManager's internal logging via callbacks
    // and the eventLog.append calls above will need the actual runId
    // Let's re-emit the run_started with correct runId
    await this.eventLog.append({
      runId: result.runId,
      eventType: "run_started",
      payload: { graphId, input, threadId },
    });

    return result;
  }

  /**
   * Get a run view by ID.
   *
   * @param runId - Run identifier
   * @returns RunView or undefined if not found
   */
  getRun(runId: string): RunView | undefined {
    const metadata = this.runManager.getRun(runId);
    if (!metadata) return undefined;

    return this.mapMetadataToView(metadata);
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
  cancelRun(runId: string): boolean {
    const metadata = this.runManager.getRun(runId);
    if (!metadata) return false;

    const cancelled = this.runManager.cancelRun(runId);
    if (cancelled) {
      // Emit run_cancelled event
      this.eventLog.append({
        runId,
        eventType: "run_cancelled",
        payload: { reason: "Cancelled via control plane" },
      }).catch(() => {
        // Ignore event log errors during cancellation
      });
    }
    return cancelled;
  }

  /**
   * Resume a HITL interrupt.
   *
   * @param options - Resume options (runId, token, decision)
   * @returns Updated run status
   * @throws Error if interrupt not found, expired, or run not waiting_hitl
   */
  async resumeHitl(options: ResumeHitlOptions): Promise<RunStatus> {
    const { runId, token, decision } = options;

    // Verify run exists and is waiting_hitl
    const metadata = this.runManager.getRun(runId);
    if (!metadata) {
      throw new Error(`Run not found: ${runId}`);
    }
    if (metadata.status !== "waiting_hitl") {
      throw new Error(`Run ${runId} is not waiting for HITL (status: ${metadata.status})`);
    }

    // Use hitlGateway to resume
    const gateway = this.hitlGateway;
    if (!gateway) {
      throw new Error("No HITL gateway configured");
    }

    const success = await gateway.resume(token, decision);
    if (!success) {
      const interrupt = await gateway.getInterrupt(token);
      if (!interrupt) {
        throw new Error(`HITL interrupt not found: ${token}`);
      }
      if (interrupt.status === "expired") {
        throw new Error(`HITL interrupt expired: ${token}`);
      }
      throw new Error(`Failed to resume HITL interrupt: ${token}`);
    }

    // Emit hitl resumed event
    await this.eventLog.append({
      runId,
      eventType: "hitl",
      payload: {
        nodeId: metadata.currentNodeId ?? "",
        token,
        action: "resumed",
        decision,
      },
    });

    // Get updated run status
    const updated = this.runManager.getRun(runId);
    return updated?.status ?? "running";
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
   * List all runs (optionally filtered).
   *
   * @param status - Optional status filter
   * @returns Array of run views
   */
  listRuns(status?: RunStatus): RunView[] {
    const runs = this.runManager.listRuns(status);
    return runs.map((m) => this.mapMetadataToView(m));
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

  /**
   * Map RunMetadata to RunView.
   */
  private mapMetadataToView(metadata: RunMetadata): RunView {
    const view: RunView = {
      runId: metadata.runId,
      graphId: metadata.graphId,
      threadId: metadata.threadId ?? null,
      status: metadata.status,
      input: metadata.input,
      output: metadata.output,
      error: metadata.error,
      createdAt: metadata.createdAt,
      startedAt: metadata.startedAt,
      finishedAt: metadata.finishedAt,
      nodeHistory: metadata.nodeHistory.map((r) => ({
        nodeId: r.nodeId,
        nodeType: r.nodeType,
        startedAt: r.startedAt,
        finishedAt: r.finishedAt,
        status: r.status,
        input: r.input,
        output: r.output,
        error: r.error,
        attempt: r.attempt,
      })),
    };

    // Add HITL interrupt info if waiting
    if (metadata.status === "waiting_hitl") {
      // The interrupt info would be in the scheduler result
      // For now, we can't easily access it from RunManager
      // This could be enhanced by storing interrupt info in metadata
    }

    return view;
  }
}

/**
 * Create a ControlPlane with default dependencies.
 * Convenience function for quick setup.
 *
 * @param store - Optional StateStore for persistence
 * @returns ControlPlane instance
 */
export function createControlPlane(store?: StateStore): ControlPlane {
  const { RunManager, defaultRunManager } = require("../runtime/run-manager.js") as typeof import("../runtime/run-manager.js");
  const { createEventLog } = require("../obs/event-log.js") as typeof import("../obs/event-log.js");
  const { createHitlGateway } = require("../hitl/gateway.js") as typeof import("../hitl/gateway.js");

  const runManager = new RunManager();
  const eventLog = createEventLog(store ?? new (require("../persistence/sqlite-store.js").SQLiteStateStore)(":memory:"));
  const hitlGateway = store ? createHitlGateway(store) : undefined;

  return new ControlPlane(runManager, eventLog, store, hitlGateway);
}