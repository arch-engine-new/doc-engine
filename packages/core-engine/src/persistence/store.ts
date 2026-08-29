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
  ConversationMessageRow,
  ConversationThreadRow,
  DocTypeRow,
  DocumentRow,
  ExtractionRow,
  FieldBoxRow,
  FieldDefRow,
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
  DOC_TYPE_CHILD_ID,
  DOC_TYPE_PARENT_ID,
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
  seedDemoDocTypes,
} from "../pipeline/seed.js";
import { LedgerConflictError } from "../pipeline/job-pipeline.js";

/** Writable FieldBox columns for upsert; names match FieldBoxRow, coords stay DECIMAL strings. */
export type FieldBoxWrite = Pick<
  FieldBoxRow,
  "field_key" | "value_type" | "page" | "x" | "y" | "w" | "h"
>;

/** Writable FieldDef columns for saveFieldDefs. */
export type FieldDefWrite = Pick<FieldDefRow, "field_key" | "value_type" | "required">;

const SYSTEM = "system";

export class CoreEngineStore {
  constructor(private readonly db: Database.Database) {}

  close(): void {
    this.db.close();
  }

  seedPublishedRules(): void {
    this.ensureEmptySpecPack();
    this.seedDemoDocTypes();
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
  }): ClauseRow {
    const ts = nowIso();
    this.db
      .prepare(
        `INSERT INTO t_clause
          (clause_id, version_id, parent_clause_id, heading, body, span_json, qdrant_point_id,
           created_at, updated_at, creator, updater, deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      )
      .run(
        input.clause_id,
        input.version_id,
        input.parent_clause_id ?? null,
        input.heading ?? null,
        input.body,
        input.span_json ?? null,
        input.qdrant_point_id ?? input.clause_id,
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

  insertDocType(input: {
    pack_id: string;
    name: string;
    parent_doc_type_id?: string | null;
    doc_type_id?: string;
  }): DocTypeRow {
    const pack = this.getSpecPack(input.pack_id);
    if (!pack) {
      throw new Error(`spec pack not found: ${input.pack_id}`);
    }
    if (input.parent_doc_type_id) {
      const parent = this.getDocType(input.parent_doc_type_id);
      if (!parent) {
        throw new Error(`parent doc type not found: ${input.parent_doc_type_id}`);
      }
      if (parent.pack_id !== input.pack_id) {
        throw new Error(`parent doc type ${input.parent_doc_type_id} does not belong to pack ${input.pack_id}`);
      }
    }
    const ts = nowIso();
    const doc_type_id = input.doc_type_id ?? newId("dt");
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

  getDocType(docTypeId: string): DocTypeRow | null {
    const row = this.db
      .prepare(`SELECT * FROM t_doc_type WHERE doc_type_id = ? AND deleted = 0`)
      .get(docTypeId) as DocTypeRow | undefined;
    return row ?? null;
  }

  updateDocType(docTypeId: string, name: string): DocTypeRow {
    const docType = this.getDocType(docTypeId);
    if (!docType) {
      throw new Error(`doc type not found: ${docTypeId}`);
    }
    const ts = nowIso();
    this.db
      .prepare(
        `UPDATE t_doc_type SET name = ?, updated_at = ?, updater = ? WHERE doc_type_id = ? AND deleted = 0`,
      )
      .run(name, ts, SYSTEM, docTypeId);
    return this.getDocType(docTypeId)!;
  }

  softDeleteDocType(docTypeId: string): DocTypeRow {
    const docType = this.getDocType(docTypeId);
    if (!docType) {
      throw new Error(`doc type not found: ${docTypeId}`);
    }
    const child = this.db
      .prepare(
        `SELECT COUNT(*) AS cnt FROM t_doc_type WHERE parent_doc_type_id = ? AND deleted = 0`,
      )
      .get(docTypeId) as { cnt: number };
    if (Number(child.cnt) > 0) {
      throw new LedgerConflictError("doc type has children");
    }
    const templates = this.db
      .prepare(`SELECT COUNT(*) AS cnt FROM t_template WHERE doc_type_id = ? AND deleted = 0`)
      .get(docTypeId) as { cnt: number };
    if (Number(templates.cnt) > 0) {
      throw new LedgerConflictError("doc type has templates");
    }
    const jobs = this.db
      .prepare(`SELECT COUNT(*) AS cnt FROM t_job WHERE doc_type_id = ? AND deleted = 0`)
      .get(docTypeId) as { cnt: number };
    if (Number(jobs.cnt) > 0) {
      throw new LedgerConflictError("doc type has jobs");
    }
    const ts = nowIso();
    this.db
      .prepare(
        `UPDATE t_doc_type SET deleted = 1, updated_at = ?, updater = ? WHERE doc_type_id = ? AND deleted = 0`,
      )
      .run(ts, SYSTEM, docTypeId);
    return this.db.prepare(`SELECT * FROM t_doc_type WHERE doc_type_id = ?`).get(docTypeId) as DocTypeRow;
  }

  listDocTypesByPack(packId: string): DocTypeRow[] {
    return this.db
      .prepare(`SELECT * FROM t_doc_type WHERE pack_id = ? AND deleted = 0 ORDER BY id ASC`)
      .all(packId) as DocTypeRow[];
  }

  /** Root-first chain including docTypeId; used to flatten FieldDef with child winning duplicate keys. */
  getDocTypeAncestors(docTypeId: string): DocTypeRow[] {
    const chain: DocTypeRow[] = [];
    let current = this.getDocType(docTypeId);
    while (current) {
      chain.unshift(current);
      if (!current.parent_doc_type_id) {
        break;
      }
      current = this.getDocType(current.parent_doc_type_id);
      if (chain.length > 32) {
        throw new Error(`doc type ancestor cycle detected at ${docTypeId}`);
      }
    }
    return chain;
  }

  listFieldDefs(docTypeId: string): FieldDefRow[] {
    return this.db
      .prepare(
        `SELECT * FROM t_field_def WHERE doc_type_id = ? AND deleted = 0 ORDER BY id ASC`,
      )
      .all(docTypeId) as FieldDefRow[];
  }

  saveFieldDefs(docTypeId: string, defs: FieldDefWrite[]): FieldDefRow[] {
    const docType = this.getDocType(docTypeId);
    if (!docType) {
      throw new Error(`doc type not found: ${docTypeId}`);
    }
    const ts = nowIso();
    const upsert = this.db.prepare(
      `INSERT INTO t_field_def
        (doc_type_id, field_key, value_type, required, created_at, updated_at, creator, updater, deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
       ON CONFLICT(doc_type_id, field_key) DO UPDATE SET
         value_type = excluded.value_type,
         required = excluded.required,
         updated_at = excluded.updated_at,
         updater = excluded.updater,
         deleted = 0`,
    );
    const tx = this.db.transaction(() => {
      this.db
        .prepare(`UPDATE t_field_def SET deleted = 1, updated_at = ?, updater = ? WHERE doc_type_id = ?`)
        .run(ts, SYSTEM, docTypeId);
      for (const def of defs) {
        upsert.run(
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

  /** Demo parent/child DocType tree on PACK_ID for fixture extraction regression. */
  private seedDemoDocTypes(): void {
    seedDemoDocTypes(this, {
      packId: PACK_ID,
      parentId: DOC_TYPE_PARENT_ID,
      childId: DOC_TYPE_CHILD_ID,
    });
  }

  insertTemplate(input: {
    pack_id: string;
    doc_type_id: string;
    name: string;
    page_image_uri?: string | null;
  }): TemplateRow {
    const docType = this.getDocType(input.doc_type_id);
    if (!docType) {
      throw new Error(`doc type not found: ${input.doc_type_id}`);
    }
    if (docType.pack_id !== input.pack_id) {
      throw new Error(`doc type ${input.doc_type_id} does not belong to pack ${input.pack_id}`);
    }
    const ts = nowIso();
    const template_id = newId("tpl");
    this.db
      .prepare(
        `INSERT INTO t_template
          (template_id, pack_id, doc_type_id, name, page_image_uri, created_at, updated_at, creator, updater, deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      )
      .run(
        template_id,
        input.pack_id,
        input.doc_type_id,
        input.name,
        input.page_image_uri ?? null,
        ts,
        ts,
        SYSTEM,
        SYSTEM,
      );
    return this.db.prepare(`SELECT * FROM t_template WHERE template_id = ?`).get(template_id) as TemplateRow;
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

  listJobs(): JobRow[] {
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

  insertJob(input: {
    project_id: string;
    pack_id: string | null;
    status: string;
    template_id?: string | null;
    doc_type_id?: string | null;
  }): JobRow {
    if (input.doc_type_id && input.pack_id) {
      const docType = this.getDocType(input.doc_type_id);
      if (!docType) {
        throw new Error(`doc type not found: ${input.doc_type_id}`);
      }
      if (docType.pack_id !== input.pack_id) {
        throw new Error(`doc type ${input.doc_type_id} does not belong to pack ${input.pack_id}`);
      }
    }
    const ts = nowIso();
    const job_id = newId("job");
    const trace_id = newId("trc");
    this.db
      .prepare(
        `INSERT INTO t_job
          (job_id, project_id, pack_id, trace_id, status, template_id, doc_type_id, agent_run_id,
           created_at, updated_at, creator, updater, deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, 0)`,
      )
      .run(
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
}
