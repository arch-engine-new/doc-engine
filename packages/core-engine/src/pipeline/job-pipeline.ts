/**
 * Walking-skeleton job pipeline: fixture upload → extract JSON → R1/R2 → findings + audit.
 * Chat is HITL-only: persists messages, does not change job.status, does not write Receipt.
 */

import Database from "better-sqlite3";
import type { BlobStore } from "../blob/port.js";
import { blobObjectUri, uploadObjectKey } from "../blob/minio.js";
import { extractByTemplate } from "../extract/field-box.js";
import { extractOcrByTemplate, parseOcrFields } from "../extract/ocr-fields.js";
import type { OcrPort } from "../ocr/port.js";
import { SqliteLedger, type LedgerStore } from "../persistence/ledger.js";
import { resolveEngineMode } from "../persistence/live-env.js";
import { runMigrationOnDb } from "../persistence/migrate.js";
import { runPgMigration } from "../persistence/pg-migrate.js";
import { PostgresLedger } from "../persistence/pg-store.js";
import { CoreEngineStore, type FieldBoxWrite } from "../persistence/store.js";
import { evaluate, RuleInterpreter } from "../rules/interpreter.js";
import {
  RulePublisher,
  type AddFixtureInput,
  type PublishResult,
  type SaveDraftInput,
  type SaveDraftResult,
} from "../rules/publish.js";
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
  RuleVersionRow,
  SpecPackRow,
  StandardVersionRow,
  TemplateRow,
  VolumePreviewRow,
} from "../types.js";
import { PACK_ID, fieldsForKind, type FixtureKind } from "./seed.js";
import {
  ReviewDesk,
  type CheckWordingInput,
  type ConfirmProposalResult,
} from "./review.js";
import {
  VolumeDesk,
  type PreviewVolumeResult,
} from "./volume.js";
import {
  StandardLibrary,
  type AddStandardEdgeInput,
  type AttachStandardFitInput,
  type IngestStandardInput,
  type IngestStandardResult,
  type SearchStandardInput,
} from "../retrieve/library.js";
import { liveRetrievePorts } from "../retrieve/live-ports.js";
import type { RetrieveHit, RetrievePorts } from "../retrieve/ports.js";

export interface FixtureJobResult {
  project: ProjectRow;
  job: JobRow;
  document: DocumentRow;
  extraction: ExtractionRow;
  findings: FindingRow[];
}

export interface AppendChatInput {
  traceId: string;
  step: string;
  body: string;
  role?: string;
}

export interface AppendChatResult {
  thread: ConversationThreadRow;
  message: ConversationMessageRow;
}

export interface CreateSpecPackInput {
  projectId: string;
  name: string;
  version: string;
}

export interface CreateTemplateInput {
  packId: string;
  name: string;
  pageImageUri?: string;
}

export interface RunFixtureJobInput {
  kind: FixtureKind;
  template_id?: string;
}

export interface OpenJobForPackInput {
  projectId: string;
  packId: string;
}

/** Reject before insertJob so HTTP can map 400 without orphan ledger rows. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

const ALLOWED_IMAGE_MIMES = new Set(["image/jpeg", "image/png"]);
const PDF_MIME = "application/pdf";
const DEFAULT_BLOB_BUCKET = "docengine";

/**
 * Thrown for >4MB or disallowed MIME before any Job row is inserted.
 * HTTP maps this to 400; OCR/MinIO failures after insert use failed + audit instead.
 */
export class UploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadValidationError";
  }
}

export interface OpenUploadJobInput {
  projectId: string;
  packId?: string;
  template_id?: string;
  fileName: string;
  mime: string;
  bytes: Uint8Array;
  /** Optional retrieve query; defaults to joined 编号/日期 fields after extract. */
  standardFitQuery?: string;
}

export interface OpenUploadJobDeps {
  blob: BlobStore;
  ocr: OcrPort;
}

export interface OpenUploadJobResult {
  project: ProjectRow;
  job: JobRow;
  document: DocumentRow;
  extraction: ExtractionRow;
  findings: FindingRow[];
}

/** Human HITL only. Never used as a chat side effect. Submit is not a valid next status. */
export const CONFIRM_NEXT: Record<string, string> = {
  uploaded: "inspecting",
  inspecting: "extracting",
  extracting: "checking",
  checking: "pending",
  pending: "previewed",
};

