/**
 * WHY: Postgres is async; tests keep better-sqlite3; one interface prevents silent dual ledgers.
 *
 * LedgerStore matches CoreEngineStore public methods, each returning Promise<T>.
 * SqliteLedger wraps the sync store with Promise.resolve — no deasync, no second schema.
 */

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
import { LEDGER_TABLES } from "./migrate.js";
import {
  CoreEngineStore,
  type CompletenessRuleWrite,
  type ExcelCellMappingWrite,
  type FieldBoxWrite,
  type FieldFillRuleWrite,
  type IngestPageUpdate,
  type IngestRunWrite,
  type LayoutEdgeWrite,
  type LayoutUnitWrite,
  type ListJobsFilter,
  type SkillDraftUpdate,
  type SkillDraftWrite,
  type SkillLedgerWrite,
  type SkillRecordUpdate,
  type SkillRecordWrite,
} from "./store.js";

/**
 * WHY: check_findings / pending_review / volume_preview share GET /api/jobs.
 * Skill-track uploads must not land on leftover C2 pages (M16/R28/D12), so
 * omit or unknown query values stay `legacy`. Pass `skill` only when a caller
 * explicitly wants the Skill workbench list.
 */
export function resolveJobsListTrack(raw: string | null | undefined): JobTrack {
  return raw === "skill" ? "skill" : "legacy";
}

