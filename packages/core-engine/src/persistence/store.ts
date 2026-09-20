/**
 * SQLite ledger for walking skeleton (jobs + spec pack / field boxes).
 * Rows use generated contract field names from core-engine-rows.ts.
 *
 * Sync better-sqlite3 implementation. Async callers use LedgerStore / SqliteLedger
 * so Postgres can share one Promise-based contract without a second silent ledger.
 */

import type Database from "better-sqlite3";
import { newId, nowIso } from "../ids.js";
import type {
  AuditEventRow,
  ClauseRow,
  CompletenessRuleRow,
  ConversationMessageRow,
  ConversationThreadRow,
  DocTypeRow,
  DocumentArtifactRow,
  DocumentRow,
  ExcelCellMappingRow,
  ExtractionRow,
  FieldBoxRow,
  FieldDefRow,
  FieldFillRuleRow,
  FindingRow,
  IngestPageRow,
  IngestRunRow,
  JobRow,
  JobTrack,
  LayoutEdgeRow,
  LayoutUnitRow,
  ProjectRow,
  ProposalRow,
  ReceiptRow,
  RuleFixtureRow,
  RuleRow,
  RuleVersionRow,
  SignatureTaskRow,
  SkillDraftRow,
  SkillLedgerRow,
  SkillRecordRow,
  SpecPackRow,
  StandardDocRow,
  StandardEdgeRow,
  StandardVersionRow,
  TemplateRow,
  VolumePreviewRow,
} from "../types.js";
import {
  EMPTY_PACK_NAME,
  EMPTY_PACK_VERSION,
  PACK_ID,
  R1_DSL,
  R2_DSL,
  RULE_R1_ID,
  RULE_R1_VERSION_ID,
  RULE_R2_ID,
  RULE_R2_VERSION_ID,
  SEED_PACK_PROJECT_ID,
  DOC_TYPE_CHILD_ID,
  DOC_TYPE_PARENT_ID,
  seedConcreteInspectionBatchLedger,
  seedDemoDocTypes,
} from "../pipeline/seed.js";
import { LedgerConflictError } from "../pipeline/job-pipeline.js";

/** Writable FieldBox columns for upsert; names match FieldBoxRow, coords stay DECIMAL strings. */
export type FieldBoxWrite = Pick<
  FieldBoxRow,
  "field_key" | "value_type" | "page" | "x" | "y" | "w" | "h"
>;

/** Writable Excel cell mapping columns for bulk replace. */
export type ExcelCellMappingWrite = Pick<
  ExcelCellMappingRow,
  "sheet_name" | "cell" | "field_key" | "value_type" | "signature_role"
>;

/** Writable field fill rule columns for bulk replace. */
export type FieldFillRuleWrite = Pick<
  FieldFillRuleRow,
  | "field_key"
  | "required"
  | "pattern"
  | "min_num"
  | "max_num"
  | "default_generator"
  | "default_literal"
>;

/** Writable completeness rule columns for bulk replace. */
export type CompletenessRuleWrite = Pick<
  CompletenessRuleRow,
  "doc_type_id" | "label" | "required"
> & { rule_id?: string };

/** Layout unit write; body_markdown must keep table pipes, not flattened OCR. */
export type LayoutUnitWrite = {
  unit_id?: string;
  version_id: string;
  chunk_kind: string;
  clause_id?: string | null;
  file_name: string;
  page_start: number;
  page_end: number;
  heading?: string | null;
  body_markdown: string;
  qdrant_point_id?: string | null;
  ingest_run_id?: string | null;
};

/** Auto layout edges (PARENT_OF/SUPPORTS); not human CITES on t_standard_edge. */
export type LayoutEdgeWrite = {
  from_unit_id: string;
  to_unit_id: string;
  kind: string;
  link_method: string;
  confidence?: number | null;
};

/** Creating a run also inserts N pending pages so index_error can be recorded later. */
export type IngestRunWrite = {
  ingest_run_id?: string;
  doc_id: string;
  pack_id: string;
  status?: string;
  file_name: string;
  page_count: number;
};

/** Page tick; status may be index_error (vector fail) which is not ocr_error. */
export type IngestPageUpdate = {
  ingest_run_id: string;
  page_no: number;
  status: string;
  error?: string | null;
};

/** Optional Job.track filter so findings lists can stay on leftover fixture jobs. */
export type ListJobsFilter = {
  track?: JobTrack;
};

/** Production Skill index write; uniqueness is (pack_id, canonical_name) while deleted=0. */
export type SkillRecordWrite = {
  skill_id?: string;
  pack_id: string;
  project_id: string;
  canonical_name: string;
  names_json: string;
  aliases_json: string;
  check_items_json: string;
  fix_actions_json: string;
  version?: number;
};

/** Chat/confirm only mutate drafts; one live draft per job. */
export type SkillDraftWrite = {
  draft_id?: string;
  job_id: string;
  pack_id: string;
  payload_json: string;
  summary_json: string;
  selected_skill_id?: string | null;
};

/** Chat only patches draft fields; inserting a second draft for the same job would violate uk_t_skill_draft_job. */
export type SkillDraftUpdate = {
  payload_json?: string;
  summary_json?: string;
  selected_skill_id?: string | null;
};

/** Internal Skill processing ledger; must not grow external adapter columns. */
export type SkillLedgerWrite = {
  ledger_id?: string;
  job_id: string;
  skill_id?: string | null;
  original_blob_uri: string;
  original_mime: string;
  patched_blob_uri?: string | null;
  patched_mime?: string | null;
  verdict: string;
  reason: string;
  fix_list_json: string;
  unprocessed_tables_json: string;
};

function isUniqueConstraintError(err: unknown): boolean {
  const code = (err as { code?: string }).code;
  return code === "SQLITE_CONSTRAINT_UNIQUE" || code === "SQLITE_CONSTRAINT";
}

const SYSTEM = "system";

function insertPendingIngestPages(
  db: Database.Database,
  input: { ingest_run_id: string; doc_id: string; page_count: number; ts: string },
): void {
  const stmt = db.prepare(
    `INSERT INTO t_ingest_page
      (ingest_run_id, doc_id, page_no, status, error, created_at, updated_at, creator, updater, deleted)
     VALUES (?, ?, ?, 'pending', NULL, ?, ?, ?, ?, 0)`,
  );
  for (let pageNo = 1; pageNo <= input.page_count; pageNo += 1) {
    stmt.run(input.ingest_run_id, input.doc_id, pageNo, input.ts, input.ts, SYSTEM, SYSTEM);
  }
}

export class CoreEngineStore {
  constructor(private readonly db: Database.Database) {}

  close(): void {
    this.db.close();
  }

