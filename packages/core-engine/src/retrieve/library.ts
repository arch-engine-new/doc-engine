/**
 * Standard library: ingest by clause heading, search via Qdrant/Neo4j ports,
 * attach Finding.clause_id only from retrieve hits. No industry presets.
 */

import type { LedgerStore } from "../persistence/ledger.js";
import type {
  ClauseRow,
  FindingRow,
  LayoutUnitRow,
  StandardDocRow,
  StandardVersionRow,
} from "../types.js";
import { HashEmbeddings } from "./embeddings.js";
import {
  clauseNoFromTableCaption,
  extractClauseRefs,
  splitLayoutUnits,
  type SplitLayoutUnit,
} from "./layout-split.js";
import { MemoryGraphStore } from "./memory-graph.js";
import { MemoryVectorStore } from "./memory-vector.js";
import { FakePrequery } from "./prequery.js";
import type {
  ChunkKind,
  ClauseSpan,
  EdgeKind,
  GraphEdge,
  PrequeryResult,
  RetrieveHit,
  RetrievePath,
  RetrievePorts,
  SearchHit,
  VectorHit,
} from "./ports.js";
import { IndependentReranker } from "./rerank.js";

export type { SearchHit, RetrieveHit };

export interface IngestStandardInput {
  packId: string;
  title: string;
  fileUri: string;
  text: string;
  versionId?: string;
  status?: string;
}

export interface IngestStandardResult {
  doc: StandardDocRow;
  version: StandardVersionRow;
  clauses: ClauseRow[];
  layoutUnits: LayoutUnitRow[];
  /** Tables with zero caption/cell_ref SUPPORTS; never filled by proximity. */
  tablesUnlinked: number;
}

export interface SearchStandardInput {
  packId: string;
  query: string;
  jobId?: string;
}

export interface AttachStandardFitInput {
  jobId: string;
  query: string;
  ruleVersionId?: string;
  packId?: string;
}

export interface AddStandardEdgeInput {
  from: string;
  to: string;
  kind: EdgeKind;
}

/** Provenance copied onto every Finding from one table so N rows stay grounded. */
interface FindingTableSource {
  unit_id: string;
  file_name: string;
  page_start: number;
  page_end: number;
  heading: string | null;
}

const DEFAULT_PAGE = 1;
const MAX_TABLE_FIT_FINDINGS = 20;

const GRAPH_KIND_SUPERSEDES = /替代|废止|supersede/i;
const GRAPH_KIND_REQUIRES = /requires/i;
const GRAPH_KIND_APPLIES = /applies/i;

function vectorHitUnitId(item: VectorHit): string {
  const unitId = item.payload?.unit_id;
  if (typeof unitId === "string" && unitId.length > 0) return unitId;
  return item.id;
}

function asChunkKind(value: string): ChunkKind {
  if (value === "clause" || value === "table" || value === "annex") return value;
  return "clause";
}

/** queryPath must always receive a kind; untyped walks let PARENT_OF steal A13. */
function inferGraphKind(rewritten: string): EdgeKind {
  if (GRAPH_KIND_SUPERSEDES.test(rewritten)) return "SUPERSEDES";
  if (GRAPH_KIND_REQUIRES.test(rewritten)) return "REQUIRES";
  if (GRAPH_KIND_APPLIES.test(rewritten)) return "APPLIES_TO";
  return "CITES";
}

