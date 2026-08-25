/**
 * OpenTelemetry hooks for EventLog.
 *
 * Provides optional OTel integration that emits span events alongside EventLog.
 * Uses dynamic require to avoid hard dependency on @opentelemetry/api.
 * If OTel is not available, functions are no-ops.
 */

import type { EventType, EventPayload, EventRow } from "./event-log.js";

/** OpenTelemetry Span interface (subset we use). */
export interface OtelSpan {
  /** Span name. */
  name: string;
  /** Set attribute on span. */
  setAttribute(key: string, value: string | number | boolean): this;
  /** Add event to span. */
  addEvent(name: string, attributes?: Record<string, string | number | boolean>): this;
  /** Record exception on span. */
  recordException(exception: Error): this;
  /** Set span status. */
  setStatus(status: { code: number; message?: string }): this;
  /** End the span. */
  end(): void;
}

/** OpenTelemetry Tracer interface (subset we use). */
export interface OtelTracer {
  /** Start a new span. */
  startSpan(name: string, options?: { attributes?: Record<string, string | number | boolean> }): OtelSpan;
  /** Start active span (for context propagation). */
  startActiveSpan<T>(name: string, fn: (span: OtelSpan) => T): T;
}

/** Cached OTel API references. */
let otelApi: {
  trace: { getTracer: (name: string, version?: string) => OtelSpan | null } | null;
  context: { active: () => unknown } | null;
  isAvailable: boolean;
} | null = null;

/**
 * Try to load OpenTelemetry API dynamically.
 * Returns true if OTel is available, false otherwise.
 */
function loadOtelApi(): boolean {
  if (otelApi !== null) return otelApi.isAvailable;

  try {
    // Dynamic require to avoid hard dependency
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const api = require("@opentelemetry/api");
    otelApi = {
      trace: api.trace,
      context: api.context,
      isAvailable: true,
    };
    return true;
  } catch {
    otelApi = {
      trace: null,
      context: null,
      isAvailable: false,
    };
    return false;
  }
}

/**
 * Get an OTel tracer for the agent-runtime.
 * Returns null if OTel is not available.
 *
 * @param name - Tracer name (default: "agent-runtime")
 * @param version - Tracer version (default: package version)
 * @returns OtelTracer or null
 */
export function getOtelTracer(name = "agent-runtime", version = "0.1.0"): OtelTracer | null {
  if (!loadOtelApi() || !otelApi?.trace) {
    return null;
  }

  const tracer = otelApi.trace.getTracer(name, version);
  if (!tracer) return null;

  return {
    startSpan: (spanName, options) => {
      const span = tracer.startSpan(spanName, options);
      return {
        name: spanName,
        setAttribute: (key, value) => {
          span.setAttribute(key, value);
          return span;
        },
        addEvent: (eventName, attributes) => {
          span.addEvent(eventName, attributes);
          return span;
        },
        recordException: (exception) => {
          span.recordException(exception);
          return span;
        },
        setStatus: (status) => {
          span.setStatus(status);
          return span;
        },
        end: () => span.end(),
      };
    },
    startActiveSpan: (spanName, fn) => {
      return tracer.startActiveSpan(spanName, (span) => {
        const wrappedSpan = {
          name: spanName,
          setAttribute: (key: string, value: string | number | boolean) => {
            span.setAttribute(key, value);
            return wrappedSpan;
          },
          addEvent: (eventName: string, attributes?: Record<string, string | number | boolean>) => {
            span.addEvent(eventName, attributes);
            return wrappedSpan;
          },
          recordException: (exception: Error) => {
            span.recordException(exception);
            return wrappedSpan;
          },
          setStatus: (status: { code: number; message?: string }) => {
            span.setStatus(status);
            return wrappedSpan;
          },
          end: () => span.end(),
        };
        return fn(wrappedSpan);
      });
    },
  };
}

/**
 * Check if OpenTelemetry is available.
 */
export function isOtelAvailable(): boolean {
  return loadOtelApi();
}

/**
 * EventLog OTel integration.
 * Wraps an EventLog and emits OTel spans/events for each appended event.
 */
