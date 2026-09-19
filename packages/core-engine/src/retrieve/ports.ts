/**
 * Retrieve ports for the standard library.
 * Production: Qdrant + Neo4j. Tests: memory implementations. Never SQLite FTS-as-RAG.
 */

export type RetrievePath = "vector" | "graph" | "exact";

/**
 * Layout unit kind for vector payload and hits. Tables/annexes are first-class
 * chunks; stuffing their id into clause_id made Qdrant look like a clause hit.
 */
export type ChunkKind = "clause" | "table" | "annex";

/**
 * Graph relation kinds. PARENT_OF / BELONGS_TO / SUPPORTS exist so LayoutUnit
 * can sit beside Clause; omitting them forced every node through upsertClause.
 */
export type EdgeKind =
  | "CITES"
  | "SUPERSEDES"
  | "APPLIES_TO"
  | "REQUIRES"
  | "PARENT_OF"
  | "BELONGS_TO"
  | "SUPPORTS";

export type PrequeryIntent = "exact" | "semantic" | "graph";

export interface PrequeryResult {
  rewritten: string;
  intent: PrequeryIntent;
  clauseNo?: string;
  toClauseNo?: string;
}

export interface VectorPoint {
  id: string;
  vector: number[];
  payload?: Record<string, unknown>;
}

export interface VectorHit {
  id: string;
  score: number;
  payload?: Record<string, unknown>;
  vector?: number[];
}

export interface VectorStore {
  upsert(point: VectorPoint): Promise<void>;
  search(
    vector: number[],
    opts?: { versionId?: string; topK?: number },
  ): Promise<VectorHit[]>;
}

export interface GraphEdge {
  from: string;
  to: string;
  kind: EdgeKind;
}

export interface GraphStore {
  upsertClause(clauseId: string, props?: Record<string, unknown>): Promise<void>;
  /**
   * MERGE a labelled node. LayoutUnit must use this with label "LayoutUnit";
   * routing tables through upsertClause would MERGE them into :Clause (D7).
   */
  upsertNode(label: string, id: string, props?: Record<string, unknown>): Promise<void>;
  upsertEdge(edge: GraphEdge): Promise<void>;
  shortestPath(from: string, to: string): Promise<GraphEdge[]>;
  queryPath(from: string, kind?: EdgeKind): Promise<GraphEdge[]>;
}

export interface Prequery {
  rewrite(query: string): Promise<PrequeryResult> | PrequeryResult;
}

export interface RerankCandidate {
  /** Tables never enter rerank; this stays a t_clause id so attachHit can trust it. */
  clause_id: string;
  text: string;
  vector?: number[];
}

export interface Reranker {
  rerank(query: string, candidates: RerankCandidate[]): Promise<string[]> | string[];
}

export interface Embeddings {
  embed(text: string): number[];
}

export interface RetrievePorts {
  vector: VectorStore;
  graph: GraphStore;
  prequery: Prequery;
  rerank: Reranker;
  embed: Embeddings;
}

export interface ClauseSpan {
  start: number;
  end: number;
}

/**
 * Provenance-bearing retrieve hit. Citation UI needs file+page+unit; table hits
 * must keep clause_id null so attachHit cannot treat a layout unit as a clause.
 * heading/body are ledger text for detail/chat; the hits table must not render body.
 */
export interface RetrieveHit {
  /** Clause hits use t_clause id; table/annex hits MUST be null (D6). */
  clause_id: string | null;
  /** Stable layout identity. Table hits use this, never clause_id. */
  unit_id: string;
  chunk_kind: ChunkKind;
  file_name: string;
  page_start: number;
  page_end: number;
  /** SUPPORTS targets for a table hit; omitted on clause hits. */
  supported_clause_ids?: string[];
  standard_version_id: string;
  span: ClauseSpan | null;
  retrieve_path: RetrievePath;
  path?: GraphEdge[];
  /**
   * Ledger heading (clause heading or layout caption). Optional so older
   * fixtures compile; empty/null means no title, never invent one.
   */
  heading?: string | null;
  /**
   * Ledger body for detail/chat (clause.body or layout body_markdown).
   * Hits-table rows must not render this; empty string is kept, not filled in.
   */
  body?: string | null;
}

/** Alias used by contracts / callers. */
export type SearchHit = RetrieveHit;

/** Optional chat-complete shape; IndependentReranker must never call it. */
export interface ChatComplete {
  complete(options: { prompt: string }): Promise<string>;
}
