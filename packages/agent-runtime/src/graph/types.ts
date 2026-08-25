/**
 * Executable node kinds for the self-built graph workflow engine.
 * Kept closed so GraphCompiler can reject typos before a run starts.
 */
export type NodeType =
  | "start"
  | "end"
  | "llm"
  | "tool"
  | "fn"
  | "branch"
  | "hitl"
  | "subgraph";

/** Closed set used by the compiler for O(1) type checks. */
export const NODE_TYPES: readonly NodeType[] = [
  "start",
  "end",
  "llm",
  "tool",
  "fn",
  "branch",
  "hitl",
  "subgraph",
] as const;

/**
 * Per-node retry policy so transient executor failures do not fail the whole run
 * until attempts are exhausted (runtime applies backoff/jitter).
 */
export interface RetryPolicy {
  /** Total attempts including the first try; must be >= 1 when present. */
  maxAttempts: number;
  /** Base delay in ms before the next attempt. */
  backoffMs?: number;
  /** When true, runtime may randomize backoff to avoid thundering herds. */
  jitter?: boolean;
}

/**
 * Single graph node. `id` is the stable handle for edges and checkpoints.
 */
export interface GraphNode {
  id: string;
  type: NodeType;
  name?: string;
  /** Type-specific config (prompt, tool name, fn ref, etc.). Opaque at compile time. */
  config?: Record<string, unknown>;
  retry?: RetryPolicy;
  timeoutMs?: number;
}

/**
 * Directed edge. Optional `condition` selects a branch path at runtime;
 * `onError` marks the failure-routing edge after retries are exhausted.
 */
export interface GraphEdge {
  from: string;
  to: string;
  condition?: string;
  onError?: boolean;
}

/**
 * Authoring-time graph definition. `graphId` may be omitted; compileGraph assigns one.
 */
export interface GraphDefinition {
  graphId?: string;
  name?: string;
  version?: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Optional explicit entry; otherwise inferred from a `start` node or sole root. */
  entryNodeId?: string;
}

/**
 * Immutable compile output consumed by the scheduler/runtime.
 * Adjacency and terminals are precomputed so scheduling stays O(ready set).
 */
export interface CompiledGraph {
  graphId: string;
  name?: string;
  version?: string;
  nodes: ReadonlyMap<string, GraphNode>;
  edges: readonly GraphEdge[];
  entryNodeId: string;
  terminalNodeIds: readonly string[];
  /** Normal (non-onError) successors per node id. */
  adjacency: ReadonlyMap<string, readonly string[]>;
  /** Source definition snapshot (with assigned graphId). */
  definition: GraphDefinition;
}