export interface LedgerStore {
  close(): Promise<void>;
  /** Empty all core-engine t_* tables. Does not DROP DATABASE. */
  wipeLedger(): Promise<void>;
  seedPublishedRules(): Promise<void>;
  insertSpecPack(input: {
    project_id: string;
    name: string;
    version: string;
    pack_id?: string;
  }): Promise<SpecPackRow>;
  listSpecPacks(projectId: string): Promise<SpecPackRow[]>;
  getSpecPack(packId: string): Promise<SpecPackRow | null>;
  updateSpecPackGrouping(
    packId: string,
    groupKeys: string[],
    orderKey: string | null,
  ): Promise<SpecPackRow>;
  bindEffectiveVersion(packId: string, versionId: string): Promise<SpecPackRow>;
  insertStandardDoc(input: {
    pack_id: string;
    title: string;
    file_uri: string;
    doc_id?: string;
  }): Promise<StandardDocRow>;
  getStandardDoc(docId: string): Promise<StandardDocRow | null>;
  listStandardDocs(packId: string): Promise<StandardDocRow[]>;
  insertStandardVersion(input: {
    doc_id: string;
    status: string;
    version_id?: string;
  }): Promise<StandardVersionRow>;
  getStandardVersion(versionId: string): Promise<StandardVersionRow | null>;
  listStandardVersions(docId: string): Promise<StandardVersionRow[]>;
  listEffectiveStandardVersions(packId: string): Promise<StandardVersionRow[]>;
  updateStandardVersionStatus(versionId: string, status: string): Promise<StandardVersionRow>;
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
  }): Promise<ClauseRow>;
  getClause(clauseId: string): Promise<ClauseRow | null>;
  listClauses(versionId: string): Promise<ClauseRow[]>;
  insertStandardEdge(input: {
    from_clause_id: string;
    to_clause_id: string;
    kind: string;
  }): Promise<StandardEdgeRow>;
  listStandardEdges(fromClauseId?: string): Promise<StandardEdgeRow[]>;
  /**
   * Layout units are the ingest/search grain. Table/annex chunks stay here with
   * null clause_id so t_clause never receives a fabricated id.
   */
  insertLayoutUnit(input: LayoutUnitWrite): Promise<LayoutUnitRow>;
  getLayoutUnit(unitId: string): Promise<LayoutUnitRow | null>;
  listLayoutUnits(versionId: string): Promise<LayoutUnitRow[]>;
  /**
   * Auto PARENT_OF/BELONGS_TO/SUPPORTS live here so t_standard_edge stays
   * human-edited CITES/SUPERSEDES.
   */
  insertLayoutEdge(input: LayoutEdgeWrite): Promise<LayoutEdgeRow>;
  /**
   * Inserts the run and N pending pages together. Later ticks can set
   * index_error (vector upsert failed) without confusing it with ocr_error.
   */
  insertIngestRun(input: IngestRunWrite): Promise<IngestRunRow>;
  listIngestPages(ingestRunId: string): Promise<IngestPageRow[]>;
  /**
   * index_error means Qdrant upsert failed after OCR succeeded; ocr_error is a
   * different recovery path and must not be reused for indexing failures (R28).
   */
  updateIngestPage(input: IngestPageUpdate): Promise<IngestPageRow>;
  getDocType(docTypeId: string): Promise<DocTypeRow | null>;
  listDocTypesByPack(packId: string): Promise<DocTypeRow[]>;
  insertDocType(input: {
    pack_id: string;
    name: string;
    parent_doc_type_id?: string | null;
    doc_type_id?: string;
  }): Promise<DocTypeRow>;
  updateDocTypeName(docTypeId: string, name: string): Promise<DocTypeRow>;
  softDeleteDocType(docTypeId: string): Promise<DocTypeRow>;
  listFieldDefs(docTypeId: string): Promise<FieldDefRow[]>;
  saveFieldDefs(
    docTypeId: string,
    defs: Array<{ field_key: string; value_type: string; required?: number }>,
  ): Promise<FieldDefRow[]>;
  listEffectiveFieldDefs(docTypeId: string): Promise<FieldDefRow[]>;
  listTemplatesByDocType(docTypeId: string): Promise<TemplateRow[]>;
  insertTemplate(input: {
    pack_id: string;
    name: string;
    page_image_uri?: string | null;
    doc_type_id?: string;
    layout_kind?: string;
    excel_template_uri?: string | null;
    excel_sheet_name?: string | null;
  }): Promise<TemplateRow>;
  updateTemplateExcel(
    templateId: string,
    input: {
      layout_kind?: string;
      excel_template_uri?: string | null;
      excel_sheet_name?: string | null;
    },
  ): Promise<TemplateRow>;
  saveFieldBoxes(templateId: string, boxes: FieldBoxWrite[]): Promise<FieldBoxRow[]>;
  listFieldBoxes(templateId: string): Promise<FieldBoxRow[]>;
  listPublishedRuleVersions(): Promise<RuleVersionRow[]>;
  getRuleVersionByRuleId(ruleId: string): Promise<RuleVersionRow | null>;
  getRuleVersion(versionId: string): Promise<RuleVersionRow | null>;
  insertRule(input: { pack_id: string; title: string | null }): Promise<RuleRow>;
  insertDraftRuleVersion(input: {
    rule_id: string;
    dsl_json: string;
    blocking: number;
  }): Promise<RuleVersionRow>;
  updateRuleVersionStatus(versionId: string, status: string): Promise<RuleVersionRow>;
  insertRuleFixture(input: {
    version_id: string;
    kind: string;
    payload_json: string;
  }): Promise<RuleFixtureRow>;
  listRuleFixtures(versionId: string): Promise<RuleFixtureRow[]>;
  updateFixtureLastResult(id: number, lastResult: string): Promise<RuleFixtureRow>;
  insertProject(name: string): Promise<ProjectRow>;
  listProjects(): Promise<ProjectRow[]>;
  getProject(projectId: string): Promise<ProjectRow | null>;
  updateProjectName(projectId: string, name: string): Promise<ProjectRow>;
  softDeleteProject(projectId: string): Promise<ProjectRow>;
  updateSpecPackName(packId: string, name: string): Promise<SpecPackRow>;
  softDeleteSpecPack(packId: string): Promise<SpecPackRow>;
  countJobsByPack(packId: string): Promise<number>;
  getTemplate(templateId: string): Promise<TemplateRow | null>;
  listTemplates(packId: string): Promise<TemplateRow[]>;
  /**
   * WHY: HTTP findings lists pass `{ track: "legacy" }` so Skill-track rows
   * stay out of check_findings / pending_review / volume_preview (M16).
   * Omit the filter only for internal callers that still need both tracks.
   */
  listJobs(filter?: ListJobsFilter): Promise<JobRow[]>;
  getDocumentForJob(jobId: string): Promise<DocumentRow | null>;
  getExtraction(jobId: string): Promise<ExtractionRow | null>;
  listThreads(traceId: string): Promise<ConversationThreadRow[]>;
  listMessagesByTrace(traceId: string): Promise<ConversationMessageRow[]>;
  /**
   * Persist a job. Default track is leftover `legacy`; Skill uploads pass `skill`
   * so later findings lists can hide them without rewriting historical rows.
   */
  insertJob(input: {
    project_id: string;
    pack_id: string | null;
    status: string;
    template_id?: string | null;
    doc_type_id?: string | null;
    track?: JobTrack;
    skill_draft_id?: string | null;
  }): Promise<JobRow>;
  updateJobStatus(jobId: string, status: string): Promise<JobRow>;
  updateJobAgentRunId(jobId: string, agentRunId: string): Promise<JobRow>;
  getJob(jobId: string): Promise<JobRow | null>;
  getJobByTrace(traceId: string): Promise<JobRow | null>;
  insertDocument(input: {
    job_id: string;
    file_name: string;
    file_uri: string;
    mime: string | null;
  }): Promise<DocumentRow>;
  insertExtraction(input: {
    job_id: string;
    ocr_text: string | null;
    fields: Record<string, unknown>;
  }): Promise<ExtractionRow>;
  listExtractions(jobId: string): Promise<ExtractionRow[]>;
  insertVolumePreview(input: { job_id: string; tree: unknown }): Promise<VolumePreviewRow>;
  getVolumePreviewById(previewId: string): Promise<VolumePreviewRow | null>;
  getVolumePreview(jobId: string): Promise<VolumePreviewRow | null>;
  insertFinding(input: {
    job_id: string;
    rule_version_id: string;
    result: string;
    blocking: number;
    detail: string | null;
    clause_id?: string | null;
    standard_version_id?: string | null;
    retrieve_path?: string | null;
  }): Promise<FindingRow>;
  listFindings(jobId: string): Promise<FindingRow[]>;
  insertProposal(input: {
    job_id: string;
    wording: string;
    status?: string;
    agent_run_id?: string | null;
  }): Promise<ProposalRow>;
  getProposal(proposalId: string): Promise<ProposalRow | null>;
  updateProposalWording(proposalId: string, wording: string): Promise<ProposalRow>;
  updateProposalStatus(proposalId: string, status: string): Promise<ProposalRow>;
  listPendingProposals(jobId?: string): Promise<ProposalRow[]>;
  insertReceipt(input: {
    proposal_id: string | null;
    job_id: string;
    status?: string;
    payload?: unknown;
  }): Promise<ReceiptRow>;
  getReceipt(receiptId: string): Promise<ReceiptRow | null>;
  listReceipts(jobId?: string): Promise<ReceiptRow[]>;
  listReceiptsByProposal(proposalId: string): Promise<ReceiptRow[]>;
  appendAudit(input: {
    trace_id: string;
    event_type: string;
    ref_id: string | null;
    payload: unknown;
  }): Promise<AuditEventRow>;
  listAudit(traceId: string): Promise<AuditEventRow[]>;
  getThread(traceId: string, step: string): Promise<ConversationThreadRow | null>;
  insertThread(input: {
    trace_id: string;
    step: string;
    job_id: string | null;
  }): Promise<ConversationThreadRow>;
  insertMessage(input: {
    thread_id: string;
    role: string;
    body: string;
  }): Promise<ConversationMessageRow>;
  listMessages(traceId: string, step: string): Promise<ConversationMessageRow[]>;
  listExcelCellMappings(templateId: string): Promise<ExcelCellMappingRow[]>;
  getExcelCellMapping(mappingId: string): Promise<ExcelCellMappingRow | null>;
  saveExcelCellMappings(
    templateId: string,
    mappings: ExcelCellMappingWrite[],
  ): Promise<ExcelCellMappingRow[]>;
  softDeleteExcelCellMapping(mappingId: string): Promise<ExcelCellMappingRow>;
  listFieldFillRules(docTypeId: string): Promise<FieldFillRuleRow[]>;
  getFieldFillRule(docTypeId: string, fieldKey: string): Promise<FieldFillRuleRow | null>;
  saveFieldFillRules(docTypeId: string, rules: FieldFillRuleWrite[]): Promise<FieldFillRuleRow[]>;
  insertDocumentArtifact(input: {
    project_id: string;
    doc_type_id: string;
    template_id: string;
    file_uri: string;
    status?: string;
    trace_id: string;
    metadata?: unknown;
    artifact_id?: string;
  }): Promise<DocumentArtifactRow>;
  getDocumentArtifact(artifactId: string): Promise<DocumentArtifactRow | null>;
  listDocumentArtifacts(projectId: string, docTypeId?: string): Promise<DocumentArtifactRow[]>;
  updateDocumentArtifact(
    artifactId: string,
    input: {
      adapter_document_id?: string | null;
      status?: string;
      receipt_id?: string | null;
      metadata?: unknown;
    },
  ): Promise<DocumentArtifactRow>;
  insertSignatureTask(input: {
    artifact_id: string;
    role: string;
    assignee_label?: string | null;
    status?: string;
    trace_id: string;
    task_id?: string;
  }): Promise<SignatureTaskRow>;
  getSignatureTask(taskId: string): Promise<SignatureTaskRow | null>;
  listSignatureTasksByArtifact(artifactId: string): Promise<SignatureTaskRow[]>;
  listPendingSignatureTasks(): Promise<SignatureTaskRow[]>;
  updateSignatureTask(
    taskId: string,
    input: {
      status?: string;
      signer_name?: string | null;
      receipt_id?: string | null;
    },
  ): Promise<SignatureTaskRow>;
  listCompletenessRules(packId: string): Promise<CompletenessRuleRow[]>;
  getCompletenessRule(ruleId: string): Promise<CompletenessRuleRow | null>;
  saveCompletenessRules(
    packId: string,
    rules: CompletenessRuleWrite[],
  ): Promise<CompletenessRuleRow[]>;
  softDeleteCompletenessRule(ruleId: string): Promise<CompletenessRuleRow>;
  /** Pack-scoped Skill index; uniqueness is (pack_id, canonical_name), not global name. */
  insertSkillRecord(input: SkillRecordWrite): Promise<SkillRecordRow>;
  getSkillRecord(skillId: string): Promise<SkillRecordRow | null>;
  getSkillRecordByPackName(packId: string, canonicalName: string): Promise<SkillRecordRow | null>;
  listSkillRecords(packId: string): Promise<SkillRecordRow[]>;
  /**
   * WHY: confirm overlays this pack's live JSON (same skill_id, version++).
   * Insert-conflict reuse without update would ignore the latest teach (R13).
   */
  updateSkillRecord(skillId: string, input: SkillRecordUpdate): Promise<SkillRecordRow>;
  /** Chat writes drafts only; confirm-skill later copies into t_skill_record. */
  insertSkillDraft(input: SkillDraftWrite): Promise<SkillDraftRow>;
  getSkillDraft(draftId: string): Promise<SkillDraftRow | null>;
  getSkillDraftByJob(jobId: string): Promise<SkillDraftRow | null>;
  updateSkillDraft(draftId: string, input: SkillDraftUpdate): Promise<SkillDraftRow>;
  /** Internal processing ledger; Skill path must not reuse t_document_artifact. */
  insertSkillLedger(input: SkillLedgerWrite): Promise<SkillLedgerRow>;
  getSkillLedger(ledgerId: string): Promise<SkillLedgerRow | null>;
  listSkillLedgersByJob(jobId: string): Promise<SkillLedgerRow[]>;
}

