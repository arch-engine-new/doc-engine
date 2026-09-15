/**
 * WHY: live ledger is Postgres per schema contract; tests keep SqliteLedger.
 *
 * Semantic clone of CoreEngineStore. TIMESTAMP and JSONB map back to generated row strings.
 */

import pg from "pg";
import type { QueryResult, QueryResultRow } from "pg";
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
  LayoutEdgeRow,
  LayoutUnitRow,
  ProjectRow,
  ProposalRow,
  ReceiptRow,
  RuleFixtureRow,
  RuleRow,
  RuleVersionRow,
  SignatureTaskRow,
  SpecPackRow,
  StandardDocRow,
  StandardEdgeRow,
  StandardVersionRow,
  TemplateRow,
  VolumePreviewRow,
} from "../types.js";
import { LedgerConflictError } from "../pipeline/job-pipeline.js";
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
  seedConcreteInspectionBatchExcelDemo,
} from "../pipeline/seed.js";
import type { LedgerStore } from "./ledger.js";
import { LEDGER_TABLES } from "./migrate.js";
import type {
  CompletenessRuleWrite,
  ExcelCellMappingWrite,
  FieldBoxWrite,
  FieldFillRuleWrite,
  IngestPageUpdate,
  IngestRunWrite,
  LayoutEdgeWrite,
  LayoutUnitWrite,
} from "./store.js";

const SYSTEM = "system";

type PgClient = pg.Pool | pg.Client;

function asIso(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    return value;
  }
  throw new Error(`expected timestamp string or Date, got ${typeof value}`);
}

function asJsonString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

function asJsonStringOrNull(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  return asJsonString(value);
}

function asNumber(value: unknown): number {
  return Number(value);
}

function asCoord(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  return String(value);
}

function asDecimalOrNull(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  return asCoord(value);
}

function mapAudit(row: QueryResultRow): {
  id: number;
  created_at: string;
  updated_at: string;
  creator: string;
  updater: string;
  deleted: number;
} {
  return {
    id: asNumber(row.id),
    created_at: asIso(row.created_at),
    updated_at: asIso(row.updated_at),
    creator: String(row.creator),
    updater: String(row.updater),
    deleted: asNumber(row.deleted),
  };
}

function mapProject(row: QueryResultRow): ProjectRow {
  return {
    ...mapAudit(row),
    project_id: String(row.project_id),
    name: String(row.name),
  };
}

function mapSpecPack(row: QueryResultRow): SpecPackRow {
  return {
    ...mapAudit(row),
    pack_id: String(row.pack_id),
    project_id: String(row.project_id),
    name: String(row.name),
    version: String(row.version),
    group_keys_json: asJsonStringOrNull(row.group_keys_json),
    order_key: row.order_key == null ? null : String(row.order_key),
    effective_standard_version_id:
      row.effective_standard_version_id == null
        ? null
        : String(row.effective_standard_version_id),
  };
}

function mapDocType(row: QueryResultRow): DocTypeRow {
  return {
    ...mapAudit(row),
    doc_type_id: String(row.doc_type_id),
    pack_id: String(row.pack_id),
    parent_doc_type_id:
      row.parent_doc_type_id == null ? null : String(row.parent_doc_type_id),
    name: String(row.name),
  };
}

function mapFieldDef(row: QueryResultRow): FieldDefRow {
  return {
    ...mapAudit(row),
    doc_type_id: String(row.doc_type_id),
    field_key: String(row.field_key),
    value_type: String(row.value_type),
    required: asNumber(row.required),
  };
}

function mapTemplate(row: QueryResultRow): TemplateRow {
  return {
    ...mapAudit(row),
    template_id: String(row.template_id),
    pack_id: String(row.pack_id),
    doc_type_id: row.doc_type_id == null ? "" : String(row.doc_type_id),
    name: String(row.name),
    page_image_uri: row.page_image_uri == null ? null : String(row.page_image_uri),
    layout_kind: row.layout_kind == null ? "raster" : String(row.layout_kind),
    excel_template_uri: row.excel_template_uri == null ? null : String(row.excel_template_uri),
    excel_sheet_name: row.excel_sheet_name == null ? null : String(row.excel_sheet_name),
  };
}

function mapExcelCellMapping(row: QueryResultRow): ExcelCellMappingRow {
  return {
    ...mapAudit(row),
    mapping_id: String(row.mapping_id),
    template_id: String(row.template_id),
    sheet_name: String(row.sheet_name),
    cell: String(row.cell),
    field_key: String(row.field_key),
    value_type: String(row.value_type),
    signature_role: row.signature_role == null ? null : String(row.signature_role),
  };
}

function mapFieldFillRule(row: QueryResultRow): FieldFillRuleRow {
  return {
    ...mapAudit(row),
    doc_type_id: String(row.doc_type_id),
    field_key: String(row.field_key),
    required: asNumber(row.required),
    pattern: row.pattern == null ? null : String(row.pattern),
    min_num: asDecimalOrNull(row.min_num),
    max_num: asDecimalOrNull(row.max_num),
    default_generator: row.default_generator == null ? null : String(row.default_generator),
    default_literal: row.default_literal == null ? null : String(row.default_literal),
  };
}

function mapDocumentArtifact(row: QueryResultRow): DocumentArtifactRow {
  return {
    ...mapAudit(row),
    artifact_id: String(row.artifact_id),
    project_id: String(row.project_id),
    doc_type_id: String(row.doc_type_id),
    template_id: String(row.template_id),
    file_uri: String(row.file_uri),
    adapter_document_id: row.adapter_document_id == null ? null : String(row.adapter_document_id),
    status: String(row.status),
    trace_id: String(row.trace_id),
    receipt_id: row.receipt_id == null ? null : String(row.receipt_id),
    metadata_json: asJsonStringOrNull(row.metadata_json),
  };
}

function mapSignatureTask(row: QueryResultRow): SignatureTaskRow {
  return {
    ...mapAudit(row),
    task_id: String(row.task_id),
    artifact_id: String(row.artifact_id),
    role: String(row.role),
    assignee_label: row.assignee_label == null ? null : String(row.assignee_label),
    status: String(row.status),
    signer_name: row.signer_name == null ? null : String(row.signer_name),
    trace_id: String(row.trace_id),
    receipt_id: row.receipt_id == null ? null : String(row.receipt_id),
  };
}

function mapCompletenessRule(row: QueryResultRow): CompletenessRuleRow {
  return {
    ...mapAudit(row),
    rule_id: String(row.rule_id),
    pack_id: String(row.pack_id),
    doc_type_id: String(row.doc_type_id),
    label: String(row.label),
    required: asNumber(row.required),
  };
}

function mapFieldBox(row: QueryResultRow): FieldBoxRow {
  return {
    ...mapAudit(row),
    template_id: String(row.template_id),
    field_key: String(row.field_key),
    value_type: String(row.value_type),
    page: asNumber(row.page),
    x: asCoord(row.x),
    y: asCoord(row.y),
    w: asCoord(row.w),
    h: asCoord(row.h),
  };
}

function mapRule(row: QueryResultRow): RuleRow {
  return {
    ...mapAudit(row),
    rule_id: String(row.rule_id),
    pack_id: String(row.pack_id),
    title: row.title == null ? null : String(row.title),
  };
}

function mapRuleVersion(row: QueryResultRow): RuleVersionRow {
  return {
    ...mapAudit(row),
    version_id: String(row.version_id),
    rule_id: String(row.rule_id),
    dsl_json: asJsonString(row.dsl_json),
    status: String(row.status),
    blocking: asNumber(row.blocking),
  };
}

function mapRuleFixture(row: QueryResultRow): RuleFixtureRow {
  return {
    ...mapAudit(row),
    version_id: String(row.version_id),
    kind: String(row.kind),
    payload_json: asJsonString(row.payload_json),
    last_result: row.last_result == null ? null : String(row.last_result),
  };
}

function mapJob(row: QueryResultRow): JobRow {
  return {
    ...mapAudit(row),
    job_id: String(row.job_id),
    project_id: String(row.project_id),
    pack_id: row.pack_id == null ? null : String(row.pack_id),
    trace_id: String(row.trace_id),
    status: String(row.status),
    template_id: row.template_id == null ? null : String(row.template_id),
    doc_type_id: row.doc_type_id == null ? null : String(row.doc_type_id),
    agent_run_id: row.agent_run_id == null ? null : String(row.agent_run_id),
  };
}

function mapDocument(row: QueryResultRow): DocumentRow {
  return {
    ...mapAudit(row),
    doc_id: String(row.doc_id),
    job_id: String(row.job_id),
    file_name: String(row.file_name),
    file_uri: String(row.file_uri),
    mime: row.mime == null ? null : String(row.mime),
  };
}

function mapExtraction(row: QueryResultRow): ExtractionRow {
  return {
    ...mapAudit(row),
    extraction_id: String(row.extraction_id),
    job_id: String(row.job_id),
    ocr_text: row.ocr_text == null ? null : String(row.ocr_text),
    fields_json: asJsonString(row.fields_json),
  };
}

function mapFinding(row: QueryResultRow): FindingRow {
  return {
    ...mapAudit(row),
    finding_id: String(row.finding_id),
    job_id: String(row.job_id),
    rule_version_id: String(row.rule_version_id),
    result: String(row.result),
    blocking: asNumber(row.blocking),
    detail: row.detail == null ? null : String(row.detail),
    clause_id: row.clause_id == null ? null : String(row.clause_id),
    standard_version_id:
      row.standard_version_id == null ? null : String(row.standard_version_id),
    retrieve_path: row.retrieve_path == null ? null : String(row.retrieve_path),
  };
}

function mapProposal(row: QueryResultRow): ProposalRow {
  return {
    ...mapAudit(row),
    proposal_id: String(row.proposal_id),
    job_id: String(row.job_id),
    status: String(row.status),
    wording: String(row.wording),
    agent_run_id: row.agent_run_id == null ? null : String(row.agent_run_id),
  };
}