export class OtelEventLog {
  private eventLog: any; // EventLog instance
  private tracer: OtelTracer | null;

  constructor(eventLog: any) {
    this.eventLog = eventLog;
    this.tracer = getOtelTracer();
  }

  /**
   * Append event to both EventLog and OTel.
   */
  async append(options: {
    runId: string;
    eventType: EventType;
    payload: EventPayload;
    seq?: number;
  }): Promise<EventRow> {
    const row = await this.eventLog.append(options);

    // Emit OTel event if available
    if (this.tracer) {
      this.emitOtelEvent(row);
    }

    return row;
  }

  /**
   * Get trace from underlying EventLog.
   */
  async getTrace(runId: string, fromSeq?: number): Promise<EventRow[]> {
    return this.eventLog.getTrace(runId, fromSeq);
  }

  /**
   * Get events from sequence.
   */
  async getEventsFrom(runId: string, fromSeq: number): Promise<EventRow[]> {
    return this.eventLog.getEventsFrom(runId, fromSeq);
  }

  /**
   * Get latest sequence.
   */
  async getLatestSeq(runId: string): Promise<number> {
    return this.eventLog.getLatestSeq(runId);
  }

  /**
   * Reset sequence cache.
   */
  async resetSeqCache(runId: string): Promise<void> {
    return this.eventLog.resetSeqCache(runId);
  }

  /**
   * Delegate convenience methods to underlying EventLog.
   */
  async appendNodeStart(
    runId: string,
    nodeId: string,
    nodeType: string,
    input: unknown,
    attempt: number = 1,
  ): Promise<EventRow> {
    const row = await this.eventLog.appendNodeStart(runId, nodeId, nodeType, input, attempt);
    if (this.tracer) this.emitOtelEvent(row);
    return row;
  }

  async appendNodeEnd(
    runId: string,
    nodeId: string,
    nodeType: string,
    output: unknown,
    status: "completed" | "failed" | "skipped",
    error?: { message: string; code?: string },
    attempt: number = 1,
  ): Promise<EventRow> {
    const row = await this.eventLog.appendNodeEnd(runId, nodeId, nodeType, output, status, error, attempt);
    if (this.tracer) this.emitOtelEvent(row);
    return row;
  }

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
    const row = await this.eventLog.appendToolCall(
      runId,
      nodeId,
      toolName,
      request,
      response,
      status,
      error,
      durationMs,
      idempotencyKey,
    );
    if (this.tracer) this.emitOtelEvent(row);
    return row;
  }

  async appendCheckpoint(
    runId: string,
    nodeId: string | null,
    seq: number,
    metadata: Record<string, unknown>,
  ): Promise<EventRow> {
    const row = await this.eventLog.appendCheckpoint(runId, nodeId, seq, metadata);
    if (this.tracer) this.emitOtelEvent(row);
    return row;
  }

  async appendHitl(
    runId: string,
    nodeId: string,
    token: string,
    action: "created" | "resumed" | "expired" | "cancelled",
    payload?: unknown,
    decision?: unknown,
  ): Promise<EventRow> {
    const row = await this.eventLog.appendHitl(runId, nodeId, token, action, payload, decision);
    if (this.tracer) this.emitOtelEvent(row);
    return row;
  }

  async appendRunCompleted(
    runId: string,
    output: unknown,
    durationMs: number,
    nodeCount: number,
  ): Promise<EventRow> {
    const row = await this.eventLog.appendRunCompleted(runId, output, durationMs, nodeCount);
    if (this.tracer) this.emitOtelEvent(row);
    return row;
  }

  async appendRunFailed(
    runId: string,
    error: { message: string; code?: string; cause?: unknown },
    durationMs: number,
    completedNodes: number,
  ): Promise<EventRow> {
    const row = await this.eventLog.appendRunFailed(runId, error, durationMs, completedNodes);
    if (this.tracer) this.emitOtelEvent(row);
    return row;
  }

  async appendRunCancelled(
    runId: string,
    reason: string,
    durationMs: number,
    completedNodes: number,
  ): Promise<EventRow> {
    const row = await this.eventLog.appendRunCancelled(runId, reason, durationMs, completedNodes);
    if (this.tracer) this.emitOtelEvent(row);
    return row;
  }

  /**
   * Emit OTel span event for a row.
   */
  private emitOtelEvent(row: EventRow): void {
    if (!this.tracer) return;

    const span = this.tracer.startSpan(`event.${row.eventType}`, {
      attributes: {
        "run.id": row.runId,
        "event.seq": row.seq,
        "event.type": row.eventType,
        "event.id": row.id,
      },
    });

    // Add event-specific attributes
    const payload = row.payload as Record<string, unknown>;
    for (const [key, value] of Object.entries(payload)) {
      if (value !== undefined && value !== null) {
        const strValue = typeof value === "object" ? JSON.stringify(value) : String(value);
        if (strValue.length <= 1000) {
          span.setAttribute(`event.${key}`, strValue);
        }
      }
    }

    span.end();
  }
}