export class JobPipeline {
  private project: ProjectRow | null = null;
  readonly interpreter = new RuleInterpreter();
  readonly publisher: RulePublisher;
  readonly review: ReviewDesk;
  readonly volume: VolumeDesk;
  readonly library: StandardLibrary;

  constructor(
    private readonly store: LedgerStore,
    ports?: Partial<RetrievePorts>,
  ) {
    this.publisher = new RulePublisher(store);
    this.review = new ReviewDesk(store);
    this.volume = new VolumeDesk(store);
    this.library = new StandardLibrary(store, ports);
  }

  private static boot(dbPath: string): LedgerStore {
    const db = new Database(dbPath);
    db.pragma("foreign_keys = ON");
    runMigrationOnDb(db);
    const store = new CoreEngineStore(db);
    store.seedPublishedRules();
    return new SqliteLedger(store);
  }

  static open(dbPath = ":memory:"): JobPipeline {
    return new JobPipeline(JobPipeline.boot(dbPath));
  }

  /**
   * Open a pipeline with explicit retrieve ports (Qdrant/Neo4j in prod, memory in tests).
   * JobPipeline.open() stays backward compatible and lazily uses memory ports.
   */
  static openStandardLibrary(
    ports?: Partial<RetrievePorts>,
    dbPath = ":memory:",
  ): JobPipeline {
    return new JobPipeline(JobPipeline.boot(dbPath), ports);
  }

  /**
   * Live assembly belongs on the pipeline factory so HTTP session does not new
   * Qdrant clients itself.
   */
  static async openLiveFromEnv(): Promise<JobPipeline> {
    const mode = resolveEngineMode();
    if (mode.mode === "memory") {
      return JobPipeline.openStandardLibrary();
    }
    await runPgMigration(mode.databaseUrl);
    const store = new PostgresLedger(mode.databaseUrl);
    await store.seedPublishedRules();
    return new JobPipeline(store, liveRetrievePorts());
  }

  async close(): Promise<void> {
    await this.store.close();
  }

  /** Empty t_* ledger tables so live demo reset can re-seed. Does not DROP DATABASE. */
  wipeLedger(): Promise<void> {
    return this.store.wipeLedger();
  }

  async createProject(name = "SLICE-1 Demo"): Promise<ProjectRow> {
    this.project = await this.store.insertProject(name);
    return this.project;
  }

  /** Empty spec-pack shell; does not seed industry packs. */
  async createSpecPack(input: CreateSpecPackInput): Promise<SpecPackRow> {
    return this.store.insertSpecPack({
      project_id: input.projectId,
      name: input.name,
      version: input.version,
    });
  }

  /** List packs for one project; seed 「空规范包」 lives under SEED_PACK_PROJECT_ID. */
  async listSpecPacks(projectId: string): Promise<SpecPackRow[]> {
    return this.store.listSpecPacks(projectId);
  }

  async setGroupKeys(packId: string, groupKeys: string[], orderKey: string | null = null): Promise<SpecPackRow> {
    return this.store.updateSpecPackGrouping(packId, groupKeys, orderKey);
  }

  /** Insert a checking job bound to a pack with no extraction (SLICE-5 test / multi-leaf setup). */
  async openJobForPack(input: OpenJobForPackInput): Promise<JobRow> {
    return this.store.insertJob({
      project_id: input.projectId,
      pack_id: input.packId,
      status: "checking",
    });
  }

  async attachExtraction(jobId: string, fields: Record<string, unknown>): Promise<ExtractionRow> {
    return this.volume.attachExtraction(jobId, fields);
  }

  async previewVolume(jobId: string): Promise<PreviewVolumeResult> {
    return this.volume.previewVolume(jobId);
  }

  async getVolumePreview(jobId: string): Promise<VolumePreviewRow | null> {
    return this.volume.getVolumePreview(jobId);
  }

  /** Template bound to a pack; page_image_uri optional this slice. */
  async createTemplate(input: CreateTemplateInput): Promise<TemplateRow> {
    return this.store.insertTemplate({
      pack_id: input.packId,
      name: input.name,
      page_image_uri: input.pageImageUri ?? null,
    });
  }

  /** Persist FieldBoxes; same field_key on a template upserts coords. */
  async saveFieldBoxes(templateId: string, boxes: FieldBoxWrite[]): Promise<FieldBoxRow[]> {
    return this.store.saveFieldBoxes(templateId, boxes);
  }

