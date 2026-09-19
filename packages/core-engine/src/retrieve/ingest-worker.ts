/**
 * Pull-tick PDF ingest. startPdf only registers pending pages so 202 cannot
 * hide a full-document OCR; each tick writes at most one page (D9/R24).
 */

import type { OcrPort } from "../ocr/port.js";
import { extractPdfUnicodePages, hasUsablePdfTextLayer } from "../ocr/pdf-text.js";
import { getDocumentProxy } from "unpdf";
import { renderPdfPagePng, type PdfPageRasterFn } from "../ocr/pdf-raster.js";
import type { LedgerStore } from "../persistence/ledger.js";
import type {
  ClauseRow,
  IngestPageRow,
  LayoutUnitRow,
  StandardDocRow,
  StandardVersionRow,
} from "../types.js";
import {
  clauseNoFromTableCaption,
  extractClauseRefs,
  splitLayoutUnits,
  type SplitLayoutUnit,
} from "./layout-split.js";
import type { StandardLibrary } from "./library.js";
import type { EdgeKind, RetrievePorts } from "./ports.js";

export interface StartPdfInput {
  packId: string;
  title: string;
  fileName: string;
  bytes: Uint8Array;
  ocr?: OcrPort;
  raster?: PdfPageRasterFn;
}

export interface StartPdfResult {
  ingest_run_id: string;
  doc: StandardDocRow;
  version: StandardVersionRow;
  page_count: number;
}

export interface TickPageResult {
  ingest_run_id: string;
  page_no: number | null;
  status: string;
  error: string | null;
  done: boolean;
}

interface RunMeta {
  packId: string;
  title: string;
  fileName: string;
  fileUri: string;
  docId: string;
  versionId: string;
  ocr: OcrPort;
  raster?: PdfPageRasterFn;
}

interface PagePersistSession {
  meta: RunMeta;
  ingestRunId: string;
  pageNo: number;
  clauses: ClauseRow[];
  layoutUnits: LayoutUnitRow[];
}

/**
 * Page-at-a-time ingest worker. Bytes stay in process memory this slice so
 * MinIO is not a gate for tests; live object storage can wrap the same tick.
 */
export class StandardIngestWorker {
  private readonly pdfByRun = new Map<string, Uint8Array>();
  private readonly metaByRun = new Map<string, RunMeta>();

  constructor(
    private readonly store: LedgerStore,
    private readonly library: StandardLibrary,
    private readonly defaults: { ocr: OcrPort; raster?: PdfPageRasterFn },
  ) {}

  /**
   * Insert doc/version/run and pending pages only. OCR on start would block
   * 202 and make a 2-page index_error fixture look like a one-shot ingest.
   */
  async startPdf(input: StartPdfInput): Promise<StartPdfResult> {
    if (!(await this.store.getSpecPack(input.packId))) {
      throw new Error(`spec pack not found: ${input.packId}`);
    }
    const pageCount = await countPdfPages(input.bytes);
    const fileUri = `memory://standards/${input.fileName}`;
    const doc = await this.store.insertStandardDoc({
      pack_id: input.packId,
      title: input.title,
      file_uri: fileUri,
    });
    const version = await this.store.insertStandardVersion({
      doc_id: doc.doc_id,
      status: "effective",
    });
    const run = await this.store.insertIngestRun({
      doc_id: doc.doc_id,
      pack_id: input.packId,
      file_name: input.fileName,
      page_count: pageCount,
      status: "pending",
    });
    this.pdfByRun.set(run.ingest_run_id, input.bytes);
    this.metaByRun.set(run.ingest_run_id, {
      packId: input.packId,
      title: input.title,
      fileName: input.fileName,
      fileUri,
      docId: doc.doc_id,
      versionId: version.version_id,
      ocr: input.ocr ?? this.defaults.ocr,
      raster: input.raster ?? this.defaults.raster,
    });
    return { ingest_run_id: run.ingest_run_id, doc, version, page_count: pageCount };
  }