function fileNameFromUri(fileUri: string): string {
  const noQuery = (fileUri.trim().split(/[?#]/, 1)[0] ?? fileUri).replace(/\\/g, "/");
  const parts = noQuery.split("/").filter((part) => part.length > 0);
  const last = parts[parts.length - 1];
  if (!last) return "document";
  return last.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:/, "") || last;
}

function parseSpan(spanJson: string | null): ClauseSpan | null {
  if (!spanJson) return null;
  try {
    const parsed: unknown = JSON.parse(spanJson);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as ClauseSpan).start === "number" &&
      typeof (parsed as ClauseSpan).end === "number"
    ) {
      return { start: (parsed as ClauseSpan).start, end: (parsed as ClauseSpan).end };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function humanClauseNo(clause: ClauseRow): string {
  const colon = clause.clause_id.lastIndexOf(":");
  if (colon >= 0) return clause.clause_id.slice(colon + 1);
  return clause.clause_id;
}

function clauseMatchesNumber(clause: ClauseRow, clauseNo: string): boolean {
  if (humanClauseNo(clause) === clauseNo) return true;
  if (clause.heading?.includes(clauseNo)) return true;
  return false;
}

/** Exact clause number only. Heading substring would treat 1.1 as parent "1". */
function findClauseByExactNo(clauses: ClauseRow[], ref: string): ClauseRow | null {
  for (const clause of clauses) {
    const no = humanClauseNo(clause);
    if (no === ref || no === `第${ref}条` || ref === `第${no}条`) return clause;
  }
  return null;
}

interface IngestSession {
  input: IngestStandardInput;
  versionId: string;
  fileName: string;
  clauses: ClauseRow[];
  layoutUnits: LayoutUnitRow[];
}

export function defaultRetrievePorts(partial?: Partial<RetrievePorts>): RetrievePorts {
  return {
    vector: partial?.vector ?? new MemoryVectorStore(),
    graph: partial?.graph ?? new MemoryGraphStore(),
    prequery: partial?.prequery ?? new FakePrequery(),
    rerank: partial?.rerank ?? new IndependentReranker(),
    embed: partial?.embed ?? new HashEmbeddings(),
  };
}

export class StandardLibrary {
  private readonly ports: RetrievePorts;

  constructor(
    private readonly store: LedgerStore,
    ports?: Partial<RetrievePorts>,
  ) {
    this.ports = defaultRetrievePorts(ports);
  }

  getPorts(): RetrievePorts {
    return this.ports;
  }

  /**
   * Collection rebuild (v3 1024-d) empties Qdrant; Hash 48-d backfill would
   * look like live RAG still works. Fail the boot instead of mixing dims.
   */
  async reindexVectorsFromLedger(): Promise<void> {
    for (const project of await this.store.listProjects()) {
      for (const pack of await this.store.listSpecPacks(project.project_id)) {
        await this.reindexPackLayoutUnits(pack.pack_id);
      }
    }
  }

  private async reindexPackLayoutUnits(packId: string): Promise<void> {
    for (const doc of await this.store.listStandardDocs(packId)) {
      for (const version of await this.store.listStandardVersions(doc.doc_id)) {
        for (const unit of await this.store.listLayoutUnits(version.version_id)) {
          await this.upsertReindexedUnit(packId, doc, unit);
        }
      }
    }
  }

  private async upsertReindexedUnit(
    packId: string,
    doc: StandardDocRow,
    unit: LayoutUnitRow,
  ): Promise<void> {
    const kind = asChunkKind(unit.chunk_kind);
    const text = await this.reindexEmbedText(unit, kind);
    await this.ports.vector.upsert({
      id: unit.unit_id,
      vector: await this.ports.embed.embed(text),
      payload: this.reindexPayload(packId, doc, unit, kind),
    });
  }

  private async reindexEmbedText(unit: LayoutUnitRow, kind: ChunkKind): Promise<string> {
    if (kind === "clause") {
      const clause = unit.clause_id ? await this.store.getClause(unit.clause_id) : null;
      if (clause) return `${clause.heading ?? ""}\n${clause.body}`;
    }
    return `${unit.heading ?? ""}\n${unit.body_markdown}`;
  }

  private reindexPayload(
    packId: string,
    doc: StandardDocRow,
    unit: LayoutUnitRow,
    kind: ChunkKind,
  ): Record<string, unknown> {
    const pageStart = unit.page_start > 0 ? unit.page_start : DEFAULT_PAGE;
    const pageEnd = unit.page_end >= pageStart ? unit.page_end : pageStart;
    const fileName = unit.file_name.length > 0 ? unit.file_name : fileNameFromUri(doc.file_uri);
    const payload: Record<string, unknown> = {
      unit_id: unit.unit_id,
      chunk_kind: kind,
      versionId: unit.version_id,
      file_name: fileName,
      page_start: pageStart,
      page_end: pageEnd,
      heading: unit.heading,
      doc_title: doc.title,
      pack_id: packId,
      source_uri: doc.file_uri,
    };
    // Table/annex clause_id would fail the payload gate and invent a clause hit.
    if (kind === "clause" && unit.clause_id) {
      payload.clause_id = unit.clause_id;
    }
    return payload;
  }

  /**
   * JSON/text ingest for fixtures. Provenance is URI basename + page 1 because
   * there is no PDF; GFM tables still become layout units so SUPPORTS can fire.
   */
  async ingest(input: IngestStandardInput): Promise<IngestStandardResult> {
    const fileName = fileNameFromUri(input.fileUri);
    const doc = await this.store.insertStandardDoc({
      pack_id: input.packId,
      title: input.title,
      file_uri: input.fileUri,
    });
    const version = await this.store.insertStandardVersion({
      doc_id: doc.doc_id,
      status: input.status ?? "effective",
      version_id: input.versionId,
    });
    const parts = splitLayoutUnits(input.text);
    const session: IngestSession = {
      input,
      versionId: version.version_id,
      fileName,
      clauses: await this.insertClauseRows(version.version_id, fileName, parts),
      layoutUnits: [],
    };
    await this.persistClauseUnits(session, parts);
    await this.linkParentOf(parts, session.clauses);
    const tablesUnlinked = await this.persistTableUnits(session, parts);
    await this.linkCites(input.packId, parts, session.clauses);
    return {
      doc,
      version,
      clauses: session.clauses,
      layoutUnits: session.layoutUnits,
      tablesUnlinked,
    };
  }

  async addEdge(input: AddStandardEdgeInput): Promise<void> {
    await this.store.insertStandardEdge({
      from_clause_id: input.from,
      to_clause_id: input.to,
      kind: input.kind,
    });
    await this.ports.graph.upsertEdge({
      from: input.from,
      to: input.to,
      kind: input.kind,
    });
  }

  async resolveEffectiveVersionIds(packId: string): Promise<string[]> {
    const pack = await this.store.getSpecPack(packId);
    if (!pack) {
      throw new Error(`spec pack not found: ${packId}`);
    }
    if (pack.effective_standard_version_id) {
      const bound = await this.store.getStandardVersion(pack.effective_standard_version_id);
      if (!bound || bound.status !== "effective") {
        throw new Error(
          `bound standard version ${pack.effective_standard_version_id} is not effective`,
        );
      }
      return [bound.version_id];
    }
    return (await this.store.listEffectiveStandardVersions(packId)).map((row) => row.version_id);
  }

  /**
   * Graph targets may live in a sibling pack. Pack-only versionIds drop those
   * hits even when CITES/SUPERSEDES already exist (R29).
   */
  async resolveProjectEffectiveVersionIds(packId: string): Promise<string[]> {
    const pack = await this.store.getSpecPack(packId);
    if (!pack) {
      throw new Error(`spec pack not found: ${packId}`);
    }
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const other of await this.store.listSpecPacks(pack.project_id)) {
      for (const versionId of await this.resolveEffectiveVersionIds(other.pack_id)) {
        if (seen.has(versionId)) continue;
        seen.add(versionId);
        ids.push(versionId);
      }
    }
    return ids;
  }

  /**
   * Graph uses project-wide effective versions so a CITES target in a sibling
   * pack is not dropped. Exact/semantic stay on the caller's pack versions.
   */
  async searchStandard(input: SearchStandardInput): Promise<RetrieveHit[]> {
    const pre = await this.ports.prequery.rewrite(input.query);
    let hits: RetrieveHit[] = [];
    if (pre.intent === "graph") {
      hits = await this.searchGraph(input.packId, pre);
    } else {
      const versionIds = await this.resolveEffectiveVersionIds(input.packId);
      hits =
        pre.intent === "exact"
          ? await this.searchExact(versionIds, pre.clauseNo ?? pre.rewritten)
          : await this.searchSemantic(versionIds, pre.rewritten);
      hits = await this.expandOneHop(hits, versionIds);
    }

    if (input.jobId) {
      const job = await this.store.getJob(input.jobId);
      if (job) {
        await this.store.appendAudit({
          trace_id: job.trace_id,
          event_type: "retrieve",
          ref_id: hits[0]?.clause_id ?? null,
          payload: {
            pack_id: input.packId,
            query: input.query,
            intent: pre.intent,
            hits: hits.map((hit) => hit.clause_id),
          },
        });
      }
    }
    return hits;
  }

  /**
   * Table hits are 1:N. Writing only hits[0] would drop grounded SUPPORTS clauses.
   */
  async attachStandardFitFinding(input: AttachStandardFitInput): Promise<FindingRow[]> {
    const job = await this.store.getJob(input.jobId);
    if (!job) {
      throw new Error(`job not found: ${input.jobId}`);
    }
    const packId = input.packId ?? job.pack_id;
    if (!packId) {
      throw new Error(`job ${input.jobId} has no pack_id`);
    }
    const hits = await this.searchStandard({
      packId,
      query: input.query,
      jobId: input.jobId,
    });
    if (hits.length === 0) {
      throw new Error("no retrieve hit to attach");
    }
    const tableHit = hits.find((hit) => hit.chunk_kind === "table");
    if (tableHit) {
      return this.attachTableSupportedFindings(job.job_id, job.trace_id, tableHit, input.ruleVersionId);
    }
    const clauseHit = hits.find((hit) => hit.chunk_kind === "clause");
    if (!clauseHit) {
      throw new Error("no retrieve hit to attach");
    }
    return [await this.attachHit(job.job_id, job.trace_id, clauseHit, input.ruleVersionId)];
  }

  /**
   * Finding.clause_id must be t_clause. Table/annex unit ids are provenance, not clauses.
   */
  async attachHit(
    jobId: string,
    traceId: string,
    hit: RetrieveHit,
    ruleVersionId?: string,
    source?: FindingTableSource,
  ): Promise<FindingRow> {
    await this.assertClauseHitAttachable(hit);
    if (typeof hit.clause_id !== "string" || hit.clause_id.length === 0) {
      throw new Error(`invented clause_id: ${hit.clause_id}`);
    }
    const clause = await this.store.getClause(hit.clause_id);
    if (!clause) {
      throw new Error(`invented clause_id: ${hit.clause_id}`);
    }
    const version = await this.store.getStandardVersion(clause.version_id);
    if (!version || version.status !== "effective") {
      throw new Error(`standard version ${clause.version_id} is not effective`);
    }
    const rule_version_id =
      ruleVersionId ?? (await this.store.listPublishedRuleVersions())[0]?.version_id;
    if (!rule_version_id) {
      throw new Error("no rule_version_id to attach standard-fit finding");
    }
    const finding = await this.store.insertFinding({
      job_id: jobId,
      rule_version_id,
      result: "fail",
      blocking: 1,
      detail: JSON.stringify({
        span: hit.span,
        heading: clause.heading,
        retrieve_path: hit.retrieve_path,
        ...(source ? { source } : {}),
      }),
      clause_id: clause.clause_id,
      standard_version_id: version.version_id,
      retrieve_path: hit.retrieve_path,
    });
    await this.store.appendAudit({
      trace_id: traceId,
      event_type: "finding",
      ref_id: finding.finding_id,
      payload: {
        finding_id: finding.finding_id,
        clause_id: finding.clause_id,
        standard_version_id: finding.standard_version_id,
        retrieve_path: finding.retrieve_path,
      },
    });
    return finding;
  }

  /** Table unit ids must not land in Finding.clause_id even if chunk_kind is spoofed. */
  private async assertClauseHitAttachable(hit: RetrieveHit): Promise<void> {
    if (hit.chunk_kind === "table" || hit.chunk_kind === "annex") {
      throw new Error(`cannot attach table/annex unit as clause_id: ${hit.unit_id}`);
    }
    if (typeof hit.clause_id !== "string" || hit.clause_id.length === 0) return;
    const unit = await this.store.getLayoutUnit(hit.clause_id);
    if (unit && unit.chunk_kind !== "clause") {
      throw new Error(`cannot attach table/annex unit as clause_id: ${hit.clause_id}`);
    }
  }

  private async attachTableSupportedFindings(
    jobId: string,
    traceId: string,
    tableHit: RetrieveHit,
    ruleVersionId?: string,
  ): Promise<FindingRow[]> {
    const source = await this.tableFindingSource(tableHit);
    const clauseIds = (tableHit.supported_clause_ids ?? []).slice(0, MAX_TABLE_FIT_FINDINGS);
    const rows: FindingRow[] = [];
    for (const clauseId of clauseIds) {
      const clause = await this.store.getClause(clauseId);
      if (!clause) {
        throw new Error(`invented clause_id: ${clauseId}`);
      }
      const hit = this.toHit(clause, tableHit.retrieve_path);
      rows.push(await this.attachHit(jobId, traceId, hit, ruleVersionId, source));
    }
    return rows;
  }

  private async tableFindingSource(hit: RetrieveHit): Promise<FindingTableSource> {
    const unit = await this.store.getLayoutUnit(hit.unit_id);
    return {
      unit_id: hit.unit_id,
      file_name: hit.file_name,
      page_start: hit.page_start,
      page_end: hit.page_end,
      heading: unit?.heading ?? null,
    };
  }

  /**
   * Out-edge one hop only: never recurse on appended graph rows (that would
   * dump two-hop neighbors into the table), never walk inbound edges.
   * Zero clause hits short-circuit so empty/table-only results do not scan
   * the graph.
   */
  private async expandOneHop(
    hits: RetrieveHit[],
    versionIds: string[],
  ): Promise<RetrieveHit[]> {
    const seen = new Set<string>();
    for (const hit of hits) {
      if (hit.clause_id) seen.add(hit.clause_id);
    }
    if (seen.size === 0) return hits;

    const origins = hits.filter(
      (hit) =>
        typeof hit.clause_id === "string" &&
        hit.clause_id.length > 0 &&
        (hit.retrieve_path === "vector" || hit.retrieve_path === "exact"),
    );
    const extra: RetrieveHit[] = [];
    for (const origin of origins) {
      extra.push(...(await this.expandOriginNeighbors(origin.clause_id!, seen, versionIds)));
    }
    return [...hits, ...extra];
  }

  /** queryPath is already one outgoing hop; calling it on edge.to would be a second hop. */
  private async expandOriginNeighbors(
    originId: string,
    seen: Set<string>,
    versionIds: string[],
  ): Promise<RetrieveHit[]> {
    const edges: GraphEdge[] = [
      ...(await this.ports.graph.queryPath(originId, "CITES")),
      ...(await this.ports.graph.queryPath(originId, "SUPERSEDES")),
    ];
    const extra: RetrieveHit[] = [];
    for (const edge of edges) {
      const neighbor = await this.neighborHitIfNew(edge, seen, versionIds);
      if (neighbor) extra.push(neighbor);
    }
    return extra;
  }

  private async neighborHitIfNew(
    edge: GraphEdge,
    seen: Set<string>,
    versionIds: string[],
  ): Promise<RetrieveHit | null> {
    if (seen.has(edge.to)) return null;
    const clause = await this.store.getClause(edge.to);
    if (!clause || !versionIds.includes(clause.version_id)) return null;
    seen.add(edge.to);
    const hit = this.toHit(clause, "graph");
    hit.path = [edge];
    return hit;
  }

  private async searchExact(versionIds: string[], clauseNo: string): Promise<RetrieveHit[]> {
    const needle = clauseNo.trim();
    const hits: RetrieveHit[] = [];
    for (const versionId of versionIds) {
      for (const clause of await this.store.listClauses(versionId)) {
        if (!clauseMatchesNumber(clause, needle)) continue;
        hits.push(this.toHit(clause, "exact"));
      }
    }
    return hits;
  }

  private async searchSemantic(versionIds: string[], rewritten: string): Promise<RetrieveHit[]> {
    const queryVector = await this.ports.embed.embed(rewritten);
    const scoredTables: Array<{ score: number; hit: RetrieveHit }> = [];
    const clauseHits: RetrieveHit[] = [];
    for (const versionId of versionIds) {
      const split = await this.semanticHitsForVersion(versionId, rewritten, queryVector);
      scoredTables.push(...split.tables);
      clauseHits.push(...split.clauses);
    }
    scoredTables.sort((a, b) => b.score - a.score);
    return [...scoredTables.map((item) => item.hit), ...clauseHits];
  }

  private async semanticHitsForVersion(
    versionId: string,
    rewritten: string,
    queryVector: number[],
  ): Promise<{ tables: Array<{ score: number; hit: RetrieveHit }>; clauses: RetrieveHit[] }> {
    const neighbors = await this.ports.vector.search(queryVector, { versionId, topK: 8 });
    const tables: Array<{ score: number; hit: RetrieveHit }> = [];
    const candidates: Array<{
      clause_id: string;
      text: string;
      vector?: number[];
      clause: ClauseRow;
    }> = [];
    for (const item of neighbors) {
      const classified = await this.classifySemanticNeighbor(item, versionId);
      if (!classified) continue;
      if (classified.kind === "table") {
        tables.push({ score: item.score, hit: classified.hit });
      } else {
        candidates.push(classified.candidate);
      }
    }
    return { tables, clauses: await this.rerankClauseHits(rewritten, candidates) };
  }

  private async classifySemanticNeighbor(
    item: VectorHit,
    versionId: string,
  ): Promise<
    | { kind: "table"; hit: RetrieveHit }
    | {
        kind: "clause";
        candidate: {
          clause_id: string;
          text: string;
          vector?: number[];
          clause: ClauseRow;
        };
      }
    | null
  > {
    const unit = await this.store.getLayoutUnit(vectorHitUnitId(item));
    if (!unit || unit.version_id !== versionId) return null;
    if (unit.chunk_kind === "table" || unit.chunk_kind === "annex") {
      const supported =
        unit.chunk_kind === "table" ? await this.supportedClauseIds(unit.unit_id) : undefined;
      return { kind: "table", hit: this.toUnitHit(unit, "vector", supported) };
    }
    if (unit.chunk_kind !== "clause" || !unit.clause_id) return null;
    const clause = await this.store.getClause(unit.clause_id);
    if (!clause || clause.version_id !== versionId) return null;
    return {
      kind: "clause",
      candidate: {
        clause_id: clause.clause_id,
        text: `${clause.heading ?? ""}\n${clause.body}`,
        vector: item.vector,
        clause,
      },
    };
  }

  private async rerankClauseHits(
    rewritten: string,
    candidates: Array<{
      clause_id: string;
      text: string;
      vector?: number[];
      clause: ClauseRow;
    }>,
  ): Promise<RetrieveHit[]> {
    if (candidates.length === 0) return [];
    const ordered = await this.ports.rerank.rerank(rewritten, candidates);
    const hits: RetrieveHit[] = [];
    for (const clauseId of ordered) {
      const match = candidates.find((item) => item.clause_id === clauseId);
      if (match) hits.push(this.toHit(match.clause, "vector"));
    }
    return hits;
  }

  private async supportedClauseIds(unitId: string): Promise<string[]> {
    const edges = await this.ports.graph.queryPath(unitId, "SUPPORTS");
    return edges.map((edge) => edge.to);
  }

  private async searchGraph(packId: string, pre: PrequeryResult): Promise<RetrieveHit[]> {
    const versionIds = await this.resolveProjectEffectiveVersionIds(packId);
    const fromClause = pre.clauseNo ? await this.findByNumber(versionIds, pre.clauseNo) : null;
    if (!fromClause) return [];
    let path: GraphEdge[] = [];
    if (pre.toClauseNo) {
      const toClause = await this.findByNumber(versionIds, pre.toClauseNo);
      if (toClause) {
        path = await this.ports.graph.shortestPath(fromClause.clause_id, toClause.clause_id);
      }
    }
    if (path.length === 0) {
      path = await this.ports.graph.queryPath(
        fromClause.clause_id,
        inferGraphKind(pre.rewritten),
      );
    }
    if (path.length === 0) return [];
    const targetId = path[path.length - 1]!.to;
    const target = await this.store.getClause(targetId);
    if (!target || !versionIds.includes(target.version_id)) return [];
    const hit = this.toHit(target, "graph");
    hit.path = path;
    return [hit];
  }

  private async findByNumber(versionIds: string[], clauseNo: string): Promise<ClauseRow | null> {
    for (const versionId of versionIds) {
      for (const clause of await this.store.listClauses(versionId)) {
        if (clauseMatchesNumber(clause, clauseNo)) return clause;
      }
    }
    return null;
  }

  /**
   * Hits must carry file/page/unit or citation UI cannot show provenance.
   * Clause-only builder; table/annex hits go through toUnitHit so clause_id stays null.
   * heading/body are copied from the clause ledger — never synthesized.
   */
  private toHit(clause: ClauseRow, retrieve_path: RetrievePath): RetrieveHit {
    const pageStart = clause.page_start && clause.page_start > 0 ? clause.page_start : DEFAULT_PAGE;
    const pageEnd =
      clause.page_end && clause.page_end >= pageStart ? clause.page_end : pageStart;
    return {
      clause_id: clause.clause_id,
      unit_id: clause.clause_id,
      chunk_kind: "clause",
      file_name: clause.file_name && clause.file_name.length > 0 ? clause.file_name : "unknown",
      page_start: pageStart,
      page_end: pageEnd,
      standard_version_id: clause.version_id,
      span: parseSpan(clause.span_json),
      retrieve_path,
      heading: clause.heading,
      body: clause.body,
    };
  }

  /**
   * Table/annex hits keep clause_id null so attachHit cannot treat a unit as a clause.
   * heading/body come from LayoutUnitRow; empty body_markdown is returned as-is.
   */
  private toUnitHit(
    unit: LayoutUnitRow,
    retrieve_path: RetrievePath,
    supportedClauseIds?: string[],
  ): RetrieveHit {
    const pageStart = unit.page_start > 0 ? unit.page_start : DEFAULT_PAGE;
    const pageEnd = unit.page_end >= pageStart ? unit.page_end : pageStart;
    const kind = asChunkKind(unit.chunk_kind);
    return {
      clause_id: kind === "clause" ? unit.clause_id : null,
      unit_id: unit.unit_id,
      chunk_kind: kind,
      file_name: unit.file_name.length > 0 ? unit.file_name : "unknown",
      page_start: pageStart,
      page_end: pageEnd,
      supported_clause_ids: supportedClauseIds,
      standard_version_id: unit.version_id,
      span: null,
      retrieve_path,
      heading: unit.heading,
      body: unit.body_markdown,
    };
  }

  private async insertClauseRows(
    versionId: string,
    fileName: string,
    parts: SplitLayoutUnit[],
  ): Promise<ClauseRow[]> {
    const clauses: ClauseRow[] = [];
    for (const part of parts) {
      if (part.chunkKind !== "clause" || !part.clauseNo) continue;
      const clause_id = `${versionId}:${part.clauseNo}`;
      const parent_clause_id = part.parentClauseNo ? `${versionId}:${part.parentClauseNo}` : null;
      clauses.push(
        await this.store.insertClause({
          clause_id,
          version_id: versionId,
          parent_clause_id,
          heading: part.heading,
          body: part.body,
          span_json: JSON.stringify(part.span),
          qdrant_point_id: clause_id,
          file_name: fileName,
          page_start: DEFAULT_PAGE,
          page_end: DEFAULT_PAGE,
        }),
      );
    }
    return clauses;
  }

  private async persistClauseUnits(session: IngestSession, parts: SplitLayoutUnit[]): Promise<void> {
    for (const part of parts) {
      if (part.chunkKind !== "clause" || !part.clauseNo) continue;
      const clause = findClauseByExactNo(session.clauses, part.clauseNo);
      if (!clause) continue;
      session.layoutUnits.push(
        await this.upsertClauseLayout(session.input, session.fileName, part, clause),
      );
    }
  }

  private async upsertClauseLayout(
    input: IngestStandardInput,
    fileName: string,
    part: SplitLayoutUnit,
    clause: ClauseRow,
  ): Promise<LayoutUnitRow> {
    const text = `${part.heading}\n${part.body}`;
    const unit = await this.store.insertLayoutUnit({
      unit_id: clause.clause_id,
      version_id: clause.version_id,
      chunk_kind: "clause",
      clause_id: clause.clause_id,
      file_name: fileName,
      page_start: DEFAULT_PAGE,
      page_end: DEFAULT_PAGE,
      heading: part.heading,
      body_markdown: part.body,
      qdrant_point_id: clause.clause_id,
    });
    await this.ports.vector.upsert({
      id: clause.clause_id,
      vector: await this.ports.embed.embed(text),
      payload: {
        unit_id: clause.clause_id,
        chunk_kind: "clause",
        clause_id: clause.clause_id,
        versionId: clause.version_id,
        file_name: fileName,
        page_start: DEFAULT_PAGE,
        page_end: DEFAULT_PAGE,
        clause_no: part.clauseNo,
        heading: part.heading,
        doc_title: input.title,
        pack_id: input.packId,
        source_uri: input.fileUri,
      },
    });
    await this.ports.graph.upsertClause(clause.clause_id, {
      versionId: clause.version_id,
      heading: part.heading,
      file_name: fileName,
      page_start: DEFAULT_PAGE,
      page_end: DEFAULT_PAGE,
    });
    return unit;
  }

  private async persistTableUnits(
    session: IngestSession,
    parts: SplitLayoutUnit[],
  ): Promise<number> {
    let tablesUnlinked = 0;
    let tableSeq = 0;
    for (const part of parts) {
      if (part.chunkKind !== "table") continue;
      tableSeq += 1;
      const unitId = `${session.versionId}:table:${tableSeq}`;
      const unit = await this.upsertTableLayout(session, unitId, part);
      session.layoutUnits.push(unit);
      const linked = await this.linkTableSupports(unitId, part, session.clauses);
      if (linked === 0) tablesUnlinked += 1;
      await this.linkTableBelongsTo(unitId, part, session.clauses);
    }
    return tablesUnlinked;
  }

  private async upsertTableLayout(
    session: IngestSession,
    unitId: string,
    part: SplitLayoutUnit,
  ): Promise<LayoutUnitRow> {
    const { input, versionId, fileName } = session;
    const unit = await this.store.insertLayoutUnit({
      unit_id: unitId,
      version_id: versionId,
      chunk_kind: "table",
      clause_id: null,
      file_name: fileName,
      page_start: DEFAULT_PAGE,
      page_end: DEFAULT_PAGE,
      heading: part.heading,
      body_markdown: part.body,
      qdrant_point_id: unitId,
    });
    await this.ports.vector.upsert({
      id: unitId,
      vector: await this.ports.embed.embed(`${part.heading}\n${part.body}`),
      payload: {
        unit_id: unitId,
        chunk_kind: "table",
        versionId,
        file_name: fileName,
        page_start: DEFAULT_PAGE,
        page_end: DEFAULT_PAGE,
        caption: part.caption,
        heading: part.heading,
        doc_title: input.title,
        pack_id: input.packId,
        source_uri: input.fileUri,
      },
    });
    await this.ports.graph.upsertNode("LayoutUnit", unitId, {
      kind: "table",
      versionId,
      file_name: fileName,
    });
    return unit;
  }

  /**
   * Caption then cell_ref only. Nearest-clause linking is proximity and forbidden.
   */
  private async linkTableSupports(
    unitId: string,
    part: SplitLayoutUnit,
    clauses: ClauseRow[],
  ): Promise<number> {
    const targets = new Map<string, "caption" | "cell_ref">();
    const captionNo = part.caption ? clauseNoFromTableCaption(part.caption) : null;
    if (captionNo) {
      const hit = findClauseByExactNo(clauses, captionNo);
      if (hit) targets.set(hit.clause_id, "caption");
    }
    for (const ref of extractClauseRefs(part.body)) {
      const hit = findClauseByExactNo(clauses, ref);
      if (hit && !targets.has(hit.clause_id)) targets.set(hit.clause_id, "cell_ref");
    }
    for (const [clauseId, linkMethod] of targets) {
      await this.writeLayoutEdge(unitId, clauseId, "SUPPORTS", linkMethod);
    }
    return targets.size;
  }

  private async linkTableBelongsTo(
    unitId: string,
    part: SplitLayoutUnit,
    clauses: ClauseRow[],
  ): Promise<void> {
    if (!part.containerClauseNo) return;
    const container = findClauseByExactNo(clauses, part.containerClauseNo);
    if (!container) return;
    await this.writeLayoutEdge(unitId, container.clause_id, "BELONGS_TO", "manual");
  }

  /** Parent owns child: from=parent, to=child. Reversing this breaks hierarchy browse. */
  private async linkParentOf(parts: SplitLayoutUnit[], clauses: ClauseRow[]): Promise<void> {
    for (const part of parts) {
      if (part.chunkKind !== "clause" || !part.clauseNo || !part.parentClauseNo) continue;
      const parent = findClauseByExactNo(clauses, part.parentClauseNo);
      const child = findClauseByExactNo(clauses, part.clauseNo);
      if (!parent || !child) continue;
      await this.writeLayoutEdge(parent.clause_id, child.clause_id, "PARENT_OF", "manual");
    }
  }

  /**
   * Body citations to already-ingested effective clauses only. 第99.9条 with no
   * row must not CREATE a Clause node.
   */
  private async linkCites(
    packId: string,
    parts: SplitLayoutUnit[],
    local: ClauseRow[],
  ): Promise<void> {
    const known = await this.loadProjectEffectiveClauses(packId, local);
    for (const part of parts) {
      if (part.chunkKind !== "clause" || !part.clauseNo) continue;
      const from = findClauseByExactNo(local, part.clauseNo);
      if (!from) continue;
      for (const ref of extractClauseRefs(part.body)) {
        const to = findClauseByExactNo(known, ref);
        if (!to || to.clause_id === from.clause_id) continue;
        await this.writeLayoutEdge(from.clause_id, to.clause_id, "CITES", "manual");
      }
    }
  }

  private async loadProjectEffectiveClauses(
    packId: string,
    local: ClauseRow[],
  ): Promise<ClauseRow[]> {
    const pack = await this.store.getSpecPack(packId);
    if (!pack) return local;
    const known = new Map(local.map((clause) => [clause.clause_id, clause]));
    for (const other of await this.store.listSpecPacks(pack.project_id)) {
      for (const version of await this.store.listEffectiveStandardVersions(other.pack_id)) {
        if (version.status !== "effective") continue;
        for (const clause of await this.store.listClauses(version.version_id)) {
          known.set(clause.clause_id, clause);
        }
      }
    }
    return [...known.values()];
  }

  private async writeLayoutEdge(
    from: string,
    to: string,
    kind: EdgeKind,
    linkMethod: string,
  ): Promise<void> {
    await this.store.insertLayoutEdge({
      from_unit_id: from,
      to_unit_id: to,
      kind,
      link_method: linkMethod,
      confidence: 1,
    });
    await this.ports.graph.upsertEdge({ from, to, kind });
  }
}

/** Read-only tool handler: search only, never submit / publish / invent clause_id. */
export function createSearchClauseToolHandler(library: StandardLibrary) {
  return async (input: SearchStandardInput): Promise<RetrieveHit[]> =>
    library.searchStandard(input);
}
