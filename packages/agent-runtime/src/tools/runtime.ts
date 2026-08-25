/**
 * ToolRuntime executes registered tools with validation, timeout, retry, and idempotency.
 *
 * Features:
 * - Input/output schema validation
 * - Configurable timeout with AbortController
 * - Retry policy with exponential backoff and optional jitter
 * - Idempotency key support with persistent storage
 */

import type { StateStore, StoredToolCall } from "../persistence/types.js";
import { ToolRegistry, type RegisteredTool, type ToolSchema, getDefaultRegistry } from "./registry.js";

/**
 * Retry policy configuration for tool execution.
 * Mirrors graph node RetryPolicy from graph/types.ts
 */
export interface RetryPolicy {
  /** Total attempts including the first try; must be >= 1. */
  maxAttempts: number;
  /** Base delay in ms before the next attempt. Default: 1000ms. */
  backoffMs?: number;
  /** When true, runtime adds random jitter to backoff. Default: true. */
  jitter?: boolean;
}

/**
 * Options for tool execution.
 */
export interface ExecuteOptions {
  /** Optional idempotency key for deduplication. */
  idempotencyKey?: string;
  /** Optional timeout in milliseconds. Default: 30000ms. */
  timeoutMs?: number;
  /** Optional retry policy. If not provided, no retry is attempted. */
  retryPolicy?: RetryPolicy;
  /** Run ID for persistence context. Required if idempotencyKey is used. */
  runId?: string;
  /** Node execution ID for persistence context. Required if idempotencyKey is used. */
  nodeExecutionId?: number;
}

/**
 * Result of tool execution.
 */
export interface ToolExecutionResult<Output = unknown> {
  /** The tool output (validated against output schema). */
  output: Output;
  /** Duration of execution in milliseconds. */
  durationMs: number;
  /** Number of attempts made (1 if no retry). */
  attempts: number;
  /** Whether the result was returned from idempotency cache. */
  fromCache: boolean;
}

/**
 * Observed tool execution result (for trace event emission via onToolCall).
 */
export interface ToolCallObserved {
  /** Run identifier (may be undefined if not provided to execute). */
  runId?: string;
  /** Tool name. */
  toolName: string;
  /** Validated input arguments. */
  request: unknown;
  /** Output (null on failure). */
  response: unknown | null;
  /** Terminal status. */
  status: "success" | "failed";
  /** Error details (null on success). */
  error: { message: string; code: string } | null;
  /** Execution duration in milliseconds. */
  durationMs: number;
  /** Idempotency key, if any. */
  idempotencyKey?: string;
  /** Whether the result came from the idempotency cache. */
  fromCache: boolean;
}

/**
 * Tool execution error with context.
 */
export class ToolExecutionError extends Error {
  readonly toolName: string;
  readonly code: "VALIDATION_ERROR" | "TIMEOUT" | "HANDLER_ERROR" | "NOT_FOUND" | "IDEMPOTENCY_CONFLICT";
  readonly attempt: number;
  readonly cause?: Error;

  constructor(
    toolName: string,
    code: ToolExecutionError["code"],
    message: string,
    attempt: number,
    cause?: Error,
  ) {
    super(message);
    this.name = "ToolExecutionError";
    this.toolName = toolName;
    this.code = code;
    this.attempt = attempt;
    this.cause = cause;
  }
}

/**
 * JSON Schema type definition (subset of JSON Schema Draft 7).
 * Avoids external dependency on json-schema package.
 */
export interface JsonSchema {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  items?: JsonSchema;
  enum?: unknown[];
  format?: string;
  minimum?: number;
  maximum?: number;
  [key: string]: unknown;
}

/**
 * Simple JSON Schema validator (subset implementation).
 * Validates input against a JSON Schema Draft 7 subset.
 */
class SchemaValidator {
  /**
   * Validate a value against a JSON schema.
   * Throws ToolExecutionError on validation failure.
   */
  static validate(value: unknown, schema: ToolSchema["input"], context: string): void {
    this.validateValue(value, schema, context);
  }