  seedPublishedRules(): void {
    this.ensureEmptySpecPack();
    seedDemoDocTypes(this, {
      packId: PACK_ID,
      parentId: DOC_TYPE_PARENT_ID,
      childId: DOC_TYPE_CHILD_ID,
    });
    seedConcreteInspectionBatchLedger(this, { packId: PACK_ID });
    const ts = nowIso();
    this.db
      .prepare(
        `INSERT OR IGNORE INTO t_rule
          (rule_id, pack_id, title, created_at, updated_at, creator, updater, deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      )
      .run(RULE_R1_ID, PACK_ID, "required(编号)", ts, ts, SYSTEM, SYSTEM);
    this.db
      .prepare(
        `INSERT OR IGNORE INTO t_rule
          (rule_id, pack_id, title, created_at, updated_at, creator, updater, deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      )
      .run(RULE_R2_ID, PACK_ID, "compare(日期A, ≤, 日期B)", ts, ts, SYSTEM, SYSTEM);
    this.db
      .prepare(
        `INSERT OR IGNORE INTO t_rule_version
          (version_id, rule_id, dsl_json, status, blocking, created_at, updated_at, creator, updater, deleted)
         VALUES (?, ?, ?, 'published', 1, ?, ?, ?, ?, 0)`,
      )
      .run(RULE_R1_VERSION_ID, RULE_R1_ID, JSON.stringify(R1_DSL), ts, ts, SYSTEM, SYSTEM);
    this.db
      .prepare(
        `INSERT OR IGNORE INTO t_rule_version
          (version_id, rule_id, dsl_json, status, blocking, created_at, updated_at, creator, updater, deleted)
         VALUES (?, ?, ?, 'published', 1, ?, ?, ?, ?, 0)`,
      )
      .run(RULE_R2_VERSION_ID, RULE_R2_ID, JSON.stringify(R2_DSL), ts, ts, SYSTEM, SYSTEM);
  }

  /**
   * Ensure PACK_ID has an empty spec-pack shell so jobs can point at it.
   * Name is 「空规范包」 — never an industry preset (公路/水利/房建).
   */
  private ensureEmptySpecPack(): void {
    const ts = nowIso();
    this.db
      .prepare(
        `INSERT OR IGNORE INTO t_spec_pack
          (pack_id, project_id, name, version, group_keys_json, order_key, effective_standard_version_id,
           created_at, updated_at, creator, updater, deleted)
         VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?, ?, 0)`,
      )
      .run(PACK_ID, SEED_PACK_PROJECT_ID, EMPTY_PACK_NAME, EMPTY_PACK_VERSION, ts, ts, SYSTEM, SYSTEM);
  }

  /** Insert an empty spec pack shell; group_keys / order_key / standard version stay null this slice. */
  insertSpecPack(input: {
    project_id: string;
    name: string;
    version: string;
    pack_id?: string;
  }): SpecPackRow {
    const ts = nowIso();
    const pack_id = input.pack_id ?? newId("pack");
    this.db
      .prepare(
        `INSERT INTO t_spec_pack
          (pack_id, project_id, name, version, group_keys_json, order_key, effective_standard_version_id,
           created_at, updated_at, creator, updater, deleted)
         VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?, ?, 0)`,
      )
      .run(pack_id, input.project_id, input.name, input.version, ts, ts, SYSTEM, SYSTEM);
    return this.db.prepare(`SELECT * FROM t_spec_pack WHERE pack_id = ?`).get(pack_id) as SpecPackRow;
  }

  listSpecPacks(projectId: string): SpecPackRow[] {
    return this.db
      .prepare(
        `SELECT * FROM t_spec_pack WHERE project_id = ? AND deleted = 0 ORDER BY id ASC`,
      )
      .all(projectId) as SpecPackRow[];
  }

  getSpecPack(packId: string): SpecPackRow | null {
    const row = this.db
      .prepare(`SELECT * FROM t_spec_pack WHERE pack_id = ? AND deleted = 0`)
      .get(packId) as SpecPackRow | undefined;
    return row ?? null;
  }

  /** Persist caller groupKeys JSON array + optional orderKey; does not inject industry presets. */
  updateSpecPackGrouping(
    packId: string,
    groupKeys: string[],
    orderKey: string | null,
  ): SpecPackRow {
    const pack = this.getSpecPack(packId);
    if (!pack) {
      throw new Error(`spec pack not found: ${packId}`);
    }
    const ts = nowIso();
    this.db
      .prepare(
        `UPDATE t_spec_pack
         SET group_keys_json = ?, order_key = ?, updated_at = ?, updater = ?
         WHERE pack_id = ? AND deleted = 0`,
      )
      .run(JSON.stringify(groupKeys), orderKey, ts, SYSTEM, packId);
    return this.getSpecPack(packId)!;
  }

  bindEffectiveVersion(packId: string, versionId: string): SpecPackRow {
    const pack = this.getSpecPack(packId);
    if (!pack) {
      throw new Error(`spec pack not found: ${packId}`);
    }
    const version = this.getStandardVersion(versionId);
    if (!version) {
      throw new Error(`standard version not found: ${versionId}`);
    }
    if (version.status !== "effective") {
      throw new Error(`standard version ${versionId} is ${version.status}, not effective`);
    }
    const doc = this.getStandardDoc(version.doc_id);
    if (!doc || doc.pack_id !== packId) {
      throw new Error(`standard version ${versionId} does not belong to pack ${packId}`);
    }
    const ts = nowIso();
    this.db
      .prepare(
        `UPDATE t_spec_pack
         SET effective_standard_version_id = ?, updated_at = ?, updater = ?
         WHERE pack_id = ? AND deleted = 0`,
      )
      .run(versionId, ts, SYSTEM, packId);
    return this.getSpecPack(packId)!;
  }

  insertStandardDoc(input: {
    pack_id: string;
    title: string;
    file_uri: string;
    doc_id?: string;
  }): StandardDocRow {
    const ts = nowIso();
    const doc_id = input.doc_id ?? newId("sdoc");
    this.db
      .prepare(
        `INSERT INTO t_standard_doc
          (doc_id, pack_id, title, file_uri, created_at, updated_at, creator, updater, deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      )
      .run(doc_id, input.pack_id, input.title, input.file_uri, ts, ts, SYSTEM, SYSTEM);
    return this.getStandardDoc(doc_id)!;
  }

  getStandardDoc(docId: string): StandardDocRow | null {
    const row = this.db
      .prepare(`SELECT * FROM t_standard_doc WHERE doc_id = ? AND deleted = 0`)
      .get(docId) as StandardDocRow | undefined;
    return row ?? null;
  }

  listStandardDocs(packId: string): StandardDocRow[] {
    return this.db
      .prepare(
        `SELECT * FROM t_standard_doc WHERE pack_id = ? AND deleted = 0 ORDER BY id ASC`,
      )
      .all(packId) as StandardDocRow[];
  }

  insertStandardVersion(input: {
    doc_id: string;
    status: string;
    version_id?: string;
  }): StandardVersionRow {
    const ts = nowIso();
    const version_id = input.version_id ?? newId("sver");
    this.db
      .prepare(
        `INSERT INTO t_standard_version
          (version_id, doc_id, status, created_at, updated_at, creator, updater, deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      )
      .run(version_id, input.doc_id, input.status, ts, ts, SYSTEM, SYSTEM);
    return this.getStandardVersion(version_id)!;
  }

  getStandardVersion(versionId: string): StandardVersionRow | null {
    const row = this.db
      .prepare(`SELECT * FROM t_standard_version WHERE version_id = ? AND deleted = 0`)
      .get(versionId) as StandardVersionRow | undefined;
    return row ?? null;
  }

  listStandardVersions(docId: string): StandardVersionRow[] {
    return this.db
      .prepare(
        `SELECT * FROM t_standard_version WHERE doc_id = ? AND deleted = 0 ORDER BY id ASC`,
      )
      .all(docId) as StandardVersionRow[];
  }

  listEffectiveStandardVersions(packId: string): StandardVersionRow[] {
    return this.db
      .prepare(
        `SELECT v.* FROM t_standard_version v
         INNER JOIN t_standard_doc d ON d.doc_id = v.doc_id
         WHERE d.pack_id = ? AND v.status = 'effective' AND v.deleted = 0 AND d.deleted = 0
         ORDER BY v.id ASC`,
      )
      .all(packId) as StandardVersionRow[];
  }

  updateStandardVersionStatus(versionId: string, status: string): StandardVersionRow {
    const version = this.getStandardVersion(versionId);
    if (!version) {
      throw new Error(`standard version not found: ${versionId}`);
    }
    const ts = nowIso();
    this.db
      .prepare(
        `UPDATE t_standard_version SET status = ?, updated_at = ?, updater = ? WHERE version_id = ? AND deleted = 0`,
      )
      .run(status, ts, SYSTEM, versionId);
    return this.getStandardVersion(versionId)!;
  }

  insertClause(input: {
    clause_id: string;
    version_id: string;
    parent_clause_id?: string | null;
    heading?: string | null;
    body: string;
    span_json?: string | null;
    qdrant_point_id?: string | null;
    file_name?: string | null;
    page_start?: number | null;
    page_end?: number | null;
  }): ClauseRow {
    const ts = nowIso();
    this.db
      .prepare(
        `INSERT INTO t_clause
          (clause_id, version_id, parent_clause_id, heading, body, span_json, qdrant_point_id,
           file_name, page_start, page_end, created_at, updated_at, creator, updater, deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      )
      .run(
        input.clause_id,
        input.version_id,
        input.parent_clause_id ?? null,
        input.heading ?? null,
        input.body,
        input.span_json ?? null,
        input.qdrant_point_id ?? input.clause_id,
        input.file_name ?? null,
        input.page_start ?? null,
        input.page_end ?? null,
        ts,
        ts,
        SYSTEM,
        SYSTEM,
      );
    return this.getClause(input.clause_id)!;
  }

  getClause(clauseId: string): ClauseRow | null {
    const row = this.db
      .prepare(`SELECT * FROM t_clause WHERE clause_id = ? AND deleted = 0`)
      .get(clauseId) as ClauseRow | undefined;
    return row ?? null;
  }

  listClauses(versionId: string): ClauseRow[] {
    return this.db
      .prepare(
        `SELECT * FROM t_clause WHERE version_id = ? AND deleted = 0 ORDER BY id ASC`,
      )
      .all(versionId) as ClauseRow[];
  }

  insertStandardEdge(input: {
    from_clause_id: string;
    to_clause_id: string;
    kind: string;
  }): StandardEdgeRow {
    const ts = nowIso();
    const result = this.db
      .prepare(
        `INSERT INTO t_standard_edge
          (from_clause_id, to_clause_id, kind, created_at, updated_at, creator, updater, deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      )
      .run(input.from_clause_id, input.to_clause_id, input.kind, ts, ts, SYSTEM, SYSTEM);
    return this.db
      .prepare(`SELECT * FROM t_standard_edge WHERE id = ?`)
      .get(Number(result.lastInsertRowid)) as StandardEdgeRow;
  }

  listStandardEdges(fromClauseId?: string): StandardEdgeRow[] {
    if (fromClauseId) {
      return this.db
        .prepare(
          `SELECT * FROM t_standard_edge WHERE from_clause_id = ? AND deleted = 0 ORDER BY id ASC`,
        )
        .all(fromClauseId) as StandardEdgeRow[];
    }
    return this.db
      .prepare(`SELECT * FROM t_standard_edge WHERE deleted = 0 ORDER BY id ASC`)
      .all() as StandardEdgeRow[];
  }

  /**
   * Layout units are the ingest/search grain. Table/annex chunks stay here with
   * null clause_id so t_clause never receives a fabricated id.
   */
  insertLayoutUnit(input: LayoutUnitWrite): LayoutUnitRow {
    const ts = nowIso();
    const unit_id = input.unit_id ?? newId("lu");
    const qdrant_point_id = input.qdrant_point_id ?? unit_id;
    this.db
      .prepare(
        `INSERT INTO t_layout_unit
          (unit_id, version_id, chunk_kind, clause_id, file_name, page_start, page_end,
           heading, body_markdown, qdrant_point_id, ingest_run_id,
           created_at, updated_at, creator, updater, deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      )
      .run(
        unit_id,
        input.version_id,
        input.chunk_kind,
        input.clause_id ?? null,
        input.file_name,
        input.page_start,
        input.page_end,
        input.heading ?? null,
        input.body_markdown,
        qdrant_point_id,
        input.ingest_run_id ?? null,
        ts,
        ts,
        SYSTEM,
        SYSTEM,
      );
    return this.getLayoutUnit(unit_id)!;
  }

  getLayoutUnit(unitId: string): LayoutUnitRow | null {
    const row = this.db
      .prepare(`SELECT * FROM t_layout_unit WHERE unit_id = ? AND deleted = 0`)
      .get(unitId) as LayoutUnitRow | undefined;
    return row ?? null;
  }

  listLayoutUnits(versionId: string): LayoutUnitRow[] {
    return this.db
      .prepare(
        `SELECT * FROM t_layout_unit WHERE version_id = ? AND deleted = 0 ORDER BY id ASC`,
      )
      .all(versionId) as LayoutUnitRow[];
  }

  /**
   * Auto PARENT_OF/BELONGS_TO/SUPPORTS live here so t_standard_edge stays
   * human-edited CITES/SUPERSEDES.
   */
  insertLayoutEdge(input: LayoutEdgeWrite): LayoutEdgeRow {
    const ts = nowIso();
    const result = this.db
      .prepare(
        `INSERT INTO t_layout_edge
          (from_unit_id, to_unit_id, kind, link_method, confidence,
           created_at, updated_at, creator, updater, deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      )
      .run(
        input.from_unit_id,
        input.to_unit_id,
        input.kind,
        input.link_method,
        input.confidence ?? 1.0,
        ts,
        ts,
        SYSTEM,
        SYSTEM,
      );
    return this.db
      .prepare(`SELECT * FROM t_layout_edge WHERE id = ?`)
      .get(Number(result.lastInsertRowid)) as LayoutEdgeRow;
  }

  /**
   * Inserts the run and N pending pages together. Later ticks can set
   * index_error (vector upsert failed) without confusing it with ocr_error.
   */
  insertIngestRun(input: IngestRunWrite): IngestRunRow {
    const ts = nowIso();
    const ingest_run_id = input.ingest_run_id ?? newId("ing");
    this.db
      .prepare(
        `INSERT INTO t_ingest_run
          (ingest_run_id, doc_id, pack_id, status, file_name,
           created_at, updated_at, creator, updater, deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      )
      .run(
        ingest_run_id,
        input.doc_id,
        input.pack_id,
        input.status ?? "pending",
        input.file_name,
        ts,
        ts,
        SYSTEM,
        SYSTEM,
      );
    insertPendingIngestPages(this.db, {
      ingest_run_id,
      doc_id: input.doc_id,
      page_count: input.page_count,
      ts,
    });
    const row = this.db
      .prepare(`SELECT * FROM t_ingest_run WHERE ingest_run_id = ? AND deleted = 0`)
      .get(ingest_run_id) as IngestRunRow;
    return row;
  }

  listIngestPages(ingestRunId: string): IngestPageRow[] {
    return this.db
      .prepare(
        `SELECT * FROM t_ingest_page WHERE ingest_run_id = ? AND deleted = 0 ORDER BY page_no ASC`,
      )
      .all(ingestRunId) as IngestPageRow[];
  }

  /**
   * index_error means Qdrant upsert failed after OCR succeeded; ocr_error is a
   * different recovery path and must not be reused for indexing failures (R28).
   */
  updateIngestPage(input: IngestPageUpdate): IngestPageRow {
    const ts = nowIso();
    this.db
      .prepare(
        `UPDATE t_ingest_page
         SET status = ?, error = ?, updated_at = ?, updater = ?
         WHERE ingest_run_id = ? AND page_no = ? AND deleted = 0`,
      )
      .run(
        input.status,
        input.error ?? null,
        ts,
        SYSTEM,
        input.ingest_run_id,
        input.page_no,
      );
    const row = this.db
      .prepare(
        `SELECT * FROM t_ingest_page WHERE ingest_run_id = ? AND page_no = ? AND deleted = 0`,
      )
      .get(input.ingest_run_id, input.page_no) as IngestPageRow | undefined;
    if (!row) {
      throw new Error(
        `ingest page not found: ${input.ingest_run_id} page ${input.page_no}`,
      );
    }
    return row;
  }

  getDocType(docTypeId: string): DocTypeRow | null {
    const row = this.db
      .prepare(`SELECT * FROM t_doc_type WHERE doc_type_id = ? AND deleted = 0`)
      .get(docTypeId) as DocTypeRow | undefined;
    return row ?? null;
  }

  listDocTypesByPack(packId: string): DocTypeRow[] {
    return this.db
      .prepare(
        `SELECT * FROM t_doc_type WHERE pack_id = ? AND deleted = 0 ORDER BY id ASC`,
      )
      .all(packId) as DocTypeRow[];
  }

  insertDocType(input: {
    pack_id: string;
    name: string;
    parent_doc_type_id?: string | null;
    doc_type_id?: string;
  }): DocTypeRow {
    const ts = nowIso();
    const doc_type_id = input.doc_type_id ?? newId("dt");
    if (input.parent_doc_type_id) {
      const parent = this.getDocType(input.parent_doc_type_id);
      if (!parent || parent.pack_id !== input.pack_id) {
        throw new Error("parent doc type does not belong to pack");
      }
    }
    this.db
      .prepare(
        `INSERT INTO t_doc_type
          (doc_type_id, pack_id, parent_doc_type_id, name, created_at, updated_at, creator, updater, deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      )
      .run(
        doc_type_id,
        input.pack_id,
        input.parent_doc_type_id ?? null,
        input.name,
        ts,
        ts,
        SYSTEM,
        SYSTEM,
      );
    return this.getDocType(doc_type_id)!;
  }

  updateDocTypeName(docTypeId: string, name: string): DocTypeRow {
    const ts = nowIso();
    this.db
      .prepare(
        `UPDATE t_doc_type SET name = ?, updated_at = ?, updater = ? WHERE doc_type_id = ? AND deleted = 0`,
      )
      .run(name, ts, SYSTEM, docTypeId);
    const row = this.getDocType(docTypeId);
    if (!row) throw new Error(`doc type not found: ${docTypeId}`);
    return row;
  }

  countChildDocTypes(docTypeId: string): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS c FROM t_doc_type WHERE parent_doc_type_id = ? AND deleted = 0`,
      )
      .get(docTypeId) as { c: number };
    return Number(row.c);
  }

  countTemplatesByDocType(docTypeId: string): number {
    const row = this.db
      .prepare(`SELECT COUNT(*) AS c FROM t_template WHERE doc_type_id = ? AND deleted = 0`)
      .get(docTypeId) as { c: number };
    return Number(row.c);
  }

  countJobsByDocType(docTypeId: string): number {
    const row = this.db
      .prepare(`SELECT COUNT(*) AS c FROM t_job WHERE doc_type_id = ? AND deleted = 0`)
      .get(docTypeId) as { c: number };
    return Number(row.c);
  }

  softDeleteDocType(docTypeId: string): DocTypeRow {
    if (this.countChildDocTypes(docTypeId) > 0) {
      throw new LedgerConflictError("doc type has child types");
    }
    if (this.countTemplatesByDocType(docTypeId) > 0) {
      throw new LedgerConflictError("doc type has templates");
    }
    if (this.countJobsByDocType(docTypeId) > 0) {
      throw new LedgerConflictError("doc type has jobs");
    }
    const ts = nowIso();
    this.db
      .prepare(
        `UPDATE t_doc_type SET deleted = 1, updated_at = ?, updater = ? WHERE doc_type_id = ? AND deleted = 0`,
      )
      .run(ts, SYSTEM, docTypeId);
    const row = this.db
      .prepare(`SELECT * FROM t_doc_type WHERE doc_type_id = ?`)
      .get(docTypeId) as DocTypeRow | undefined;
    if (!row) throw new Error(`doc type not found: ${docTypeId}`);
    return row;
  }

  listFieldDefs(docTypeId: string): FieldDefRow[] {
    return this.db
      .prepare(
        `SELECT * FROM t_field_def WHERE doc_type_id = ? AND deleted = 0 ORDER BY id ASC`,
      )
      .all(docTypeId) as FieldDefRow[];
  }

  saveFieldDefs(
    docTypeId: string,
    defs: Array<{ field_key: string; value_type: string; required?: number }>,
  ): FieldDefRow[] {
    const ts = nowIso();
    const tx = this.db.transaction(() => {
      this.db
        .prepare(`UPDATE t_field_def SET deleted = 1, updated_at = ?, updater = ? WHERE doc_type_id = ?`)
        .run(ts, SYSTEM, docTypeId);
      const insert = this.db.prepare(
        `INSERT INTO t_field_def
          (doc_type_id, field_key, value_type, required, created_at, updated_at, creator, updater, deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      );
      for (const def of defs) {
        insert.run(
          docTypeId,
          def.field_key,
          def.value_type,
          def.required ?? 0,
          ts,
          ts,
          SYSTEM,
          SYSTEM,
        );
      }
    });
    tx();
    return this.listFieldDefs(docTypeId);
  }

  /** Ancestor chain root → leaf; includes docTypeId. */
  listDocTypeAncestorChain(docTypeId: string): DocTypeRow[] {
    const chain: DocTypeRow[] = [];
    let current: DocTypeRow | null = this.getDocType(docTypeId);
    while (current) {
      chain.unshift(current);
      current = current.parent_doc_type_id ? this.getDocType(current.parent_doc_type_id) : null;
    }
    return chain;
  }

  /** Child field defs override parent keys along the ancestor chain. */
  listEffectiveFieldDefs(docTypeId: string): FieldDefRow[] {
    const byKey = new Map<string, FieldDefRow>();
    for (const dt of this.listDocTypeAncestorChain(docTypeId)) {
      for (const def of this.listFieldDefs(dt.doc_type_id)) {
        byKey.set(def.field_key, def);
      }
    }
    return [...byKey.values()].sort((a, b) => a.field_key.localeCompare(b.field_key, "zh"));
  }

  listTemplatesByDocType(docTypeId: string): TemplateRow[] {
    return this.db
      .prepare(
        `SELECT * FROM t_template WHERE doc_type_id = ? AND deleted = 0 ORDER BY id ASC`,
      )
      .all(docTypeId) as TemplateRow[];
  }

  insertTemplate(input: {
    pack_id: string;
    name: string;
    page_image_uri?: string | null;
    doc_type_id?: string;
    layout_kind?: string;
    excel_template_uri?: string | null;
    excel_sheet_name?: string | null;
  }): TemplateRow {
    const ts = nowIso();
    const template_id = newId("tpl");
    const doc_type_id = input.doc_type_id ?? "";
    if (doc_type_id) {
      const dt = this.getDocType(doc_type_id);
      if (!dt || dt.pack_id !== input.pack_id) {
        throw new Error("doc type does not belong to pack");
      }
    }
    this.db
      .prepare(
        `INSERT INTO t_template
          (template_id, pack_id, doc_type_id, name, page_image_uri, layout_kind, excel_template_uri, excel_sheet_name, created_at, updated_at, creator, updater, deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      )
      .run(
        template_id,
        input.pack_id,
        doc_type_id,
        input.name,
        input.page_image_uri ?? null,
        input.layout_kind ?? "raster",
        input.excel_template_uri ?? null,
        input.excel_sheet_name ?? null,
        ts,
        ts,
        SYSTEM,
        SYSTEM,
      );
    return this.db.prepare(`SELECT * FROM t_template WHERE template_id = ?`).get(template_id) as TemplateRow;
  }

  /** Update Excel layout fields on an existing template. */
  updateTemplateExcel(
    templateId: string,
    input: {
      layout_kind?: string;
      excel_template_uri?: string | null;
      excel_sheet_name?: string | null;
    },
  ): TemplateRow {
    const ts = nowIso();
    const current = this.getTemplate(templateId);
    if (!current) {
      throw new Error("template not found");
    }
    this.db
      .prepare(
        `UPDATE t_template
         SET layout_kind = ?, excel_template_uri = ?, excel_sheet_name = ?, updated_at = ?, updater = ?
         WHERE template_id = ? AND deleted = 0`,
      )
      .run(
        input.layout_kind ?? current.layout_kind ?? "raster",
        input.excel_template_uri !== undefined ? input.excel_template_uri : current.excel_template_uri,
        input.excel_sheet_name !== undefined ? input.excel_sheet_name : current.excel_sheet_name,
        ts,
        SYSTEM,
        templateId,
      );
    return this.getTemplate(templateId)!;
  }

  /** Upsert boxes by (template_id, field_key) so re-save replaces coords without duplicate keys. */
  saveFieldBoxes(templateId: string, boxes: FieldBoxWrite[]): FieldBoxRow[] {
    const ts = nowIso();
    const upsert = this.db.prepare(
      `INSERT INTO t_field_box
        (template_id, field_key, value_type, page, x, y, w, h, created_at, updated_at, creator, updater, deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
       ON CONFLICT(template_id, field_key) DO UPDATE SET
         value_type = excluded.value_type,
         page = excluded.page,
         x = excluded.x,
         y = excluded.y,
         w = excluded.w,
         h = excluded.h,
         updated_at = excluded.updated_at,
         updater = excluded.updater,
         deleted = 0`,
    );
    const tx = this.db.transaction(() => {
      for (const box of boxes) {
        upsert.run(
          templateId,
          box.field_key,
          box.value_type,
          box.page,
          box.x,
          box.y,
          box.w,
          box.h,
          ts,
          ts,
          SYSTEM,
          SYSTEM,
        );
      }
    });
    tx();
    return this.listFieldBoxes(templateId);
  }

  listFieldBoxes(templateId: string): FieldBoxRow[] {
    return this.db
      .prepare(
        `SELECT * FROM t_field_box WHERE template_id = ? AND deleted = 0 ORDER BY id ASC`,
      )
      .all(templateId) as FieldBoxRow[];
  }

  listPublishedRuleVersions(): RuleVersionRow[] {
    return this.db
      .prepare(
        `SELECT * FROM t_rule_version WHERE status = 'published' AND deleted = 0 ORDER BY rule_id ASC`,
      )
      .all() as RuleVersionRow[];
  }

  getRuleVersionByRuleId(ruleId: string): RuleVersionRow | null {
    const row = this.db
      .prepare(
        `SELECT * FROM t_rule_version WHERE rule_id = ? AND deleted = 0 ORDER BY id DESC LIMIT 1`,
      )
      .get(ruleId) as RuleVersionRow | undefined;
    return row ?? null;
  }

  getRuleVersion(versionId: string): RuleVersionRow | null {
    const row = this.db
      .prepare(`SELECT * FROM t_rule_version WHERE version_id = ? AND deleted = 0`)
      .get(versionId) as RuleVersionRow | undefined;
    return row ?? null;
  }

  insertRule(input: { pack_id: string; title: string | null }): RuleRow {
    const ts = nowIso();
    const rule_id = newId("rule");
    this.db
      .prepare(
        `INSERT INTO t_rule
          (rule_id, pack_id, title, created_at, updated_at, creator, updater, deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      )
      .run(rule_id, input.pack_id, input.title, ts, ts, SYSTEM, SYSTEM);
    return this.db.prepare(`SELECT * FROM t_rule WHERE rule_id = ?`).get(rule_id) as RuleRow;
  }

  insertDraftRuleVersion(input: {
    rule_id: string;
    dsl_json: string;
    blocking: number;
  }): RuleVersionRow {
    const ts = nowIso();
    const version_id = newId("rv");
    this.db
      .prepare(
        `INSERT INTO t_rule_version
          (version_id, rule_id, dsl_json, status, blocking, created_at, updated_at, creator, updater, deleted)
         VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, 0)`,
      )
      .run(
        version_id,
        input.rule_id,
        input.dsl_json,
        input.blocking,
        ts,
        ts,
        SYSTEM,
        SYSTEM,
      );
    return this.getRuleVersion(version_id)!;
  }

  updateRuleVersionStatus(versionId: string, status: string): RuleVersionRow {
    const ts = nowIso();
    this.db
      .prepare(
        `UPDATE t_rule_version SET status = ?, updated_at = ?, updater = ? WHERE version_id = ? AND deleted = 0`,
      )
      .run(status, ts, SYSTEM, versionId);
    return this.getRuleVersion(versionId)!;
  }

  insertRuleFixture(input: {
    version_id: string;
    kind: string;
    payload_json: string;
  }): RuleFixtureRow {
    const ts = nowIso();
    const result = this.db
      .prepare(
        `INSERT INTO t_rule_fixture
          (version_id, kind, payload_json, last_result, created_at, updated_at, creator, updater, deleted)
         VALUES (?, ?, ?, NULL, ?, ?, ?, ?, 0)`,
      )
      .run(input.version_id, input.kind, input.payload_json, ts, ts, SYSTEM, SYSTEM);
    return this.db
      .prepare(`SELECT * FROM t_rule_fixture WHERE id = ?`)
      .get(Number(result.lastInsertRowid)) as RuleFixtureRow;
  }

  listRuleFixtures(versionId: string): RuleFixtureRow[] {
    return this.db
      .prepare(
        `SELECT * FROM t_rule_fixture WHERE version_id = ? AND deleted = 0 ORDER BY id ASC`,
      )
      .all(versionId) as RuleFixtureRow[];
  }

  updateFixtureLastResult(id: number, lastResult: string): RuleFixtureRow {
    const ts = nowIso();
    this.db
      .prepare(
        `UPDATE t_rule_fixture SET last_result = ?, updated_at = ?, updater = ? WHERE id = ? AND deleted = 0`,
      )
      .run(lastResult, ts, SYSTEM, id);
    return this.db.prepare(`SELECT * FROM t_rule_fixture WHERE id = ?`).get(id) as RuleFixtureRow;
  }

  insertProject(name: string): ProjectRow {
    const ts = nowIso();
    const project_id = newId("prj");
    this.db
      .prepare(
        `INSERT INTO t_project (project_id, name, created_at, updated_at, creator, updater, deleted)
         VALUES (?, ?, ?, ?, ?, ?, 0)`,
      )
      .run(project_id, name, ts, ts, SYSTEM, SYSTEM);
    return this.db.prepare(`SELECT * FROM t_project WHERE project_id = ?`).get(project_id) as ProjectRow;
  }

  listProjects(): ProjectRow[] {
    return this.db
      .prepare(`SELECT * FROM t_project WHERE deleted = 0 ORDER BY id ASC`)
      .all() as ProjectRow[];
  }

  getProject(projectId: string): ProjectRow | null {
    const row = this.db
      .prepare(`SELECT * FROM t_project WHERE project_id = ? AND deleted = 0`)
      .get(projectId) as ProjectRow | undefined;
    return row ?? null;
  }

  updateProjectName(projectId: string, name: string): ProjectRow {
    const project = this.getProject(projectId);
    if (!project) {
      throw new Error(`project not found: ${projectId}`);
    }
    const ts = nowIso();
    this.db
      .prepare(
        `UPDATE t_project SET name = ?, updated_at = ?, updater = ? WHERE project_id = ? AND deleted = 0`,
      )
      .run(name, ts, SYSTEM, projectId);
    return this.getProject(projectId)!;
  }

  softDeleteProject(projectId: string): ProjectRow {
    const project = this.getProject(projectId);
    if (!project) {
      throw new Error(`project not found: ${projectId}`);
    }
    if (this.listSpecPacks(projectId).length > 0) {
      throw new LedgerConflictError("project has spec packs");
    }
    const ts = nowIso();
    this.db
      .prepare(
        `UPDATE t_project SET deleted = 1, updated_at = ?, updater = ? WHERE project_id = ? AND deleted = 0`,
      )
      .run(ts, SYSTEM, projectId);
    return this.db.prepare(`SELECT * FROM t_project WHERE project_id = ?`).get(projectId) as ProjectRow;
  }

  updateSpecPackName(packId: string, name: string): SpecPackRow {
    const pack = this.getSpecPack(packId);
    if (!pack) {
      throw new Error(`spec pack not found: ${packId}`);
    }
    const ts = nowIso();
    this.db
      .prepare(
        `UPDATE t_spec_pack SET name = ?, updated_at = ?, updater = ? WHERE pack_id = ? AND deleted = 0`,
      )
      .run(name, ts, SYSTEM, packId);
    return this.getSpecPack(packId)!;
  }

  softDeleteSpecPack(packId: string): SpecPackRow {
    const pack = this.getSpecPack(packId);
    if (!pack) {
      throw new Error(`spec pack not found: ${packId}`);
    }
    if (this.countJobsByPack(packId) > 0) {
      throw new LedgerConflictError("spec pack has jobs");
    }
    const ts = nowIso();
    this.db
      .prepare(
        `UPDATE t_spec_pack SET deleted = 1, updated_at = ?, updater = ? WHERE pack_id = ? AND deleted = 0`,
      )
      .run(ts, SYSTEM, packId);
    return this.db.prepare(`SELECT * FROM t_spec_pack WHERE pack_id = ?`).get(packId) as SpecPackRow;
  }

  countJobsByPack(packId: string): number {
    const row = this.db
      .prepare(`SELECT COUNT(*) AS cnt FROM t_job WHERE pack_id = ? AND deleted = 0`)
      .get(packId) as { cnt: number };
    return Number(row.cnt);
  }

  getTemplate(templateId: string): TemplateRow | null {
    const row = this.db
      .prepare(`SELECT * FROM t_template WHERE template_id = ? AND deleted = 0`)
      .get(templateId) as TemplateRow | undefined;
    return row ?? null;
  }

  listTemplates(packId: string): TemplateRow[] {
    return this.db
      .prepare(`SELECT * FROM t_template WHERE pack_id = ? AND deleted = 0 ORDER BY id ASC`)
      .all(packId) as TemplateRow[];
  }

  listJobs(filter?: ListJobsFilter): JobRow[] {
    if (filter?.track) {
      return this.db
        .prepare(`SELECT * FROM t_job WHERE deleted = 0 AND track = ? ORDER BY id DESC`)
        .all(filter.track) as JobRow[];
    }
    return this.db
      .prepare(`SELECT * FROM t_job WHERE deleted = 0 ORDER BY id DESC`)
      .all() as JobRow[];
  }

  getDocumentForJob(jobId: string): DocumentRow | null {
    const row = this.db
      .prepare(
        `SELECT * FROM t_document WHERE job_id = ? AND deleted = 0 ORDER BY id ASC LIMIT 1`,
      )
      .get(jobId) as DocumentRow | undefined;
    return row ?? null;
  }

  getExtraction(jobId: string): ExtractionRow | null {
    const row = this.db
      .prepare(
        `SELECT * FROM t_extraction WHERE job_id = ? AND deleted = 0 ORDER BY id DESC LIMIT 1`,
      )
      .get(jobId) as ExtractionRow | undefined;
    return row ?? null;
  }

  listThreads(traceId: string): ConversationThreadRow[] {
    return this.db
      .prepare(
        `SELECT * FROM t_conversation_thread WHERE trace_id = ? AND deleted = 0 ORDER BY id ASC`,
      )
      .all(traceId) as ConversationThreadRow[];
  }

  listMessagesByTrace(traceId: string): ConversationMessageRow[] {
    return this.db
      .prepare(
        `SELECT m.* FROM t_conversation_message m
         INNER JOIN t_conversation_thread t ON t.thread_id = m.thread_id
         WHERE t.trace_id = ? AND m.deleted = 0 AND t.deleted = 0
         ORDER BY m.id ASC`,
      )
      .all(traceId) as ConversationMessageRow[];
  }

  /**
   * Persist a job. Omit track to keep leftover fixture semantics (`legacy`);
   * Skill uploads must pass track=`skill` so findings lists can exclude them.
   */
  insertJob(input: {
    project_id: string;
    pack_id: string | null;
    status: string;
    template_id?: string | null;
    doc_type_id?: string | null;
    track?: JobTrack;
    skill_draft_id?: string | null;
  }): JobRow {
    const ts = nowIso();
    const job_id = newId("job");
    const trace_id = newId("trc");
    this.db
      .prepare(
        `INSERT INTO t_job
          (job_id, project_id, pack_id, trace_id, status, template_id, doc_type_id, agent_run_id,
           track, skill_draft_id,
           created_at, updated_at, creator, updater, deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, 0)`,
      )
      .run(
        job_id,
        input.project_id,
        input.pack_id,
        trace_id,
        input.status,
        input.template_id ?? null,
        input.doc_type_id ?? null,
        input.track ?? "legacy",
        input.skill_draft_id ?? null,
        ts,
        ts,
        SYSTEM,
        SYSTEM,
      );
    return this.getJob(job_id)!;
  }

  updateJobStatus(jobId: string, status: string): JobRow {
    const ts = nowIso();
    this.db
      .prepare(`UPDATE t_job SET status = ?, updated_at = ?, updater = ? WHERE job_id = ? AND deleted = 0`)
      .run(status, ts, SYSTEM, jobId);
    return this.getJob(jobId)!;
  }

  updateJobAgentRunId(jobId: string, agentRunId: string): JobRow {
    const ts = nowIso();
    this.db
      .prepare(
        `UPDATE t_job SET agent_run_id = ?, updated_at = ?, updater = ? WHERE job_id = ? AND deleted = 0`,
      )
      .run(agentRunId, ts, SYSTEM, jobId);
    return this.getJob(jobId)!;
  }

  getJob(jobId: string): JobRow | null {
    const row = this.db
      .prepare(`SELECT * FROM t_job WHERE job_id = ? AND deleted = 0`)
      .get(jobId) as JobRow | undefined;
    return row ?? null;
  }

  getJobByTrace(traceId: string): JobRow | null {
    const row = this.db
      .prepare(`SELECT * FROM t_job WHERE trace_id = ? AND deleted = 0`)
      .get(traceId) as JobRow | undefined;
    return row ?? null;
  }

  insertDocument(input: {
    job_id: string;
    file_name: string;
    file_uri: string;
    mime: string | null;
  }): DocumentRow {
    const ts = nowIso();
    const doc_id = newId("doc");
    this.db
      .prepare(
        `INSERT INTO t_document
          (doc_id, job_id, file_name, file_uri, mime, created_at, updated_at, creator, updater, deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      )
      .run(doc_id, input.job_id, input.file_name, input.file_uri, input.mime, ts, ts, SYSTEM, SYSTEM);
    return this.db.prepare(`SELECT * FROM t_document WHERE doc_id = ?`).get(doc_id) as DocumentRow;
  }

  insertExtraction(input: {
    job_id: string;
    ocr_text: string | null;
    fields: Record<string, unknown>;
  }): ExtractionRow {
    const ts = nowIso();
    const extraction_id = newId("ext");
    this.db
      .prepare(
        `INSERT INTO t_extraction
          (extraction_id, job_id, ocr_text, fields_json, created_at, updated_at, creator, updater, deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      )
      .run(extraction_id, input.job_id, input.ocr_text, JSON.stringify(input.fields), ts, ts, SYSTEM, SYSTEM);
    return this.db.prepare(`SELECT * FROM t_extraction WHERE extraction_id = ?`).get(extraction_id) as ExtractionRow;
  }

  listExtractions(jobId: string): ExtractionRow[] {
    return this.db
      .prepare(`SELECT * FROM t_extraction WHERE job_id = ? AND deleted = 0 ORDER BY id ASC`)
      .all(jobId) as ExtractionRow[];
  }

  insertVolumePreview(input: { job_id: string; tree: unknown }): VolumePreviewRow {
    const ts = nowIso();
    const preview_id = newId("prv");
    this.db
      .prepare(
        `INSERT INTO t_volume_preview
          (preview_id, job_id, tree_json, created_at, updated_at, creator, updater, deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      )
      .run(preview_id, input.job_id, JSON.stringify(input.tree), ts, ts, SYSTEM, SYSTEM);
    return this.getVolumePreviewById(preview_id)!;
  }

  getVolumePreviewById(previewId: string): VolumePreviewRow | null {
    const row = this.db
      .prepare(`SELECT * FROM t_volume_preview WHERE preview_id = ? AND deleted = 0`)
      .get(previewId) as VolumePreviewRow | undefined;
    return row ?? null;
  }

  /** Latest preview snapshot for a job (highest id). */
  getVolumePreview(jobId: string): VolumePreviewRow | null {
    const row = this.db
      .prepare(
        `SELECT * FROM t_volume_preview WHERE job_id = ? AND deleted = 0 ORDER BY id DESC LIMIT 1`,
      )
      .get(jobId) as VolumePreviewRow | undefined;
    return row ?? null;
  }

  insertFinding(input: {
    job_id: string;
    rule_version_id: string;
    result: string;
    blocking: number;
    detail: string | null;
    clause_id?: string | null;
    standard_version_id?: string | null;
    retrieve_path?: string | null;
  }): FindingRow {
    const ts = nowIso();
    const finding_id = newId("fnd");
    this.db
      .prepare(
        `INSERT INTO t_finding
          (finding_id, job_id, rule_version_id, result, blocking, detail,
           clause_id, standard_version_id, retrieve_path,
           created_at, updated_at, creator, updater, deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      )
      .run(
        finding_id,
        input.job_id,
        input.rule_version_id,
        input.result,
        input.blocking,
        input.detail,
        input.clause_id ?? null,
        input.standard_version_id ?? null,
        input.retrieve_path ?? null,
        ts,
        ts,
        SYSTEM,
        SYSTEM,
      );
    return this.db.prepare(`SELECT * FROM t_finding WHERE finding_id = ?`).get(finding_id) as FindingRow;
  }

  listFindings(jobId: string): FindingRow[] {
    return this.db
      .prepare(`SELECT * FROM t_finding WHERE job_id = ? AND deleted = 0 ORDER BY id ASC`)
      .all(jobId) as FindingRow[];
  }

  insertProposal(input: {
    job_id: string;
    wording: string;
    status?: string;
    agent_run_id?: string | null;
  }): ProposalRow {
    const ts = nowIso();
    const proposal_id = newId("prp");
    this.db
      .prepare(
        `INSERT INTO t_proposal
          (proposal_id, job_id, status, wording, agent_run_id, created_at, updated_at, creator, updater, deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      )
      .run(
        proposal_id,
        input.job_id,
        input.status ?? "pending",
        input.wording,
        input.agent_run_id ?? null,
        ts,
        ts,
        SYSTEM,
        SYSTEM,
      );
    return this.getProposal(proposal_id)!;
  }

  getProposal(proposalId: string): ProposalRow | null {
    const row = this.db
      .prepare(`SELECT * FROM t_proposal WHERE proposal_id = ? AND deleted = 0`)
      .get(proposalId) as ProposalRow | undefined;
    return row ?? null;
  }

  updateProposalWording(proposalId: string, wording: string): ProposalRow {
    const ts = nowIso();
    this.db
      .prepare(
        `UPDATE t_proposal SET wording = ?, updated_at = ?, updater = ? WHERE proposal_id = ? AND deleted = 0`,
      )
      .run(wording, ts, SYSTEM, proposalId);
    return this.getProposal(proposalId)!;
  }

  updateProposalStatus(proposalId: string, status: string): ProposalRow {
    const ts = nowIso();
    this.db
      .prepare(
        `UPDATE t_proposal SET status = ?, updated_at = ?, updater = ? WHERE proposal_id = ? AND deleted = 0`,
      )
      .run(status, ts, SYSTEM, proposalId);
    return this.getProposal(proposalId)!;
  }

  listPendingProposals(jobId?: string): ProposalRow[] {
    if (jobId) {
      return this.db
        .prepare(
          `SELECT * FROM t_proposal WHERE job_id = ? AND status = 'pending' AND deleted = 0 ORDER BY id ASC`,
        )
        .all(jobId) as ProposalRow[];
    }
    return this.db
      .prepare(`SELECT * FROM t_proposal WHERE status = 'pending' AND deleted = 0 ORDER BY id ASC`)
      .all() as ProposalRow[];
  }

  insertReceipt(input: {
    proposal_id: string | null;
    job_id: string;
    status?: string;
    payload?: unknown;
  }): ReceiptRow {
    const ts = nowIso();
    const receipt_id = newId("rcp");
    this.db
      .prepare(
        `INSERT INTO t_receipt
          (receipt_id, proposal_id, job_id, status, payload_json, created_at, updated_at, creator, updater, deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      )
      .run(
        receipt_id,
        input.proposal_id,
        input.job_id,
        input.status ?? "accepted",
        input.payload === undefined ? null : JSON.stringify(input.payload),
        ts,
        ts,
        SYSTEM,
        SYSTEM,
      );
    return this.getReceipt(receipt_id)!;
  }

  getReceipt(receiptId: string): ReceiptRow | null {
    const row = this.db
      .prepare(`SELECT * FROM t_receipt WHERE receipt_id = ? AND deleted = 0`)
      .get(receiptId) as ReceiptRow | undefined;
    return row ?? null;
  }

  listReceipts(jobId?: string): ReceiptRow[] {
    if (jobId) {
      return this.db
        .prepare(`SELECT * FROM t_receipt WHERE job_id = ? AND deleted = 0 ORDER BY id ASC`)
        .all(jobId) as ReceiptRow[];
    }
    return this.db
      .prepare(`SELECT * FROM t_receipt WHERE deleted = 0 ORDER BY id ASC`)
      .all() as ReceiptRow[];
  }

  listReceiptsByProposal(proposalId: string): ReceiptRow[] {
    return this.db
      .prepare(
        `SELECT * FROM t_receipt WHERE proposal_id = ? AND deleted = 0 ORDER BY id ASC`,
      )
      .all(proposalId) as ReceiptRow[];
  }

  appendAudit(input: {
    trace_id: string;
    event_type: string;
    ref_id: string | null;
    payload: unknown;
  }): AuditEventRow {
    const ts = nowIso();
    const seqRow = this.db
      .prepare(`SELECT COALESCE(MAX(seq), 0) AS max_seq FROM t_audit_event WHERE trace_id = ?`)
      .get(input.trace_id) as { max_seq: number };
    const seq = Number(seqRow.max_seq) + 1;
    this.db
      .prepare(
        `INSERT INTO t_audit_event
          (trace_id, seq, event_type, ref_id, payload_json, created_at, updated_at, creator, updater, deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      )
      .run(input.trace_id, seq, input.event_type, input.ref_id, JSON.stringify(input.payload), ts, ts, SYSTEM, SYSTEM);
    return this.db
      .prepare(`SELECT * FROM t_audit_event WHERE trace_id = ? AND seq = ?`)
      .get(input.trace_id, seq) as AuditEventRow;
  }

  listAudit(traceId: string): AuditEventRow[] {
    return this.db
      .prepare(`SELECT * FROM t_audit_event WHERE trace_id = ? AND deleted = 0 ORDER BY seq ASC`)
      .all(traceId) as AuditEventRow[];
  }

  getThread(traceId: string, step: string): ConversationThreadRow | null {
    const row = this.db
      .prepare(
        `SELECT * FROM t_conversation_thread WHERE trace_id = ? AND step = ? AND deleted = 0`,
      )
      .get(traceId, step) as ConversationThreadRow | undefined;
    return row ?? null;
  }

  insertThread(input: {
    trace_id: string;
    step: string;
    job_id: string | null;
  }): ConversationThreadRow {
    const ts = nowIso();
    const thread_id = newId("thr");
    this.db
      .prepare(
        `INSERT INTO t_conversation_thread
          (thread_id, trace_id, step, job_id, hitl_token, created_at, updated_at, creator, updater, deleted)
         VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, 0)`,
      )
      .run(thread_id, input.trace_id, input.step, input.job_id, ts, ts, SYSTEM, SYSTEM);
    return this.db.prepare(`SELECT * FROM t_conversation_thread WHERE thread_id = ?`).get(thread_id) as ConversationThreadRow;
  }

  insertMessage(input: {
    thread_id: string;
    role: string;
    body: string;
  }): ConversationMessageRow {
    const ts = nowIso();
    const result = this.db
      .prepare(
        `INSERT INTO t_conversation_message
          (thread_id, role, body, created_at, updated_at, creator, updater, deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      )
      .run(input.thread_id, input.role, input.body, ts, ts, SYSTEM, SYSTEM);
    return this.db
      .prepare(`SELECT * FROM t_conversation_message WHERE id = ?`)
      .get(Number(result.lastInsertRowid)) as ConversationMessageRow;
  }

  listMessages(traceId: string, step: string): ConversationMessageRow[] {
    return this.db
      .prepare(
        `SELECT m.* FROM t_conversation_message m
         INNER JOIN t_conversation_thread t ON t.thread_id = m.thread_id
         WHERE t.trace_id = ? AND t.step = ? AND m.deleted = 0 AND t.deleted = 0
         ORDER BY m.id ASC`,
      )
      .all(traceId, step) as ConversationMessageRow[];
  }

  listExcelCellMappings(templateId: string): ExcelCellMappingRow[] {
    return this.db
      .prepare(
        `SELECT * FROM t_excel_cell_mapping WHERE template_id = ? AND deleted = 0 ORDER BY id ASC`,
      )
      .all(templateId) as ExcelCellMappingRow[];
  }

  getExcelCellMapping(mappingId: string): ExcelCellMappingRow | null {
    const row = this.db
      .prepare(`SELECT * FROM t_excel_cell_mapping WHERE mapping_id = ? AND deleted = 0`)
      .get(mappingId) as ExcelCellMappingRow | undefined;
    return row ?? null;
  }

  saveExcelCellMappings(templateId: string, mappings: ExcelCellMappingWrite[]): ExcelCellMappingRow[] {
    const ts = nowIso();
    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE t_excel_cell_mapping SET deleted = 1, updated_at = ?, updater = ? WHERE template_id = ?`,
        )
        .run(ts, SYSTEM, templateId);
      const insert = this.db.prepare(
        `INSERT INTO t_excel_cell_mapping
          (mapping_id, template_id, sheet_name, cell, field_key, value_type, signature_role, created_at, updated_at, creator, updater, deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      );
      for (const mapping of mappings) {
        insert.run(
          newId("map"),
          templateId,
          mapping.sheet_name,
          mapping.cell,
          mapping.field_key,
          mapping.value_type,
          mapping.signature_role ?? null,
          ts,
          ts,
          SYSTEM,
          SYSTEM,
        );
      }
    });
    tx();
    return this.listExcelCellMappings(templateId);
  }

  softDeleteExcelCellMapping(mappingId: string): ExcelCellMappingRow {
    const ts = nowIso();
    this.db
      .prepare(
        `UPDATE t_excel_cell_mapping SET deleted = 1, updated_at = ?, updater = ? WHERE mapping_id = ? AND deleted = 0`,
      )
      .run(ts, SYSTEM, mappingId);
    const row = this.db
      .prepare(`SELECT * FROM t_excel_cell_mapping WHERE mapping_id = ?`)
      .get(mappingId) as ExcelCellMappingRow;
    return row;
  }

  listFieldFillRules(docTypeId: string): FieldFillRuleRow[] {
    return this.db
      .prepare(
        `SELECT * FROM t_field_fill_rule WHERE doc_type_id = ? AND deleted = 0 ORDER BY id ASC`,
      )
      .all(docTypeId) as FieldFillRuleRow[];
  }

  getFieldFillRule(docTypeId: string, fieldKey: string): FieldFillRuleRow | null {
    const row = this.db
      .prepare(
        `SELECT * FROM t_field_fill_rule WHERE doc_type_id = ? AND field_key = ? AND deleted = 0`,
      )
      .get(docTypeId, fieldKey) as FieldFillRuleRow | undefined;
    return row ?? null;
  }

  saveFieldFillRules(docTypeId: string, rules: FieldFillRuleWrite[]): FieldFillRuleRow[] {
    const ts = nowIso();
    const tx = this.db.transaction(() => {
      this.db
        .prepare(`UPDATE t_field_fill_rule SET deleted = 1, updated_at = ?, updater = ? WHERE doc_type_id = ?`)
        .run(ts, SYSTEM, docTypeId);
      const insert = this.db.prepare(
        `INSERT INTO t_field_fill_rule
          (doc_type_id, field_key, required, pattern, min_num, max_num, default_generator, default_literal, created_at, updated_at, creator, updater, deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      );
      for (const rule of rules) {
        insert.run(
          docTypeId,
          rule.field_key,
          rule.required ?? 0,
          rule.pattern ?? null,
          rule.min_num ?? null,
          rule.max_num ?? null,
          rule.default_generator ?? null,
          rule.default_literal ?? null,
          ts,
          ts,
          SYSTEM,
          SYSTEM,
        );
      }
    });
    tx();
    return this.listFieldFillRules(docTypeId);
  }

  insertDocumentArtifact(input: {
    project_id: string;
    doc_type_id: string;
    template_id: string;
    file_uri: string;
    status?: string;
    trace_id: string;
    metadata?: unknown;
    artifact_id?: string;
  }): DocumentArtifactRow {
    const ts = nowIso();
    const artifact_id = input.artifact_id ?? newId("art");
    this.db
      .prepare(
        `INSERT INTO t_document_artifact
          (artifact_id, project_id, doc_type_id, template_id, file_uri, adapter_document_id, status, trace_id, receipt_id, metadata_json, created_at, updated_at, creator, updater, deleted)
         VALUES (?, ?, ?, ?, ?, NULL, ?, ?, NULL, ?, ?, ?, ?, ?, 0)`,
      )
      .run(
        artifact_id,
        input.project_id,
        input.doc_type_id,
        input.template_id,
        input.file_uri,
        input.status ?? "generated",
        input.trace_id,
        input.metadata === undefined ? null : JSON.stringify(input.metadata),
        ts,
        ts,
        SYSTEM,
        SYSTEM,
      );
    return this.getDocumentArtifact(artifact_id)!;
  }

  getDocumentArtifact(artifactId: string): DocumentArtifactRow | null {
    const row = this.db
      .prepare(`SELECT * FROM t_document_artifact WHERE artifact_id = ? AND deleted = 0`)
      .get(artifactId) as DocumentArtifactRow | undefined;
    return row ?? null;
  }

  listDocumentArtifacts(projectId: string, docTypeId?: string): DocumentArtifactRow[] {
    if (docTypeId) {
      return this.db
        .prepare(
          `SELECT * FROM t_document_artifact WHERE project_id = ? AND doc_type_id = ? AND deleted = 0 ORDER BY id ASC`,
        )
        .all(projectId, docTypeId) as DocumentArtifactRow[];
    }
    return this.db
      .prepare(
        `SELECT * FROM t_document_artifact WHERE project_id = ? AND deleted = 0 ORDER BY id ASC`,
      )
      .all(projectId) as DocumentArtifactRow[];
  }

  updateDocumentArtifact(
    artifactId: string,
    input: {
      adapter_document_id?: string | null;
      status?: string;
      receipt_id?: string | null;
      metadata?: unknown;
    },
  ): DocumentArtifactRow {
    const ts = nowIso();
    const current = this.getDocumentArtifact(artifactId);
    if (!current) {
      throw new Error("artifact not found");
    }
    this.db
      .prepare(
        `UPDATE t_document_artifact
         SET adapter_document_id = ?, status = ?, receipt_id = ?, metadata_json = ?, updated_at = ?, updater = ?
         WHERE artifact_id = ? AND deleted = 0`,
      )
      .run(
        input.adapter_document_id !== undefined ? input.adapter_document_id : current.adapter_document_id,
        input.status ?? current.status,
        input.receipt_id !== undefined ? input.receipt_id : current.receipt_id,
        input.metadata === undefined ? current.metadata_json : JSON.stringify(input.metadata),
        ts,
        SYSTEM,
        artifactId,
      );
    return this.getDocumentArtifact(artifactId)!;
  }

  insertSignatureTask(input: {
    artifact_id: string;
    role: string;
    assignee_label?: string | null;
    status?: string;
    trace_id: string;
    task_id?: string;
  }): SignatureTaskRow {
    const ts = nowIso();
    const task_id = input.task_id ?? newId("sig");
    this.db
      .prepare(
        `INSERT INTO t_signature_task
          (task_id, artifact_id, role, assignee_label, status, signer_name, trace_id, receipt_id, created_at, updated_at, creator, updater, deleted)
         VALUES (?, ?, ?, ?, ?, NULL, ?, NULL, ?, ?, ?, ?, 0)`,
      )
      .run(
        task_id,
        input.artifact_id,
        input.role,
        input.assignee_label ?? null,
        input.status ?? "pending",
        input.trace_id,
        ts,
        ts,
        SYSTEM,
        SYSTEM,
      );
    return this.getSignatureTask(task_id)!;
  }

  getSignatureTask(taskId: string): SignatureTaskRow | null {
    const row = this.db
      .prepare(`SELECT * FROM t_signature_task WHERE task_id = ? AND deleted = 0`)
      .get(taskId) as SignatureTaskRow | undefined;
    return row ?? null;
  }

  listSignatureTasksByArtifact(artifactId: string): SignatureTaskRow[] {
    return this.db
      .prepare(
        `SELECT * FROM t_signature_task WHERE artifact_id = ? AND deleted = 0 ORDER BY id ASC`,
      )
      .all(artifactId) as SignatureTaskRow[];
  }

  listPendingSignatureTasks(): SignatureTaskRow[] {
    return this.db
      .prepare(
        `SELECT * FROM t_signature_task WHERE status = 'pending' AND deleted = 0 ORDER BY id ASC`,
      )
      .all() as SignatureTaskRow[];
  }

  updateSignatureTask(
    taskId: string,
    input: {
      status?: string;
      signer_name?: string | null;
      receipt_id?: string | null;
    },
  ): SignatureTaskRow {
    const ts = nowIso();
    const current = this.getSignatureTask(taskId);
    if (!current) {
      throw new Error("signature task not found");
    }
    this.db
      .prepare(
        `UPDATE t_signature_task
         SET status = ?, signer_name = ?, receipt_id = ?, updated_at = ?, updater = ?
         WHERE task_id = ? AND deleted = 0`,
      )
      .run(
        input.status ?? current.status,
        input.signer_name !== undefined ? input.signer_name : current.signer_name,
        input.receipt_id !== undefined ? input.receipt_id : current.receipt_id,
        ts,
        SYSTEM,
        taskId,
      );
    return this.getSignatureTask(taskId)!;
  }

  listCompletenessRules(packId: string): CompletenessRuleRow[] {
    return this.db
      .prepare(
        `SELECT * FROM t_completeness_rule WHERE pack_id = ? AND deleted = 0 ORDER BY id ASC`,
      )
      .all(packId) as CompletenessRuleRow[];
  }

  getCompletenessRule(ruleId: string): CompletenessRuleRow | null {
    const row = this.db
      .prepare(`SELECT * FROM t_completeness_rule WHERE rule_id = ? AND deleted = 0`)
      .get(ruleId) as CompletenessRuleRow | undefined;
    return row ?? null;
  }

  saveCompletenessRules(packId: string, rules: CompletenessRuleWrite[]): CompletenessRuleRow[] {
    const ts = nowIso();
    const tx = this.db.transaction(() => {
      this.db
        .prepare(`UPDATE t_completeness_rule SET deleted = 1, updated_at = ?, updater = ? WHERE pack_id = ?`)
        .run(ts, SYSTEM, packId);
      const insert = this.db.prepare(
        `INSERT INTO t_completeness_rule
          (rule_id, pack_id, doc_type_id, label, required, created_at, updated_at, creator, updater, deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      );
      for (const rule of rules) {
        insert.run(
          rule.rule_id ?? newId("cr"),
          packId,
          rule.doc_type_id,
          rule.label,
          rule.required ?? 0,
          ts,
          ts,
          SYSTEM,
          SYSTEM,
        );
      }
    });
    tx();
    return this.listCompletenessRules(packId);
  }

  softDeleteCompletenessRule(ruleId: string): CompletenessRuleRow {
    const ts = nowIso();
    this.db
      .prepare(
        `UPDATE t_completeness_rule SET deleted = 1, updated_at = ?, updater = ? WHERE rule_id = ? AND deleted = 0`,
      )
      .run(ts, SYSTEM, ruleId);
    const row = this.db
      .prepare(`SELECT * FROM t_completeness_rule WHERE rule_id = ?`)
      .get(ruleId) as CompletenessRuleRow;
    return row;
  }

  /** Look up a production Skill; callers must not invent pack-global uniqueness. */
  getSkillRecord(skillId: string): SkillRecordRow | null {
    const row = this.db
      .prepare(`SELECT * FROM t_skill_record WHERE skill_id = ? AND deleted = 0`)
      .get(skillId) as SkillRecordRow | undefined;
    return row ?? null;
  }

  /** Pack-scoped canonical name lookup so R26 isolation is a query, not a convention. */
  getSkillRecordByPackName(packId: string, canonicalName: string): SkillRecordRow | null {
    const row = this.db
      .prepare(
        `SELECT * FROM t_skill_record WHERE pack_id = ? AND canonical_name = ? AND deleted = 0`,
      )
      .get(packId, canonicalName) as SkillRecordRow | undefined;
    return row ?? null;
  }

  listSkillRecords(packId: string): SkillRecordRow[] {
    return this.db
      .prepare(`SELECT * FROM t_skill_record WHERE pack_id = ? AND deleted = 0 ORDER BY id ASC`)
      .all(packId) as SkillRecordRow[];
  }

  /**
   * Insert a production Skill. Same canonical_name is legal across packs; same pack is a conflict.
   */
  insertSkillRecord(input: SkillRecordWrite): SkillRecordRow {
    if (this.getSkillRecordByPackName(input.pack_id, input.canonical_name)) {
      throw new LedgerConflictError("skill canonical_name already exists in pack");
    }
    const ts = nowIso();
    const skill_id = input.skill_id ?? newId("sk");
    try {
      this.db
        .prepare(
          `INSERT INTO t_skill_record
            (skill_id, pack_id, project_id, canonical_name, names_json, aliases_json,
             check_items_json, fix_actions_json, version, created_at, updated_at, creator, updater, deleted)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        )
        .run(
          skill_id,
          input.pack_id,
          input.project_id,
          input.canonical_name,
          input.names_json,
          input.aliases_json,
          input.check_items_json,
          input.fix_actions_json,
          input.version ?? 1,
          ts,
          ts,
          SYSTEM,
          SYSTEM,
        );
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new LedgerConflictError("skill canonical_name already exists in pack");
      }
      throw err;
    }
    return this.getSkillRecord(skill_id)!;
  }

  getSkillDraft(draftId: string): SkillDraftRow | null {
    const row = this.db
      .prepare(`SELECT * FROM t_skill_draft WHERE draft_id = ? AND deleted = 0`)
      .get(draftId) as SkillDraftRow | undefined;
    return row ?? null;
  }

  getSkillDraftByJob(jobId: string): SkillDraftRow | null {
    const row = this.db
      .prepare(`SELECT * FROM t_skill_draft WHERE job_id = ? AND deleted = 0`)
      .get(jobId) as SkillDraftRow | undefined;
    return row ?? null;
  }

  /** One live draft per job so chat cannot fork a second index candidate. */
  insertSkillDraft(input: SkillDraftWrite): SkillDraftRow {
    if (this.getSkillDraftByJob(input.job_id)) {
      throw new LedgerConflictError("skill draft already exists for job");
    }
    const ts = nowIso();
    const draft_id = input.draft_id ?? newId("sdr");
    try {
      this.db
        .prepare(
          `INSERT INTO t_skill_draft
            (draft_id, job_id, pack_id, payload_json, summary_json, selected_skill_id,
             created_at, updated_at, creator, updater, deleted)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        )
        .run(
          draft_id,
          input.job_id,
          input.pack_id,
          input.payload_json,
          input.summary_json,
          input.selected_skill_id ?? null,
          ts,
          ts,
          SYSTEM,
          SYSTEM,
        );
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new LedgerConflictError("skill draft already exists for job");
      }
      throw err;
    }
    return this.getSkillDraft(draft_id)!;
  }

  /** Chat may rewrite payload/summary/selection; it must not insert a second draft. */
  updateSkillDraft(draftId: string, input: SkillDraftUpdate): SkillDraftRow {
    const current = this.getSkillDraft(draftId);
    if (!current) {
      throw new Error(`skill draft not found: ${draftId}`);
    }
    const ts = nowIso();
    this.db
      .prepare(
        `UPDATE t_skill_draft
           SET payload_json = ?, summary_json = ?, selected_skill_id = ?, updated_at = ?, updater = ?
         WHERE draft_id = ? AND deleted = 0`,
      )
      .run(
        input.payload_json ?? current.payload_json,
        input.summary_json ?? current.summary_json,
        input.selected_skill_id === undefined ? current.selected_skill_id : input.selected_skill_id,
        ts,
        SYSTEM,
        draftId,
      );
    return this.getSkillDraft(draftId)!;
  }

  getSkillLedger(ledgerId: string): SkillLedgerRow | null {
    const row = this.db
      .prepare(`SELECT * FROM t_skill_ledger WHERE ledger_id = ? AND deleted = 0`)
      .get(ledgerId) as SkillLedgerRow | undefined;
    return row ?? null;
  }

  listSkillLedgersByJob(jobId: string): SkillLedgerRow[] {
    return this.db
      .prepare(`SELECT * FROM t_skill_ledger WHERE job_id = ? AND deleted = 0 ORDER BY id ASC`)
      .all(jobId) as SkillLedgerRow[];
  }

  /** Record internal processing outcome; Skill path must not write t_document_artifact. */
  insertSkillLedger(input: SkillLedgerWrite): SkillLedgerRow {
    const ts = nowIso();
    const ledger_id = input.ledger_id ?? newId("sld");
    this.db
      .prepare(
        `INSERT INTO t_skill_ledger
          (ledger_id, job_id, skill_id, original_blob_uri, original_mime, patched_blob_uri, patched_mime,
           verdict, reason, fix_list_json, unprocessed_tables_json,
           created_at, updated_at, creator, updater, deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      )
      .run(
        ledger_id,
        input.job_id,
        input.skill_id ?? null,
        input.original_blob_uri,
        input.original_mime,
        input.patched_blob_uri ?? null,
        input.patched_mime ?? null,
        input.verdict,
        input.reason,
        input.fix_list_json,
        input.unprocessed_tables_json,
        ts,
        ts,
        SYSTEM,
        SYSTEM,
      );
    return this.getSkillLedger(ledger_id)!;
  }
}
