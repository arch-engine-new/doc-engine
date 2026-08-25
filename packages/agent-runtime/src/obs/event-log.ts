/**
 * EventLog: append-only event store for run traces.
 *
 * Why: Provides a durable, ordered event stream per runId for debugging,
 * replay, audit, and observability. Uses SQLiteStateStore for persistence.
 * Events are typed and ordered by sequence number.
 */

import type { StateStore, StoredRunEvent } from "../persistence/types.js";

/**
 * Event types emitted during a run lifecycle.
 * Matches the eventType column in t_agent_run_event.
 */
export type EventType =
  | "node_start"
  | "node_end"
  | "tool_call"
  | "checkpoint"
  | "hitl"
  | "run_started"
  | "run_completed"
  | "run_failed"
  | "run_cancelled";

/**
 * Payload shapes for each event type (for type-safe access).
 */
export interface NodeStartPayload {
  nodeId: string;
  nodeType: string;
  input: unknown;
  attempt: number;
}

export interface NodeEndPayload {
  nodeId: string;
  nodeType: string;
  output?: unknown;
  error?: { message: string; code?: string };
  status: "running" | "completed" | "failed" | "skipped";
  attempt: number;
}

export interface ToolCallPayload {
  toolName: string;
  request: unknown;
  response?: unknown;
  error?: { message: string; code?: string };
  durationMs?: number;
  idempotencyKey?: string;
}

export interface CheckpointPayload {
  seq: number;
  nodeId: string | null;
  phase: string;
  metadata?: Record<string, unknown>;
}

export interface HitlPayload {
  nodeId: string;
  token: string;
  action: "created" | "resumed" | "expired" | "cancelled";
  payload?: unknown;
  decision?: unknown;
}

export interface RunCompletedPayload {
  output?: unknown;
  durationMs?: number;
  nodeCount?: number;
}

export interface RunFailedPayload {
  error: { message: string; code?: string; cause?: unknown };
  durationMs?: number;
  nodeCount?: number;
}

export interface RunCancelledPayload {
  reason?: string;
  durationMs?: number;
  nodeCount?: number;
}

export interface RunStartedPayload {
  graphId: string;
  input: unknown;
  threadId?: string;
}

/** Union of all event payloads. */
export type EventPayload =
  | NodeStartPayload
  | NodeEndPayload
  | ToolCallPayload
  | CheckpointPayload
  | HitlPayload
  | RunCompletedPayload
  | RunFailedPayload
  | RunCancelledPayload
  | RunStartedPayload;

/**
 * Event row returned by EventLog (includes DB metadata).
 */
export interface EventRow {
  /** Auto-incrementing row ID. */
  id: number;
  /** Run identifier. */
  runId: string;
  /** Sequence number within the run (strictly increasing). */
  seq: number;
  /** Event type discriminator. */
  eventType: EventType;
  /** Typed payload. */
  payload: EventPayload;
  /** ISO timestamp when event was created. */
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
  /** Optional explicit sequence (auto-assigned if omitted). */
  seq?: number;
}

/**
 * EventLog class for appending and querying run events.
 * Uses a StateStore (e.g., SQLiteStateStore) for persistence.
 */
export class EventLog {
  private store: StateStore;
  private seqCache = new Map<string, number>();
  private appendChains = new Map<string, Promise<unknown>>();

  /**
   * Create an EventLog.
   * @param store - StateStore implementation (e.g., SQLiteStateStore)
   */
  constructor(store: StateStore) {
    this.store = store;
  }

  /**
   * Append an event to the run's event log.
   * Assigns the next sequence number if not provided.
   *
   * Why a per-runId chain: sequence allocation reads the cache then persists;
   * concurrent appends to the same run would both compute the same next seq
   * and violate uk_t_agent_run_event_run_seq. Chaining serializes appends.
   *
   * @param options - Event to append
   * @returns The appended event row with assigned seq and id
   */
  async append(options: AppendEventOptions): Promise<EventRow> {
    const runId = options.runId;
    const prev = this.appendChains.get(runId) ?? Promise.resolve();
    const current = prev.then(
      () => this.appendInner(options),
      () => this.appendInner(options),
    );
    this.appendChains.set(runId, current);
    try {
      return await current;
    } finally {
      if (this.appendChains.get(runId) === current) {
        this.appendChains.delete(runId);
      }
    }
  }

  /**
   * Internal append implementation; must be invoked via the per-runId chain
   * so seq allocation is race-free.
   */
  private async appendInner(options: AppendEventOptions): Promise<EventRow> {
    const { runId, eventType, payload, seq } = options;

    // Determine next sequence number
    let nextSeq = seq;
    if (nextSeq === undefined) {
      const cached = this.seqCache.get(runId);
      if (cached !== undefined) {
        nextSeq = cached + 1;
      } else {
        // Query the latest event from the store
        const events = await this.store.getEvents(runId);
        nextSeq = events.length > 0 ? (events[events.length - 1]?.seq ?? 0) + 1 : 1;
      }
    }

    // Persist the event
    const now = new Date().toISOString();
    const rowId = await this.store.appendEvent({
      runId,
      seq: nextSeq,
      eventType,
      payloadJson: payload,
    });

    // Update cache
    this.seqCache.set(runId, nextSeq);

    // Return the event row
    return {
      id: rowId,
      runId,
      seq: nextSeq,
      eventType,
      payload,
      createdAt: now,
    };
  }