  /**
   * Process ≤1 pending page. OCR/raster errors stay ocr_error; vector/graph
   * failures are index_error so a later page cannot wipe an earlier ok page.
   */
  async tick(ingestRunId: string): Promise<TickPageResult> {
    const pages = await this.store.listIngestPages(ingestRunId);
    if (pages.length === 0) {
      throw new Error(`ingest run not found: ${ingestRunId}`);
    }
    const pending = pages.find((page) => page.status === "pending");
    if (!pending) {
      return { ingest_run_id: ingestRunId, page_no: null, status: "done", error: null, done: true };
    }
    return this.tickPending(ingestRunId, pending);
  }

  private async tickPending(ingestRunId: string, pending: IngestPageRow): Promise<TickPageResult> {
    let text: string;
    try {
      text = await this.resolvePageText(ingestRunId, pending.page_no);
    } catch (err) {
      return this.finishPage(ingestRunId, pending.page_no, "ocr_error", err);
    }
    try {
      await this.persistPage(ingestRunId, pending.page_no, text);
    } catch (err) {
      return this.finishPage(ingestRunId, pending.page_no, "index_error", err);
    }
    return this.finishPage(ingestRunId, pending.page_no, "ok", null);
  }

  private async resolvePageText(ingestRunId: string, pageNo: number): Promise<string> {
    const meta = this.requireMeta(ingestRunId);
    const bytes = this.pdfByRun.get(ingestRunId);
    if (!bytes) {
      throw new Error(`ingest pdf bytes not in memory: ${ingestRunId}`);
    }
    const pages = await extractPdfUnicodePages(bytes);
    const layer = pages[pageNo - 1] ?? "";
    if (hasUsablePdfTextLayer(layer)) {
      return layer;
    }
    const raster = meta.raster ?? renderPdfPagePng;
    const png = await raster(bytes, pageNo);
    const layout = await meta.ocr.recognizeLayout({
      bytes: png,
      mime: "image/png",
      fileName: `${meta.fileName}.p${pageNo}.png`,
    });
    return layout.text;
  }

  private async persistPage(ingestRunId: string, pageNo: number, text: string): Promise<void> {
    const meta = this.requireMeta(ingestRunId);
    const ports = this.library.getPorts();
    const parts = splitLayoutUnits(text);
    const session: PagePersistSession = {
      meta,
      ingestRunId,
      pageNo,
      clauses: await insertNewClauses(this.store, meta, pageNo, parts),
      layoutUnits: [],
    };
    const known = await this.store.listClauses(meta.versionId);
    await persistClauseUnits(this.store, ports, session, parts);
    await linkParentOf(this.store, ports, parts, known);
    await persistTableUnits(this.store, ports, session, parts, known);
    await linkCites(this.store, ports, meta.packId, parts, known);
  }

  private async finishPage(
    ingestRunId: string,
    pageNo: number,
    status: string,
    err: unknown,
  ): Promise<TickPageResult> {
    const error = err == null ? null : err instanceof Error ? err.message : String(err);
    const row = await this.store.updateIngestPage({
      ingest_run_id: ingestRunId,
      page_no: pageNo,
      status,
      error,
    });
    return {
      ingest_run_id: ingestRunId,
      page_no: row.page_no,
      status: row.status,
      error: row.error,
      done: false,
    };
  }

  private requireMeta(ingestRunId: string): RunMeta {
    const meta = this.metaByRun.get(ingestRunId);
    if (!meta) {
      throw new Error(`ingest run metadata not in memory: ${ingestRunId}`);
    }
    return meta;
  }
}

async function countPdfPages(bytes: Uint8Array): Promise<number> {
  try {
    const pdf = await getDocumentProxy(Uint8Array.from(bytes));
    const n = pdf.numPages;
    if (typeof n === "number" && n > 0) return n;
  } catch {
    /* fall through to text-layer length */
  }
  const pages = await extractPdfUnicodePages(bytes);
  return Math.max(pages.length, 1);
}

function humanClauseNo(clause: ClauseRow): string {
  const colon = clause.clause_id.lastIndexOf(":");
  return colon >= 0 ? clause.clause_id.slice(colon + 1) : clause.clause_id;
}

function findClauseByExactNo(clauses: ClauseRow[], ref: string): ClauseRow | null {
  for (const clause of clauses) {
    const no = humanClauseNo(clause);
    if (no === ref || no === `第${ref}条` || ref === `第${no}条`) return clause;
  }
  return null;
}