export class SqliteLedger implements LedgerStore {
  constructor(private readonly inner: CoreEngineStore) {}

  close(): Promise<void> {
    return Promise.resolve(this.inner.close());
  }

  wipeLedger(): Promise<void> {
    // sqlite tests use :memory:; DELETE all LEDGER_TABLES rows to match the contract.
    const db = (this.inner as unknown as { db: { exec: (sql: string) => void } }).db;
    db.exec(LEDGER_TABLES.map((table) => `DELETE FROM ${table};`).join("\n"));
    return Promise.resolve();
  }

  seedPublishedRules(): Promise<void> {
    return Promise.resolve(this.inner.seedPublishedRules());
  }

  insertSpecPack(input: {
    project_id: string;
    name: string;
    version: string;
    pack_id?: string;
  }): Promise<SpecPackRow> {
    return Promise.resolve(this.inner.insertSpecPack(input));
  }

  listSpecPacks(projectId: string): Promise<SpecPackRow[]> {
    return Promise.resolve(this.inner.listSpecPacks(projectId));
  }

  getSpecPack(packId: string): Promise<SpecPackRow | null> {
    return Promise.resolve(this.inner.getSpecPack(packId));
  }

  updateSpecPackGrouping(
    packId: string,
    groupKeys: string[],
    orderKey: string | null,
  ): Promise<SpecPackRow> {
    return Promise.resolve(this.inner.updateSpecPackGrouping(packId, groupKeys, orderKey));
  }

