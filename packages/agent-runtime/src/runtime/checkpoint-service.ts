/**
 * CheckpointService: Persists and restores run state for crash recovery.
 *
 * Why: After each node execution, a checkpoint is written containing the full
 * channel state and execution metadata. On resume, the latest checkpoint is
 * loaded and execution continues from the next ready node, skipping already
 * completed nodes (idempotency via node execution records).
 */

import type { StateStore, StoredCheckpoint } from "../persistence/types.js";
import type { CompiledGraph } from "../graph/types.js";
import type { ChannelMap, NodeExecutionRecord, RunMetadata, RunStatus } from "./state.js";
import { serializeChannels, deserializeChannels } from "./state.js";
import type { GraphNode } from "../graph/types.js";

/** Checkpoint row returned to callers (cleaner than StoredCheckpoint). */
export interface CheckpointRow {
  /** Sequence number within the run. */
  seq: number;
  /** Node ID where checkpoint was created (the node that just completed). */
  nodeId: string | null;
  /** Serialized channel state (name -> value). */
  state: Record<string, unknown>;
  /** Optional metadata (custom data from scheduler). */
  metadata?: Record<string, unknown>;
  /** When this checkpoint was created. */
  createdAt: string;
}

/** Options for writing a checkpoint. */
export interface WriteCheckpointOptions {
  /** Run identifier. */
  runId: string;
  /** Monotonically increasing sequence number. */
  seq: number;
  /** Node that just completed (null for initial checkpoint). */
  nodeId: string | null;
  /** Current channel map. */
  channels: ChannelMap;
  /** Optional custom metadata. */
  metadata?: Record<string, unknown>;
}

/** Result of a resumed run. */
export interface ResumeResult {
  /** Restored channel map. */
  channels: ChannelMap;
  /** Restored execution history (completed nodes). */
  history: NodeExecutionRecord[];
  /** Next sequence number to use. */
  nextSeq: number;
  /** Node IDs that have already completed (for idempotency), in execution order. */
  completedNodeIds: string[];
}

/**
 * CheckpointService handles persistence and restoration of run checkpoints.
 * Uses the StateStore interface for database operations.
 */
export class CheckpointService {
  private store: StateStore;

  constructor(store: StateStore) {
    this.store = store;
  }

  /**
   * Write a checkpoint after a node completes.
   * Serializes the full channel state and stores it with metadata.
   */
  async write(options: WriteCheckpointOptions): Promise<CheckpointRow> {
    const { runId, seq, nodeId, channels, metadata } = options;

    const stateJson = serializeChannels(channels);
    const metadataJson = metadata ?? {};

    const id = await this.store.createCheckpoint({
      runId,
      seq,
      nodeId,
      stateJson,
      metadataJson,
    });

    return {
      seq,
      nodeId,
      state: stateJson,
      metadata: metadataJson,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Get the latest checkpoint for a run.
   */
  async getLatest(runId: string): Promise<CheckpointRow | null> {
    const stored = await this.store.getLatestCheckpoint(runId);
    if (!stored) return null;

    return this.mapStoredToRow(stored);
  }

  /**
   * Get all checkpoints for a run (for debugging/inspection).
   */
  async getAll(runId: string): Promise<CheckpointRow[]> {
    const stored = await this.store.listCheckpoints(runId);
    return stored.map((s) => this.mapStoredToRow(s));
  }

  /**
   * Restore run state from the latest checkpoint.
   * Returns deserialized channels, history, next sequence number,
   * and set of completed node IDs for idempotency.
   * Uses checkpoint metadata for completed nodes.
   */
  async resume(
    runId: string,
    compiledGraph: CompiledGraph,
  ): Promise<ResumeResult | null> {
    const checkpoint = await this.getLatest(runId);
    if (!checkpoint) return null;

    // Use checkpoint metadata for completed nodes (written by scheduler after each node)
    const completedNodeIds: string[] = [];
    const history: NodeExecutionRecord[] = [];

    if (checkpoint.metadata?.completedNodes) {
      const completedNodesArray = checkpoint.metadata.completedNodes as string[];
      for (const nodeId of completedNodesArray) {
        completedNodeIds.push(nodeId);
        const node = compiledGraph.nodes.get(nodeId);
        history.push({
          nodeId,
          nodeType: (node?.type ?? "fn") as GraphNode["type"],
          startedAt: checkpoint.createdAt,
          finishedAt: checkpoint.createdAt,
          status: "completed",
          input: undefined,
          output: undefined,
          attempt: 1,
        });
      }
    } else {
      // Fallback: load from store if metadata not available
      const executions = await this.store.getNodeExecutions(runId);
      // Sort by startedAt to get execution order (handle null startedAt)
      executions.sort((a, b) => {
        const timeA = a.startedAt ? new Date(a.startedAt).getTime() : 0;
        const timeB = b.startedAt ? new Date(b.startedAt).getTime() : 0;
        return timeA - timeB;
      });
      for (const exec of executions) {
        if (exec.status === "completed") {
          completedNodeIds.push(exec.nodeId);
          history.push({
            nodeId: exec.nodeId,
            nodeType: exec.nodeType as GraphNode["type"],
            startedAt: exec.startedAt ?? new Date().toISOString(),
            finishedAt: exec.finishedAt ?? undefined,
            status: "completed",
            input: exec.inputJson ?? undefined,
            output: exec.outputJson ?? undefined,
            attempt: exec.attempt,
          });
        }
      }
    }

    // Deserialize channels
    const channels = deserializeChannels(checkpoint.state);

    return {
      channels,
      history,
      nextSeq: checkpoint.seq + 1,
      completedNodeIds,
    };
  }

  private mapStoredToRow(stored: StoredCheckpoint): CheckpointRow {
    return {
      seq: stored.seq,
      nodeId: stored.nodeId,
      state: stored.stateJson as Record<string, unknown>,
      metadata: stored.metadataJson as Record<string, unknown> | undefined,
      createdAt: stored.createdAt,
    };
  }
}

/**
 * Create a CheckpointService from a SQLiteStateStore.
 * Convenience function for common setup.
 */
export function createCheckpointService(store: StateStore): CheckpointService {
  return new CheckpointService(store);
}