async function insertNewClauses(
  store: LedgerStore,
  meta: RunMeta,
  pageNo: number,
  parts: SplitLayoutUnit[],
): Promise<ClauseRow[]> {
  const rows: ClauseRow[] = [];
  for (const part of parts) {
    if (part.chunkKind !== "clause" || !part.clauseNo) continue;
    const clause_id = `${meta.versionId}:${part.clauseNo}`;
    if (await store.getClause(clause_id)) continue;
    const parent_clause_id = part.parentClauseNo ? `${meta.versionId}:${part.parentClauseNo}` : null;
    rows.push(
      await store.insertClause({
        clause_id,
        version_id: meta.versionId,
        parent_clause_id,
        heading: part.heading,
        body: part.body,
        span_json: JSON.stringify(part.span),
        qdrant_point_id: clause_id,
        file_name: meta.fileName,
        page_start: pageNo,
        page_end: pageNo,
      }),
    );
  }
  return rows;
}

async function persistClauseUnits(
  store: LedgerStore,
  ports: RetrievePorts,
  session: PagePersistSession,
  parts: SplitLayoutUnit[],
): Promise<void> {
  const known = await store.listClauses(session.meta.versionId);
  for (const part of parts) {
    if (part.chunkKind !== "clause" || !part.clauseNo) continue;
    const clause = findClauseByExactNo(known, part.clauseNo);
    if (!clause) continue;
    if (await store.getLayoutUnit(clause.clause_id)) continue;
    session.layoutUnits.push(await upsertClauseLayout(store, ports, session, part, clause));
  }
}

async function upsertClauseLayout(
  store: LedgerStore,
  ports: RetrievePorts,
  session: PagePersistSession,
  part: SplitLayoutUnit,
  clause: ClauseRow,
): Promise<LayoutUnitRow> {
  const { meta, pageNo, ingestRunId } = session;
  const unit = await store.insertLayoutUnit({
    unit_id: clause.clause_id,
    version_id: clause.version_id,
    chunk_kind: "clause",
    clause_id: clause.clause_id,
    file_name: meta.fileName,
    page_start: pageNo,
    page_end: pageNo,
    heading: part.heading,
    body_markdown: part.body,
    qdrant_point_id: clause.clause_id,
    ingest_run_id: ingestRunId,
  });
  await ports.vector.upsert({
    id: clause.clause_id,
    vector: await ports.embed.embed(`${part.heading}\n${part.body}`),
    payload: {
      unit_id: clause.clause_id,
      chunk_kind: "clause",
      clause_id: clause.clause_id,
      versionId: clause.version_id,
      file_name: meta.fileName,
      page_start: pageNo,
      page_end: pageNo,
      clause_no: part.clauseNo,
      heading: part.heading,
      doc_title: meta.title,
      pack_id: meta.packId,
      source_uri: meta.fileUri,
      ingest_run_id: ingestRunId,
    },
  });
  await ports.graph.upsertClause(clause.clause_id, {
    versionId: clause.version_id,
    heading: part.heading,
    file_name: meta.fileName,
    page_start: pageNo,
    page_end: pageNo,
  });
  return unit;
}

async function persistTableUnits(
  store: LedgerStore,
  ports: RetrievePorts,
  session: PagePersistSession,
  parts: SplitLayoutUnit[],
  clauses: ClauseRow[],
): Promise<void> {
  const existing = await store.listLayoutUnits(session.meta.versionId);
  let tableSeq = existing.filter((unit) => unit.chunk_kind === "table").length;
  for (const part of parts) {
    if (part.chunkKind !== "table") continue;
    tableSeq += 1;
    const unitId = `${session.meta.versionId}:p${session.pageNo}:table:${tableSeq}`;
    const unit = await upsertTableLayout(store, ports, session, unitId, part);
    session.layoutUnits.push(unit);
    await linkTableSupports(store, ports, unitId, part, clauses);
    await linkTableBelongsTo(store, ports, unitId, part, clauses);
  }
}

