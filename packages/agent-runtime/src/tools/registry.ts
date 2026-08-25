/**
 * ToolRegistry manages tool definitions and their schemas.
 *
 * Tools are registered with input/output schemas for validation.
 * The registry is used by ToolRuntime to look up tools at execution time.
 */

import { type JsonSchema } from "./runtime.js";

/**
 * Tool schema definition with input and output validation.
 */
export interface ToolSchema {
  /** JSON Schema for validating tool input arguments. */
  input: JsonSchema;
  /** JSON Schema for validating tool output result. */
  output: JsonSchema;
}

/**
 * Tool handler function signature.
 * Receives validated input and returns output to be validated.
 */
export type ToolHandler<Input = unknown, Output = unknown> = (
  input: Input,
) => Promise<Output>;

/**
 * Registered tool entry.
 */
export interface RegisteredTool<Input = unknown, Output = unknown> {
  /** Unique tool name. */
  name: string;
  /** Tool schema for validation. */
  schema: ToolSchema;
  /** Tool handler implementation. */
  handler: ToolHandler<Input, Output>;
  /** Optional description for documentation. */
  description?: string;
}

/**
 * ToolRegistry provides a centralized registry for tools with schema validation.
 *
 * @example
 * ```typescript
 * const registry = new ToolRegistry();
 * registry.register("add", {
 *   input: { type: "object", properties: { a: { type: "number" }, b: { type: "number" } }, required: ["a", "b"] },
 *   output: { type: "number" }
 * }, async ({ a, b }) => a + b);
 * ```
 */
export class ToolRegistry {
  private tools = new Map<string, RegisteredTool<unknown, unknown>>();

  /**
   * Register a new tool with input/output schemas and handler.
   *
   * @param name - Unique tool identifier
   * @param schema - Input and output JSON schemas
   * @param handler - Async function implementing the tool logic
   * @param description - Optional human-readable description
   * @throws {Error} If a tool with the same name is already registered
   */
  register<Input = unknown, Output = unknown>(
    name: string,
    schema: ToolSchema,
    handler: ToolHandler<Input, Output>,
    description?: string,
  ): void {
    if (this.tools.has(name)) {
      throw new Error(`Tool "${name}" is already registered`);
    }

    this.tools.set(name, {
      name,
      schema,
      handler: handler as ToolHandler<unknown, unknown>,
      description,
    });
  }

  /**
   * Get a registered tool by name.
   *
   * @param name - Tool name to retrieve
   * @returns The registered tool or undefined if not found
   */
  get<Input = unknown, Output = unknown>(name: string): RegisteredTool<Input, Output> | undefined {
    return this.tools.get(name) as RegisteredTool<Input, Output> | undefined;
  }

  /**
   * List all registered tool names.
   *
   * @returns Array of tool names
   */
  list(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Check if a tool is registered.
   *
   * @param name - Tool name to check
   * @returns true if tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Remove a tool from the registry.
   *
   * @param name - Tool name to remove
   * @returns true if tool was removed, false if not found
   */
  remove(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Get all registered tools.
   *
   * @returns Array of all registered tools
   */
  getAll(): RegisteredTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Clear all registered tools.
   */
  clear(): void {
    this.tools.clear();
  }
}

/**
 * Default global tool registry instance.
 * Use ToolRegistry.getDefault() for a shared singleton.
 */
let defaultRegistry: ToolRegistry | null = null;

/**
 * Get or create the default global tool registry.
 */
export function getDefaultRegistry(): ToolRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new ToolRegistry();
  }
  return defaultRegistry;
}

/**
 * Set a custom default registry (useful for testing).
 */
export function setDefaultRegistry(registry: ToolRegistry): void {
  defaultRegistry = registry;
}