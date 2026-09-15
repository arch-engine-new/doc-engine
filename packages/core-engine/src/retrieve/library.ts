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
  ClauseSpan,
  EdgeKind,
  GraphEdge,
  RetrieveHit,
  RetrievePath,
  RetrievePorts,
  SearchHit,
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

const DEFAULT_PAGE = 1;

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

  async searchStandard(input: SearchStandardInput): Promise<RetrieveHit[]> {
    const versionIds = await this.resolveEffectiveVersionIds(input.packId);
    const pre = await this.ports.prequery.rewrite(input.query);
    let hits: RetrieveHit[] = [];
    if (pre.intent === "exact") {
      hits = await this.searchExact(versionIds, pre.clauseNo ?? pre.rewritten);
    } else if (pre.intent === "graph") {
      hits = await this.searchGraph(versionIds, pre.clauseNo, pre.toClauseNo);
    } else {
      hits = await this.searchSemantic(versionIds, pre.rewritten);
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

  async attachStandardFitFinding(input: AttachStandardFitInput): Promise<FindingRow> {
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
    const hit = hits[0];
    if (!hit) {
      throw new Error("no retrieve hit to attach");
    }
    return this.attachHit(job.job_id, job.trace_id, hit, input.ruleVersionId);
  }

  /**
   * Attach a retrieve hit only. Invented clause_id (not in t_clause) is rejected.
   */
  async attachHit(
    jobId: string,
    traceId: string,
    hit: RetrieveHit,
    ruleVersionId?: string,
  ): Promise<FindingRow> {
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
    const queryVector = this.ports.embed.embed(rewritten);
    const collected: RetrieveHit[] = [];
    for (const versionId of versionIds) {
      const neighbors = await this.ports.vector.search(queryVector, { versionId, topK: 8 });
      const candidates: Array<{
        clause_id: string;
        text: string;
        vector?: number[];
        clause: ClauseRow;
      }> = [];
      for (const item of neighbors) {
        const clause = await this.store.getClause(item.id);
        if (!clause || clause.version_id !== versionId) continue;
        candidates.push({
          clause_id: clause.clause_id,
          text: `${clause.heading ?? ""}\n${clause.body}`,
          vector: item.vector,
          clause,
        });
      }
      if (candidates.length === 0) continue;
      const ordered = await this.ports.rerank.rerank(rewritten, candidates);
      const topId = ordered[0];
      const top = candidates.find((item) => item.clause_id === topId) ?? candidates[0];
      if (top) collected.push(this.toHit(top.clause, "vector"));
    }
    return collected;
  }

  private async searchGraph(
    versionIds: string[],
    fromNo?: string,
    toNo?: string,
  ): Promise<RetrieveHit[]> {
    const fromClause = fromNo ? await this.findByNumber(versionIds, fromNo) : null;
    if (!fromClause) return [];
    let path: GraphEdge[] = [];
    if (toNo) {
      const toClause = await this.findByNumber(versionIds, toNo);
      if (toClause) {
        path = await this.ports.graph.shortestPath(fromClause.clause_id, toClause.clause_id);
      }
    }
    if (path.length === 0) {
      path = await this.ports.graph.queryPath(fromClause.clause_id);
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
   * Table hits are Task 6; this path only builds clause hits from t_clause.
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
      vector: this.ports.embed.embed(text),
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
      vector: this.ports.embed.embed(`${part.heading}\n${part.body}`),
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
