import {
  NODE_TYPES,
  type CompiledGraph,
  type GraphDefinition,
  type GraphEdge,
  type GraphNode,
  type NodeType,
} from "./types.js";

const NODE_TYPE_SET: ReadonlySet<string> = new Set(NODE_TYPES);

/**
 * Thrown when a GraphDefinition fails static checks.
 * Callers should surface `code` to control APIs without parsing message text.
 */
export class GraphCompileError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "GraphCompileError";
    this.code = code;
  }
}

function isNodeType(value: string): value is NodeType {
  return NODE_TYPE_SET.has(value);
}

/** Prefer Web Crypto when available; fall back so compile stays dependency-free. */
function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) {
    return c.randomUUID();
  }
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function assignGraphId(existing?: string): string {
  if (existing !== undefined && existing.trim() !== "") {
    return existing;
  }
  return `graph_${newId()}`;
}

/**
 * Build the normal (non-onError) adjacency map.
 *
 * Why: onError edges must NOT contribute to in-degree/readiness — the scheduler
 * treats them as fallback routing only, so they are excluded here to keep
 * topo-order semantics deterministic.
 */
function buildAdjacency(
  nodeIds: ReadonlySet<string>,
  edges: readonly GraphEdge[],
): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();
  for (const id of nodeIds) {
    adjacency.set(id, []);
  }
  for (const edge of edges) {
    if (edge.onError) {
      continue;
    }
    const list = adjacency.get(edge.from);
    if (list) {
      list.push(edge.to);
    }
  }
  return adjacency;
}

function findTerminals(
  nodes: ReadonlyMap<string, GraphNode>,
  adjacency: ReadonlyMap<string, readonly string[]>,
): string[] {
  const terminals: string[] = [];
  for (const [id, node] of nodes) {
    if (node.type === "end") {
      terminals.push(id);
      continue;
    }
    const outs = adjacency.get(id) ?? [];
    if (outs.length === 0) {
      terminals.push(id);
    }
  }
  return terminals;
}

/**
 * Resolve the entry node id.
 *
 * Why: the runtime launches from exactly one entry; support four authoring
 * styles in strict priority order — explicit entryNodeId (must exist), a
 * single start node, a single root (in-degree-0) node, otherwise fail with an
 * unambiguous error the author can act on rather than scheduling a random node.
 */
function resolveEntryNodeId(
  def: GraphDefinition,
  nodes: ReadonlyMap<string, GraphNode>,
  edges: readonly GraphEdge[],
): string {
  if (def.entryNodeId !== undefined) {
    if (!nodes.has(def.entryNodeId)) {
      throw new GraphCompileError(
        `entryNodeId "${def.entryNodeId}" does not exist`,
        "MISSING_ENTRY",
      );
    }
    return def.entryNodeId;
  }

  const starts = [...nodes.values()].filter((n) => n.type === "start");
  if (starts.length === 1) {
    return starts[0]!.id;
  }
  if (starts.length > 1) {
    throw new GraphCompileError(
      "multiple start nodes require explicit entryNodeId",
      "AMBIGUOUS_ENTRY",
    );
  }

  const targeted = new Set(edges.map((e) => e.to));
  const roots = [...nodes.keys()].filter((id) => !targeted.has(id));
  if (roots.length === 1) {
    return roots[0]!;
  }
  if (roots.length === 0) {
    throw new GraphCompileError(
      "no entry node: every node is targeted by an edge (cycle without start)",
      "MISSING_ENTRY",
    );
  }
  throw new GraphCompileError(
    "multiple root nodes require explicit entryNodeId or a single start node",
    "AMBIGUOUS_ENTRY",
  );
}

/**
 * Validate and normalize a graph definition into a CompiledGraph.
 *
 * Rejects empty graphs, unknown node types, dangling edges, and graphs with
 * no terminal path so the runtime never schedules an unfinishable run.
 *
 * Why (validation order): definition shape → node ids/types/retry → edge
 * endpoints → terminal reachability → entry resolution. Each step fails fast
 * with a typed GraphCompileError the author sees at compile time, not mid-run.
 * The returned CompiledGraph precomputes adjacency/terminals/entry so the
 * hot scheduler path does no authoring-time checks.
 */
export function compileGraph(def: GraphDefinition): CompiledGraph {
  if (!def || !Array.isArray(def.nodes) || !Array.isArray(def.edges)) {
    throw new GraphCompileError(
      "graph definition must include nodes and edges arrays",
      "INVALID_DEFINITION",
    );
  }

  if (def.nodes.length === 0) {
    throw new GraphCompileError("graph must contain at least one node", "EMPTY_GRAPH");
  }

  const nodeMap = new Map<string, GraphNode>();
  for (const node of def.nodes) {
    if (!node?.id || typeof node.id !== "string") {
      throw new GraphCompileError("every node must have a non-empty string id", "INVALID_NODE");
    }
    if (nodeMap.has(node.id)) {
      throw new GraphCompileError(`duplicate node id "${node.id}"`, "DUPLICATE_NODE");
    }
    if (!node.type || !isNodeType(node.type)) {
      throw new GraphCompileError(
        `unknown node type "${String(node.type)}" on node "${node.id}"`,
        "UNKNOWN_NODE_TYPE",
      );
    }
    if (
      node.retry !== undefined &&
      (!Number.isFinite(node.retry.maxAttempts) || node.retry.maxAttempts < 1)
    ) {
      throw new GraphCompileError(
        `retry.maxAttempts must be >= 1 on node "${node.id}"`,
        "INVALID_RETRY",
      );
    }
    nodeMap.set(node.id, node);
  }

  const nodeIds = new Set(nodeMap.keys());
  for (const edge of def.edges) {
    if (!edge || typeof edge.from !== "string" || typeof edge.to !== "string") {
      throw new GraphCompileError("every edge must have string from/to", "INVALID_EDGE");
    }
    if (!nodeIds.has(edge.from)) {
      throw new GraphCompileError(
        `edge.from "${edge.from}" references a missing node`,
        "MISSING_NODE",
      );
    }
    if (!nodeIds.has(edge.to)) {
      throw new GraphCompileError(
        `edge.to "${edge.to}" references a missing node`,
        "MISSING_NODE",
      );
    }
  }

  const adjacency = buildAdjacency(nodeIds, def.edges);
  const terminalNodeIds = findTerminals(nodeMap, adjacency);
  if (terminalNodeIds.length === 0) {
    throw new GraphCompileError(
      "graph has no terminal path: add an end node or a node with no outgoing edges",
      "NO_TERMINAL",
    );
  }

  const graphId = assignGraphId(def.graphId);
  const entryNodeId = resolveEntryNodeId(def, nodeMap, def.edges);

  const definition: GraphDefinition = {
    ...def,
    graphId,
    entryNodeId,
  };

  return {
    graphId,
    name: def.name,
    version: def.version,
    nodes: nodeMap,
    edges: Object.freeze([...def.edges]),
    entryNodeId,
    terminalNodeIds: Object.freeze([...terminalNodeIds]),
    adjacency: new Map(
      [...adjacency.entries()].map(([k, v]) => [k, Object.freeze([...v])] as const),
    ),
    definition,
  };
}