  async listFieldBoxes(templateId: string): Promise<FieldBoxRow[]> {
    return this.store.listFieldBoxes(templateId);
  }

  async saveDraft(input: SaveDraftInput): Promise<SaveDraftResult> {
    return this.publisher.saveDraft(input);
  }

  async addFixture(input: AddFixtureInput): Promise<RuleFixtureRow> {
    return this.publisher.addFixture(input);
  }

  async runFixtures(versionId: string): Promise<RuleFixtureRow[]> {
    return this.publisher.runFixtures(versionId);
  }

  async canPublish(versionId: string): Promise<boolean> {
    return this.publisher.canPublish(versionId);
  }

  async publish(versionId: string): Promise<PublishResult> {
    return this.publisher.publish(versionId);
  }

  async getRuleVersion(versionId: string): Promise<RuleVersionRow | null> {
    return this.store.getRuleVersion(versionId);
  }

  async listPublishedRuleVersions(): Promise<RuleVersionRow[]> {
    return this.store.listPublishedRuleVersions();
  }

  async runFixtureJob(input: RunFixtureJobInput): Promise<FixtureJobResult> {
    const project = this.project ?? (await this.createProject());
    const fixtureFields = fieldsForKind(input.kind);

    let job = await this.store.insertJob({
      project_id: project.project_id,
      pack_id: PACK_ID,
      status: "inspecting",
      template_id: input.template_id ?? null,
    });

    const document = await this.store.insertDocument({
      job_id: job.job_id,
      file_name: `fixture-${input.kind}.json`,
      file_uri: `fixture://${input.kind}`,
      mime: "application/json",
    });

    job = await this.store.updateJobStatus(job.job_id, "extracting");

    const fields = await this.projectExtractionFields(job.template_id, fixtureFields);

    const extraction = await this.store.insertExtraction({
      job_id: job.job_id,
      ocr_text: JSON.stringify(fixtureFields),
      fields,
    });
    await this.store.appendAudit({
      trace_id: job.trace_id,
      event_type: "extraction",
      ref_id: extraction.extraction_id,
      payload: { extraction_id: extraction.extraction_id, job_id: job.job_id },
    });

    const rules = await this.store.listPublishedRuleVersions();
    for (const rule of rules) {
      await this.store.appendAudit({
        trace_id: job.trace_id,
        event_type: "rule_version",
        ref_id: rule.version_id,
        payload: { version_id: rule.version_id, rule_id: rule.rule_id, blocking: rule.blocking },
      });
    }

    job = await this.store.updateJobStatus(job.job_id, "checking");

    const evaluated = evaluate(fields, rules);
    const findings: FindingRow[] = [];
    for (const item of evaluated) {
      const finding = await this.store.insertFinding({
        job_id: job.job_id,
        rule_version_id: item.rule_version_id,
        result: item.result,
        blocking: item.blocking,
        detail: item.detail,
      });
      findings.push(finding);
      await this.store.appendAudit({
        trace_id: job.trace_id,
        event_type: "finding",
        ref_id: finding.finding_id,
        payload: {
          finding_id: finding.finding_id,
          rule_version_id: finding.rule_version_id,
          result: finding.result,
          blocking: finding.blocking,
        },
      });
    }

    // Blocking fail must not auto-pass; both fixtures remain at checking.
    return { project, job, document, extraction, findings };
  }