  /**
   * Validate output value against output schema.
   */
  static validateOutput(value: unknown, schema: ToolSchema["output"], context: string): void {
    this.validateValue(value, schema, context);
  }

  private static validateValue(value: unknown, schema: JsonSchema, path: string): void {
    // Type validation
    if (schema.type) {
      const types = Array.isArray(schema.type) ? schema.type : [schema.type];
      const valueType = this.getJsonType(value);
      if (!types.includes(valueType)) {
        throw new ToolExecutionError(
          "",
          "VALIDATION_ERROR",
          `${path}: expected type ${types.join(" or ")}, got ${valueType}`,
          0,
        );
      }
    }

    // Required properties (for objects)
    if (schema.type === "object" || !schema.type) {
      if (schema.required && Array.isArray(schema.required)) {
        for (const req of schema.required) {
          if (value && typeof value === "object" && !(req in (value as Record<string, unknown>))) {
            throw new ToolExecutionError(
              "",
              "VALIDATION_ERROR",
              `${path}: required property "${req}" is missing`,
              0,
            );
          }
        }
      }

      // Properties validation
      if (schema.properties && value && typeof value === "object") {
        const obj = value as Record<string, unknown>;
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          if (key in obj) {
            this.validateValue(obj[key], propSchema as JsonSchema, `${path}.${key}`);
          }
        }
      }

      // Additional properties check
      if (schema.additionalProperties === false && value && typeof value === "object") {
        const obj = value as Record<string, unknown>;
        const allowedKeys = new Set([
          ...Object.keys(schema.properties ?? {}),
          ...(schema.required ?? []),
        ]);
        for (const key of Object.keys(obj)) {
          if (!allowedKeys.has(key)) {
            throw new ToolExecutionError(
              "",
              "VALIDATION_ERROR",
              `${path}: additional property "${key}" is not allowed`,
              0,
            );
          }
        }
      }
    }

    // Array items validation
    if (schema.type === "array" && schema.items && Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        this.validateValue(value[i], schema.items as JsonSchema, `${path}[${i}]`);
      }
    }

    // Enum validation
    if (schema.enum && Array.isArray(schema.enum)) {
      if (!schema.enum.includes(value)) {
        throw new ToolExecutionError(
          "",
          "VALIDATION_ERROR",
          `${path}: value must be one of ${schema.enum.map((v) => JSON.stringify(v)).join(", ")}`,
          0,
        );
      }
    }

    // String format validation (basic)
    if (schema.type === "string" && schema.format) {
      if (schema.format === "email" && typeof value === "string") {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          throw new ToolExecutionError(
            "",
            "VALIDATION_ERROR",
            `${path}: invalid email format`,
            0,
          );
        }
      }
      if (schema.format === "uuid" && typeof value === "string") {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
          throw new ToolExecutionError(
            "",
            "VALIDATION_ERROR",
            `${path}: invalid uuid format`,
            0,
          );
        }
      }
    }

    // Number constraints
    if (schema.type === "number" || schema.type === "integer") {
      if (typeof value === "number") {
        if (schema.minimum !== undefined && value < schema.minimum) {
          throw new ToolExecutionError(
            "",
            "VALIDATION_ERROR",
            `${path}: value ${value} is less than minimum ${schema.minimum}`,
            0,
          );
        }
        if (schema.maximum !== undefined && value > schema.maximum) {
          throw new ToolExecutionError(
            "",
            "VALIDATION_ERROR",
            `${path}: value ${value} is greater than maximum ${schema.maximum}`,
            0,
          );
        }
        if (schema.type === "integer" && !Number.isInteger(value)) {
          throw new ToolExecutionError(
            "",
            "VALIDATION_ERROR",
            `${path}: value must be an integer`,
            0,
          );
        }
      }
    }
  }

  private static getJsonType(value: unknown): string {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    return typeof value;
  }
}

/**
 * ToolRuntime executes tools with full validation, timeout, retry, and idempotency support.
 */
