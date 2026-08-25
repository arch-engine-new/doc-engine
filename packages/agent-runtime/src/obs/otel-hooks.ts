/**
 * Optional OpenTelemetry hooks for EventLog.
 *
 * Why: Provides distributed tracing integration without mandatory OTel dependency.
 * Uses try/catch require to gracefully degrade when @opentelemetry/* packages
 * are not installed. Emits span events alongside EventLog for correlation.
 */

import type { EventLog, EventType, EventPayload, EventRow } from "./event-log.js";

/** OpenTelemetry Span interface (subset used). */
interface OtelSpan {
  name: string;
  setAttribute(key: string, value: string | number | boolean): this;
  setAttributes(attributes: Record<string, string | number | boolean>): this;
  addEvent(name: string, attributes?: Record<string, string | number | boolean>): this;
  recordException(exception: Error, attributes?: Record<string, string | number | boolean>): this;
  end(): void;
}

/** OpenTelemetry Tracer interface (subset used). */
interface OtelTracer {
  startSpan(name: string, options?: { attributes?: Record<string, string | number | boolean> }): OtelSpan;
  startActiveSpan<T>(name: string, fn: (span: OtelSpan) => T): T;
}

/** OpenTelemetry Context interface (subset used). */
interface OtelContext {
  setValue(key: symbol, value: unknown): OtelContext;
}

/** OpenTelemetry API module shape. */
interface OtelApi {
  trace: {
    getTracer(name: string, version?: string): OtelTracer;
    setSpan(context: OtelContext, span: OtelSpan): OtelContext;
    getSpan(context: OtelContext): OtelSpan | undefined;
    getActiveContext(): OtelContext;
  };
  context: {
    active(): OtelContext;
    with(context: OtelContext, fn: () => void): void;
  };
  SpanStatusCode: { OK: number; ERROR: number };
}

/** Cached OTel API instance (lazy-loaded). */
let otelApi: OtelApi | null = null;
let otelLoadAttempted = false;

/**
 * Try to load OpenTelemetry API dynamically.
 * Returns null if not available (packages not installed).
 */
function loadOtelApi(): OtelApi | null {
  if (otelLoadAttempted) {
    return otelApi;
  }
  otelLoadAttempted = true;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const api = require("@opentelemetry/api") as OtelApi;
    otelApi = api;
    return api;
  } catch {
    // OTel not installed - this is expected in many environments
    return null;
  }
}

/**
 * Get the OTel tracer for agent-runtime.
 * Returns null if OTel is not available.
 */
function getTracer(): OtelTracer | null {
  const api = loadOtelApi();
  if (!api) return null;
  return api.trace.getTracer("agent-runtime", "0.1.0");
}

/**
 * Event type to span name mapping.
 */
const EVENT_SPAN_NAMES: Record<EventType, string> = {
  node_start: "node.start",
  node_end: "node.end",
  tool_call: "tool.call",
  checkpoint: "checkpoint",
  hitl: "hitl",
  run_started: "run.started",
  run_completed: "run.completed",
  run_failed: "run.failed",
  run_cancelled: "run.cancelled",
};

/**
 * Register OpenTelemetry hooks on an EventLog instance.
 * When OTel is available, wraps append() to emit span events.
 * When OTel is not available, this is a no-op (EventLog works normally).
 *
 * @param eventLog - EventLog instance to instrument
 * @returns The original EventLog (for chaining), or the wrapped version
 *
 * @example
 * ```ts
 * const eventLog = createEventLog(store);
 * registerOtelHooks(eventLog);
 * // Now eventLog.append() also emits OTel span events
 * ```
 */
export function registerOtelHooks(eventLog: EventLog): EventLog {
  const api = loadOtelApi();
  if (!api) {
    // OTel not available - return original unchanged
    return eventLog;
  }

  const tracer = getTracer();
  if (!tracer) {
    return eventLog;
  }

  // Store original append
  const originalAppend = eventLog.append.bind(eventLog);

  // Wrap append to emit span events
  eventLog.append = async (options: { runId: string; eventType: EventType; payload: EventPayload; seq?: number }) => {
    const { runId, eventType, payload, seq } = options;

    // Call original append first
    const row = await originalAppend({ runId, eventType, payload, seq });

    // Emit OTel span event
    const spanName = EVENT_SPAN_NAMES[eventType] ?? `event.${eventType}`;
    const span = tracer.startSpan(spanName, {
      attributes: {
        "agent.run_id": runId,
        "agent.event.seq": seq ?? row.seq,
        "agent.event.type": eventType,
      },
    });

    // Add payload as attributes (flattened for simple values)
    addPayloadAttributes(span, payload);

    // End span immediately (event spans are short-lived)
    span.end();

    return row;
  };

  return eventLog;
}

/**
 * Add payload properties as span attributes (for simple values only).
 * Complex objects are skipped to avoid attribute size limits.
 */
function addPayloadAttributes(span: OtelSpan, payload: EventPayload): void {
  if (!payload || typeof payload !== "object") return;

  const attrs: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (value === null || value === undefined) continue;

    const type = typeof value;
    if (type === "string" || type === "number" || type === "boolean") {
      attrs[`event.${key}`] = value;
    } else if (type === "object") {
      // For objects, add a JSON string attribute (truncated)
      try {
        const json = JSON.stringify(value);
        if (json.length <= 2000) {
          attrs[`event.${key}.json`] = json;
        } else {
          attrs[`event.${key}.json_truncated`] = json.slice(0, 2000) + "...";
        }
      } catch {
        // Ignore serialization errors
      }
    }
  }

  if (Object.keys(attrs).length > 0) {
    span.setAttributes(attrs);
  }
}

/**
 * Create a span for a run (parent span for the entire execution).
 * Returns a span that should be ended when the run completes.
 *
 * @param runId - Run identifier
 * @param graphId - Graph identifier
 * @param input - Run input (for attributes)
 * @returns OTel span or null if OTel not available
 */
export function createRunSpan(runId: string, graphId: string, input?: unknown): OtelSpan | null {
  const tracer = getTracer();
  if (!tracer) return null;

  const span = tracer.startSpan("run", {
    attributes: {
      "agent.run_id": runId,
      "agent.graph_id": graphId,
    },
  });

  if (input !== undefined) {
    try {
      const json = JSON.stringify(input);
      if (json.length <= 2000) {
        span.setAttribute("agent.run.input", json);
      }
    } catch {
      // Ignore
    }
  }

  return span;
}

/**
 * End a run span with final status.
 */
export function endRunSpan(span: OtelSpan | null, status: "completed" | "failed" | "cancelled", output?: unknown, error?: Error): void {
  if (!span) return;

  span.setAttribute("agent.run.status", status);

  if (output !== undefined) {
    try {
      const json = JSON.stringify(output);
      if (json.length <= 2000) {
        span.setAttribute("agent.run.output", json);
      }
    } catch {
      // Ignore
    }
  }

  if (error) {
    span.recordException(error);
    span.setAttribute("agent.run.error", error.message);
    if (error.cause) {
      span.setAttribute("agent.run.error_cause", String(error.cause));
    }
  }

  span.end();
}

/**
 * Check if OpenTelemetry is available.
 */
export function isOtelAvailable(): boolean {
  return loadOtelApi() !== null;
}

/**
 * Get the OTel API instance (for advanced usage).
 * Returns null if not available.
 */
export function getOtelApi(): OtelApi | null {
  return loadOtelApi();
}