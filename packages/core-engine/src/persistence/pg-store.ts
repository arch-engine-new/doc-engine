/**
 * WHY: live ledger is Postgres per schema contract; tests keep SqliteLedger.
 *
 * Semantic clone of CoreEngineStore for project / spec_pack / template / field_box / rule tables.
 * TIMESTAMP and JSONB are mapped back to generated row strings. Remaining methods wait for later tasks.
 */

import pg from "pg";
import type { QueryResult, QueryResultRow } from "pg";
import { newId, nowIso } from "../ids.js";
import type {
  AuditEventRow,
  ClauseRow,
  ConversationMessageRow,
  ConversationThreadRow,
  DocumentRow,
  ExtractionRow,
  FieldBoxRow,
  FindingRow,
  JobRow,
  ProjectRow,
  ProposalRow,
  ReceiptRow,
  RuleFixtureRow,
  RuleRow,
  RuleVersionRow,
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
} from "../pipeline/seed.js";
import type { LedgerStore } from "./ledger.js";
import type { FieldBoxWrite } from "./store.js";

const SYSTEM = "system";

type PgClient = pg.Pool | pg.Client;

function notImplemented(methodName: string): never {
  throw new Error(`not implemented until later triple-store task: ${methodName}`);
}

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

function mapTemplate(row: QueryResultRow): TemplateRow {
  return {
    ...mapAudit(row),
    template_id: String(row.template_id),
    pack_id: String(row.pack_id),
    name: String(row.name),
    page_image_uri: row.page_image_uri == null ? null : String(row.page_image_uri),
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

  async seedPublishedRules(): Promise<void> {
    await this.ensureEmptySpecPack();
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

  bindEffectiveVersion(_packId: string, _versionId: string): Promise<SpecPackRow> {
    notImplemented("bindEffectiveVersion");
  }

  insertStandardDoc(_input: {
    pack_id: string;
    title: string;
    file_uri: string;
    doc_id?: string;
  }): Promise<StandardDocRow> {
    notImplemented("insertStandardDoc");
  }

  getStandardDoc(_docId: string): Promise<StandardDocRow | null> {
    notImplemented("getStandardDoc");
  }

  listStandardDocs(_packId: string): Promise<StandardDocRow[]> {
    notImplemented("listStandardDocs");
  }

  insertStandardVersion(_input: {
    doc_id: string;
    status: string;
    version_id?: string;
  }): Promise<StandardVersionRow> {
    notImplemented("insertStandardVersion");
  }

  getStandardVersion(_versionId: string): Promise<StandardVersionRow | null> {
    notImplemented("getStandardVersion");
  }

  listStandardVersions(_docId: string): Promise<StandardVersionRow[]> {
    notImplemented("listStandardVersions");
  }

  listEffectiveStandardVersions(_packId: string): Promise<StandardVersionRow[]> {
    notImplemented("listEffectiveStandardVersions");
  }

  updateStandardVersionStatus(
    _versionId: string,
    _status: string,
  ): Promise<StandardVersionRow> {
    notImplemented("updateStandardVersionStatus");
  }

  insertClause(_input: {
    clause_id: string;
    version_id: string;
    parent_clause_id?: string | null;
    heading?: string | null;
    body: string;
    span_json?: string | null;
    qdrant_point_id?: string | null;
  }): Promise<ClauseRow> {
    notImplemented("insertClause");
  }

  getClause(_clauseId: string): Promise<ClauseRow | null> {
    notImplemented("getClause");
  }

  listClauses(_versionId: string): Promise<ClauseRow[]> {
    notImplemented("listClauses");
  }

  insertStandardEdge(_input: {
    from_clause_id: string;
    to_clause_id: string;
    kind: string;
  }): Promise<StandardEdgeRow> {
    notImplemented("insertStandardEdge");
  }

  listStandardEdges(_fromClauseId?: string): Promise<StandardEdgeRow[]> {
    notImplemented("listStandardEdges");
  }

  async insertTemplate(input: {
    pack_id: string;
    name: string;
    page_image_uri?: string | null;
  }): Promise<TemplateRow> {
    const ts = nowIso();
    const template_id = newId("tpl");
    const result = await this.q(
      `INSERT INTO t_template
        (template_id, pack_id, name, page_image_uri, created_at, updated_at, creator, updater, deleted)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0)
       RETURNING *`,
      [template_id, input.pack_id, input.name, input.page_image_uri ?? null, ts, ts, SYSTEM, SYSTEM],
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

  listJobs(): Promise<JobRow[]> {
    notImplemented("listJobs");
  }

  getDocumentForJob(_jobId: string): Promise<DocumentRow | null> {
    notImplemented("getDocumentForJob");
  }

  getExtraction(_jobId: string): Promise<ExtractionRow | null> {
    notImplemented("getExtraction");
  }

  listThreads(_traceId: string): Promise<ConversationThreadRow[]> {
    notImplemented("listThreads");
  }

  listMessagesByTrace(_traceId: string): Promise<ConversationMessageRow[]> {
    notImplemented("listMessagesByTrace");
  }

  insertJob(_input: {
    project_id: string;
    pack_id: string | null;
    status: string;
    template_id?: string | null;
  }): Promise<JobRow> {
    notImplemented("insertJob");
  }

  updateJobStatus(_jobId: string, _status: string): Promise<JobRow> {
    notImplemented("updateJobStatus");
  }

  getJob(_jobId: string): Promise<JobRow | null> {
    notImplemented("getJob");
  }

  getJobByTrace(_traceId: string): Promise<JobRow | null> {
    notImplemented("getJobByTrace");
  }

  insertDocument(_input: {
    job_id: string;
    file_name: string;
    file_uri: string;
    mime: string | null;
  }): Promise<DocumentRow> {
    notImplemented("insertDocument");
  }

  insertExtraction(_input: {
    job_id: string;
    ocr_text: string | null;
    fields: Record<string, unknown>;
  }): Promise<ExtractionRow> {
    notImplemented("insertExtraction");
  }

  listExtractions(_jobId: string): Promise<ExtractionRow[]> {
    notImplemented("listExtractions");
  }

  insertVolumePreview(_input: { job_id: string; tree: unknown }): Promise<VolumePreviewRow> {
    notImplemented("insertVolumePreview");
  }

  getVolumePreviewById(_previewId: string): Promise<VolumePreviewRow | null> {
    notImplemented("getVolumePreviewById");
  }

  getVolumePreview(_jobId: string): Promise<VolumePreviewRow | null> {
    notImplemented("getVolumePreview");
  }

  insertFinding(_input: {
    job_id: string;
    rule_version_id: string;
    result: string;
    blocking: number;
    detail: string | null;
    clause_id?: string | null;
    standard_version_id?: string | null;
    retrieve_path?: string | null;
  }): Promise<FindingRow> {
    notImplemented("insertFinding");
  }

  listFindings(_jobId: string): Promise<FindingRow[]> {
    notImplemented("listFindings");
  }

  insertProposal(_input: {
    job_id: string;
    wording: string;
    status?: string;
    agent_run_id?: string | null;
  }): Promise<ProposalRow> {
    notImplemented("insertProposal");
  }

  getProposal(_proposalId: string): Promise<ProposalRow | null> {
    notImplemented("getProposal");
  }

  updateProposalWording(_proposalId: string, _wording: string): Promise<ProposalRow> {
    notImplemented("updateProposalWording");
  }

  updateProposalStatus(_proposalId: string, _status: string): Promise<ProposalRow> {
    notImplemented("updateProposalStatus");
  }

  listPendingProposals(_jobId?: string): Promise<ProposalRow[]> {
    notImplemented("listPendingProposals");
  }

  insertReceipt(_input: {
    proposal_id: string | null;
    job_id: string;
    status?: string;
    payload?: unknown;
  }): Promise<ReceiptRow> {
    notImplemented("insertReceipt");
  }

  getReceipt(_receiptId: string): Promise<ReceiptRow | null> {
    notImplemented("getReceipt");
  }

  listReceipts(_jobId?: string): Promise<ReceiptRow[]> {
    notImplemented("listReceipts");
  }

  listReceiptsByProposal(_proposalId: string): Promise<ReceiptRow[]> {
    notImplemented("listReceiptsByProposal");
  }

  appendAudit(_input: {
    trace_id: string;
    event_type: string;
    ref_id: string | null;
    payload: unknown;
  }): Promise<AuditEventRow> {
    notImplemented("appendAudit");
  }

  listAudit(_traceId: string): Promise<AuditEventRow[]> {
    notImplemented("listAudit");
  }

  getThread(_traceId: string, _step: string): Promise<ConversationThreadRow | null> {
    notImplemented("getThread");
  }

  insertThread(_input: {
    trace_id: string;
    step: string;
    job_id: string | null;
  }): Promise<ConversationThreadRow> {
    notImplemented("insertThread");
  }

  insertMessage(_input: {
    thread_id: string;
    role: string;
    body: string;
  }): Promise<ConversationMessageRow> {
    notImplemented("insertMessage");
  }

  listMessages(_traceId: string, _step: string): Promise<ConversationMessageRow[]> {
    notImplemented("listMessages");
  }
}