  /**
   * Convenience: append node_start event.
   */
  async appendNodeStart(
    runId: string,
    nodeId: string,
    nodeType: string,
    input: unknown,
    attempt: number,
  ): Promise<EventRow> {
    return this.append({
      runId,
      eventType: "node_start",
      payload: { nodeId, nodeType, input, attempt },
    });
  }

  /**
   * Convenience: append node_end event.
   */
  async appendNodeEnd(
    runId: string,
    nodeId: string,
    nodeType: string,
    output: unknown | undefined,
    status: "completed" | "failed" | "skipped",
    error: { message: string; code?: string } | undefined,
    attempt: number,
  ): Promise<EventRow> {
    return this.append({
      runId,
      eventType: "node_end",
      payload: { nodeId, nodeType, output, status, error, attempt },
    });
  }

  /**
   * Convenience: append tool_call event.
   */
  async appendToolCall(
    runId: string,
    nodeId: string,
    toolName: string,
    request: unknown,
    response: unknown | undefined,
    status: "completed" | "failed",
    error: { message: string; code?: string } | undefined,
    durationMs: number | undefined,
    idempotencyKey: string | undefined,
  ): Promise<EventRow> {
    return this.append({
      runId,
      eventType: "tool_call",
      payload: { toolName, request, response, status, error, durationMs, idempotencyKey },
    });
  }

  /**
   * Convenience: append checkpoint event.
   */
  async appendCheckpoint(
    runId: string,
    nodeId: string | null,
    seq: number,
    metadata: Record<string, unknown> | undefined,
  ): Promise<EventRow> {
    return this.append({
      runId,
      eventType: "checkpoint",
      payload: { seq, nodeId, phase: "checkpoint", metadata },
    });
  }

  /**
   * Convenience: append hitl event.
   */
  async appendHitl(
    runId: string,
    nodeId: string,
    token: string,
    action: "created" | "resumed" | "expired" | "cancelled",
    payload: unknown,
    decision?: unknown,
  ): Promise<EventRow> {
    return this.append({
      runId,
      eventType: "hitl",
      payload: { nodeId, token, action, payload, decision },
    });
  }

  /**
   * Convenience: append run_completed event.
   */
  async appendRunCompleted(
    runId: string,
    output: unknown,
    durationMs: number | undefined,
    nodeCount: number,
  ): Promise<EventRow> {
    return this.append({
      runId,
      eventType: "run_completed",
      payload: { output, durationMs, nodeCount },
    });
  }

  /**
   * Convenience: append run_failed event.
   */
  async appendRunFailed(
    runId: string,
    error: { message: string; code?: string },
    durationMs: number | undefined,
    nodeCount: number,
  ): Promise<EventRow> {
    return this.append({
      runId,
      eventType: "run_failed",
      payload: { error, durationMs, nodeCount },
    });
  }

  /**
   * Convenience: append run_cancelled event.
   */
  async appendRunCancelled(
    runId: string,
    reason: string | undefined,
    durationMs: number | undefined,
    nodeCount: number,
  ): Promise<EventRow> {
    return this.append({
      runId,
      eventType: "run_cancelled",
      payload: { reason, durationMs, nodeCount },
    });
  }

  /**
   * Get the full trace (all events) for a run, ordered by sequence.
   *
   * @param runId - Run identifier
   * @param fromSeq - Optional sequence number to start from (inclusive)
   * @returns Array of event rows ordered by seq ASC
   */
  async getTrace(runId: string, fromSeq?: number): Promise<EventRow[]> {
    const storedEvents = await this.store.getEvents(runId, fromSeq);
    return storedEvents.map((e) => this.mapStoredToRow(e));
  }

  /**
   * Get events from a specific sequence onwards (for incremental polling).
   *
   * @param runId - Run identifier
   * @param fromSeq - Sequence number to start from (inclusive)
   * @returns Array of event rows ordered by seq ASC
   */
  async getEventsFrom(runId: string, fromSeq: number): Promise<EventRow[]> {
    return this.getTrace(runId, fromSeq);
  }

  /**
   * Get the latest sequence number for a run.
   *
   * @param runId - Run identifier
   * @returns Latest sequence number, or 0 if no events
   */
  async getLatestSeq(runId: string): Promise<number> {
    const cached = this.seqCache.get(runId);
    if (cached !== undefined) {
      return cached;
    }
    const events = await this.store.getEvents(runId);
    return events.length > 0 ? (events[events.length - 1]?.seq ?? 0) : 0;
  }

  /**
   * Clear the sequence cache for a run (useful after external modifications).
   *
   * @param runId - Run identifier
   */
  clearCache(runId: string): void {
    this.seqCache.delete(runId);
  }

  /**
   * Clear all cached sequences.
   */
  clearAllCache(): void {
    this.seqCache.clear();
  }

  /**
   * Reset sequence cache for a run by loading latest from store.
   * Useful after restart to continue sequencing correctly.
   */
  async resetSeqCache(runId: string): Promise<void> {
    const events = await this.store.getEvents(runId);
    const latestSeq = events.length > 0 ? (events[events.length - 1]?.seq ?? 0) : 0;
    this.seqCache.set(runId, latestSeq);
  }

  /**
   * Map StoredRunEvent to public EventRow.
   */
  private mapStoredToRow(stored: StoredRunEvent): EventRow {
    return {
      id: stored.id,
      runId: stored.runId,
      seq: stored.seq,
      eventType: stored.eventType as EventType,
      payload: stored.payloadJson as EventPayload,
      createdAt: stored.createdAt,
    };
  }
}

/**
 * Create an EventLog from a StateStore.
 * Convenience function for common setup.
 */
export function createEventLog(store: StateStore): EventLog {
  return new EventLog(store);
}