export class ToolRuntime {
  private registry: ToolRegistry;
  private store?: StateStore;

  /**
   * Optional observability hook: called once per execute() for each terminal
   * outcome (success, failure, or idempotency cache hit). Used to emit
   * tool_call events into a run's trace.
   */
  onToolCall?: (record: ToolCallObserved) => void | Promise<void>;

  /**
   * Create a new ToolRuntime.
   *
   * @param registry - ToolRegistry instance (uses default if not provided)
   * @param store - Optional StateStore for idempotency persistence
   */
  constructor(registry?: ToolRegistry, store?: StateStore) {
    this.registry = registry ?? new ToolRegistry();
    this.store = store;
  }

  /**
   * Get the underlying tool registry.
   */
  getRegistry(): ToolRegistry {
    return this.registry;
  }

  /**
   * Execute a tool by name with full validation, timeout, retry, and idempotency.
   *
   * @param name - Tool name to execute
   * @param input - Input arguments (will be validated against input schema)
   * @param options - Execution options (idempotency, timeout, retry)
   * @returns Tool execution result with output and metadata
   * @throws {ToolExecutionError} On validation failure, timeout, handler error, or tool not found
   */
  async execute<Input = unknown, Output = unknown>(
    name: string,
    input: Input,
    options: ExecuteOptions = {},
  ): Promise<ToolExecutionResult<Output>> {
    const {
      idempotencyKey,
      timeoutMs = 30000,
      retryPolicy,
      runId,
      nodeExecutionId,
    } = options;

    // Look up tool
    const tool = this.registry.get<Input, Output>(name);
    if (!tool) {
      throw new ToolExecutionError(name, "NOT_FOUND", `Tool "${name}" not found`, 0);
    }

    // Check idempotency cache first
    if (idempotencyKey && this.store) {
      const cached = await this.store.getToolCallByIdempotencyKey(idempotencyKey);
      if (cached && cached.status === "success" && cached.responseJson !== null) {
        const fromCacheResult = {
          output: cached.responseJson as Output,
          durationMs: cached.durationMs ?? 0,
          attempts: 1,
          fromCache: true,
        };
        await this.emitToolCall({
          runId,
          toolName: name,
          request: input,
          response: cached.responseJson as Output,
          status: "success",
          error: null,
          durationMs: cached.durationMs ?? 0,
          idempotencyKey,
          fromCache: true,
        });
        return fromCacheResult;
      }
    }

    // Validate input
    try {
      SchemaValidator.validate(input, tool.schema.input, `tool.${name}.input`);
    } catch (error) {
      if (error instanceof ToolExecutionError) {
        throw new ToolExecutionError(name, "VALIDATION_ERROR", error.message, 0, error);
      }
      throw error;
    }

    // Execute with retry logic
    const policy = retryPolicy ?? { maxAttempts: 1, backoffMs: 1000, jitter: true };
    const maxAttempts = Math.max(1, policy.maxAttempts);
    const baseBackoff = policy.backoffMs ?? 1000;
    const useJitter = policy.jitter ?? true;

    let lastError: Error | undefined;
    let attempt = 0;

    // Create tool call record once for idempotency tracking (before retry loop)
    let toolCallId: number | undefined;
    if (idempotencyKey && this.store && runId && nodeExecutionId) {
      toolCallId = await this.store.createToolCall({
        runId,
        nodeExecutionId,
        toolName: name,
        idempotencyKey,
        requestJson: input,
        responseJson: null,
        status: "pending",
        errorJson: null,
        durationMs: 0,
      });
    }

    for (attempt = 1; attempt <= maxAttempts; attempt++) {
      const startTime = Date.now();

      try {

        // Execute with timeout
        const output = await this.executeWithTimeout(
          () => tool.handler(input),
          timeoutMs,
          name,
        );

        // Validate output
        try {
          SchemaValidator.validateOutput(output, tool.schema.output, `tool.${name}.output`);
        } catch (error) {
          if (error instanceof ToolExecutionError) {
            throw new ToolExecutionError(name, "VALIDATION_ERROR", error.message, attempt, error);
          }
          throw error;
        }

        const durationMs = Date.now() - startTime;

        // Update tool call record on success
        if (toolCallId && this.store) {
          await this.store.updateToolCall(toolCallId, {
            responseJson: output,
            status: "success",
            durationMs,
          });
        }

        await this.emitToolCall({
          runId,
          toolName: name,
          request: input,
          response: output,
          status: "success",
          error: null,
          durationMs,
          idempotencyKey,
          fromCache: false,
        });

        return {
          output: output as Output,
          durationMs,
          attempts: attempt,
          fromCache: false,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const durationMs = Date.now() - startTime;

        // Update tool call record on failure
        if (toolCallId && this.store) {
          await this.store.updateToolCall(toolCallId, {
            status: "failed",
            errorJson: { message: lastError.message, code: "HANDLER_ERROR" },
            durationMs,
          });
        }

        await this.emitToolCall({
          runId,
          toolName: name,
          request: input,
          response: null,
          status: "failed",
          error: { message: lastError.message, code: "HANDLER_ERROR" },
          durationMs,
          idempotencyKey,
          fromCache: false,
        });

        // Don't retry on validation errors or not found
        if (error instanceof ToolExecutionError) {
          if (error.code === "VALIDATION_ERROR" || error.code === "NOT_FOUND") {
            throw error;
          }
          // For timeout, retry if attempts remain
          if (error.code === "TIMEOUT" && attempt < maxAttempts) {
            await this.sleep(this.calculateBackoff(attempt, baseBackoff, useJitter));
            continue;
          }
        }

        // Retry on other errors if attempts remain
        if (attempt < maxAttempts) {
          await this.sleep(this.calculateBackoff(attempt, baseBackoff, useJitter));
          continue;
        }

        // Exhausted attempts - re-throw original error if it's a ToolExecutionError, otherwise wrap
        if (lastError instanceof ToolExecutionError) {
          throw lastError;
        }
        throw new ToolExecutionError(
          name,
          "HANDLER_ERROR",
          `Tool "${name}" failed after ${attempt} attempt(s): ${lastError.message}`,
          attempt,
          lastError,
        );
      }
    }

    // Should not reach here, but TypeScript needs it
    throw lastError ?? new ToolExecutionError(name, "HANDLER_ERROR", "Unknown error", attempt);
  }

  /**
   * Execute a promise with timeout.
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    toolName: string,
  ): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new ToolExecutionError(toolName, "TIMEOUT", `Tool "${toolName}" timed out after ${timeoutMs}ms`, 0));
      }, timeoutMs);
    });

    try {
      return await Promise.race([fn(), timeoutPromise]);
    } finally {
      clearTimeout(timeoutId!);
    }
  }

  /**
   * Calculate backoff with optional jitter.
   */
  private calculateBackoff(attempt: number, baseBackoff: number, jitter: boolean): number {
    const exponentialBackoff = baseBackoff * Math.pow(2, attempt - 1);
    if (jitter) {
      // Add ±25% jitter
      const jitterFactor = 0.75 + Math.random() * 0.5;
      return Math.floor(exponentialBackoff * jitterFactor);
    }
    return exponentialBackoff;
  }

  /**
   * Sleep for specified milliseconds.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Invoke the onToolCall observability hook if configured. Never throws:
   * observability must not break execution.
   */
  private async emitToolCall(record: ToolCallObserved): Promise<void> {
    if (!this.onToolCall) return;
    try {
      await this.onToolCall(record);
    } catch {
      // Swallow observer errors; the tool outcome stands.
    }
  }
}

/**
 * Create a ToolRuntime with the default registry and optional store.
 */
export function createToolRuntime(store?: StateStore): ToolRuntime {
  return new ToolRuntime(getDefaultRegistry(), store);
}

// Re-export for convenience
export { getDefaultRegistry, setDefaultRegistry } from "./registry.js";