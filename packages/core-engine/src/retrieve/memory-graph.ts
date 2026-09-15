import type { EdgeKind, GraphEdge, GraphStore } from "./ports.js";

const NODE_LABELS = ["Clause", "LayoutUnit"] as const;
type GraphNodeLabel = (typeof NODE_LABELS)[number];

const EDGE_KINDS: readonly EdgeKind[] = [
  "CITES",
  "SUPERSEDES",
  "APPLIES_TO",
  "REQUIRES",
  "PARENT_OF",
  "BELONGS_TO",
  "SUPPORTS",
];

function assertKind(kind: string): EdgeKind {
  if ((EDGE_KINDS as readonly string[]).includes(kind)) return kind as EdgeKind;
  throw new Error(`unsupported edge kind: ${kind}`);
}

function assertNodeLabel(label: string): GraphNodeLabel {
  if ((NODE_LABELS as readonly string[]).includes(label)) return label as GraphNodeLabel;
  throw new Error(`unsupported node label: ${label}`);
}

/**
 * MERGE labels per kind. Unconditional Clause create would rebuild a
 * LayoutUnit id as :Clause (D7). PARENT_OF/BELONGS_TO reuse an already-upserted
 * label so hierarchy can sit on Clause after upsertClause.
 */
function endpointLabel(
  kind: EdgeKind,
  end: "from" | "to",
  existing: GraphNodeLabel | undefined,
): GraphNodeLabel {
  if (kind === "SUPPORTS") return end === "from" ? "LayoutUnit" : "Clause";
  if (kind === "CITES" || kind === "SUPERSEDES" || kind === "APPLIES_TO" || kind === "REQUIRES") {
    return "Clause";
  }
  if (existing) return existing;
  if (kind === "BELONGS_TO") return end === "from" ? "LayoutUnit" : "Clause";
  return "Clause";
}

interface MemoryGraphNode {
  label: GraphNodeLabel;
  props: Record<string, unknown>;
}

/** In-memory GraphStore for tests. Same interface as Neo4jGraphStore. */
export class MemoryGraphStore implements GraphStore {
  private readonly nodes = new Map<string, MemoryGraphNode>();
  private readonly edges: GraphEdge[] = [];

  /**
   * Delegate so clause-only callers never pick a label. Tables must use
   * upsertNode("LayoutUnit") or they MERGE as :Clause (D7).
   */
  async upsertClause(clauseId: string, props?: Record<string, unknown>): Promise<void> {
    await this.upsertNode("Clause", clauseId, props);
  }

  /**
   * MERGE a labelled node. Rejects anything but Clause|LayoutUnit so tests and
   * ingest cannot invent a third kind that Neo4j would also refuse.
   */
  async upsertNode(label: string, id: string, props?: Record<string, unknown>): Promise<void> {
    const nodeLabel = assertNodeLabel(label);
    const existing = this.nodes.get(id);
    this.nodes.set(id, {
      label: nodeLabel,
      props: { ...(existing?.props ?? {}), ...(props ?? {}) },
    });
  }

  /**
   * Connect by kind/label. Existing LayoutUnit ids are left labelled so a
   * later SUPPORTS MERGE cannot rebuild them as Clause.
   */
  async upsertEdge(edge: GraphEdge): Promise<void> {
    const kind = assertKind(edge.kind);
    const fromLabel = endpointLabel(kind, "from", this.nodes.get(edge.from)?.label);
    const toLabel = endpointLabel(kind, "to", this.nodes.get(edge.to)?.label);
    this.ensureNode(edge.from, fromLabel);
    this.ensureNode(edge.to, toLabel);
    const exists = this.edges.some(
      (item) => item.from === edge.from && item.to === edge.to && item.kind === kind,
    );
    if (!exists) this.edges.push({ from: edge.from, to: edge.to, kind });
  }

  /**
   * Inspect MERGE label. Tests use this to prove SUPPORTS from stayed
   * LayoutUnit and PARENT_OF ends stayed Clause.
   */
  nodeLabel(id: string): GraphNodeLabel | undefined {
    return this.nodes.get(id)?.label;
  }

  async shortestPath(from: string, to: string): Promise<GraphEdge[]> {
    if (from === to) return [];
    const queue: Array<{ node: string; path: GraphEdge[] }> = [{ node: from, path: [] }];
    const seen = new Set<string>([from]);
    while (queue.length > 0) {
      const { node, path } = queue.shift()!;
      for (const edge of this.edges) {
        if (edge.from !== node) continue;
        if (seen.has(edge.to)) continue;
        const next = [...path, edge];
        if (edge.to === to) return next;
        seen.add(edge.to);
        queue.push({ node: edge.to, path: next });
      }
    }
    return [];
  }

  /**
   * Return outgoing edges of any label. Kind pins A13 to SUPERSEDES so a later
   * PARENT_OF hop cannot replace the hit. Omitting kind excludes PARENT_OF
   * (spec default) so hierarchy never pollutes untyped paths.
   */
  async queryPath(from: string, kind?: EdgeKind): Promise<GraphEdge[]> {
    const required = kind ? assertKind(kind) : undefined;
    return this.edges.filter((edge) => {
      if (edge.from !== from) return false;
      if (required) return edge.kind === required;
      return edge.kind !== "PARENT_OF";
    });
  }

  private ensureNode(id: string, label: GraphNodeLabel): void {
    if (this.nodes.has(id)) return;
    this.nodes.set(id, { label, props: {} });
  }
}
