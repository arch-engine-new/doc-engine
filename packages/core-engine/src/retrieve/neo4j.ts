/**
 * Production GraphStore adapter (Neo4j).
 * Throws if NEO4J_URI (or constructor uri) is missing. Tests use MemoryGraphStore.
 */

import neo4j, { type Driver, type Session } from "neo4j-driver";
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
 * MERGE labels per kind. Unconditional `(a:Clause),(b:Clause)` would rebuild a
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

async function lookupNodeLabel(session: Session, id: string): Promise<GraphNodeLabel | undefined> {
  const result = await session.run(
    `MATCH (n {id: $id})
     WHERE n:LayoutUnit OR n:Clause
     RETURN CASE WHEN n:LayoutUnit THEN 'LayoutUnit' ELSE 'Clause' END AS label
     LIMIT 1`,
    { id },
  );
  const raw = result.records[0]?.get("label");
  return raw === "LayoutUnit" || raw === "Clause" ? raw : undefined;
}

export class Neo4jGraphStore implements GraphStore {
  private readonly driver: Driver;

  constructor(options?: { uri?: string; user?: string; password?: string }) {
    const uri = options?.uri ?? process.env.NEO4J_URI;
    if (!uri) {
      throw new Error("Neo4j URI not configured (set NEO4J_URI)");
    }
    const user = options?.user ?? process.env.NEO4J_USER ?? "neo4j";
    const password = options?.password ?? process.env.NEO4J_PASSWORD ?? "";
    this.driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  }

  /**
   * Kept so callers that only have a clause id do not go through a free-form
   * label. Tables must not use this — it would MERGE them into :Clause (D7).
   */
  async upsertClause(clauseId: string, props?: Record<string, unknown>): Promise<void> {
    await this.upsertNode("Clause", clauseId, props);
  }

  /**
   * MERGE by allowlisted label. Dynamic labels are interpolated only after
   * Clause|LayoutUnit check so a user string cannot become a Cypher label.
   */
  async upsertNode(label: string, id: string, props?: Record<string, unknown>): Promise<void> {
    const nodeLabel = assertNodeLabel(label);
    const session = this.driver.session();
    try {
      await session.run(`MERGE (n:${nodeLabel} {id: $id}) SET n += $props`, {
        id,
        props: props ?? {},
      });
    } finally {
      await session.close();
    }
  }

  /**
   * MERGE endpoints by kind/label instead of always `:Clause`. SUPPORTS from a
   * table id must stay LayoutUnit; otherwise A13-style clause paths and table
   * nodes collapse onto the same label.
   */
  async upsertEdge(edge: GraphEdge): Promise<void> {
    const kind = assertKind(edge.kind);
    const session = this.driver.session();
    try {
      const fromExisting = await lookupNodeLabel(session, edge.from);
      const toExisting = await lookupNodeLabel(session, edge.to);
      const fromLabel = endpointLabel(kind, "from", fromExisting);
      const toLabel = endpointLabel(kind, "to", toExisting);
      await session.run(
        `MERGE (a:${fromLabel} {id: $from})
         MERGE (b:${toLabel} {id: $to})
         MERGE (a)-[r:${kind}]->(b)`,
        { from: edge.from, to: edge.to },
      );
    } finally {
      await session.close();
    }
  }

  async shortestPath(from: string, to: string): Promise<GraphEdge[]> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (a:Clause {id: $from}), (b:Clause {id: $to})
         MATCH p = shortestPath((a)-[*..8]->(b))
         RETURN [rel IN relationships(p) |
           { from: startNode(rel).id, to: endNode(rel).id, kind: type(rel) }
         ] AS path`,
        { from, to },
      );
      const row = result.records[0];
      if (!row) return [];
      const path = row.get("path") as Array<{ from: string; to: string; kind: string }>;
      return (path ?? []).map((item) => ({
        from: String(item.from),
        to: String(item.to),
        kind: assertKind(item.kind),
      }));
    } finally {
      await session.close();
    }
  }

  /**
   * Walk outgoing edges on any graph label. Matching only `:Clause` hid SUPPORTS
   * from LayoutUnit. Passing kind is required for A13: a later PARENT_OF hop
   * would otherwise replace the SUPERSEDES target. Omitting kind excludes
   * PARENT_OF so hierarchy never pollutes the default path.
   */
  async queryPath(from: string, kind?: EdgeKind): Promise<GraphEdge[]> {
    const session = this.driver.session();
    try {
      const result = kind
        ? await session.run(
            `MATCH (a {id: $from})-[r:${assertKind(kind)}]->(b)
             WHERE (a:Clause OR a:LayoutUnit) AND (b:Clause OR b:LayoutUnit)
             RETURN a.id AS fromId, b.id AS toId, type(r) AS kind`,
            { from },
          )
        : await session.run(
            `MATCH (a {id: $from})-[r]->(b)
             WHERE type(r) <> 'PARENT_OF'
               AND (a:Clause OR a:LayoutUnit) AND (b:Clause OR b:LayoutUnit)
             RETURN a.id AS fromId, b.id AS toId, type(r) AS kind`,
            { from },
          );
      return result.records.map((record) => ({
        from: String(record.get("fromId")),
        to: String(record.get("toId")),
        kind: assertKind(String(record.get("kind"))),
      }));
    } finally {
      await session.close();
    }
  }
}