  /**
   * Real upload path: validate → MinIO/memory blob → OCR or PDF text → extract → DSL.
   * Validation errors throw UploadValidationError before insertJob; blob/OCR failures
   * mark the Job failed and audit upload_error/ocr_error so operators can retry manually.
   */
  async openUploadJob(
    input: OpenUploadJobInput,
    deps: OpenUploadJobDeps,
  ): Promise<OpenUploadJobResult> {
    validateUploadInput(input);

    const project = await this.resolveProjectForUpload(input.projectId);
    const packId = input.packId ?? PACK_ID;

    let job = await this.store.insertJob({
      project_id: project.project_id,
      pack_id: packId,
      status: "uploaded",
      template_id: input.template_id ?? null,
    });

    let document: DocumentRow;
    try {
      const { fileUri } = await this.persistUploadBlob(job.job_id, input, deps.blob);
      document = await this.store.insertDocument({
        job_id: job.job_id,
        file_name: input.fileName,
        file_uri: fileUri,
        mime: input.mime,
      });
    } catch (err) {
      return this.failUploadJob(job, "upload_error", err);
    }

    job = await this.store.updateJobStatus(job.job_id, "inspecting");
    job = await this.store.updateJobStatus(job.job_id, "extracting");

    let ocrText: string;
    let ocrVendor: string;
    try {
      const recognized = await recognizeUploadText(input, deps.ocr);
      ocrText = recognized.text;
      ocrVendor = recognized.vendor;
    } catch (err) {
      return this.failUploadJob(job, "ocr_error", err);
    }

    const fields = await this.projectOcrExtractionFields(job.template_id, ocrText);

    const extraction = await this.store.insertExtraction({
      job_id: job.job_id,
      ocr_text: ocrText,
      fields,
    });
    await this.store.appendAudit({
      trace_id: job.trace_id,
      event_type: "extraction",
      ref_id: extraction.extraction_id,
      payload: {
        extraction_id: extraction.extraction_id,
        job_id: job.job_id,
        ocr_vendor: ocrVendor,
      },
    });

    const rules = await this.store.listPublishedRuleVersions();
    for (const rule of rules) {
      await this.store.appendAudit({
        trace_id: job.trace_id,
        event_type: "rule_version",
        ref_id: rule.version_id,
        payload: { version_id: rule.version_id, rule_id: rule.rule_id, blocking: rule.blocking },
      });
    }

    job = await this.store.updateJobStatus(job.job_id, "checking");

    const evaluated = evaluate(fields, rules);
    const findings: FindingRow[] = [];
    for (const item of evaluated) {
      const finding = await this.store.insertFinding({
        job_id: job.job_id,
        rule_version_id: item.rule_version_id,
        result: item.result,
        blocking: item.blocking,
        detail: item.detail,
      });
      findings.push(finding);
      await this.store.appendAudit({
        trace_id: job.trace_id,
        event_type: "finding",
        ref_id: finding.finding_id,
        payload: {
          finding_id: finding.finding_id,
          rule_version_id: finding.rule_version_id,
          result: finding.result,
          blocking: finding.blocking,
        },
      });
    }

    if (packId) {
      await this.tryAttachStandardFit(job, packId, input.standardFitQuery, fields, findings);
    }

    return { project, job, document, extraction, findings };
  }

  private async resolveProjectForUpload(projectId: string): Promise<ProjectRow> {
    if (this.project?.project_id === projectId) {
      return this.project;
    }
    const found = (await this.listProjects()).find((row) => row.project_id === projectId);
    if (!found) {
      throw new Error(`project not found: ${projectId}`);
    }
    this.project = found;
    return found;
  }

  private blobBucketName(blob: BlobStore): string {
    const maybe = blob as { bucket?: string };
    return typeof maybe.bucket === "string" ? maybe.bucket : DEFAULT_BLOB_BUCKET;
  }

  private async persistUploadBlob(
    jobId: string,
    input: OpenUploadJobInput,
    blob: BlobStore,
  ): Promise<{ key: string; fileUri: string }> {
    const key = uploadObjectKey(jobId, input.fileName);
    const bucket = this.blobBucketName(blob);
    await blob.ensureBucket();
    await blob.put({ key, bytes: input.bytes, mime: input.mime });
    return { key, fileUri: blobObjectUri(bucket, key) };
  }

  private async failUploadJob(
    job: JobRow,
    eventType: "ocr_error" | "upload_error",
    err: unknown,
  ): Promise<never> {
    const error = err instanceof Error ? err : new Error(String(err));
    await this.store.updateJobStatus(job.job_id, "failed");
    await this.store.appendAudit({
      trace_id: job.trace_id,
      event_type: eventType,
      ref_id: null,
      payload: { message: error.message },
    });
    throw error;
  }

  private async projectOcrExtractionFields(
    templateId: string | null,
    ocrText: string,
  ): Promise<Record<string, unknown>> {
    if (!templateId) {
      return parseOcrFields(ocrText);
    }
    const boxes = await this.store.listFieldBoxes(templateId);
    if (boxes.length === 0) {
      return parseOcrFields(ocrText);
    }
    return extractOcrByTemplate(ocrText, boxes);
  }

