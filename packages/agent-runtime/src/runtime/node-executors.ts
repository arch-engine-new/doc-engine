/**
 * Node executors for each GraphNode type.
 *
 * Why: Separates execution logic from scheduling, making each executor
 * independently testable and replaceable. fn/branch are implemented;
 * llm/tool/hitl/subgraph throw NotImplementedError with clear messages
 * so the scheduler integrates end-to-end without external deps.
 */

import type { GraphNode } from "../graph/types.js";
import type { ExecutionContext } from "./state.js";
import type { RetryPolicy } from "../graph/types.js";
import { ToolRuntime, type ExecuteOptions } from "../tools/runtime.js";
import { getDefaultRegistry } from "../tools/registry.js";

/** Result of executing a single node. */
export interface NodeResult {
  /** Channels to merge into global state. */
  updates: Record<string, unknown>;
  /** Optional explicit next node ids (for dynamic routing beyond static edges). */
  nextNodeIds?: string[];
  /** If true, the node signals "no further execution" (treated as terminal). */
  halt?: boolean;
}

/** Base executor interface. */
export interface NodeExecutor {
  /** Execute the node with the given context. */
  execute(node: GraphNode, context: ExecutionContext): Promise<NodeResult>;
  /** Node type this executor handles. */
  readonly nodeType: GraphNode["type"];
}

/** Error thrown for unimplemented node types. */
export class NotImplementedError extends Error {
  readonly nodeType: GraphNode["type"];

  constructor(nodeType: GraphNode["type"]) {
    super(`Executor for node type "${nodeType}" is not implemented yet. Implement in node-executors.ts or provide a custom executor.`);
    this.name = "NotImplementedError";
    this.nodeType = nodeType;
  }
}

/**
 * Function node executor.
 * Expects node.config.fn to be a function (string reference resolved by caller)
 * or node.config.inlineFn to be an inline async function.
 * Reads inputs from channels specified in node.config.inputChannels (default: ["input"]).
 * Writes output to channel specified in node.config.outputChannel (default: node.id).
 */
export class FnExecutor implements NodeExecutor {
  readonly nodeType = "fn" as const;

  async execute(node: GraphNode, context: ExecutionContext): Promise<NodeResult> {
    const config = node.config ?? {};
    const inputChannels: string[] = (config.inputChannels as string[]) ?? ["input"];
    const outputChannel: string = (config.outputChannel as string) ?? node.id;

    // Resolve inputs from channels
    const inputs: Record<string, unknown> = {};
    for (const ch of inputChannels) {
      inputs[ch] = getChannel(context.channels, ch);
    }

    // Get the function to execute
    let fn: ((inputs: Record<string, unknown>, context: ExecutionContext) => Promise<unknown>) | undefined;

    if (typeof config.inlineFn === "function") {
      fn = config.inlineFn as typeof fn;
    } else if (typeof config.fn === "function") {
      fn = config.fn as typeof fn;
    } else if (typeof config.fn === "string") {
      // String reference - in real impl would resolve from registry
      throw new Error(`Function reference "${config.fn}" not registered. Use inlineFn or register function.`);
    } else {
      throw new Error(`fn node "${node.id}" requires config.fn (function) or config.inlineFn`);
    }

    // fn is guaranteed to be defined here (throw above if not)
    const fnImpl = fn!;

    // Execute with timeout if configured
    const timeoutMs = node.timeoutMs ?? 30000;
    const output = await this.withTimeout(fnImpl(inputs, context), timeoutMs, `fn node "${node.id}" timed out after ${timeoutMs}ms`);

    return {
      updates: { [outputChannel]: output },
    };
  }

  private async withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
    ]);
  }
}

/**
 * Branch node executor.
 * Evaluates node.config.condition (a function receiving channel values)
 * and returns the matching edge's `condition` value to route dynamically.
 * Expects exactly one outgoing edge with matching condition, or a default (no condition).
 */
export class BranchExecutor implements NodeExecutor {
  readonly nodeType = "branch" as const;