function mapReceipt(row: QueryResultRow): ReceiptRow {
  return {
    ...mapAudit(row),
    receipt_id: String(row.receipt_id),
    proposal_id: row.proposal_id == null ? null : String(row.proposal_id),
    job_id: String(row.job_id),
    status: String(row.status),
    payload_json: asJsonStringOrNull(row.payload_json),
  };
}

function mapVolumePreview(row: QueryResultRow): VolumePreviewRow {
  return {
    ...mapAudit(row),
    preview_id: String(row.preview_id),
    job_id: String(row.job_id),
    tree_json: asJsonString(row.tree_json),
  };
}

function mapAuditEvent(row: QueryResultRow): AuditEventRow {
  return {
    ...mapAudit(row),
    trace_id: String(row.trace_id),
    seq: asNumber(row.seq),
    event_type: String(row.event_type),
    ref_id: row.ref_id == null ? null : String(row.ref_id),
    payload_json: asJsonString(row.payload_json),
  };
}

function mapConversationThread(row: QueryResultRow): ConversationThreadRow {
  return {
    ...mapAudit(row),
    thread_id: String(row.thread_id),
    trace_id: String(row.trace_id),
    step: String(row.step),
    job_id: row.job_id == null ? null : String(row.job_id),
    hitl_token: row.hitl_token == null ? null : String(row.hitl_token),
  };
}

function mapConversationMessage(row: QueryResultRow): ConversationMessageRow {
  return {
    ...mapAudit(row),
    thread_id: String(row.thread_id),
    role: String(row.role),
    body: String(row.body),
  };
}

function mapStandardDoc(row: QueryResultRow): StandardDocRow {
  return {
    ...mapAudit(row),
    doc_id: String(row.doc_id),
    pack_id: String(row.pack_id),
    title: String(row.title),
    file_uri: String(row.file_uri),
  };
}

function mapStandardVersion(row: QueryResultRow): StandardVersionRow {
  return {
    ...mapAudit(row),
    version_id: String(row.version_id),
    doc_id: String(row.doc_id),
    status: String(row.status),
  };
}

function mapClause(row: QueryResultRow): ClauseRow {
  return {
    ...mapAudit(row),
    clause_id: String(row.clause_id),
    version_id: String(row.version_id),
    parent_clause_id: row.parent_clause_id == null ? null : String(row.parent_clause_id),
    heading: row.heading == null ? null : String(row.heading),
    body: String(row.body),
    span_json: asJsonStringOrNull(row.span_json),
    qdrant_point_id: row.qdrant_point_id == null ? null : String(row.qdrant_point_id),
    file_name: row.file_name == null ? null : String(row.file_name),
    page_start: row.page_start == null ? null : asNumber(row.page_start),
    page_end: row.page_end == null ? null : asNumber(row.page_end),
  };
}

function mapStandardEdge(row: QueryResultRow): StandardEdgeRow {
  return {
    ...mapAudit(row),
    from_clause_id: String(row.from_clause_id),
    to_clause_id: String(row.to_clause_id),
    kind: String(row.kind),
  };
}

function mapLayoutUnit(row: QueryResultRow): LayoutUnitRow {
  return {
    ...mapAudit(row),
    unit_id: String(row.unit_id),
    version_id: String(row.version_id),
    chunk_kind: String(row.chunk_kind),
    clause_id: row.clause_id == null ? null : String(row.clause_id),
    file_name: String(row.file_name),
    page_start: asNumber(row.page_start),
    page_end: asNumber(row.page_end),
    heading: row.heading == null ? null : String(row.heading),
    body_markdown: String(row.body_markdown),
    qdrant_point_id: String(row.qdrant_point_id),
    ingest_run_id: row.ingest_run_id == null ? null : String(row.ingest_run_id),
  };
}

function mapLayoutEdge(row: QueryResultRow): LayoutEdgeRow {
  return {
    ...mapAudit(row),
    from_unit_id: String(row.from_unit_id),
    to_unit_id: String(row.to_unit_id),
    kind: String(row.kind),
    link_method: String(row.link_method),
    confidence: row.confidence == null ? null : asNumber(row.confidence),
  };
}

function mapIngestRun(row: QueryResultRow): IngestRunRow {
  return {
    ...mapAudit(row),
    ingest_run_id: String(row.ingest_run_id),
    doc_id: String(row.doc_id),
    pack_id: String(row.pack_id),
    status: String(row.status),
    file_name: String(row.file_name),
  };
}

function mapIngestPage(row: QueryResultRow): IngestPageRow {
  return {
    ...mapAudit(row),
    ingest_run_id: String(row.ingest_run_id),
    doc_id: String(row.doc_id),
    page_no: asNumber(row.page_no),
    status: String(row.status),
    error: row.error == null ? null : String(row.error),
  };
}

async function insertPendingIngestPages(
  q: (text: string, values?: unknown[]) => Promise<QueryResult>,
  input: { ingest_run_id: string; doc_id: string; page_count: number; ts: string },
): Promise<void> {
  for (let pageNo = 1; pageNo <= input.page_count; pageNo += 1) {
    await q(
      `INSERT INTO t_ingest_page
        (ingest_run_id, doc_id, page_no, status, error, created_at, updated_at, creator, updater, deleted)
       VALUES ($1, $2, $3, 'pending', NULL, $4, $5, $6, $7, 0)`,
      [input.ingest_run_id, input.doc_id, pageNo, input.ts, input.ts, SYSTEM, SYSTEM],
    );
  }
}

export class PostgresLedger implements LedgerStore {
  private readonly db: PgClient;

  constructor(clientOrUrl: PgClient | string) {
    this.db =
      typeof clientOrUrl === "string"
        ? new pg.Pool({ connectionString: clientOrUrl })
        : clientOrUrl;
  }

  private async q(text: string, values: unknown[] = []): Promise<QueryResult> {
    return this.db.query(text, values);
  }

  async close(): Promise<void> {
    await this.db.end();
  }

  async wipeLedger(): Promise<void> {
    await this.q(`TRUNCATE TABLE ${LEDGER_TABLES.join(", ")} RESTART IDENTITY CASCADE`);
  }

  async seedPublishedRules(): Promise<void> {
    await this.ensureEmptySpecPack();
    const existing = await this.getDocType(DOC_TYPE_PARENT_ID);
    if (!existing) {
      await this.insertDocType({
        pack_id: PACK_ID,
        doc_type_id: DOC_TYPE_PARENT_ID,
        name: "夹具父类型",
        parent_doc_type_id: null,
      });
      await this.saveFieldDefs(DOC_TYPE_PARENT_ID, [
        { field_key: "编号", value_type: "string", required: 0 },
        { field_key: "日期A", value_type: "date", required: 0 },
      ]);
      await this.insertDocType({
        pack_id: PACK_ID,
        doc_type_id: DOC_TYPE_CHILD_ID,
        name: "夹具子类型",
        parent_doc_type_id: DOC_TYPE_PARENT_ID,
      });
      await this.saveFieldDefs(DOC_TYPE_CHILD_ID, [
        { field_key: "特殊批号", value_type: "string", required: 0 },
      ]);
    }
    const ts = nowIso();
    await this.q(
      `INSERT INTO t_rule
        (rule_id, pack_id, title, created_at, updated_at, creator, updater, deleted)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0)
       ON CONFLICT DO NOTHING`,
      [RULE_R1_ID, PACK_ID, "required(编号)", ts, ts, SYSTEM, SYSTEM],
    );
    await this.q(
      `INSERT INTO t_rule
        (rule_id, pack_id, title, created_at, updated_at, creator, updater, deleted)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0)
       ON CONFLICT DO NOTHING`,
      [RULE_R2_ID, PACK_ID, "compare(日期A, ≤, 日期B)", ts, ts, SYSTEM, SYSTEM],
    );
    await this.q(
      `INSERT INTO t_rule_version
        (version_id, rule_id, dsl_json, status, blocking, created_at, updated_at, creator, updater, deleted)
       VALUES ($1, $2, $3, 'published', 1, $4, $5, $6, $7, 0)
       ON CONFLICT DO NOTHING`,
      [RULE_R1_VERSION_ID, RULE_R1_ID, JSON.stringify(R1_DSL), ts, ts, SYSTEM, SYSTEM],
    );
    await this.q(
      `INSERT INTO t_rule_version
        (version_id, rule_id, dsl_json, status, blocking, created_at, updated_at, creator, updater, deleted)
       VALUES ($1, $2, $3, 'published', 1, $4, $5, $6, $7, 0)
       ON CONFLICT DO NOTHING`,
      [RULE_R2_VERSION_ID, RULE_R2_ID, JSON.stringify(R2_DSL), ts, ts, SYSTEM, SYSTEM],
    );
    await seedConcreteInspectionBatchExcelDemo(this, { packId: PACK_ID });
  }

  /** Empty spec-pack shell named 「空规范包」 — never an industry preset. */
  private async ensureEmptySpecPack(): Promise<void> {
    const ts = nowIso();
    await this.q(
      `INSERT INTO t_spec_pack
        (pack_id, project_id, name, version, group_keys_json, order_key, effective_standard_version_id,
         created_at, updated_at, creator, updater, deleted)
       VALUES ($1, $2, $3, $4, NULL, NULL, NULL, $5, $6, $7, $8, 0)
       ON CONFLICT DO NOTHING`,
      [PACK_ID, SEED_PACK_PROJECT_ID, EMPTY_PACK_NAME, EMPTY_PACK_VERSION, ts, ts, SYSTEM, SYSTEM],
    );
  }

