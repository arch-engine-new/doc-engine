/**
 * EventLog: append-only event store for run traces.
 *
 * Provides structured event logging alongside the existing checkpoint system.
 * Events are stored in t_agent_run_event table via StateStore.
 * Event types: node_start, node_end, tool_call, checkpoint, hitl, run_completed, run_failed, run_cancelled.
 */

import type { StateStore, StoredRunEvent } from "../persistence/types.js";

/** Event types for the run event log. */
export type EventType =
  | "node_start"
  | "node_end"
  | "tool_call"
  | "checkpoint"
  | "hitl"
  | "run_completed"
  | "run_failed"
  | "run_cancelled";

/** Base event payload structure. */
export interface EventPayload {
  /** Event-specific data. */
  [key: string]: unknown;
}

/** Event row returned by EventLog. */
export interface EventRow {
  /** Auto-incremented event ID. */
  id: number;
  /** Run identifier. */
  runId: string;
  /** Sequence number within the run. */
  seq: number;
  /** Event type. */
  eventType: EventType;
  /** Event payload as JSON. */
  payload: EventPayload;
  /** ISO timestamp of creation. */
  createdAt: string;
}

/** Options for appending an event. */
export interface AppendEventOptions {
  /** Run identifier. */
  runId: string;
  /** Event type. */
  eventType: EventType;
  /** Event payload. */
  payload: EventPayload;
  /** Optional explicit sequence number (auto-assigned if omitted). */
  seq?: number;
}

/**
 * EventLog provides append-only event logging for run traces.
 * Uses StateStore for persistence (SQLite by default).
 */
export class EventLog {
  private store: StateStore;
  private seqCache = new Map<string, number>();

  constructor(store: StateStore) {
    this.store = store;
  }

  /**
   * Append an event to the run's event log.
   *
   * @param options - Event options including runId, eventType, and payload
   * @returns The created EventRow with assigned seq and id
   */
  async append(options: AppendEventOptions): Promise<EventRow> {
    const { runId, eventType, payload, seq } = options;

    // Determine sequence number
    let eventSeq = seq;
    if (eventSeq === undefined) {
      const cached = this.seqCache.get(runId) ?? 0;
      eventSeq = cached + 1;
      this.seqCache.set(runId, eventSeq);
    } else {
      // Update cache to stay in sync
      this.seqCache.set(runId, Math.max(this.seqCache.get(runId) ?? 0, eventSeq));
    }

    // Persist via StateStore
    const storedId = await this.store.appendEvent({
      runId,
      seq: eventSeq,
      eventType,
      payloadJson: payload,
    });

    const row: EventRow = {
      id: storedId,
      runId,
      seq: eventSeq,
      eventType,
      payload,
      createdAt: new Date().toISOString(),
    };

    return row;
  }

  /**
   * Get all events for a run, ordered by sequence number.
   *
   * @param runId - Run identifier
   * @param fromSeq - Optional starting sequence (inclusive)
   * @returns Array of EventRow ordered by seq ASC
   */
  async getTrace(runId: string, fromSeq?: number): Promise<EventRow[]> {
    const storedEvents = await this.store.getEvents(runId, fromSeq);

    return storedEvents.map((e) => ({
      id: e.id,
      runId: e.runId,
      seq: e.seq,
      eventType: e.eventType as EventType,
      payload: e.payloadJson as EventPayload,
      createdAt: e.createdAt,
    }));
  }

  /**
   * Get events from a specific sequence number (for streaming/replay).
   *
   * @param runId - Run identifier
   * @param fromSeq - Starting sequence number (inclusive)
   * @returns Array of EventRow ordered by seq ASC
   */
  async getEventsFrom(runId: string, fromSeq: number): Promise<EventRow[]> {
    return this.getTrace(runId, fromSeq);
  }