  async execute(node: GraphNode, context: ExecutionContext): Promise<NodeResult> {
    const config = node.config ?? {};

    if (typeof config.condition !== "function") {
      throw new Error(`branch node "${node.id}" requires config.condition function`);
    }

    // Read all channels for condition evaluation
    const channelValues = serializeChannels(context.channels);

    const conditionResult = await config.condition(channelValues, context);

    // Find matching edge from compiled graph
    const compiledGraph = context.compiledGraph;
    const edges = compiledGraph.edges.filter((e) => e.from === node.id && !e.onError);

    let matchedEdge: typeof edges[0] | undefined;
    for (const edge of edges) {
      if (edge.condition === undefined) {
        // Default edge (no condition) - use if no explicit match
        if (!matchedEdge) matchedEdge = edge;
      } else if (edge.condition === conditionResult) {
        matchedEdge = edge;
        break; // Explicit match wins
      }
    }

    if (!matchedEdge) {
      throw new Error(`branch node "${node.id}": no matching edge for condition "${conditionResult}"`);
    }

    return {
      updates: {},
      nextNodeIds: [matchedEdge.to],
    };
  }
}

/**
 * LLM node executor - NOT IMPLEMENTED.
 * Would call an LLM provider with prompt from config, stream/return response.
 */
export class LLMExecutor implements NodeExecutor {
  readonly nodeType = "llm" as const;

  async execute(_node: GraphNode, _context: ExecutionContext): Promise<NodeResult> {
    throw new NotImplementedError("llm");
  }
}

/**
 * Tool node executor.
 * Invokes a registered tool via ToolRuntime with validation, timeout, retry, and idempotency.
 *
 * Configuration (node.config):
 * - toolName: string (required) - Name of the registered tool to invoke
 * - inputFrom: string (optional) - Channel whose object value is passed as tool args (see execute)
 * - inputChannels: string[] (optional, default: ["input"]) - Channels to read input from when inputFrom is unset
 * - outputChannel: string (optional, default: node.id) - Channel to write output to
 * - idempotencyKey: string (optional) - Key for idempotent execution (can be a template like "{{runId}}-{{nodeId}}")
 * - retry: RetryPolicy (optional) - Override retry policy from node.retry
 * - timeoutMs: number (optional) - Override timeout from node.timeoutMs
 */
export class ToolExecutor implements NodeExecutor {
  readonly nodeType = "tool" as const;
  private runtime: ToolRuntime;

  constructor(runtime?: ToolRuntime) {
    this.runtime = runtime ?? new ToolRuntime(getDefaultRegistry());
  }

  /**
   * Set a custom ToolRuntime (useful for testing or custom registries).
   */
  setRuntime(runtime: ToolRuntime): void {
    this.runtime = runtime;
  }

  /**
   * Invoke the registered tool. `inputFrom` unwraps a channel object so tool
   * schemas receive `{ packId, query }` rather than `{ search_args: {...} }`.
   */
  async execute(node: GraphNode, context: ExecutionContext): Promise<NodeResult> {
    const config = node.config ?? {};

    // Get tool name from config
    const toolName = config.toolName as string | undefined;
    if (!toolName) {
      throw new Error(`tool node "${node.id}" requires config.toolName`);
    }

    const outputChannel: string = (config.outputChannel as string) ?? node.id;
    const input = this.resolveToolInput(node.id, config, context.channels);

    // Resolve idempotency key with template substitution
    let idempotencyKey: string | undefined;
    if (config.idempotencyKey) {
      idempotencyKey = this.resolveTemplate(config.idempotencyKey as string, context, node);
    }

    // Build execution options
    const options: ExecuteOptions = {
      idempotencyKey,
      timeoutMs: node.timeoutMs ?? (config.timeoutMs as number | undefined),
      retryPolicy: node.retry ?? (config.retry as RetryPolicy | undefined),
      runId: context.runId,
      nodeExecutionId: context.nodeExecutionId,
    };

    // Execute tool via runtime
    const result = await this.runtime.execute(toolName, input, options);

    return {
      updates: { [outputChannel]: result.output },
    };
  }