  async insertSpecPack(input: {
    project_id: string;
    name: string;
    version: string;
    pack_id?: string;
  }): Promise<SpecPackRow> {
    const ts = nowIso();
    const pack_id = input.pack_id ?? newId("pack");
    const result = await this.q(
      `INSERT INTO t_spec_pack
        (pack_id, project_id, name, version, group_keys_json, order_key, effective_standard_version_id,
         created_at, updated_at, creator, updater, deleted)
       VALUES ($1, $2, $3, $4, NULL, NULL, NULL, $5, $6, $7, $8, 0)
       RETURNING *`,
      [pack_id, input.project_id, input.name, input.version, ts, ts, SYSTEM, SYSTEM],
    );
    return mapSpecPack(result.rows[0]);
  }

  async listSpecPacks(projectId: string): Promise<SpecPackRow[]> {
    const result = await this.q(
      `SELECT * FROM t_spec_pack WHERE project_id = $1 AND deleted = 0 ORDER BY id ASC`,
      [projectId],
    );
    return result.rows.map(mapSpecPack);
  }

  async getSpecPack(packId: string): Promise<SpecPackRow | null> {
    const result = await this.q(
      `SELECT * FROM t_spec_pack WHERE pack_id = $1 AND deleted = 0`,
      [packId],
    );
    const row = result.rows[0];
    return row ? mapSpecPack(row) : null;
  }

  async updateSpecPackGrouping(
    packId: string,
    groupKeys: string[],
    orderKey: string | null,
  ): Promise<SpecPackRow> {
    const pack = await this.getSpecPack(packId);
    if (!pack) {
      throw new Error(`spec pack not found: ${packId}`);
    }
    const ts = nowIso();
    await this.q(
      `UPDATE t_spec_pack
       SET group_keys_json = $1, order_key = $2, updated_at = $3, updater = $4
       WHERE pack_id = $5 AND deleted = 0`,
      [JSON.stringify(groupKeys), orderKey, ts, SYSTEM, packId],
    );
    return (await this.getSpecPack(packId))!;
  }

  async bindEffectiveVersion(packId: string, versionId: string): Promise<SpecPackRow> {
    const pack = await this.getSpecPack(packId);
    if (!pack) {
      throw new Error(`spec pack not found: ${packId}`);
    }
    const version = await this.getStandardVersion(versionId);
    if (!version) {
      throw new Error(`standard version not found: ${versionId}`);
    }
    if (version.status !== "effective") {
      throw new Error(`standard version ${versionId} is ${version.status}, not effective`);
    }
    const doc = await this.getStandardDoc(version.doc_id);
    if (!doc || doc.pack_id !== packId) {
      throw new Error(`standard version ${versionId} does not belong to pack ${packId}`);
    }
    const ts = nowIso();
    await this.q(
      `UPDATE t_spec_pack
       SET effective_standard_version_id = $1, updated_at = $2, updater = $3
       WHERE pack_id = $4 AND deleted = 0`,
      [versionId, ts, SYSTEM, packId],
    );
    return (await this.getSpecPack(packId))!;
  }

  async insertStandardDoc(input: {
    pack_id: string;
    title: string;
    file_uri: string;
    doc_id?: string;
  }): Promise<StandardDocRow> {
    const ts = nowIso();
    const doc_id = input.doc_id ?? newId("sdoc");
    const result = await this.q(
      `INSERT INTO t_standard_doc
        (doc_id, pack_id, title, file_uri, created_at, updated_at, creator, updater, deleted)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0)
       RETURNING *`,
      [doc_id, input.pack_id, input.title, input.file_uri, ts, ts, SYSTEM, SYSTEM],
    );
    return mapStandardDoc(result.rows[0]);
  }

  async getStandardDoc(docId: string): Promise<StandardDocRow | null> {
    const result = await this.q(
      `SELECT * FROM t_standard_doc WHERE doc_id = $1 AND deleted = 0`,
      [docId],
    );
    const row = result.rows[0];
    return row ? mapStandardDoc(row) : null;
  }

  async listStandardDocs(packId: string): Promise<StandardDocRow[]> {
    const result = await this.q(
      `SELECT * FROM t_standard_doc WHERE pack_id = $1 AND deleted = 0 ORDER BY id ASC`,
      [packId],
    );
    return result.rows.map(mapStandardDoc);
  }

  async insertStandardVersion(input: {
    doc_id: string;
    status: string;
    version_id?: string;
  }): Promise<StandardVersionRow> {
    const ts = nowIso();
    const version_id = input.version_id ?? newId("sver");
    const result = await this.q(
      `INSERT INTO t_standard_version
        (version_id, doc_id, status, created_at, updated_at, creator, updater, deleted)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0)
       RETURNING *`,
      [version_id, input.doc_id, input.status, ts, ts, SYSTEM, SYSTEM],
    );
    return mapStandardVersion(result.rows[0]);
  }

  async getStandardVersion(versionId: string): Promise<StandardVersionRow | null> {
    const result = await this.q(
      `SELECT * FROM t_standard_version WHERE version_id = $1 AND deleted = 0`,
      [versionId],
    );
    const row = result.rows[0];
    return row ? mapStandardVersion(row) : null;
  }

  async listStandardVersions(docId: string): Promise<StandardVersionRow[]> {
    const result = await this.q(
      `SELECT * FROM t_standard_version WHERE doc_id = $1 AND deleted = 0 ORDER BY id ASC`,
      [docId],
    );
    return result.rows.map(mapStandardVersion);
  }

  async listEffectiveStandardVersions(packId: string): Promise<StandardVersionRow[]> {
    const result = await this.q(
      `SELECT v.* FROM t_standard_version v
       INNER JOIN t_standard_doc d ON d.doc_id = v.doc_id
       WHERE d.pack_id = $1 AND v.status = 'effective' AND v.deleted = 0 AND d.deleted = 0
       ORDER BY v.id ASC`,
      [packId],
    );
    return result.rows.map(mapStandardVersion);
  }

  async updateStandardVersionStatus(
    versionId: string,
    status: string,
  ): Promise<StandardVersionRow> {
    const version = await this.getStandardVersion(versionId);
    if (!version) {
      throw new Error(`standard version not found: ${versionId}`);
    }
    const ts = nowIso();
    await this.q(
      `UPDATE t_standard_version SET status = $1, updated_at = $2, updater = $3
       WHERE version_id = $4 AND deleted = 0`,
      [status, ts, SYSTEM, versionId],
    );
    return (await this.getStandardVersion(versionId))!;
  }

  async insertClause(input: {
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
  }): Promise<ClauseRow> {
    const ts = nowIso();
    const qdrant_point_id = input.qdrant_point_id ?? input.clause_id;
    const result = await this.q(
      `INSERT INTO t_clause
        (clause_id, version_id, parent_clause_id, heading, body, span_json, qdrant_point_id,
         file_name, page_start, page_end, created_at, updated_at, creator, updater, deleted)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 0)
       ON CONFLICT (clause_id) DO UPDATE SET
         version_id = EXCLUDED.version_id,
         parent_clause_id = EXCLUDED.parent_clause_id,
         heading = EXCLUDED.heading,
         body = EXCLUDED.body,
         span_json = EXCLUDED.span_json,
         qdrant_point_id = EXCLUDED.qdrant_point_id,
         file_name = EXCLUDED.file_name,
         page_start = EXCLUDED.page_start,
         page_end = EXCLUDED.page_end,
         updated_at = EXCLUDED.updated_at,
         updater = EXCLUDED.updater,
         deleted = 0
       RETURNING *`,
      [
        input.clause_id,
        input.version_id,
        input.parent_clause_id ?? null,
        input.heading ?? null,
        input.body,
        input.span_json ?? null,
        qdrant_point_id,
        input.file_name ?? null,
        input.page_start ?? null,
        input.page_end ?? null,
        ts,
        ts,
        SYSTEM,
        SYSTEM,
      ],
    );
    return mapClause(result.rows[0]);
  }

  async getClause(clauseId: string): Promise<ClauseRow | null> {
    const result = await this.q(
      `SELECT * FROM t_clause WHERE clause_id = $1 AND deleted = 0`,
      [clauseId],
    );
    const row = result.rows[0];
    return row ? mapClause(row) : null;
  }

  async listClauses(versionId: string): Promise<ClauseRow[]> {
    const result = await this.q(
      `SELECT * FROM t_clause WHERE version_id = $1 AND deleted = 0 ORDER BY id ASC`,
      [versionId],
    );
    return result.rows.map(mapClause);
  }

  async insertStandardEdge(input: {
    from_clause_id: string;
    to_clause_id: string;
    kind: string;
  }): Promise<StandardEdgeRow> {
    const ts = nowIso();
    const result = await this.q(
      `INSERT INTO t_standard_edge
        (from_clause_id, to_clause_id, kind, created_at, updated_at, creator, updater, deleted)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0)
       RETURNING *`,
      [input.from_clause_id, input.to_clause_id, input.kind, ts, ts, SYSTEM, SYSTEM],
    );
    return mapStandardEdge(result.rows[0]);
  }

  async listStandardEdges(fromClauseId?: string): Promise<StandardEdgeRow[]> {
    if (fromClauseId) {
      const result = await this.q(
        `SELECT * FROM t_standard_edge WHERE from_clause_id = $1 AND deleted = 0 ORDER BY id ASC`,
        [fromClauseId],
      );
      return result.rows.map(mapStandardEdge);
    }
    const result = await this.q(
      `SELECT * FROM t_standard_edge WHERE deleted = 0 ORDER BY id ASC`,
    );
    return result.rows.map(mapStandardEdge);
  }

  /**
   * Layout units are the ingest/search grain. Table/annex chunks stay here with
   * null clause_id so t_clause never receives a fabricated id.
   */
  async insertLayoutUnit(input: LayoutUnitWrite): Promise<LayoutUnitRow> {
    const ts = nowIso();
    const unit_id = input.unit_id ?? newId("lu");
    const qdrant_point_id = input.qdrant_point_id ?? unit_id;
    const result = await this.q(
      `INSERT INTO t_layout_unit
        (unit_id, version_id, chunk_kind, clause_id, file_name, page_start, page_end,
         heading, body_markdown, qdrant_point_id, ingest_run_id,
         created_at, updated_at, creator, updater, deleted)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 0)
       RETURNING *`,
      [
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
      ],
    );
    return mapLayoutUnit(result.rows[0]);
  }