  private async tryAttachStandardFit(
    job: JobRow,
    packId: string,
    explicitQuery: string | undefined,
    fields: Record<string, unknown>,
    findings: FindingRow[],
  ): Promise<void> {
    const query = explicitQuery ?? standardFitQueryFromFields(fields);
    if (query.trim().length === 0) {
      return;
    }
    try {
      const fitFinding = await this.attachStandardFitFinding({
        jobId: job.job_id,
        query,
        packId,
      });
      findings.push(fitFinding);
    } catch {
      /* no retrieve hit — skip; never invent clause_id */
    }
  }

  /**
   * Bound template with boxes → project fixture onto field_key list.
   * No boxes (or no template) keeps SLICE-1 full fixture fields.
   */
  private async projectExtractionFields(
    templateId: string | null,
    fixtureFields: Record<string, string>,
  ): Promise<Record<string, unknown>> {
    if (!templateId) return fixtureFields;
    const boxes = await this.store.listFieldBoxes(templateId);
    if (boxes.length === 0) return fixtureFields;
    return extractByTemplate(fixtureFields, boxes);
  }

  async checkWording(input: CheckWordingInput): Promise<ProposalRow> {
    return this.review.checkWording(input);
  }

  async editWording(proposalId: string, wording: string): Promise<ProposalRow> {
    return this.review.editWording(proposalId, wording);
  }

  async confirmProposal(proposalId: string): Promise<ConfirmProposalResult> {
    return this.review.confirmProposal(proposalId);
  }

  async listPending(jobId?: string): Promise<ProposalRow[]> {
    return this.review.listPending(jobId);
  }

  async listReceipts(jobId?: string): Promise<ReceiptRow[]> {
    return this.review.listReceipts(jobId);
  }

  /**
   * HITL-only: persist messages. Never confirms, never writes Receipt,
   * never calls publish, never changes rule_version.status.
   */
  async appendChat(input: AppendChatInput): Promise<AppendChatResult> {
    const job = await this.store.getJobByTrace(input.traceId);
    if (!job) {
      throw new Error(`job not found for trace_id=${input.traceId}`);
    }
    let thread = await this.store.getThread(input.traceId, input.step);
    if (!thread) {
      thread = await this.store.insertThread({
        trace_id: input.traceId,
        step: input.step,
        job_id: job.job_id,
      });
    }
    const message = await this.store.insertMessage({
      thread_id: thread.thread_id,
      role: input.role ?? "operator",
      body: input.body,
    });
    return { thread, message };
  }

  async listAudit(traceId: string): Promise<AuditEventRow[]> {
    return this.store.listAudit(traceId);
  }

  async listFindings(jobId: string): Promise<FindingRow[]> {
    return this.store.listFindings(jobId);
  }

  async listMessages(traceId: string, step: string): Promise<ConversationMessageRow[]> {
    return this.store.listMessages(traceId, step);
  }

  async getJob(jobId: string): Promise<JobRow | null> {
    return this.store.getJob(jobId);
  }

  async getJobByTrace(traceId: string): Promise<JobRow | null> {
    return this.store.getJobByTrace(traceId);
  }

  async getPublishedRuleVersion(ruleId: string): Promise<RuleVersionRow | null> {
    return this.store.getRuleVersionByRuleId(ruleId);
  }

  ingestStandard(input: IngestStandardInput): Promise<IngestStandardResult> {
    return this.library.ingest(input);
  }

  searchStandard(input: SearchStandardInput): Promise<RetrieveHit[]> {
    return this.library.searchStandard(input);
  }

  attachStandardFitFinding(input: AttachStandardFitInput): Promise<FindingRow> {
    return this.library.attachStandardFitFinding(input);
  }

  async bindEffectiveVersion(packId: string, versionId: string): Promise<SpecPackRow> {
    return this.store.bindEffectiveVersion(packId, versionId);
  }

  addStandardEdge(input: AddStandardEdgeInput): Promise<void> {
    return this.library.addEdge(input);
  }

  async getClause(clauseId: string): Promise<ClauseRow | null> {
    return this.store.getClause(clauseId);
  }

  async listClauses(versionId: string): Promise<ClauseRow[]> {
    return this.store.listClauses(versionId);
  }

  async getStandardVersion(versionId: string): Promise<StandardVersionRow | null> {
    return this.store.getStandardVersion(versionId);
  }

  async updateStandardVersionStatus(versionId: string, status: string): Promise<StandardVersionRow> {
    return this.store.updateStandardVersionStatus(versionId, status);
  }