/**
 * Create an OtelEventLog wrapper around an EventLog.
 * Returns the original EventLog if OTel is not available.
 *
 * @param eventLog - EventLog instance to wrap
 * @returns OtelEventLog or original EventLog
 */
export function createOtelEventLog(eventLog: any): any {
  if (!isOtelAvailable()) {
    return eventLog;
  }
  return new OtelEventLog(eventLog);
}

/**
 * Create a root span for a run.
 * Returns a span that should be ended when the run completes.
 *
 * @param runId - Run identifier
 * @param graphId - Graph identifier
 * @param threadId - Optional thread identifier
 * @returns OtelSpan or null if OTel not available
 */
export function createRunSpan(
  runId: string,
  graphId: string,
  threadId?: string,
): OtelSpan | null {
  const tracer = getOtelTracer();
  if (!tracer) return null;

  const span = tracer.startSpan("agent.run", {
    attributes: {
      "run.id": runId,
      "graph.id": graphId,
      "thread.id": threadId ?? "",
    },
  });

  return span;
}

/**
 * Create a span for a node execution.
 *
 * @param runId - Run identifier
 * @param nodeId - Node identifier
 * @param nodeType - Node type
 * @param attempt - Attempt number
 * @returns OtelSpan or null if OTel not available
 */
export function createNodeSpan(
  runId: string,
  nodeId: string,
  nodeType: string,
  attempt: number = 1,
): OtelSpan | null {
  const tracer = getOtelTracer();
  if (!tracer) return null;

  const span = tracer.startSpan(`agent.node.${nodeType}`, {
    attributes: {
      "run.id": runId,
      "node.id": nodeId,
      "node.type": nodeType,
      "node.attempt": attempt,
    },
  });

  return span;
}

/**
 * Create a span for a tool call.
 *
 * @param runId - Run identifier
 * @param nodeId - Node identifier
 * @param toolName - Tool name
 * @param idempotencyKey - Optional idempotency key
 * @returns OtelSpan or null if OTel not available
 */
export function createToolSpan(
  runId: string,
  nodeId: string,
  toolName: string,
  idempotencyKey?: string,
): OtelSpan | null {
  const tracer = getOtelTracer();
  if (!tracer) return null;

  const span = tracer.startSpan(`agent.tool.${toolName}`, {
    attributes: {
      "run.id": runId,
      "node.id": nodeId,
      "tool.name": toolName,
      "tool.idempotency_key": idempotencyKey ?? "",
    },
  });

  return span;
}

/**
 * Create a span for a HITL interrupt.
 *
 * @param runId - Run identifier
 * @param nodeId - Node identifier
 * @param token - HITL token
 * @returns OtelSpan or null if OTel not available
 */
export function createHitlSpan(
  runId: string,
  nodeId: string,
  token: string,
): OtelSpan | null {
  const tracer = getOtelTracer();
  if (!tracer) return null;

  const span = tracer.startSpan("agent.hitl", {
    attributes: {
      "run.id": runId,
      "node.id": nodeId,
      "hitl.token": token,
    },
  });

  return span;
}