  async getLayoutUnit(unitId: string): Promise<LayoutUnitRow | null> {
    const result = await this.q(
      `SELECT * FROM t_layout_unit WHERE unit_id = $1 AND deleted = 0`,
      [unitId],
    );
    return result.rows[0] ? mapLayoutUnit(result.rows[0]) : null;
  }

  async listLayoutUnits(versionId: string): Promise<LayoutUnitRow[]> {
    const result = await this.q(
      `SELECT * FROM t_layout_unit WHERE version_id = $1 AND deleted = 0 ORDER BY id ASC`,
      [versionId],
    );
    return result.rows.map(mapLayoutUnit);
  }

  /**
   * Auto PARENT_OF/BELONGS_TO/SUPPORTS live here so t_standard_edge stays
   * human-edited CITES/SUPERSEDES.
   */
  async insertLayoutEdge(input: LayoutEdgeWrite): Promise<LayoutEdgeRow> {
    const ts = nowIso();
    const result = await this.q(
      `INSERT INTO t_layout_edge
        (from_unit_id, to_unit_id, kind, link_method, confidence,
         created_at, updated_at, creator, updater, deleted)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0)
       RETURNING *`,
      [
        input.from_unit_id,
        input.to_unit_id,
        input.kind,
        input.link_method,
        input.confidence ?? 1.0,
        ts,
        ts,
        SYSTEM,
        SYSTEM,
      ],
    );
    return mapLayoutEdge(result.rows[0]);
  }

  /**
   * Inserts the run and N pending pages together. Later ticks can set
   * index_error (vector upsert failed) without confusing it with ocr_error.
   */
  async insertIngestRun(input: IngestRunWrite): Promise<IngestRunRow> {
    const ts = nowIso();
    const ingest_run_id = input.ingest_run_id ?? newId("ing");
    const result = await this.q(
      `INSERT INTO t_ingest_run
        (ingest_run_id, doc_id, pack_id, status, file_name,
         created_at, updated_at, creator, updater, deleted)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0)
       RETURNING *`,
      [
        ingest_run_id,
        input.doc_id,
        input.pack_id,
        input.status ?? "pending",
        input.file_name,
        ts,
        ts,
        SYSTEM,
        SYSTEM,
      ],
    );
    await insertPendingIngestPages((text, values) => this.q(text, values), {
      ingest_run_id,
      doc_id: input.doc_id,
      page_count: input.page_count,
      ts,
    });
    return mapIngestRun(result.rows[0]);
  }

  async listIngestPages(ingestRunId: string): Promise<IngestPageRow[]> {
    const result = await this.q(
      `SELECT * FROM t_ingest_page WHERE ingest_run_id = $1 AND deleted = 0 ORDER BY page_no ASC`,
      [ingestRunId],
    );
    return result.rows.map(mapIngestPage);
  }

  /**
   * index_error means Qdrant upsert failed after OCR succeeded; ocr_error is a
   * different recovery path and must not be reused for indexing failures (R28).
   */
  async updateIngestPage(input: IngestPageUpdate): Promise<IngestPageRow> {
    const ts = nowIso();
    const result = await this.q(
      `UPDATE t_ingest_page
       SET status = $1, error = $2, updated_at = $3, updater = $4
       WHERE ingest_run_id = $5 AND page_no = $6 AND deleted = 0
       RETURNING *`,
      [
        input.status,
        input.error ?? null,
        ts,
        SYSTEM,
        input.ingest_run_id,
        input.page_no,
      ],
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error(
        `ingest page not found: ${input.ingest_run_id} page ${input.page_no}`,
      );
    }
    return mapIngestPage(row);
  }

  async getDocType(docTypeId: string): Promise<DocTypeRow | null> {
    const result = await this.q(
      `SELECT * FROM t_doc_type WHERE doc_type_id = $1 AND deleted = 0`,
      [docTypeId],
    );
    return result.rows[0] ? mapDocType(result.rows[0]) : null;
  }

  async listDocTypesByPack(packId: string): Promise<DocTypeRow[]> {
    const result = await this.q(
      `SELECT * FROM t_doc_type WHERE pack_id = $1 AND deleted = 0 ORDER BY id ASC`,
      [packId],
    );
    return result.rows.map(mapDocType);
  }

  async insertDocType(input: {
    pack_id: string;
    name: string;
    parent_doc_type_id?: string | null;
    doc_type_id?: string;
  }): Promise<DocTypeRow> {
    const ts = nowIso();
    const doc_type_id = input.doc_type_id ?? newId("dt");
    if (input.parent_doc_type_id) {
      const parent = await this.getDocType(input.parent_doc_type_id);
      if (!parent || parent.pack_id !== input.pack_id) {
        throw new Error("parent doc type does not belong to pack");
      }
    }
    const result = await this.q(
      `INSERT INTO t_doc_type
        (doc_type_id, pack_id, parent_doc_type_id, name, created_at, updated_at, creator, updater, deleted)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0)
       RETURNING *`,
      [
        doc_type_id,
        input.pack_id,
        input.parent_doc_type_id ?? null,
        input.name,
        ts,
        ts,
        SYSTEM,
        SYSTEM,
      ],
    );
    return mapDocType(result.rows[0]);
  }

  async updateDocTypeName(docTypeId: string, name: string): Promise<DocTypeRow> {
    const ts = nowIso();
    await this.q(
      `UPDATE t_doc_type SET name = $1, updated_at = $2, updater = $3 WHERE doc_type_id = $4 AND deleted = 0`,
      [name, ts, SYSTEM, docTypeId],
    );
    const row = await this.getDocType(docTypeId);
    if (!row) throw new Error(`doc type not found: ${docTypeId}`);
    return row;
  }

  async countChildDocTypes(docTypeId: string): Promise<number> {
    const result = await this.q(
      `SELECT COUNT(*)::int AS c FROM t_doc_type WHERE parent_doc_type_id = $1 AND deleted = 0`,
      [docTypeId],
    );
    return Number(result.rows[0]?.c ?? 0);
  }

  async countTemplatesByDocType(docTypeId: string): Promise<number> {
    const result = await this.q(
      `SELECT COUNT(*)::int AS c FROM t_template WHERE doc_type_id = $1 AND deleted = 0`,
      [docTypeId],
    );
    return Number(result.rows[0]?.c ?? 0);
  }

  async countJobsByDocType(docTypeId: string): Promise<number> {
    const result = await this.q(
      `SELECT COUNT(*)::int AS c FROM t_job WHERE doc_type_id = $1 AND deleted = 0`,
      [docTypeId],
    );
    return Number(result.rows[0]?.c ?? 0);
  }

  async softDeleteDocType(docTypeId: string): Promise<DocTypeRow> {
    if ((await this.countChildDocTypes(docTypeId)) > 0) {
      throw new LedgerConflictError("doc type has child types");
    }
    if ((await this.countTemplatesByDocType(docTypeId)) > 0) {
      throw new LedgerConflictError("doc type has templates");
    }
    if ((await this.countJobsByDocType(docTypeId)) > 0) {
      throw new LedgerConflictError("doc type has jobs");
    }
    const ts = nowIso();
    await this.q(
      `UPDATE t_doc_type SET deleted = 1, updated_at = $1, updater = $2 WHERE doc_type_id = $3 AND deleted = 0`,
      [ts, SYSTEM, docTypeId],
    );
    const result = await this.q(`SELECT * FROM t_doc_type WHERE doc_type_id = $1`, [docTypeId]);
    if (!result.rows[0]) throw new Error(`doc type not found: ${docTypeId}`);
    return mapDocType(result.rows[0]);
  }

  async listFieldDefs(docTypeId: string): Promise<FieldDefRow[]> {
    const result = await this.q(
      `SELECT * FROM t_field_def WHERE doc_type_id = $1 AND deleted = 0 ORDER BY id ASC`,
      [docTypeId],
    );
    return result.rows.map(mapFieldDef);
  }