  async getSpecPack(packId: string): Promise<SpecPackRow | null> {
    return this.store.getSpecPack(packId);
  }

  async listProjects(): Promise<ProjectRow[]> {
    return this.store.listProjects();
  }

  async listJobs(): Promise<JobRow[]> {
    return this.store.listJobs();
  }

  async getTemplate(templateId: string): Promise<TemplateRow | null> {
    return this.store.getTemplate(templateId);
  }

  async listTemplates(packId: string): Promise<TemplateRow[]> {
    return this.store.listTemplates(packId);
  }

  async getExtraction(jobId: string): Promise<ExtractionRow | null> {
    return this.store.getExtraction(jobId);
  }

  async getDocumentForJob(jobId: string): Promise<DocumentRow | null> {
    return this.store.getDocumentForJob(jobId);
  }

  async listThreads(traceId: string): Promise<ConversationThreadRow[]> {
    return this.store.listThreads(traceId);
  }

  async listMessagesByTrace(traceId: string): Promise<ConversationMessageRow[]> {
    return this.store.listMessagesByTrace(traceId);
  }

  /**
   * Advance job.status along the HITL machine. Does not cancel blocking findings,
   * does not write Receipt, and never marks submitted.
   */
  async confirmNext(jobId: string): Promise<JobRow> {
    const job = await this.store.getJob(jobId);
    if (!job) {
      throw new Error(`job not found: ${jobId}`);
    }
    if (job.status === "submitted") {
      throw new Error("submit is not allowed");
    }
    const next = CONFIRM_NEXT[job.status];
    if (!next) {
      throw new Error(`cannot confirm-next from status=${job.status}`);
    }
    if (next === "submitted") {
      throw new Error("submit is not allowed");
    }
    return this.store.updateJobStatus(jobId, next);
  }
}

function normalizeMime(mime: string): string {
  return mime.toLowerCase().trim();
}

/** Gate uploads before insertJob; HTTP maps UploadValidationError to 400. */
export function validateUploadInput(input: Pick<OpenUploadJobInput, "mime" | "bytes">): void {
  if (input.bytes.length > MAX_UPLOAD_BYTES) {
    throw new UploadValidationError(`upload exceeds ${MAX_UPLOAD_BYTES} bytes`);
  }
  const mime = normalizeMime(input.mime);
  if (!ALLOWED_IMAGE_MIMES.has(mime) && mime !== PDF_MIME) {
    throw new UploadValidationError(`unsupported mime: ${input.mime}`);
  }
}

function standardFitQueryFromFields(fields: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const key of ["编号", "日期A", "日期B"]) {
    const value = fields[key];
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text.length > 0) parts.push(text);
  }
  return parts.join(" ");
}

/**
 * PDF text layer only — no Baidu quota. Scanned/image-only PDFs return null
 * so openUploadJob can fail with ocr_error instead of silent garbage text.
 */
function extractPdfTextLayer(bytes: Uint8Array): string | null {
  const raw = Buffer.from(bytes).toString("latin1");
  const chunks: string[] = [];
  const parenRe = /\(([^\\)]*(?:\\.[^\\)]*)*)\)/g;
  let match: RegExpExecArray | null;
  while ((match = parenRe.exec(raw)) !== null) {
    const decoded = match[1]!
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\\(/g, "(")
      .replace(/\\\)/g, ")")
      .replace(/\\\\/g, "\\");
    if (decoded.trim().length > 0) {
      chunks.push(decoded);
    }
  }
  const text = chunks.join("\n").trim();
  return text.length >= 3 ? text : null;
}

async function recognizeUploadText(
  input: Pick<OpenUploadJobInput, "bytes" | "mime" | "fileName">,
  ocr: OcrPort,
): Promise<{ text: string; vendor: string }> {
  const mime = normalizeMime(input.mime);
  if (mime === PDF_MIME) {
    const text = extractPdfTextLayer(input.bytes);
    if (text === null) {
      throw new Error("扫描件 PDF 无法本地抽字，请先导出首页为 JPEG 或 PNG");
    }
    return { text, vendor: "pdf-text" };
  }
  const result = await ocr.recognize({
    bytes: input.bytes,
    mime: input.mime,
    fileName: input.fileName,
  });
  return { text: result.text, vendor: result.vendor };
}