async function upsertTableLayout(
  store: LedgerStore,
  ports: RetrievePorts,
  session: PagePersistSession,
  unitId: string,
  part: SplitLayoutUnit,
): Promise<LayoutUnitRow> {
  const { meta, pageNo, ingestRunId } = session;
  const unit = await store.insertLayoutUnit({
    unit_id: unitId,
    version_id: meta.versionId,
    chunk_kind: "table",
    clause_id: null,
    file_name: meta.fileName,
    page_start: pageNo,
    page_end: pageNo,
    heading: part.heading,
    body_markdown: part.body,
    qdrant_point_id: unitId,
    ingest_run_id: ingestRunId,
  });
  await ports.vector.upsert({
    id: unitId,
    vector: await ports.embed.embed(`${part.heading}\n${part.body}`),
    payload: {
      unit_id: unitId,
      chunk_kind: "table",
      versionId: meta.versionId,
      file_name: meta.fileName,
      page_start: pageNo,
      page_end: pageNo,
      caption: part.caption,
      heading: part.heading,
      doc_title: meta.title,
      pack_id: meta.packId,
      source_uri: meta.fileUri,
      ingest_run_id: ingestRunId,
    },
  });
  await ports.graph.upsertNode("LayoutUnit", unitId, {
    kind: "table",
    versionId: meta.versionId,
    file_name: meta.fileName,
  });
  return unit;
}

async function linkTableSupports(
  store: LedgerStore,
  ports: RetrievePorts,
  unitId: string,
  part: SplitLayoutUnit,
  clauses: ClauseRow[],
): Promise<void> {
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
    await writeLayoutEdge(store, ports, unitId, clauseId, "SUPPORTS", linkMethod);
  }
}

async function linkTableBelongsTo(
  store: LedgerStore,
  ports: RetrievePorts,
  unitId: string,
  part: SplitLayoutUnit,
  clauses: ClauseRow[],
): Promise<void> {
  if (!part.containerClauseNo) return;
  const container = findClauseByExactNo(clauses, part.containerClauseNo);
  if (!container) return;
  await writeLayoutEdge(store, ports, unitId, container.clause_id, "BELONGS_TO", "manual");
}

async function linkParentOf(
  store: LedgerStore,
  ports: RetrievePorts,
  parts: SplitLayoutUnit[],
  clauses: ClauseRow[],
): Promise<void> {
  for (const part of parts) {
    if (part.chunkKind !== "clause" || !part.clauseNo || !part.parentClauseNo) continue;
    const parent = findClauseByExactNo(clauses, part.parentClauseNo);
    const child = findClauseByExactNo(clauses, part.clauseNo);
    if (!parent || !child) continue;
    await writeLayoutEdge(store, ports, parent.clause_id, child.clause_id, "PARENT_OF", "manual");
  }
}

async function linkCites(
  store: LedgerStore,
  ports: RetrievePorts,
  packId: string,
  parts: SplitLayoutUnit[],
  local: ClauseRow[],
): Promise<void> {
  const known = await loadProjectEffectiveClauses(store, packId, local);
  for (const part of parts) {
    if (part.chunkKind !== "clause" || !part.clauseNo) continue;
    const from = findClauseByExactNo(local, part.clauseNo);
    if (!from) continue;
    for (const ref of extractClauseRefs(part.body)) {
      const to = findClauseByExactNo(known, ref);
      if (!to || to.clause_id === from.clause_id) continue;
      await writeLayoutEdge(store, ports, from.clause_id, to.clause_id, "CITES", "manual");
    }
  }
}

async function loadProjectEffectiveClauses(
  store: LedgerStore,
  packId: string,
  local: ClauseRow[],
): Promise<ClauseRow[]> {
  const pack = await store.getSpecPack(packId);
  if (!pack) return local;
  const known = new Map(local.map((clause) => [clause.clause_id, clause]));
  for (const other of await store.listSpecPacks(pack.project_id)) {
    for (const version of await store.listEffectiveStandardVersions(other.pack_id)) {
      if (version.status !== "effective") continue;
      for (const clause of await store.listClauses(version.version_id)) {
        known.set(clause.clause_id, clause);
      }
    }
  }
  return [...known.values()];
}

async function writeLayoutEdge(
  store: LedgerStore,
  ports: RetrievePorts,
  from: string,
  to: string,
  kind: EdgeKind,
  linkMethod: string,
): Promise<void> {
  await store.insertLayoutEdge({
    from_unit_id: from,
    to_unit_id: to,
    kind,
    link_method: linkMethod,
    confidence: 1,
  });
  await ports.graph.upsertEdge({ from, to, kind });
}