  /**
   * Why: tool schemas expect flattened args like `{ packId, query }`, not
   * `{ search_args: {...} }`. Missing/non-object must throw so graphs fail loud.
   */
  private resolveToolInput(
    nodeId: string,
    config: Record<string, unknown>,
    channels: ExecutionContext["channels"],
  ): Record<string, unknown> {
    const inputFrom = config.inputFrom;
    if (typeof inputFrom === "string") {
      const value = getChannel(channels, inputFrom);
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
        throw new Error(
          `tool node "${nodeId}" config.inputFrom="${inputFrom}" must be a non-null object`,
        );
      }
      return value as Record<string, unknown>;
    }

    const inputChannels: string[] = (config.inputChannels as string[]) ?? ["input"];
    const input: Record<string, unknown> = {};
    for (const ch of inputChannels) {
      input[ch] = getChannel(channels, ch);
    }
    return input;
  }

  /**
   * Resolve template variables in idempotency key.
   * Supported: {{runId}}, {{threadId}}, {{nodeId}}, {{attempt}}
   */
  private resolveTemplate(template: string, context: ExecutionContext, node: GraphNode): string {
    return template
      .replace(/\{\{runId\}\}/g, context.runId ?? "")
      .replace(/\{\{threadId\}\}/g, context.threadId ?? "")
      .replace(/\{\{nodeId\}\}/g, node.id)
      .replace(/\{\{attempt\}\}/g, String(context.attempt ?? 1));
  }
}

/**
 * Human-in-the-loop node executor - NOT IMPLEMENTED.
 * Would pause run, persist state, await external resume signal.
 */
export class HITLExecutor implements NodeExecutor {
  readonly nodeType = "hitl" as const;

  async execute(_node: GraphNode, _context: ExecutionContext): Promise<NodeResult> {
    throw new NotImplementedError("hitl");
  }
}

/**
 * Subgraph node executor - NOT IMPLEMENTED.
 * Would spawn a nested run with subgraph definition.
 */
export class SubgraphExecutor implements NodeExecutor {
  readonly nodeType = "subgraph" as const;

  async execute(_node: GraphNode, _context: ExecutionContext): Promise<NodeResult> {
    throw new NotImplementedError("subgraph");
  }
}

/**
 * Start node executor - no-op, just passes input through.
 */
export class StartExecutor implements NodeExecutor {
  readonly nodeType = "start" as const;

  async execute(_node: GraphNode, _context: ExecutionContext): Promise<NodeResult> {
    return { updates: {} };
  }
}

/**
 * End node executor - signals halt.
 */
export class EndExecutor implements NodeExecutor {
  readonly nodeType = "end" as const;

  async execute(_node: GraphNode, _context: ExecutionContext): Promise<NodeResult> {
    return { updates: {}, halt: true };
  }
}

/** Map of all built-in executors by node type. */
export const BUILTIN_EXECUTORS: ReadonlyMap<GraphNode["type"], NodeExecutor> = new Map<
  GraphNode["type"],
  NodeExecutor
>([
  ["fn", new FnExecutor()],
  ["branch", new BranchExecutor()],
  ["llm", new LLMExecutor()],
  ["tool", new ToolExecutor()],
  ["hitl", new HITLExecutor()],
  ["subgraph", new SubgraphExecutor()],
  ["start", new StartExecutor()],
  ["end", new EndExecutor()],
]);

/**
 * Get executor for a node type.
 * Throws if no executor registered (should not happen for known types).
 */
export function getExecutor(nodeType: GraphNode["type"]): NodeExecutor {
  const executor = BUILTIN_EXECUTORS.get(nodeType);
  if (!executor) {
    throw new Error(`No executor registered for node type "${nodeType}"`);
  }
  return executor;
}

/** Helper to serialize channels for condition functions. */
function serializeChannels(channels: Map<string, { value: unknown; version: number }>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, channel] of channels) {
    out[name] = channel.value;
  }
  return out;
}

/** Helper to read a single channel. */
function getChannel(channels: Map<string, { value: unknown; version: number }>, name: string): unknown {
  return channels.get(name)?.value;
}