  async saveFieldDefs(
    docTypeId: string,
    defs: Array<{ field_key: string; value_type: string; required?: number }>,
  ): Promise<FieldDefRow[]> {
    const ts = nowIso();
    if (this.db instanceof pg.Pool) {
      const client = await this.db.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `UPDATE t_field_def SET deleted = 1, updated_at = $1, updater = $2 WHERE doc_type_id = $3`,
          [ts, SYSTEM, docTypeId],
        );
        for (const def of defs) {
          await client.query(
            `INSERT INTO t_field_def
              (doc_type_id, field_key, value_type, required, created_at, updated_at, creator, updater, deleted)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0)`,
            [
              docTypeId,
              def.field_key,
              def.value_type,
              def.required ?? 0,
              ts,
              ts,
              SYSTEM,
              SYSTEM,
            ],
          );
        }
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    } else {
      await this.q(
        `UPDATE t_field_def SET deleted = 1, updated_at = $1, updater = $2 WHERE doc_type_id = $3`,
        [ts, SYSTEM, docTypeId],
      );
      for (const def of defs) {
        await this.q(
          `INSERT INTO t_field_def
            (doc_type_id, field_key, value_type, required, created_at, updated_at, creator, updater, deleted)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0)`,
          [
            docTypeId,
            def.field_key,
            def.value_type,
            def.required ?? 0,
            ts,
            ts,
            SYSTEM,
            SYSTEM,
          ],
        );
      }
    }
    return this.listFieldDefs(docTypeId);
  }

  async listDocTypeAncestorChain(docTypeId: string): Promise<DocTypeRow[]> {
    const chain: DocTypeRow[] = [];
    let current: DocTypeRow | null = await this.getDocType(docTypeId);
    while (current) {
      chain.unshift(current);
      current = current.parent_doc_type_id
        ? await this.getDocType(current.parent_doc_type_id)
        : null;
    }
    return chain;
  }

  async listEffectiveFieldDefs(docTypeId: string): Promise<FieldDefRow[]> {
    const byKey = new Map<string, FieldDefRow>();
    for (const dt of await this.listDocTypeAncestorChain(docTypeId)) {
      for (const def of await this.listFieldDefs(dt.doc_type_id)) {
        byKey.set(def.field_key, def);
      }
    }
    return [...byKey.values()].sort((a, b) => a.field_key.localeCompare(b.field_key, "zh"));
  }

  async listTemplatesByDocType(docTypeId: string): Promise<TemplateRow[]> {
    const result = await this.q(
      `SELECT * FROM t_template WHERE doc_type_id = $1 AND deleted = 0 ORDER BY id ASC`,
      [docTypeId],
    );
    return result.rows.map(mapTemplate);
  }

  async insertTemplate(input: {
    pack_id: string;
    name: string;
    page_image_uri?: string | null;
    doc_type_id?: string;
    layout_kind?: string;
    excel_template_uri?: string | null;
    excel_sheet_name?: string | null;
  }): Promise<TemplateRow> {
    const ts = nowIso();
    const template_id = newId("tpl");
    const doc_type_id = input.doc_type_id ?? "";
    if (doc_type_id) {
      const dt = await this.getDocType(doc_type_id);
      if (!dt || dt.pack_id !== input.pack_id) {
        throw new Error("doc type does not belong to pack");
      }
    }
    const result = await this.q(
      `INSERT INTO t_template
        (template_id, pack_id, doc_type_id, name, page_image_uri, layout_kind, excel_template_uri, excel_sheet_name, created_at, updated_at, creator, updater, deleted)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0)
       RETURNING *`,
      [
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
      ],
    );
    return mapTemplate(result.rows[0]);
  }

  async updateTemplateExcel(
    templateId: string,
    input: {
      layout_kind?: string;
      excel_template_uri?: string | null;
      excel_sheet_name?: string | null;
    },
  ): Promise<TemplateRow> {
    const ts = nowIso();
    const current = await this.getTemplate(templateId);
    if (!current) {
      throw new Error("template not found");
    }
    const result = await this.q(
      `UPDATE t_template
       SET layout_kind = $1, excel_template_uri = $2, excel_sheet_name = $3, updated_at = $4, updater = $5
       WHERE template_id = $6 AND deleted = 0
       RETURNING *`,
      [
        input.layout_kind ?? current.layout_kind ?? "raster",
        input.excel_template_uri !== undefined ? input.excel_template_uri : current.excel_template_uri,
        input.excel_sheet_name !== undefined ? input.excel_sheet_name : current.excel_sheet_name,
        ts,
        SYSTEM,
        templateId,
      ],
    );
    return mapTemplate(result.rows[0]);
  }

  async saveFieldBoxes(templateId: string, boxes: FieldBoxWrite[]): Promise<FieldBoxRow[]> {
    const ts = nowIso();
    const upsert = `INSERT INTO t_field_box
        (template_id, field_key, value_type, page, x, y, w, h, created_at, updated_at, creator, updater, deleted)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0)
       ON CONFLICT (template_id, field_key) DO UPDATE SET
         value_type = EXCLUDED.value_type,
         page = EXCLUDED.page,
         x = EXCLUDED.x,
         y = EXCLUDED.y,
         w = EXCLUDED.w,
         h = EXCLUDED.h,
         updated_at = EXCLUDED.updated_at,
         updater = EXCLUDED.updater,
         deleted = 0`;
    if (this.db instanceof pg.Pool) {
      const client = await this.db.connect();
      try {
        await client.query("BEGIN");
        for (const box of boxes) {
          await client.query(upsert, [
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
          ]);
        }
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    } else {
      try {
        await this.db.query("BEGIN");
        for (const box of boxes) {
          await this.db.query(upsert, [
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
          ]);
        }
        await this.db.query("COMMIT");
      } catch (err) {
        await this.db.query("ROLLBACK");
        throw err;
      }
    }
    return this.listFieldBoxes(templateId);
  }

  async listFieldBoxes(templateId: string): Promise<FieldBoxRow[]> {
    const result = await this.q(
      `SELECT * FROM t_field_box WHERE template_id = $1 AND deleted = 0 ORDER BY id ASC`,
      [templateId],
    );
    return result.rows.map(mapFieldBox);
  }

  async listPublishedRuleVersions(): Promise<RuleVersionRow[]> {
    const result = await this.q(
      `SELECT * FROM t_rule_version WHERE status = 'published' AND deleted = 0 ORDER BY rule_id ASC`,
    );
    return result.rows.map(mapRuleVersion);
  }

  async getRuleVersionByRuleId(ruleId: string): Promise<RuleVersionRow | null> {
    const result = await this.q(
      `SELECT * FROM t_rule_version WHERE rule_id = $1 AND deleted = 0 ORDER BY id DESC LIMIT 1`,
      [ruleId],
    );
    const row = result.rows[0];
    return row ? mapRuleVersion(row) : null;
  }

  async getRuleVersion(versionId: string): Promise<RuleVersionRow | null> {
    const result = await this.q(
      `SELECT * FROM t_rule_version WHERE version_id = $1 AND deleted = 0`,
      [versionId],
    );
    const row = result.rows[0];
    return row ? mapRuleVersion(row) : null;
  }

  async insertRule(input: { pack_id: string; title: string | null }): Promise<RuleRow> {
    const ts = nowIso();
    const rule_id = newId("rule");
    const result = await this.q(
      `INSERT INTO t_rule
        (rule_id, pack_id, title, created_at, updated_at, creator, updater, deleted)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0)
       RETURNING *`,
      [rule_id, input.pack_id, input.title, ts, ts, SYSTEM, SYSTEM],
    );
    return mapRule(result.rows[0]);
  }

  async insertDraftRuleVersion(input: {
    rule_id: string;
    dsl_json: string;
    blocking: number;
  }): Promise<RuleVersionRow> {
    const ts = nowIso();
    const version_id = newId("rv");
    const result = await this.q(
      `INSERT INTO t_rule_version
        (version_id, rule_id, dsl_json, status, blocking, created_at, updated_at, creator, updater, deleted)
       VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7, $8, 0)
       RETURNING *`,
      [version_id, input.rule_id, input.dsl_json, input.blocking, ts, ts, SYSTEM, SYSTEM],
    );
    return mapRuleVersion(result.rows[0]);
  }

  async updateRuleVersionStatus(versionId: string, status: string): Promise<RuleVersionRow> {
    const ts = nowIso();
    await this.q(
      `UPDATE t_rule_version SET status = $1, updated_at = $2, updater = $3 WHERE version_id = $4 AND deleted = 0`,
      [status, ts, SYSTEM, versionId],
    );
    return (await this.getRuleVersion(versionId))!;
  }

  async insertRuleFixture(input: {
    version_id: string;
    kind: string;
    payload_json: string;
  }): Promise<RuleFixtureRow> {
    const ts = nowIso();
    const result = await this.q(
      `INSERT INTO t_rule_fixture
        (version_id, kind, payload_json, last_result, created_at, updated_at, creator, updater, deleted)
       VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, 0)
       RETURNING *`,
      [input.version_id, input.kind, input.payload_json, ts, ts, SYSTEM, SYSTEM],
    );
    return mapRuleFixture(result.rows[0]);
  }

  async listRuleFixtures(versionId: string): Promise<RuleFixtureRow[]> {
    const result = await this.q(
      `SELECT * FROM t_rule_fixture WHERE version_id = $1 AND deleted = 0 ORDER BY id ASC`,
      [versionId],
    );
    return result.rows.map(mapRuleFixture);
  }

  async updateFixtureLastResult(id: number, lastResult: string): Promise<RuleFixtureRow> {
    const ts = nowIso();
    const result = await this.q(
      `UPDATE t_rule_fixture SET last_result = $1, updated_at = $2, updater = $3 WHERE id = $4 AND deleted = 0
       RETURNING *`,
      [lastResult, ts, SYSTEM, id],
    );
    return mapRuleFixture(result.rows[0]);
  }

  async insertProject(name: string): Promise<ProjectRow> {
    const ts = nowIso();
    const project_id = newId("prj");
    const result = await this.q(
      `INSERT INTO t_project (project_id, name, created_at, updated_at, creator, updater, deleted)
       VALUES ($1, $2, $3, $4, $5, $6, 0)
       RETURNING *`,
      [project_id, name, ts, ts, SYSTEM, SYSTEM],
    );
    return mapProject(result.rows[0]);
  }

  async listProjects(): Promise<ProjectRow[]> {
    const result = await this.q(`SELECT * FROM t_project WHERE deleted = 0 ORDER BY id ASC`);
    return result.rows.map(mapProject);
  }

  async getProject(projectId: string): Promise<ProjectRow | null> {
    const result = await this.q(
      `SELECT * FROM t_project WHERE project_id = $1 AND deleted = 0`,
      [projectId],
    );
    const row = result.rows[0];
    return row ? mapProject(row) : null;
  }

  async updateProjectName(projectId: string, name: string): Promise<ProjectRow> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`project not found: ${projectId}`);
    }
    const ts = nowIso();
    const result = await this.q(
      `UPDATE t_project SET name = $1, updated_at = $2, updater = $3
       WHERE project_id = $4 AND deleted = 0
       RETURNING *`,
      [name, ts, SYSTEM, projectId],
    );
    return mapProject(result.rows[0]);
  }

  async softDeleteProject(projectId: string): Promise<ProjectRow> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`project not found: ${projectId}`);
    }
    if ((await this.listSpecPacks(projectId)).length > 0) {
      throw new LedgerConflictError("project has spec packs");
    }
    const ts = nowIso();
    const result = await this.q(
      `UPDATE t_project SET deleted = 1, updated_at = $1, updater = $2
       WHERE project_id = $3 AND deleted = 0
       RETURNING *`,
      [ts, SYSTEM, projectId],
    );
    return mapProject(result.rows[0]);
  }

  async updateSpecPackName(packId: string, name: string): Promise<SpecPackRow> {
    const pack = await this.getSpecPack(packId);
    if (!pack) {
      throw new Error(`spec pack not found: ${packId}`);
    }
    const ts = nowIso();
    const result = await this.q(
      `UPDATE t_spec_pack SET name = $1, updated_at = $2, updater = $3
       WHERE pack_id = $4 AND deleted = 0
       RETURNING *`,
      [name, ts, SYSTEM, packId],
    );
    return mapSpecPack(result.rows[0]);
  }

  async softDeleteSpecPack(packId: string): Promise<SpecPackRow> {
    const pack = await this.getSpecPack(packId);
    if (!pack) {
      throw new Error(`spec pack not found: ${packId}`);
    }
    if ((await this.countJobsByPack(packId)) > 0) {
      throw new LedgerConflictError("spec pack has jobs");
    }
    const ts = nowIso();
    const result = await this.q(
      `UPDATE t_spec_pack SET deleted = 1, updated_at = $1, updater = $2
       WHERE pack_id = $3 AND deleted = 0
       RETURNING *`,
      [ts, SYSTEM, packId],
    );
    return mapSpecPack(result.rows[0]);
  }

  async countJobsByPack(packId: string): Promise<number> {
    const result = await this.q(
      `SELECT COUNT(*)::int AS cnt FROM t_job WHERE pack_id = $1 AND deleted = 0`,
      [packId],
    );
    return Number(result.rows[0]?.cnt ?? 0);
  }

  async getTemplate(templateId: string): Promise<TemplateRow | null> {
    const result = await this.q(
      `SELECT * FROM t_template WHERE template_id = $1 AND deleted = 0`,
      [templateId],
    );
    const row = result.rows[0];
    return row ? mapTemplate(row) : null;
  }

  async listTemplates(packId: string): Promise<TemplateRow[]> {
    const result = await this.q(
      `SELECT * FROM t_template WHERE pack_id = $1 AND deleted = 0 ORDER BY id ASC`,
      [packId],
    );
    return result.rows.map(mapTemplate);
  }

  async listJobs(): Promise<JobRow[]> {
    const result = await this.q(`SELECT * FROM t_job WHERE deleted = 0 ORDER BY id DESC`);
    return result.rows.map(mapJob);
  }

  async getDocumentForJob(jobId: string): Promise<DocumentRow | null> {
    const result = await this.q(
      `SELECT * FROM t_document WHERE job_id = $1 AND deleted = 0 ORDER BY id ASC LIMIT 1`,
      [jobId],
    );
    const row = result.rows[0];
    return row ? mapDocument(row) : null;
  }

  async getExtraction(jobId: string): Promise<ExtractionRow | null> {
    const result = await this.q(
      `SELECT * FROM t_extraction WHERE job_id = $1 AND deleted = 0 ORDER BY id DESC LIMIT 1`,
      [jobId],
    );
    const row = result.rows[0];
    return row ? mapExtraction(row) : null;
  }

  async listThreads(traceId: string): Promise<ConversationThreadRow[]> {
    const result = await this.q(
      `SELECT * FROM t_conversation_thread WHERE trace_id = $1 AND deleted = 0 ORDER BY id ASC`,
      [traceId],
    );
    return result.rows.map(mapConversationThread);
  }

  async listMessagesByTrace(traceId: string): Promise<ConversationMessageRow[]> {
    const result = await this.q(
      `SELECT m.* FROM t_conversation_message m
       INNER JOIN t_conversation_thread t ON t.thread_id = m.thread_id
       WHERE t.trace_id = $1 AND m.deleted = 0 AND t.deleted = 0
       ORDER BY m.id ASC`,
      [traceId],
    );
    return result.rows.map(mapConversationMessage);
  }

  async insertJob(input: {
    project_id: string;
    pack_id: string | null;
    status: string;
    template_id?: string | null;
    doc_type_id?: string | null;
  }): Promise<JobRow> {
    const ts = nowIso();
    const job_id = newId("job");
    const trace_id = newId("trc");
    const result = await this.q(
      `INSERT INTO t_job
        (job_id, project_id, pack_id, trace_id, status, template_id, doc_type_id, agent_run_id,
         created_at, updated_at, creator, updater, deleted)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8, $9, $10, $11, 0)
       RETURNING *`,
      [
        job_id,
        input.project_id,
        input.pack_id,
        trace_id,
        input.status,
        input.template_id ?? null,
        input.doc_type_id ?? null,
        ts,
        ts,
        SYSTEM,
        SYSTEM,
      ],
    );
    return mapJob(result.rows[0]);
  }

  async updateJobStatus(jobId: string, status: string): Promise<JobRow> {
    const ts = nowIso();
    await this.q(
      `UPDATE t_job SET status = $1, updated_at = $2, updater = $3 WHERE job_id = $4 AND deleted = 0`,
      [status, ts, SYSTEM, jobId],
    );
    return (await this.getJob(jobId))!;
  }

  async updateJobAgentRunId(jobId: string, agentRunId: string): Promise<JobRow> {
    const ts = nowIso();
    await this.q(
      `UPDATE t_job SET agent_run_id = $1, updated_at = $2, updater = $3 WHERE job_id = $4 AND deleted = 0`,
      [agentRunId, ts, SYSTEM, jobId],
    );
    return (await this.getJob(jobId))!;
  }

  async getJob(jobId: string): Promise<JobRow | null> {
    const result = await this.q(`SELECT * FROM t_job WHERE job_id = $1 AND deleted = 0`, [jobId]);
    const row = result.rows[0];
    return row ? mapJob(row) : null;
  }

  async getJobByTrace(traceId: string): Promise<JobRow | null> {
    const result = await this.q(`SELECT * FROM t_job WHERE trace_id = $1 AND deleted = 0`, [traceId]);
    const row = result.rows[0];
    return row ? mapJob(row) : null;
  }

  async insertDocument(input: {
    job_id: string;
    file_name: string;
    file_uri: string;
    mime: string | null;
  }): Promise<DocumentRow> {
    const ts = nowIso();
    const doc_id = newId("doc");
    const result = await this.q(
      `INSERT INTO t_document
        (doc_id, job_id, file_name, file_uri, mime, created_at, updated_at, creator, updater, deleted)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0)
       RETURNING *`,
      [doc_id, input.job_id, input.file_name, input.file_uri, input.mime, ts, ts, SYSTEM, SYSTEM],
    );
    return mapDocument(result.rows[0]);
  }

  async insertExtraction(input: {
    job_id: string;
    ocr_text: string | null;
    fields: Record<string, unknown>;
  }): Promise<ExtractionRow> {
    const ts = nowIso();
    const extraction_id = newId("ext");
    const result = await this.q(
      `INSERT INTO t_extraction
        (extraction_id, job_id, ocr_text, fields_json, created_at, updated_at, creator, updater, deleted)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0)
       RETURNING *`,
      [extraction_id, input.job_id, input.ocr_text, JSON.stringify(input.fields), ts, ts, SYSTEM, SYSTEM],
    );
    return mapExtraction(result.rows[0]);
  }

  async listExtractions(jobId: string): Promise<ExtractionRow[]> {
    const result = await this.q(
      `SELECT * FROM t_extraction WHERE job_id = $1 AND deleted = 0 ORDER BY id ASC`,
      [jobId],
    );
    return result.rows.map(mapExtraction);
  }

  async insertVolumePreview(input: { job_id: string; tree: unknown }): Promise<VolumePreviewRow> {
    const ts = nowIso();
    const preview_id = newId("prv");
    const result = await this.q(
      `INSERT INTO t_volume_preview
        (preview_id, job_id, tree_json, created_at, updated_at, creator, updater, deleted)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0)
       RETURNING *`,
      [preview_id, input.job_id, JSON.stringify(input.tree), ts, ts, SYSTEM, SYSTEM],
    );
    return mapVolumePreview(result.rows[0]);
  }

  async getVolumePreviewById(previewId: string): Promise<VolumePreviewRow | null> {
    const result = await this.q(
      `SELECT * FROM t_volume_preview WHERE preview_id = $1 AND deleted = 0`,
      [previewId],
    );
    const row = result.rows[0];
    return row ? mapVolumePreview(row) : null;
  }

  async getVolumePreview(jobId: string): Promise<VolumePreviewRow | null> {
    const result = await this.q(
      `SELECT * FROM t_volume_preview WHERE job_id = $1 AND deleted = 0 ORDER BY id DESC LIMIT 1`,
      [jobId],
    );
    const row = result.rows[0];
    return row ? mapVolumePreview(row) : null;
  }

  async insertFinding(input: {
    job_id: string;
    rule_version_id: string;
    result: string;
    blocking: number;
    detail: string | null;
    clause_id?: string | null;
    standard_version_id?: string | null;
    retrieve_path?: string | null;
  }): Promise<FindingRow> {
    const ts = nowIso();
    const finding_id = newId("fnd");
    const result = await this.q(
      `INSERT INTO t_finding
        (finding_id, job_id, rule_version_id, result, blocking, detail,
         clause_id, standard_version_id, retrieve_path,
         created_at, updated_at, creator, updater, deleted)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 0)
       RETURNING *`,
      [
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
      ],
    );
    return mapFinding(result.rows[0]);
  }

  async listFindings(jobId: string): Promise<FindingRow[]> {
    const result = await this.q(
      `SELECT * FROM t_finding WHERE job_id = $1 AND deleted = 0 ORDER BY id ASC`,
      [jobId],
    );
    return result.rows.map(mapFinding);
  }

  async insertProposal(input: {
    job_id: string;
    wording: string;
    status?: string;
    agent_run_id?: string | null;
  }): Promise<ProposalRow> {
    const ts = nowIso();
    const proposal_id = newId("prp");
    const result = await this.q(
      `INSERT INTO t_proposal
        (proposal_id, job_id, status, wording, agent_run_id, created_at, updated_at, creator, updater, deleted)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0)
       RETURNING *`,
      [
        proposal_id,
        input.job_id,
        input.status ?? "pending",
        input.wording,
        input.agent_run_id ?? null,
        ts,
        ts,
        SYSTEM,
        SYSTEM,
      ],
    );
    return mapProposal(result.rows[0]);
  }

  async getProposal(proposalId: string): Promise<ProposalRow | null> {
    const result = await this.q(
      `SELECT * FROM t_proposal WHERE proposal_id = $1 AND deleted = 0`,
      [proposalId],
    );
    const row = result.rows[0];
    return row ? mapProposal(row) : null;
  }

  async updateProposalWording(proposalId: string, wording: string): Promise<ProposalRow> {
    const ts = nowIso();
    await this.q(
      `UPDATE t_proposal SET wording = $1, updated_at = $2, updater = $3 WHERE proposal_id = $4 AND deleted = 0`,
      [wording, ts, SYSTEM, proposalId],
    );
    return (await this.getProposal(proposalId))!;
  }

  async updateProposalStatus(proposalId: string, status: string): Promise<ProposalRow> {
    const ts = nowIso();
    await this.q(
      `UPDATE t_proposal SET status = $1, updated_at = $2, updater = $3 WHERE proposal_id = $4 AND deleted = 0`,
      [status, ts, SYSTEM, proposalId],
    );
    return (await this.getProposal(proposalId))!;
  }

  async listPendingProposals(jobId?: string): Promise<ProposalRow[]> {
    if (jobId) {
      const result = await this.q(
        `SELECT * FROM t_proposal WHERE job_id = $1 AND status = 'pending' AND deleted = 0 ORDER BY id ASC`,
        [jobId],
      );
      return result.rows.map(mapProposal);
    }
    const result = await this.q(
      `SELECT * FROM t_proposal WHERE status = 'pending' AND deleted = 0 ORDER BY id ASC`,
    );
    return result.rows.map(mapProposal);
  }

  async insertReceipt(input: {
    proposal_id: string | null;
    job_id: string;
    status?: string;
    payload?: unknown;
  }): Promise<ReceiptRow> {
    const ts = nowIso();
    const receipt_id = newId("rcp");
    const result = await this.q(
      `INSERT INTO t_receipt
        (receipt_id, proposal_id, job_id, status, payload_json, created_at, updated_at, creator, updater, deleted)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0)
       RETURNING *`,
      [
        receipt_id,
        input.proposal_id,
        input.job_id,
        input.status ?? "accepted",
        input.payload === undefined ? null : JSON.stringify(input.payload),
        ts,
        ts,
        SYSTEM,
        SYSTEM,
      ],
    );
    return mapReceipt(result.rows[0]);
  }

  async getReceipt(receiptId: string): Promise<ReceiptRow | null> {
    const result = await this.q(
      `SELECT * FROM t_receipt WHERE receipt_id = $1 AND deleted = 0`,
      [receiptId],
    );
    const row = result.rows[0];
    return row ? mapReceipt(row) : null;
  }

  async listReceipts(jobId?: string): Promise<ReceiptRow[]> {
    if (jobId) {
      const result = await this.q(
        `SELECT * FROM t_receipt WHERE job_id = $1 AND deleted = 0 ORDER BY id ASC`,
        [jobId],
      );
      return result.rows.map(mapReceipt);
    }
    const result = await this.q(`SELECT * FROM t_receipt WHERE deleted = 0 ORDER BY id ASC`);
    return result.rows.map(mapReceipt);
  }

  async listReceiptsByProposal(proposalId: string): Promise<ReceiptRow[]> {
    const result = await this.q(
      `SELECT * FROM t_receipt WHERE proposal_id = $1 AND deleted = 0 ORDER BY id ASC`,
      [proposalId],
    );
    return result.rows.map(mapReceipt);
  }

  async appendAudit(input: {
    trace_id: string;
    event_type: string;
    ref_id: string | null;
    payload: unknown;
  }): Promise<AuditEventRow> {
    const ts = nowIso();
    const seqResult = await this.q(
      `SELECT COALESCE(MAX(seq), 0) AS max_seq FROM t_audit_event WHERE trace_id = $1`,
      [input.trace_id],
    );
    const seq = asNumber(seqResult.rows[0]?.max_seq) + 1;
    const result = await this.q(
      `INSERT INTO t_audit_event
        (trace_id, seq, event_type, ref_id, payload_json, created_at, updated_at, creator, updater, deleted)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0)
       RETURNING *`,
      [input.trace_id, seq, input.event_type, input.ref_id, JSON.stringify(input.payload), ts, ts, SYSTEM, SYSTEM],
    );
    return mapAuditEvent(result.rows[0]);
  }

  async listAudit(traceId: string): Promise<AuditEventRow[]> {
    const result = await this.q(
      `SELECT * FROM t_audit_event WHERE trace_id = $1 AND deleted = 0 ORDER BY seq ASC`,
      [traceId],
    );
    return result.rows.map(mapAuditEvent);
  }

  async getThread(traceId: string, step: string): Promise<ConversationThreadRow | null> {
    const result = await this.q(
      `SELECT * FROM t_conversation_thread WHERE trace_id = $1 AND step = $2 AND deleted = 0`,
      [traceId, step],
    );
    const row = result.rows[0];
    return row ? mapConversationThread(row) : null;
  }

  async insertThread(input: {
    trace_id: string;
    step: string;
    job_id: string | null;
  }): Promise<ConversationThreadRow> {
    const ts = nowIso();
    const thread_id = newId("thr");
    const result = await this.q(
      `INSERT INTO t_conversation_thread
        (thread_id, trace_id, step, job_id, hitl_token, created_at, updated_at, creator, updater, deleted)
       VALUES ($1, $2, $3, $4, NULL, $5, $6, $7, $8, 0)
       RETURNING *`,
      [thread_id, input.trace_id, input.step, input.job_id, ts, ts, SYSTEM, SYSTEM],
    );
    return mapConversationThread(result.rows[0]);
  }

  async insertMessage(input: {
    thread_id: string;
    role: string;
    body: string;
  }): Promise<ConversationMessageRow> {
    const ts = nowIso();
    const result = await this.q(
      `INSERT INTO t_conversation_message
        (thread_id, role, body, created_at, updated_at, creator, updater, deleted)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0)
       RETURNING *`,
      [input.thread_id, input.role, input.body, ts, ts, SYSTEM, SYSTEM],
    );
    return mapConversationMessage(result.rows[0]);
  }

  async listMessages(traceId: string, step: string): Promise<ConversationMessageRow[]> {
    const result = await this.q(
      `SELECT m.* FROM t_conversation_message m
       INNER JOIN t_conversation_thread t ON t.thread_id = m.thread_id
       WHERE t.trace_id = $1 AND t.step = $2 AND m.deleted = 0 AND t.deleted = 0
       ORDER BY m.id ASC`,
      [traceId, step],
    );
    return result.rows.map(mapConversationMessage);
  }

  async listExcelCellMappings(templateId: string): Promise<ExcelCellMappingRow[]> {
    const result = await this.q(
      `SELECT * FROM t_excel_cell_mapping WHERE template_id = $1 AND deleted = 0 ORDER BY id ASC`,
      [templateId],
    );
    return result.rows.map(mapExcelCellMapping);
  }

  async getExcelCellMapping(mappingId: string): Promise<ExcelCellMappingRow | null> {
    const result = await this.q(
      `SELECT * FROM t_excel_cell_mapping WHERE mapping_id = $1 AND deleted = 0`,
      [mappingId],
    );
    const row = result.rows[0];
    return row ? mapExcelCellMapping(row) : null;
  }

  async saveExcelCellMappings(
    templateId: string,
    mappings: ExcelCellMappingWrite[],
  ): Promise<ExcelCellMappingRow[]> {
    const ts = nowIso();
    if (this.db instanceof pg.Pool) {
      const client = await this.db.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `UPDATE t_excel_cell_mapping SET deleted = 1, updated_at = $1, updater = $2 WHERE template_id = $3`,
          [ts, SYSTEM, templateId],
        );
        for (const mapping of mappings) {
          await client.query(
            `INSERT INTO t_excel_cell_mapping
              (mapping_id, template_id, sheet_name, cell, field_key, value_type, signature_role, created_at, updated_at, creator, updater, deleted)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0)`,
            [
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
            ],
          );
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } else {
      await this.q(
        `UPDATE t_excel_cell_mapping SET deleted = 1, updated_at = $1, updater = $2 WHERE template_id = $3`,
        [ts, SYSTEM, templateId],
      );
      for (const mapping of mappings) {
        await this.q(
          `INSERT INTO t_excel_cell_mapping
            (mapping_id, template_id, sheet_name, cell, field_key, value_type, signature_role, created_at, updated_at, creator, updater, deleted)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0)`,
          [
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
          ],
        );
      }
    }
    return this.listExcelCellMappings(templateId);
  }

  async softDeleteExcelCellMapping(mappingId: string): Promise<ExcelCellMappingRow> {
    const ts = nowIso();
    await this.q(
      `UPDATE t_excel_cell_mapping SET deleted = 1, updated_at = $1, updater = $2 WHERE mapping_id = $3 AND deleted = 0`,
      [ts, SYSTEM, mappingId],
    );
    const result = await this.q(`SELECT * FROM t_excel_cell_mapping WHERE mapping_id = $1`, [mappingId]);
    return mapExcelCellMapping(result.rows[0]);
  }

  async listFieldFillRules(docTypeId: string): Promise<FieldFillRuleRow[]> {
    const result = await this.q(
      `SELECT * FROM t_field_fill_rule WHERE doc_type_id = $1 AND deleted = 0 ORDER BY id ASC`,
      [docTypeId],
    );
    return result.rows.map(mapFieldFillRule);
  }

  async getFieldFillRule(docTypeId: string, fieldKey: string): Promise<FieldFillRuleRow | null> {
    const result = await this.q(
      `SELECT * FROM t_field_fill_rule WHERE doc_type_id = $1 AND field_key = $2 AND deleted = 0`,
      [docTypeId, fieldKey],
    );
    const row = result.rows[0];
    return row ? mapFieldFillRule(row) : null;
  }

  async saveFieldFillRules(docTypeId: string, rules: FieldFillRuleWrite[]): Promise<FieldFillRuleRow[]> {
    const ts = nowIso();
    if (this.db instanceof pg.Pool) {
      const client = await this.db.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `UPDATE t_field_fill_rule SET deleted = 1, updated_at = $1, updater = $2 WHERE doc_type_id = $3`,
          [ts, SYSTEM, docTypeId],
        );
        for (const rule of rules) {
          await client.query(
            `INSERT INTO t_field_fill_rule
              (doc_type_id, field_key, required, pattern, min_num, max_num, default_generator, default_literal, created_at, updated_at, creator, updater, deleted)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0)`,
            [
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
            ],
          );
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } else {
      await this.q(
        `UPDATE t_field_fill_rule SET deleted = 1, updated_at = $1, updater = $2 WHERE doc_type_id = $3`,
        [ts, SYSTEM, docTypeId],
      );
      for (const rule of rules) {
        await this.q(
          `INSERT INTO t_field_fill_rule
            (doc_type_id, field_key, required, pattern, min_num, max_num, default_generator, default_literal, created_at, updated_at, creator, updater, deleted)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0)`,
          [
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
          ],
        );
      }
    }
    return this.listFieldFillRules(docTypeId);
  }

  async insertDocumentArtifact(input: {
    project_id: string;
    doc_type_id: string;
    template_id: string;
    file_uri: string;
    status?: string;
    trace_id: string;
    metadata?: unknown;
    artifact_id?: string;
  }): Promise<DocumentArtifactRow> {
    const ts = nowIso();
    const artifact_id = input.artifact_id ?? newId("art");
    const result = await this.q(
      `INSERT INTO t_document_artifact
        (artifact_id, project_id, doc_type_id, template_id, file_uri, adapter_document_id, status, trace_id, receipt_id, metadata_json, created_at, updated_at, creator, updater, deleted)
       VALUES ($1, $2, $3, $4, $5, NULL, $6, $7, NULL, $8, $9, $10, $11, $12, 0)
       RETURNING *`,
      [
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
      ],
    );
    return mapDocumentArtifact(result.rows[0]);
  }

  async getDocumentArtifact(artifactId: string): Promise<DocumentArtifactRow | null> {
    const result = await this.q(
      `SELECT * FROM t_document_artifact WHERE artifact_id = $1 AND deleted = 0`,
      [artifactId],
    );
    const row = result.rows[0];
    return row ? mapDocumentArtifact(row) : null;
  }

  async listDocumentArtifacts(projectId: string, docTypeId?: string): Promise<DocumentArtifactRow[]> {
    const result = docTypeId
      ? await this.q(
          `SELECT * FROM t_document_artifact WHERE project_id = $1 AND doc_type_id = $2 AND deleted = 0 ORDER BY id ASC`,
          [projectId, docTypeId],
        )
      : await this.q(
          `SELECT * FROM t_document_artifact WHERE project_id = $1 AND deleted = 0 ORDER BY id ASC`,
          [projectId],
        );
    return result.rows.map(mapDocumentArtifact);
  }

  async updateDocumentArtifact(
    artifactId: string,
    input: {
      adapter_document_id?: string | null;
      status?: string;
      receipt_id?: string | null;
      metadata?: unknown;
    },
  ): Promise<DocumentArtifactRow> {
    const ts = nowIso();
    const current = await this.getDocumentArtifact(artifactId);
    if (!current) {
      throw new Error("artifact not found");
    }
    const result = await this.q(
      `UPDATE t_document_artifact
       SET adapter_document_id = $1, status = $2, receipt_id = $3, metadata_json = $4, updated_at = $5, updater = $6
       WHERE artifact_id = $7 AND deleted = 0
       RETURNING *`,
      [
        input.adapter_document_id !== undefined ? input.adapter_document_id : current.adapter_document_id,
        input.status ?? current.status,
        input.receipt_id !== undefined ? input.receipt_id : current.receipt_id,
        input.metadata === undefined ? current.metadata_json : JSON.stringify(input.metadata),
        ts,
        SYSTEM,
        artifactId,
      ],
    );
    return mapDocumentArtifact(result.rows[0]);
  }

  async insertSignatureTask(input: {
    artifact_id: string;
    role: string;
    assignee_label?: string | null;
    status?: string;
    trace_id: string;
    task_id?: string;
  }): Promise<SignatureTaskRow> {
    const ts = nowIso();
    const task_id = input.task_id ?? newId("sig");
    const result = await this.q(
      `INSERT INTO t_signature_task
        (task_id, artifact_id, role, assignee_label, status, signer_name, trace_id, receipt_id, created_at, updated_at, creator, updater, deleted)
       VALUES ($1, $2, $3, $4, $5, NULL, $6, NULL, $7, $8, $9, $10, 0)
       RETURNING *`,
      [
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
      ],
    );
    return mapSignatureTask(result.rows[0]);
  }

  async getSignatureTask(taskId: string): Promise<SignatureTaskRow | null> {
    const result = await this.q(
      `SELECT * FROM t_signature_task WHERE task_id = $1 AND deleted = 0`,
      [taskId],
    );
    const row = result.rows[0];
    return row ? mapSignatureTask(row) : null;
  }

  async listSignatureTasksByArtifact(artifactId: string): Promise<SignatureTaskRow[]> {
    const result = await this.q(
      `SELECT * FROM t_signature_task WHERE artifact_id = $1 AND deleted = 0 ORDER BY id ASC`,
      [artifactId],
    );
    return result.rows.map(mapSignatureTask);
  }

  async listPendingSignatureTasks(): Promise<SignatureTaskRow[]> {
    const result = await this.q(
      `SELECT * FROM t_signature_task WHERE status = 'pending' AND deleted = 0 ORDER BY id ASC`,
    );
    return result.rows.map(mapSignatureTask);
  }

  async updateSignatureTask(
    taskId: string,
    input: {
      status?: string;
      signer_name?: string | null;
      receipt_id?: string | null;
    },
  ): Promise<SignatureTaskRow> {
    const ts = nowIso();
    const current = await this.getSignatureTask(taskId);
    if (!current) {
      throw new Error("signature task not found");
    }
    const result = await this.q(
      `UPDATE t_signature_task
       SET status = $1, signer_name = $2, receipt_id = $3, updated_at = $4, updater = $5
       WHERE task_id = $6 AND deleted = 0
       RETURNING *`,
      [
        input.status ?? current.status,
        input.signer_name !== undefined ? input.signer_name : current.signer_name,
        input.receipt_id !== undefined ? input.receipt_id : current.receipt_id,
        ts,
        SYSTEM,
        taskId,
      ],
    );
    return mapSignatureTask(result.rows[0]);
  }

  async listCompletenessRules(packId: string): Promise<CompletenessRuleRow[]> {
    const result = await this.q(
      `SELECT * FROM t_completeness_rule WHERE pack_id = $1 AND deleted = 0 ORDER BY id ASC`,
      [packId],
    );
    return result.rows.map(mapCompletenessRule);
  }

  async getCompletenessRule(ruleId: string): Promise<CompletenessRuleRow | null> {
    const result = await this.q(
      `SELECT * FROM t_completeness_rule WHERE rule_id = $1 AND deleted = 0`,
      [ruleId],
    );
    const row = result.rows[0];
    return row ? mapCompletenessRule(row) : null;
  }

  async saveCompletenessRules(
    packId: string,
    rules: CompletenessRuleWrite[],
  ): Promise<CompletenessRuleRow[]> {
    const ts = nowIso();
    if (this.db instanceof pg.Pool) {
      const client = await this.db.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `UPDATE t_completeness_rule SET deleted = 1, updated_at = $1, updater = $2 WHERE pack_id = $3`,
          [ts, SYSTEM, packId],
        );
        for (const rule of rules) {
          await client.query(
            `INSERT INTO t_completeness_rule
              (rule_id, pack_id, doc_type_id, label, required, created_at, updated_at, creator, updater, deleted)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0)`,
            [
              rule.rule_id ?? newId("cr"),
              packId,
              rule.doc_type_id,
              rule.label,
              rule.required ?? 0,
              ts,
              ts,
              SYSTEM,
              SYSTEM,
            ],
          );
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } else {
      await this.q(
        `UPDATE t_completeness_rule SET deleted = 1, updated_at = $1, updater = $2 WHERE pack_id = $3`,
        [ts, SYSTEM, packId],
      );
      for (const rule of rules) {
        await this.q(
          `INSERT INTO t_completeness_rule
            (rule_id, pack_id, doc_type_id, label, required, created_at, updated_at, creator, updater, deleted)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0)`,
          [
            rule.rule_id ?? newId("cr"),
            packId,
            rule.doc_type_id,
            rule.label,
            rule.required ?? 0,
            ts,
            ts,
            SYSTEM,
            SYSTEM,
          ],
        );
      }
    }
    return this.listCompletenessRules(packId);
  }

  async softDeleteCompletenessRule(ruleId: string): Promise<CompletenessRuleRow> {
    const ts = nowIso();
    await this.q(
      `UPDATE t_completeness_rule SET deleted = 1, updated_at = $1, updater = $2 WHERE rule_id = $3 AND deleted = 0`,
      [ts, SYSTEM, ruleId],
    );
    const result = await this.q(`SELECT * FROM t_completeness_rule WHERE rule_id = $1`, [ruleId]);
    return mapCompletenessRule(result.rows[0]);
  }
}