  /**
   * Get the latest sequence number for a run.
   *
   * @param runId - Run identifier
   * @returns Latest seq or 0 if no events
   */
  async getLatestSeq(runId: string): Promise<number> {
    const events = await this.store.getEvents(runId);
    if (events.length === 0) return 0;
    return Math.max(...events.map((e) => e.seq));
  }

  /**
   * Reset the internal sequence cache for a run.
   * Call after loading existing events to avoid seq conflicts.
   *
   * @param runId - Run identifier
   */
  async resetSeqCache(runId: string): Promise<void> {
    const latestSeq = await this.getLatestSeq(runId);
    this.seqCache.set(runId, latestSeq);
  }

  /**
   * Convenience method to append a node_start event.
   */
  async appendNodeStart(
    runId: string,
    nodeId: string,
    nodeType: string,
    input: unknown,
    attempt: number = 1,
  ): Promise<EventRow> {
    return this.append({
      runId,
      eventType: "node_start",
      payload: { nodeId, nodeType, input, attempt },
    });
  }

  /**
   * Convenience method to append a node_end event.
   */
  async appendNodeEnd(
    runId: string,
    nodeId: string,
    nodeType: string,
    output: unknown,
    status: "completed" | "failed" | "skipped",
    error?: { message: string; code?: string },
    attempt: number = 1,
  ): Promise<EventRow> {
    return this.append({
      runId,
      eventType: "node_end",
      payload: { nodeId, nodeType, output, status, error, attempt },
    });
  }

  /**
   * Convenience method to append a tool_call event.
   */
  async appendToolCall(
    runId: string,
    nodeId: string,
    toolName: string,
    request: unknown,
    response?: unknown,
    status: "pending" | "completed" | "failed" = "pending",
    error?: { message: string; code?: string },
    durationMs?: number,
    idempotencyKey?: string,
  ): Promise<EventRow> {
    return this.append({
      runId,
      eventType: "tool_call",
      payload: { nodeId, toolName, request, response, status, error, durationMs, idempotencyKey },
    });
  }

  /**
   * Convenience method to append a checkpoint event.
   */
  async appendCheckpoint(
    runId: string,
    nodeId: string | null,
    seq: number,
    metadata: Record<string, unknown>,
  ): Promise<EventRow> {
    return this.append({
      runId,
      eventType: "checkpoint",
      payload: { nodeId, checkpointSeq: seq, metadata },
      seq,
    });
  }

  /**
   * Convenience method to append a HITL event.
   */
  async appendHitl(
    runId: string,
    nodeId: string,
    token: string,
    action: "created" | "resumed" | "expired" | "cancelled",
    payload?: unknown,
    decision?: unknown,
  ): Promise<EventRow> {
    return this.append({
      runId,
      eventType: "hitl",
      payload: { nodeId, token, action, payload, decision },
    });
  }

  /**
   * Convenience method to append a run_completed event.
   */
  async appendRunCompleted(
    runId: string,
    output: unknown,
    durationMs: number,
    nodeCount: number,
  ): Promise<EventRow> {
    return this.append({
      runId,
      eventType: "run_completed",
      payload: { output, durationMs, nodeCount },
    });
  }

  /**
   * Convenience method to append a run_failed event.
   */
  async appendRunFailed(
    runId: string,
    error: { message: string; code?: string; cause?: unknown },
    durationMs: number,
    completedNodes: number,
  ): Promise<EventRow> {
    return this.append({
      runId,
      eventType: "run_failed",
      payload: { error, durationMs, completedNodes },
    });
  }

  /**
   * Convenience method to append a run_cancelled event.
   */
  async appendRunCancelled(
    runId: string,
    reason: string,
    durationMs: number,
    completedNodes: number,
  ): Promise<EventRow> {
    return this.append({
      runId,
      eventType: "run_cancelled",
      payload: { reason, durationMs, completedNodes },
    });
  }
}

/**
 * Create an EventLog from a StateStore.
 * Convenience function for common setup.
 */
export function createEventLog(store: StateStore): EventLog {
  return new EventLog(store);
}