  bindEffectiveVersion(packId: string, versionId: string): Promise<SpecPackRow> {
    return Promise.resolve(this.inner.bindEffectiveVersion(packId, versionId));
  }

  insertStandardDoc(input: {
    pack_id: string;
    title: string;
    file_uri: string;
    doc_id?: string;
  }): Promise<StandardDocRow> {
    return Promise.resolve(this.inner.insertStandardDoc(input));
  }

  getStandardDoc(docId: string): Promise<StandardDocRow | null> {
    return Promise.resolve(this.inner.getStandardDoc(docId));
  }

  listStandardDocs(packId: string): Promise<StandardDocRow[]> {
    return Promise.resolve(this.inner.listStandardDocs(packId));
  }

  insertStandardVersion(input: {
    doc_id: string;
    status: string;
    version_id?: string;
  }): Promise<StandardVersionRow> {
    return Promise.resolve(this.inner.insertStandardVersion(input));
  }

  getStandardVersion(versionId: string): Promise<StandardVersionRow | null> {
    return Promise.resolve(this.inner.getStandardVersion(versionId));
  }

  listStandardVersions(docId: string): Promise<StandardVersionRow[]> {
    return Promise.resolve(this.inner.listStandardVersions(docId));
  }

  listEffectiveStandardVersions(packId: string): Promise<StandardVersionRow[]> {
    return Promise.resolve(this.inner.listEffectiveStandardVersions(packId));
  }

