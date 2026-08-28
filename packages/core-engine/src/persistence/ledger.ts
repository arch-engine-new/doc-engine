/**
 * WHY: Postgres is async; tests keep better-sqlite3; one interface prevents silent dual ledgers.
 *
 * LedgerStore matches CoreEngineStore public methods, each returning Promise<T>.
 * SqliteLedger wraps the sync store with Promise.resolve — no deasync, no second schema.
 */

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
import { CoreEngineStore, type FieldBoxWrite } from "./store.js";

export interface LedgerStore {
  close(): Promise<void>;
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
  }): Promise<ClauseRow>;
  getClause(clauseId: string): Promise<ClauseRow | null>;
  listClauses(versionId: string): Promise<ClauseRow[]>;
  insertStandardEdge(input: {
    from_clause_id: string;
    to_clause_id: string;
    kind: string;
  }): Promise<StandardEdgeRow>;
  listStandardEdges(fromClauseId?: string): Promise<StandardEdgeRow[]>;
  insertTemplate(input: {
    pack_id: string;
    name: string;
    page_image_uri?: string | null;
  }): Promise<TemplateRow>;
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
  getTemplate(templateId: string): Promise<TemplateRow | null>;
  listTemplates(packId: string): Promise<TemplateRow[]>;
  listJobs(): Promise<JobRow[]>;
  getDocumentForJob(jobId: string): Promise<DocumentRow | null>;
  getExtraction(jobId: string): Promise<ExtractionRow | null>;
  listThreads(traceId: string): Promise<ConversationThreadRow[]>;
  listMessagesByTrace(traceId: string): Promise<ConversationMessageRow[]>;
  insertJob(input: {
    project_id: string;
    pack_id: string | null;
    status: string;
    template_id?: string | null;
  }): Promise<JobRow>;
  updateJobStatus(jobId: string, status: string): Promise<JobRow>;
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
}

export class SqliteLedger implements LedgerStore {
  constructor(private readonly inner: CoreEngineStore) {}

  close(): Promise<void> {
    return Promise.resolve(this.inner.close());
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

  insertTemplate(input: {
    pack_id: string;
    name: string;
    page_image_uri?: string | null;
  }): Promise<TemplateRow> {
    return Promise.resolve(this.inner.insertTemplate(input));
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

  getTemplate(templateId: string): Promise<TemplateRow | null> {
    return Promise.resolve(this.inner.getTemplate(templateId));
  }

  listTemplates(packId: string): Promise<TemplateRow[]> {
    return Promise.resolve(this.inner.listTemplates(packId));
  }

  listJobs(): Promise<JobRow[]> {
    return Promise.resolve(this.inner.listJobs());
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
  }): Promise<JobRow> {
    return Promise.resolve(this.inner.insertJob(input));
  }

  updateJobStatus(jobId: string, status: string): Promise<JobRow> {
    return Promise.resolve(this.inner.updateJobStatus(jobId, status));
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
}
