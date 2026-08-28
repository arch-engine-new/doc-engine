/**
 * Standard library: ingest by clause heading, search via Qdrant/Neo4j ports,
 * attach Finding.clause_id only from retrieve hits. No industry presets.
 */

import type { LedgerStore } from "../persistence/ledger.js";
import type { ClauseRow, FindingRow, StandardDocRow, StandardVersionRow } from "../types.js";
import { HashEmbeddings } from "./embeddings.js";
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
import { splitClauses } from "./split.js";

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

export function defaultRetrievePorts(partial?: Partial<RetrievePorts>): RetrievePorts {
  return {
    vector: partial?.vector ?? new MemoryVectorStore(),
    graph: partial?.graph ?? new MemoryGraphStore(),
    prequery: partial?.prequery ?? new FakePrequery(),
    rerank: partial?.rerank ?? new IndependentReranker(),
    embed: partial?.embed ?? new HashEmbeddings(),
  };
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

  async ingest(input: IngestStandardInput): Promise<IngestStandardResult> {
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
    const splits = splitClauses(input.text);
    const clauses: ClauseRow[] = [];
    for (const part of splits) {
      const clause_id = `${version.version_id}:${part.clauseNo}`;
      const parent_clause_id = part.parentClauseNo
        ? `${version.version_id}:${part.parentClauseNo}`
        : null;
      const clause = await this.store.insertClause({
        clause_id,
        version_id: version.version_id,
        parent_clause_id,
        heading: part.heading,
        body: part.body,
        span_json: JSON.stringify(part.span),
        qdrant_point_id: clause_id,
      });
      const text = `${part.heading}\n${part.body}`;
      const vector = this.ports.embed.embed(text);
      await this.ports.vector.upsert({
        id: clause_id,
        vector,
        payload: { clause_id, versionId: version.version_id },
      });
      await this.ports.graph.upsertClause(clause_id, {
        versionId: version.version_id,
        heading: part.heading,
      });
      clauses.push(clause);
    }
    return { doc, version, clauses };
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

  private toHit(clause: ClauseRow, retrieve_path: RetrievePath): RetrieveHit {
    return {
      clause_id: clause.clause_id,
      standard_version_id: clause.version_id,
      span: parseSpan(clause.span_json),
      retrieve_path,
    };
  }
}

/** Read-only tool handler: search only, never submit / publish / invent clause_id. */
export function createSearchClauseToolHandler(library: StandardLibrary) {
  return async (input: SearchStandardInput): Promise<RetrieveHit[]> =>
    library.searchStandard(input);
}