  updateStandardVersionStatus(versionId: string, status: string): Promise<StandardVersionRow> {
    return Promise.resolve(this.inner.updateStandardVersionStatus(versionId, status));
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
  }): Promise<ClauseRow> {
    return Promise.resolve(this.inner.insertClause(input));
  }

  getClause(clauseId: string): Promise<ClauseRow | null> {
    return Promise.resolve(this.inner.getClause(clauseId));
  }

  listClauses(versionId: string): Promise<ClauseRow[]> {
    return Promise.resolve(this.inner.listClauses(versionId));
  }

  insertStandardEdge(input: {
    from_clause_id: string;
    to_clause_id: string;
    kind: string;
  }): Promise<StandardEdgeRow> {
    return Promise.resolve(this.inner.insertStandardEdge(input));
  }

  listStandardEdges(fromClauseId?: string): Promise<StandardEdgeRow[]> {
    return Promise.resolve(this.inner.listStandardEdges(fromClauseId));
  }

  insertLayoutUnit(input: LayoutUnitWrite): Promise<LayoutUnitRow> {
    return Promise.resolve(this.inner.insertLayoutUnit(input));
  }

  getLayoutUnit(unitId: string): Promise<LayoutUnitRow | null> {
    return Promise.resolve(this.inner.getLayoutUnit(unitId));
  }

  listLayoutUnits(versionId: string): Promise<LayoutUnitRow[]> {
    return Promise.resolve(this.inner.listLayoutUnits(versionId));
  }

  insertLayoutEdge(input: LayoutEdgeWrite): Promise<LayoutEdgeRow> {
    return Promise.resolve(this.inner.insertLayoutEdge(input));
  }

  insertIngestRun(input: IngestRunWrite): Promise<IngestRunRow> {
    return Promise.resolve(this.inner.insertIngestRun(input));
  }

  listIngestPages(ingestRunId: string): Promise<IngestPageRow[]> {
    return Promise.resolve(this.inner.listIngestPages(ingestRunId));
  }

  updateIngestPage(input: IngestPageUpdate): Promise<IngestPageRow> {
    return Promise.resolve(this.inner.updateIngestPage(input));
  }

  getDocType(docTypeId: string): Promise<DocTypeRow | null> {
    return Promise.resolve(this.inner.getDocType(docTypeId));
  }

  listDocTypesByPack(packId: string): Promise<DocTypeRow[]> {
    return Promise.resolve(this.inner.listDocTypesByPack(packId));
  }

  insertDocType(input: {
    pack_id: string;
    name: string;
    parent_doc_type_id?: string | null;
    doc_type_id?: string;
  }): Promise<DocTypeRow> {
    return Promise.resolve(this.inner.insertDocType(input));
  }

  updateDocTypeName(docTypeId: string, name: string): Promise<DocTypeRow> {
    return Promise.resolve(this.inner.updateDocTypeName(docTypeId, name));
  }

  softDeleteDocType(docTypeId: string): Promise<DocTypeRow> {
    return Promise.resolve(this.inner.softDeleteDocType(docTypeId));
  }

  listFieldDefs(docTypeId: string): Promise<FieldDefRow[]> {
    return Promise.resolve(this.inner.listFieldDefs(docTypeId));
  }

  saveFieldDefs(
    docTypeId: string,
    defs: Array<{ field_key: string; value_type: string; required?: number }>,
  ): Promise<FieldDefRow[]> {
    return Promise.resolve(this.inner.saveFieldDefs(docTypeId, defs));
  }

  listEffectiveFieldDefs(docTypeId: string): Promise<FieldDefRow[]> {
    return Promise.resolve(this.inner.listEffectiveFieldDefs(docTypeId));
  }

  listTemplatesByDocType(docTypeId: string): Promise<TemplateRow[]> {
    return Promise.resolve(this.inner.listTemplatesByDocType(docTypeId));
  }

  insertTemplate(input: {
    pack_id: string;
    name: string;
    page_image_uri?: string | null;
    doc_type_id?: string;
    layout_kind?: string;
    excel_template_uri?: string | null;
    excel_sheet_name?: string | null;
  }): Promise<TemplateRow> {
    return Promise.resolve(this.inner.insertTemplate(input));
  }

  updateTemplateExcel(
    templateId: string,
    input: {
      layout_kind?: string;
      excel_template_uri?: string | null;
      excel_sheet_name?: string | null;
    },
  ): Promise<TemplateRow> {
    return Promise.resolve(this.inner.updateTemplateExcel(templateId, input));
  }

  saveFieldBoxes(templateId: string, boxes: FieldBoxWrite[]): Promise<FieldBoxRow[]> {
    return Promise.resolve(this.inner.saveFieldBoxes(templateId, boxes));
  }

  listFieldBoxes(templateId: string): Promise<FieldBoxRow[]> {
    return Promise.resolve(this.inner.listFieldBoxes(templateId));
  }

  listPublishedRuleVersions(): Promise<RuleVersionRow[]> {
    return Promise.resolve(this.inner.listPublishedRuleVersions());
  }

  getRuleVersionByRuleId(ruleId: string): Promise<RuleVersionRow | null> {
    return Promise.resolve(this.inner.getRuleVersionByRuleId(ruleId));
  }

  getRuleVersion(versionId: string): Promise<RuleVersionRow | null> {
    return Promise.resolve(this.inner.getRuleVersion(versionId));
  }

  insertRule(input: { pack_id: string; title: string | null }): Promise<RuleRow> {
    return Promise.resolve(this.inner.insertRule(input));
  }

  insertDraftRuleVersion(input: {
    rule_id: string;
    dsl_json: string;
    blocking: number;
  }): Promise<RuleVersionRow> {
    return Promise.resolve(this.inner.insertDraftRuleVersion(input));
  }

  updateRuleVersionStatus(versionId: string, status: string): Promise<RuleVersionRow> {
    return Promise.resolve(this.inner.updateRuleVersionStatus(versionId, status));
  }

  insertRuleFixture(input: {
    version_id: string;
    kind: string;
    payload_json: string;
  }): Promise<RuleFixtureRow> {
    return Promise.resolve(this.inner.insertRuleFixture(input));
  }

  listRuleFixtures(versionId: string): Promise<RuleFixtureRow[]> {
    return Promise.resolve(this.inner.listRuleFixtures(versionId));
  }

  updateFixtureLastResult(id: number, lastResult: string): Promise<RuleFixtureRow> {
    return Promise.resolve(this.inner.updateFixtureLastResult(id, lastResult));
  }

  insertProject(name: string): Promise<ProjectRow> {
    return Promise.resolve(this.inner.insertProject(name));
  }

  listProjects(): Promise<ProjectRow[]> {
    return Promise.resolve(this.inner.listProjects());
  }

  getProject(projectId: string): Promise<ProjectRow | null> {
    return Promise.resolve(this.inner.getProject(projectId));
  }

  updateProjectName(projectId: string, name: string): Promise<ProjectRow> {
    return Promise.resolve(this.inner.updateProjectName(projectId, name));
  }

  softDeleteProject(projectId: string): Promise<ProjectRow> {
    return Promise.resolve(this.inner.softDeleteProject(projectId));
  }

  updateSpecPackName(packId: string, name: string): Promise<SpecPackRow> {
    return Promise.resolve(this.inner.updateSpecPackName(packId, name));
  }

  softDeleteSpecPack(packId: string): Promise<SpecPackRow> {
    return Promise.resolve(this.inner.softDeleteSpecPack(packId));
  }

  countJobsByPack(packId: string): Promise<number> {
    return Promise.resolve(this.inner.countJobsByPack(packId));
  }

  getTemplate(templateId: string): Promise<TemplateRow | null> {
    return Promise.resolve(this.inner.getTemplate(templateId));
  }

  listTemplates(packId: string): Promise<TemplateRow[]> {
    return Promise.resolve(this.inner.listTemplates(packId));
  }

  /**
   * WHY: same as LedgerStore.listJobs — HTTP findings default to leftover
   * `legacy`; unfiltered reads are for pipeline internals, not those pages.
   */
  listJobs(filter?: ListJobsFilter): Promise<JobRow[]> {
    return Promise.resolve(this.inner.listJobs(filter));
  }

  getDocumentForJob(jobId: string): Promise<DocumentRow | null> {
    return Promise.resolve(this.inner.getDocumentForJob(jobId));
  }

  getExtraction(jobId: string): Promise<ExtractionRow | null> {
    return Promise.resolve(this.inner.getExtraction(jobId));
  }

  listThreads(traceId: string): Promise<ConversationThreadRow[]> {
    return Promise.resolve(this.inner.listThreads(traceId));
  }

  listMessagesByTrace(traceId: string): Promise<ConversationMessageRow[]> {
    return Promise.resolve(this.inner.listMessagesByTrace(traceId));
  }

  insertJob(input: {
    project_id: string;
    pack_id: string | null;
    status: string;
    template_id?: string | null;
    doc_type_id?: string | null;
    track?: JobTrack;
    skill_draft_id?: string | null;
  }): Promise<JobRow> {
    return Promise.resolve(this.inner.insertJob(input));
  }

  updateJobStatus(jobId: string, status: string): Promise<JobRow> {
    return Promise.resolve(this.inner.updateJobStatus(jobId, status));
  }
  updateJobAgentRunId(jobId: string, agentRunId: string): Promise<JobRow> {
    return Promise.resolve(this.inner.updateJobAgentRunId(jobId, agentRunId));
  }

  getJob(jobId: string): Promise<JobRow | null> {
    return Promise.resolve(this.inner.getJob(jobId));
  }

  getJobByTrace(traceId: string): Promise<JobRow | null> {
    return Promise.resolve(this.inner.getJobByTrace(traceId));
  }

  insertDocument(input: {
    job_id: string;
    file_name: string;
    file_uri: string;
    mime: string | null;
  }): Promise<DocumentRow> {
    return Promise.resolve(this.inner.insertDocument(input));
  }

  insertExtraction(input: {
    job_id: string;
    ocr_text: string | null;
    fields: Record<string, unknown>;
  }): Promise<ExtractionRow> {
    return Promise.resolve(this.inner.insertExtraction(input));
  }

  listExtractions(jobId: string): Promise<ExtractionRow[]> {
    return Promise.resolve(this.inner.listExtractions(jobId));
  }

  insertVolumePreview(input: { job_id: string; tree: unknown }): Promise<VolumePreviewRow> {
    return Promise.resolve(this.inner.insertVolumePreview(input));
  }

  getVolumePreviewById(previewId: string): Promise<VolumePreviewRow | null> {
    return Promise.resolve(this.inner.getVolumePreviewById(previewId));
  }

  getVolumePreview(jobId: string): Promise<VolumePreviewRow | null> {
    return Promise.resolve(this.inner.getVolumePreview(jobId));
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
  }): Promise<FindingRow> {
    return Promise.resolve(this.inner.insertFinding(input));
  }

  listFindings(jobId: string): Promise<FindingRow[]> {
    return Promise.resolve(this.inner.listFindings(jobId));
  }

  insertProposal(input: {
    job_id: string;
    wording: string;
    status?: string;
    agent_run_id?: string | null;
  }): Promise<ProposalRow> {
    return Promise.resolve(this.inner.insertProposal(input));
  }

  getProposal(proposalId: string): Promise<ProposalRow | null> {
    return Promise.resolve(this.inner.getProposal(proposalId));
  }

  updateProposalWording(proposalId: string, wording: string): Promise<ProposalRow> {
    return Promise.resolve(this.inner.updateProposalWording(proposalId, wording));
  }

  updateProposalStatus(proposalId: string, status: string): Promise<ProposalRow> {
    return Promise.resolve(this.inner.updateProposalStatus(proposalId, status));
  }

  listPendingProposals(jobId?: string): Promise<ProposalRow[]> {
    return Promise.resolve(this.inner.listPendingProposals(jobId));
  }

  insertReceipt(input: {
    proposal_id: string | null;
    job_id: string;
    status?: string;
    payload?: unknown;
  }): Promise<ReceiptRow> {
    return Promise.resolve(this.inner.insertReceipt(input));
  }

  getReceipt(receiptId: string): Promise<ReceiptRow | null> {
    return Promise.resolve(this.inner.getReceipt(receiptId));
  }

  listReceipts(jobId?: string): Promise<ReceiptRow[]> {
    return Promise.resolve(this.inner.listReceipts(jobId));
  }

  listReceiptsByProposal(proposalId: string): Promise<ReceiptRow[]> {
    return Promise.resolve(this.inner.listReceiptsByProposal(proposalId));
  }

  appendAudit(input: {
    trace_id: string;
    event_type: string;
    ref_id: string | null;
    payload: unknown;
  }): Promise<AuditEventRow> {
    return Promise.resolve(this.inner.appendAudit(input));
  }

  listAudit(traceId: string): Promise<AuditEventRow[]> {
    return Promise.resolve(this.inner.listAudit(traceId));
  }

  getThread(traceId: string, step: string): Promise<ConversationThreadRow | null> {
    return Promise.resolve(this.inner.getThread(traceId, step));
  }

  insertThread(input: {
    trace_id: string;
    step: string;
    job_id: string | null;
  }): Promise<ConversationThreadRow> {
    return Promise.resolve(this.inner.insertThread(input));
  }

  insertMessage(input: {
    thread_id: string;
    role: string;
    body: string;
  }): Promise<ConversationMessageRow> {
    return Promise.resolve(this.inner.insertMessage(input));
  }

  listMessages(traceId: string, step: string): Promise<ConversationMessageRow[]> {
    return Promise.resolve(this.inner.listMessages(traceId, step));
  }

  listExcelCellMappings(templateId: string): Promise<ExcelCellMappingRow[]> {
    return Promise.resolve(this.inner.listExcelCellMappings(templateId));
  }

  getExcelCellMapping(mappingId: string): Promise<ExcelCellMappingRow | null> {
    return Promise.resolve(this.inner.getExcelCellMapping(mappingId));
  }

  saveExcelCellMappings(
    templateId: string,
    mappings: ExcelCellMappingWrite[],
  ): Promise<ExcelCellMappingRow[]> {
    return Promise.resolve(this.inner.saveExcelCellMappings(templateId, mappings));
  }

  softDeleteExcelCellMapping(mappingId: string): Promise<ExcelCellMappingRow> {
    return Promise.resolve(this.inner.softDeleteExcelCellMapping(mappingId));
  }

  listFieldFillRules(docTypeId: string): Promise<FieldFillRuleRow[]> {
    return Promise.resolve(this.inner.listFieldFillRules(docTypeId));
  }

  getFieldFillRule(docTypeId: string, fieldKey: string): Promise<FieldFillRuleRow | null> {
    return Promise.resolve(this.inner.getFieldFillRule(docTypeId, fieldKey));
  }

  saveFieldFillRules(docTypeId: string, rules: FieldFillRuleWrite[]): Promise<FieldFillRuleRow[]> {
    return Promise.resolve(this.inner.saveFieldFillRules(docTypeId, rules));
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
  }): Promise<DocumentArtifactRow> {
    return Promise.resolve(this.inner.insertDocumentArtifact(input));
  }

  getDocumentArtifact(artifactId: string): Promise<DocumentArtifactRow | null> {
    return Promise.resolve(this.inner.getDocumentArtifact(artifactId));
  }

  listDocumentArtifacts(projectId: string, docTypeId?: string): Promise<DocumentArtifactRow[]> {
    return Promise.resolve(this.inner.listDocumentArtifacts(projectId, docTypeId));
  }

  updateDocumentArtifact(
    artifactId: string,
    input: {
      adapter_document_id?: string | null;
      status?: string;
      receipt_id?: string | null;
      metadata?: unknown;
    },
  ): Promise<DocumentArtifactRow> {
    return Promise.resolve(this.inner.updateDocumentArtifact(artifactId, input));
  }

  insertSignatureTask(input: {
    artifact_id: string;
    role: string;
    assignee_label?: string | null;
    status?: string;
    trace_id: string;
    task_id?: string;
  }): Promise<SignatureTaskRow> {
    return Promise.resolve(this.inner.insertSignatureTask(input));
  }

  getSignatureTask(taskId: string): Promise<SignatureTaskRow | null> {
    return Promise.resolve(this.inner.getSignatureTask(taskId));
  }

  listSignatureTasksByArtifact(artifactId: string): Promise<SignatureTaskRow[]> {
    return Promise.resolve(this.inner.listSignatureTasksByArtifact(artifactId));
  }

  listPendingSignatureTasks(): Promise<SignatureTaskRow[]> {
    return Promise.resolve(this.inner.listPendingSignatureTasks());
  }

  updateSignatureTask(
    taskId: string,
    input: {
      status?: string;
      signer_name?: string | null;
      receipt_id?: string | null;
    },
  ): Promise<SignatureTaskRow> {
    return Promise.resolve(this.inner.updateSignatureTask(taskId, input));
  }

  listCompletenessRules(packId: string): Promise<CompletenessRuleRow[]> {
    return Promise.resolve(this.inner.listCompletenessRules(packId));
  }

  getCompletenessRule(ruleId: string): Promise<CompletenessRuleRow | null> {
    return Promise.resolve(this.inner.getCompletenessRule(ruleId));
  }

  saveCompletenessRules(
    packId: string,
    rules: CompletenessRuleWrite[],
  ): Promise<CompletenessRuleRow[]> {
    return Promise.resolve(this.inner.saveCompletenessRules(packId, rules));
  }

  softDeleteCompletenessRule(ruleId: string): Promise<CompletenessRuleRow> {
    return Promise.resolve(this.inner.softDeleteCompletenessRule(ruleId));
  }

  async insertSkillRecord(input: SkillRecordWrite): Promise<SkillRecordRow> {
    return this.inner.insertSkillRecord(input);
  }

  /**
   * WHY: confirm overlays this pack's live JSON (same skill_id, version++).
   * Insert-conflict reuse without update would ignore the latest teach (R13).
   */
  updateSkillRecord(skillId: string, input: SkillRecordUpdate): Promise<SkillRecordRow> {
    return Promise.resolve(this.inner.updateSkillRecord(skillId, input));
  }

  getSkillRecord(skillId: string): Promise<SkillRecordRow | null> {
    return Promise.resolve(this.inner.getSkillRecord(skillId));
  }

  getSkillRecordByPackName(packId: string, canonicalName: string): Promise<SkillRecordRow | null> {
    return Promise.resolve(this.inner.getSkillRecordByPackName(packId, canonicalName));
  }

  listSkillRecords(packId: string): Promise<SkillRecordRow[]> {
    return Promise.resolve(this.inner.listSkillRecords(packId));
  }

  async insertSkillDraft(input: SkillDraftWrite): Promise<SkillDraftRow> {
    return this.inner.insertSkillDraft(input);
  }

  getSkillDraft(draftId: string): Promise<SkillDraftRow | null> {
    return Promise.resolve(this.inner.getSkillDraft(draftId));
  }

  getSkillDraftByJob(jobId: string): Promise<SkillDraftRow | null> {
    return Promise.resolve(this.inner.getSkillDraftByJob(jobId));
  }

  updateSkillDraft(draftId: string, input: SkillDraftUpdate): Promise<SkillDraftRow> {
    return Promise.resolve(this.inner.updateSkillDraft(draftId, input));
  }

  insertSkillLedger(input: SkillLedgerWrite): Promise<SkillLedgerRow> {
    return Promise.resolve(this.inner.insertSkillLedger(input));
  }

  getSkillLedger(ledgerId: string): Promise<SkillLedgerRow | null> {
    return Promise.resolve(this.inner.getSkillLedger(ledgerId));
  }

  listSkillLedgersByJob(jobId: string): Promise<SkillLedgerRow[]> {
    return Promise.resolve(this.inner.listSkillLedgersByJob(jobId));
  }
}
