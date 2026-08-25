/**
 * RunManager: in-memory run lifecycle and metadata store.
 *
 * Why: Centralizes run state (created→running→completed/failed/cancelled),
 * provides getRun/cancelRun, and integrates compileGraph + scheduler.
 * No persistence yet (Task 4 adds SQLite checkpointing).
 */

import { compileGraph, GraphCompileError } from "../graph/compiler.js";
import type { CompiledGraph, GraphDefinition } from "../graph/types.js";
import { runGraph, type SchedulerOptions, type SchedulerResult } from "./scheduler.js";
import type { RunMetadata, RunStatus, NodeExecutionRecord } from "./state.js";

/** In-memory run store entry. */
interface RunEntry {
  metadata: RunMetadata;
  abortController: AbortController;
  schedulerPromise: Promise<SchedulerResult>;
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
      status: "created",
      createdAt: now,
      input: options.input,
      nodeHistory: [],
    };

    // Create scheduler promise (starts immediately)
    const schedulerPromise = this.runScheduler(compiledGraph, metadata, abortController.signal, options);

    // Store run entry
    this.runs.set(runId, { metadata, abortController, schedulerPromise });

    // Update status to running
    metadata.status = "running";
    metadata.startedAt = new Date().toISOString();

    return { runId, status: "running" };
  }

  /**
   * Internal: run scheduler and update metadata on completion.
   */
  private async runScheduler(
    compiledGraph: CompiledGraph,
    metadata: RunMetadata,
    abortSignal: AbortSignal,
    options: StartRunOptions,
  ): Promise<SchedulerResult> {
    // Pass runId into context via metadata reference
    metadata.runId = metadata.runId; // already set

    const result = await runGraph(compiledGraph, options.input, abortSignal, options.schedulerOptions);

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
   * Get run metadata by ID (does not wait for completion).
   */
  getRun(runId: string): RunMetadata | undefined {
    return this.runs.get(runId)?.metadata;
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