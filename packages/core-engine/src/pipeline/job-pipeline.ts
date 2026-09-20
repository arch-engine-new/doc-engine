/**
 * Walking-skeleton job pipeline: fixture upload → extract JSON → R1/R2 → findings + audit.
 * Chat is HITL-only: persists messages, does not change job.status, does not write Receipt.
 */

import Database from "better-sqlite3";
import ExcelJS from "exceljs";
import type { BlobStore } from "../blob/port.js";
import { blobObjectUri, uploadObjectKey } from "../blob/minio.js";
import { extractByTemplate } from "../extract/field-box.js";
import { resolveEffectiveBoxes, type EffectiveFieldBox } from "../extract/effective-boxes.js";
import { extractOcrByTemplate, parseOcrFields } from "../extract/ocr-fields.js";
import { newId } from "../ids.js";
import { FakeOcr } from "../ocr/fake.js";
import { PaddleOcr } from "../ocr/paddleocr.js";
import type { OcrPort } from "../ocr/port.js";
import { extractPdfUnicodeText, hasUsablePdfTextLayer } from "../ocr/pdf-text.js";
import type { PdfPageRasterFn } from "../ocr/pdf-raster.js";
import { SqliteLedger, type LedgerStore } from "../persistence/ledger.js";
import { resolveEngineMode } from "../persistence/live-env.js";
import { runMigrationOnDb } from "../persistence/migrate.js";
import { runPgMigration } from "../persistence/pg-migrate.js";
import { PostgresLedger } from "../persistence/pg-store.js";
import { CoreEngineStore, type FieldBoxWrite } from "../persistence/store.js";
import { evaluate, RuleInterpreter } from "../rules/interpreter.js";
import { emptySkillDraftPayload, renderSkillSummary, XLSX_MIME } from "../skill/index.js";
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
  DocTypeRow,
  DocumentRow,
  ExtractionRow,
  FieldBoxRow,
  FieldDefRow,
  FindingRow,
  JobRow,
  JobTrack,
  ProjectRow,
  ProposalRow,
  ReceiptRow,
  RuleFixtureRow,
  RuleVersionRow,
  SkillDraftRow,
  SkillLedgerRow,
  SkillRecordRow,
  SpecPackRow,
  StandardVersionRow,
  TemplateRow,
  VolumePreviewRow,
} from "../types.js";
import type { JobStepOrchestrator } from "../agent/job-step-orchestrator.js";
import { isRetrieveChatStep } from "../agent/prompts.js";
import {
  PACK_ID,
  fieldsForKind,
  type FixtureKind,
} from "./seed.js";
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
import {
  StandardIngestWorker,
  type StartPdfInput,
  type StartPdfResult,
  type TickPageResult,
} from "../retrieve/ingest-worker.js";
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
  docTypeId?: string;
}

export interface DemoDocTypeIds {
  parentId: string;
  childId: string;
}

export interface CreateDocTypeInput {
  packId: string;
  name: string;
  parentDocTypeId?: string | null;
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
/** Same aliases as SkillRunner: spreadsheet bytes must stay xlsx so patch_excel can rewrite the original. */
const XLSX_MIME_ALIASES = new Set([
  XLSX_MIME.toLowerCase(),
  "application/vnd.ms-excel",
  "application/x-xlsx",
]);

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

/** Thrown when rename/delete violates ledger constraints; HTTP maps to 409. */
export class LedgerConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LedgerConflictError";
  }
}

const INDUSTRY_SPEC_PACK_NAME_RE = /公路|水利|房建/;

function rejectIndustrySpecPackName(name: string): void {
  if (INDUSTRY_SPEC_PACK_NAME_RE.test(name)) {
    throw new Error("spec pack name must not contain industry presets");
  }
}

export interface OpenUploadJobInput {
  projectId: string;
  packId?: string;
  template_id?: string;
  doc_type_id?: string;
  fileName: string;
  mime: string;
  bytes: Uint8Array;
  /** Optional retrieve query; defaults to joined 编号/日期 fields after extract. */
  standardFitQuery?: string;
  /**
   * Omit for the table Skill path so uploads skip DocType and RAG.
   * Pass `legacy` only for fixture JPEG/PDF checks that still need recognize + DSL.
   */
  track?: JobTrack;
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

/**
 * Leftover C2 HITL machine only. Skill-track jobs must not consult this map
 * (confirm-next is 409). Chat still never advances status or writes Receipt.
 */
export const CONFIRM_NEXT: Record<string, string> = {
  uploaded: "inspecting",
  inspecting: "extracting",
  extracting: "checking",
  checking: "pending",
  pending: "previewed",
};

/**
 * Skill-track jobs cannot advance leftover C2. HTTP maps this to 409 so
 * confirm-next cannot look like a missing HITL token (M16).
 */
export class SkillTrackConfirmNextError extends Error {
  constructor() {
    super("cannot confirm-next from track=skill");
    this.name = "SkillTrackConfirmNextError";
  }
}

/**
 * Live ingest must fail closed when PADDLEOCR_ACCESS_TOKEN is missing.
 * Falling back to FakeOcr would stamp vendor "fake" on operator scans and look
 * like a successful OCR path. Tests may still inject FakeOcr; memory mode may
 * omit OCR (constructor default). Only the live openLiveFromEnv branch uses this.
 */
export function requireLiveOcr(env: NodeJS.ProcessEnv = process.env): OcrPort {
  const ocr = PaddleOcr.fromEnv(env);
  if (ocr != null) {
    return ocr;
  }
  throw new Error(
    "live JobPipeline requires a Paddle OCR access token; FakeOcr fallback is forbidden",
  );
}

export class JobPipeline {
  private project: ProjectRow | null = null;
  readonly interpreter = new RuleInterpreter();
  readonly publisher: RulePublisher;
  readonly review: ReviewDesk;
  readonly volume: VolumeDesk;
  readonly library: StandardLibrary;
  private readonly ingestWorker: StandardIngestWorker;
  /** Optional agent step orchestrator (wired by HTTP session). */
  stepOrchestrator: Pick<JobStepOrchestrator, "onStepEntered"> | null = null;

  constructor(
    private readonly store: LedgerStore,
    ports?: Partial<RetrievePorts>,
    ocr?: OcrPort,
  ) {
    this.publisher = new RulePublisher(store);
    this.review = new ReviewDesk(store);
    this.volume = new VolumeDesk(store);
    this.library = new StandardLibrary(store, ports);
    this.ingestWorker = new StandardIngestWorker(store, this.library, {
      ocr: ocr ?? new FakeOcr(),
    });
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
    ocr?: OcrPort,
  ): JobPipeline {
    return new JobPipeline(JobPipeline.boot(dbPath), ports, ocr);
  }

  /**
   * Live assembly belongs on the pipeline factory so HTTP session does not new
   * Qdrant clients itself.
   */
  static async openLiveFromEnv(): Promise<JobPipeline> {
    const mode = resolveEngineMode();
    if (mode.mode === "memory") {
      return JobPipeline.openStandardLibrary(undefined, ":memory:", PaddleOcr.fromEnv() ?? undefined);
    }
    await runPgMigration(mode.databaseUrl);
    const store = new PostgresLedger(mode.databaseUrl);
    await store.seedPublishedRules();
    const pipeline = new JobPipeline(store, liveRetrievePorts(), requireLiveOcr());
    // Live Qdrant may have been rebuilt to v3 dims; Hash-filling that empty collection is forbidden.
    await pipeline.library.reindexVectorsFromLedger();
    return pipeline;
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
      doc_type_id: input.docTypeId,
    });
  }

  async ensureDemoDocTypes(packId: string): Promise<DemoDocTypeIds> {
    const listed = await this.listDocTypes(packId);
    let parent = listed.find((dt) => dt.name === "夹具父类型" && !dt.parent_doc_type_id);
    if (!parent) {
      parent = await this.store.insertDocType({
        pack_id: packId,
        name: "夹具父类型",
        parent_doc_type_id: null,
      });
      await this.store.saveFieldDefs(parent.doc_type_id, [
        { field_key: "编号", value_type: "string", required: 0 },
        { field_key: "日期A", value_type: "date", required: 0 },
      ]);
    }
    let child = listed.find((dt) => dt.parent_doc_type_id === parent!.doc_type_id);
    if (!child) {
      child = await this.store.insertDocType({
        pack_id: packId,
        name: "夹具子类型",
        parent_doc_type_id: parent.doc_type_id,
      });
      await this.store.saveFieldDefs(child.doc_type_id, [
        { field_key: "特殊批号", value_type: "string", required: 0 },
      ]);
    }
    return { parentId: parent.doc_type_id, childId: child.doc_type_id };
  }

  async createDocType(input: CreateDocTypeInput): Promise<DocTypeRow> {
    return this.store.insertDocType({
      pack_id: input.packId,
      name: input.name,
      parent_doc_type_id: input.parentDocTypeId ?? null,
    });
  }

  async listDocTypes(packId: string): Promise<DocTypeRow[]> {
    return this.store.listDocTypesByPack(packId);
  }

  async getDocType(docTypeId: string): Promise<DocTypeRow | null> {
    return this.store.getDocType(docTypeId);
  }

  async updateDocType(docTypeId: string, name: string): Promise<DocTypeRow> {
    return this.store.updateDocTypeName(docTypeId, name);
  }

  async deleteDocType(docTypeId: string): Promise<DocTypeRow> {
    return this.store.softDeleteDocType(docTypeId);
  }

  async listFieldDefs(docTypeId: string): Promise<FieldDefRow[]> {
    return this.store.listFieldDefs(docTypeId);
  }

  async saveFieldDefs(
    docTypeId: string,
    defs: Array<{ field_key: string; value_type: string; required?: number }>,
  ): Promise<FieldDefRow[]> {
    return this.store.saveFieldDefs(docTypeId, defs);
  }

  async listEffectiveBoxes(templateId: string): Promise<EffectiveFieldBox[]> {
    const template = await this.store.getTemplate(templateId);
    if (!template) throw new Error(`template not found: ${templateId}`);
    const defs = template.doc_type_id
      ? await this.store.listEffectiveFieldDefs(template.doc_type_id)
      : [];
    const boxes = await this.store.listFieldBoxes(templateId);
    const merged = resolveEffectiveBoxes(defs, boxes);
    if (merged.length === 0 && boxes.length > 0) {
      return boxes.map((box) => ({
        field_key: box.field_key,
        value_type: box.value_type,
        page: box.page,
        x: box.x,
        y: box.y,
        w: box.w,
        h: box.h,
        inherited: false,
      }));
    }
    return merged;
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
      // Fixture buttons stay leftover DSL jobs; Skill default must not steal this path.
      track: "legacy",
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
    await this.emitStepEntered(job);
    const refreshed = await this.store.getJob(job.job_id);
    return { project, job: refreshed ?? job, document, extraction, findings };
  }

  /**
   * Default is the table Skill path: no DocType, layout/xlsx text, no RAG.
   * Pass track=`legacy` for leftover fixture JPEG/PDF checks (recognize + DSL).
   */
  async openUploadJob(
    input: OpenUploadJobInput,
    deps: OpenUploadJobDeps,
  ): Promise<OpenUploadJobResult> {
    if ((input.track ?? "skill") !== "legacy") {
      return this.openSkillUploadJob(input, deps);
    }
    return this.openLegacyUploadJob(input, deps);
  }

  /**
   * Leftover C2 machine: flatten OCR + DSL findings. Skill uploads must not
   * reuse this or scanned tables lose pipes and RAG would attach as if it were a check.
   */
  private async openLegacyUploadJob(
    input: OpenUploadJobInput,
    deps: OpenUploadJobDeps,
  ): Promise<OpenUploadJobResult> {
    validateUploadInput({ ...input, track: "legacy" });

    const project = await this.resolveProjectForUpload(input.projectId);
    const packId = input.packId ?? PACK_ID;

    let templateId = input.template_id ?? null;
    const docTypeId = input.doc_type_id ?? null;
    if (docTypeId && !templateId) {
      const templates = await this.store.listTemplatesByDocType(docTypeId);
      templateId = templates[0]?.template_id ?? null;
    }

    let job = await this.store.insertJob({
      project_id: project.project_id,
      pack_id: packId,
      status: "uploaded",
      template_id: templateId,
      doc_type_id: docTypeId,
      track: "legacy",
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

    const fields = await this.projectOcrExtractionFields(templateId, ocrText);

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

    await this.emitStepEntered(job);
    const refreshed = await this.store.getJob(job.job_id);
    return { project, job: refreshed ?? job, document, extraction, findings };
  }

  /**
   * Skill uploads hang an empty draft before chat. Pre-assign skill_draft_id so
   * GET job can return it without a persistence updater (M12). Unreadable files
   * skip the draft so a bad scan cannot look like a teachable Skill (M8).
   */
  private async openSkillUploadJob(
    input: OpenUploadJobInput,
    deps: OpenUploadJobDeps,
  ): Promise<OpenUploadJobResult> {
    validateUploadInput({ ...input, track: "skill" });
    const project = await this.resolveProjectForUpload(input.projectId);
    const packId = input.packId ?? PACK_ID;
    const extracted = await readSkillUploadText(input, deps.ocr);
    const draftId = extracted.ok ? newId("sdr") : null;
    const job = await this.store.insertJob({
      project_id: project.project_id,
      pack_id: packId,
      status: "uploaded",
      template_id: null,
      doc_type_id: null,
      track: "skill",
      skill_draft_id: draftId,
    });
    const document = await this.persistSkillOriginal(job, input, deps.blob);
    if (!extracted.ok) {
      return this.finishUnreadableSkillJob(project, job, document, input.mime);
    }
    return this.finishReadableSkillJob({
      project,
      job,
      document,
      packId,
      draftId: draftId!,
      extracted,
    });
  }

  private async persistSkillOriginal(
    job: JobRow,
    input: OpenUploadJobInput,
    blob: BlobStore,
  ): Promise<DocumentRow> {
    try {
      const { fileUri } = await this.persistUploadBlob(job.job_id, input, blob);
      return this.store.insertDocument({
        job_id: job.job_id,
        file_name: input.fileName,
        file_uri: fileUri,
        mime: input.mime,
      });
    } catch (err) {
      return this.failUploadJob(job, "upload_error", err);
    }
  }

  private async finishUnreadableSkillJob(
    project: ProjectRow,
    job: JobRow,
    document: DocumentRow,
    mime: string,
  ): Promise<OpenUploadJobResult> {
    const failed = await this.store.updateJobStatus(job.job_id, "failed");
    const extraction = await this.store.insertExtraction({
      job_id: job.job_id,
      ocr_text: "",
      fields: {},
    });
    await this.store.insertSkillLedger({
      job_id: job.job_id,
      skill_id: null,
      original_blob_uri: document.file_uri,
      original_mime: mime,
      verdict: "fail",
      reason: "unreadable",
      fix_list_json: "[]",
      unprocessed_tables_json: "[]",
    });
    return { project, job: failed, document, extraction, findings: [] };
  }

  private async finishReadableSkillJob(input: {
    project: ProjectRow;
    job: JobRow;
    document: DocumentRow;
    packId: string;
    draftId: string;
    extracted: { text: string; vendor: string };
  }): Promise<OpenUploadJobResult> {
    const payload = emptySkillDraftPayload();
    await this.store.insertSkillDraft({
      draft_id: input.draftId,
      job_id: input.job.job_id,
      pack_id: input.packId,
      payload_json: JSON.stringify(payload),
      summary_json: JSON.stringify(renderSkillSummary(payload)),
    });
    const extraction = await this.store.insertExtraction({
      job_id: input.job.job_id,
      ocr_text: input.extracted.text,
      fields: {},
    });
    await this.store.appendAudit({
      trace_id: input.job.trace_id,
      event_type: "extraction",
      ref_id: extraction.extraction_id,
      payload: {
        extraction_id: extraction.extraction_id,
        job_id: input.job.job_id,
        ocr_vendor: input.extracted.vendor,
      },
    });
    const refreshed = await this.store.getJob(input.job.job_id);
    return {
      project: input.project,
      job: refreshed ?? input.job,
      document: input.document,
      extraction,
      findings: [],
    };
  }

  private async emitStepEntered(job: JobRow): Promise<void> {
    if (job.track === "skill") return;
    await this.stepOrchestrator?.onStepEntered(job, job.status);
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

  private async effectiveBoxesForTemplate(templateId: string | null): Promise<EffectiveFieldBox[]> {
    if (!templateId) return [];
    return this.listEffectiveBoxes(templateId);
  }

  private async projectOcrExtractionFields(
    templateId: string | null,
    ocrText: string,
  ): Promise<Record<string, unknown>> {
    if (!templateId) {
      return parseOcrFields(ocrText);
    }
    const effective = await this.effectiveBoxesForTemplate(templateId);
    if (effective.length === 0) {
      const boxes = await this.store.listFieldBoxes(templateId);
      if (boxes.length === 0) return parseOcrFields(ocrText);
      return extractOcrByTemplate(ocrText, boxes);
    }
    return extractOcrByTemplate(ocrText, effective);
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
      const rows = await this.attachStandardFitFinding({
        jobId: job.job_id,
        query,
        packId,
      });
      findings.push(...rows);
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
    const effective = await this.effectiveBoxesForTemplate(templateId);
    if (effective.length === 0) {
      const boxes = await this.store.listFieldBoxes(templateId);
      if (boxes.length === 0) return fixtureFields;
      return extractByTemplate(fixtureFields, boxes);
    }
    return extractByTemplate(fixtureFields, effective);
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
    // retrieve/standard_lib threads are pack-scoped; job_id stays null without a Job.
    if (!job && !isRetrieveChatStep(input.step)) {
      throw new Error(`job not found for trace_id=${input.traceId}`);
    }
    let thread = await this.store.getThread(input.traceId, input.step);
    if (!thread) {
      thread = await this.store.insertThread({
        trace_id: input.traceId,
        step: input.step,
        job_id: job?.job_id ?? null,
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

  /**
   * PDF ingest 202 path: register pending pages only. Must not reuse Job
   * MAX_UPLOAD_BYTES — standard scans are larger than 4MB check photos.
   */
  startStandardPdfIngest(
    input: StartPdfInput,
    deps?: { ocr?: OcrPort; raster?: PdfPageRasterFn },
  ): Promise<StartPdfResult> {
    return this.ingestWorker.startPdf({
      ...input,
      ocr: deps?.ocr ?? input.ocr,
      raster: deps?.raster ?? input.raster,
    });
  }

  /**
   * Pull-consume ≤1 pending page. Held on the pipeline so HTTP tick can see
   * the in-memory PDF bytes map from startStandardPdfIngest.
   */
  tickStandardIngest(ingestRunId: string): Promise<TickPageResult> {
    return this.ingestWorker.tick(ingestRunId);
  }

  searchStandard(input: SearchStandardInput): Promise<RetrieveHit[]> {
    return this.library.searchStandard(input);
  }

  /** Spreads table-backed rows; Job MAX_UPLOAD_BYTES stays 4MB. */
  attachStandardFitFinding(input: AttachStandardFitInput): Promise<FindingRow[]> {
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

  async updateProject(projectId: string, name: string): Promise<ProjectRow> {
    return this.store.updateProjectName(projectId, name);
  }

  async deleteProject(projectId: string): Promise<ProjectRow> {
    return this.store.softDeleteProject(projectId);
  }

  async updateSpecPack(packId: string, name: string): Promise<SpecPackRow> {
    rejectIndustrySpecPackName(name);
    return this.store.updateSpecPackName(packId, name);
  }

  async deleteSpecPack(packId: string): Promise<SpecPackRow> {
    return this.store.softDeleteSpecPack(packId);
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

  async listTemplatesByDocType(docTypeId: string): Promise<TemplateRow[]> {
    return this.store.listTemplatesByDocType(docTypeId);
  }

  async getExtraction(jobId: string): Promise<ExtractionRow | null> {
    return this.store.getExtraction(jobId);
  }

  async getDocumentForJob(jobId: string): Promise<DocumentRow | null> {
    return this.store.getDocumentForJob(jobId);
  }

  /**
   * Upload tests and later confirm-skill read the hung draft by job, not by
   * scanning chat, because only this row is what GET job.skill_draft_id points at.
   */
  async getSkillDraftByJob(jobId: string): Promise<SkillDraftRow | null> {
    return this.store.getSkillDraftByJob(jobId);
  }

  /**
   * M8 asserts original-only ledger rows. HTTP must not open SqliteLedger itself
   * to prove unreadable uploads never grew a Skill index.
   */
  async listSkillLedgersByJob(jobId: string): Promise<SkillLedgerRow[]> {
    return this.store.listSkillLedgersByJob(jobId);
  }

  /**
   * Pack-scoped index listing so Skill upload can prove it did not insert a
   * production Skill before confirm (M5/M8).
   */
  async listSkillRecords(packId: string): Promise<SkillRecordRow[]> {
    return this.store.listSkillRecords(packId);
  }

  async listThreads(traceId: string): Promise<ConversationThreadRow[]> {
    return this.store.listThreads(traceId);
  }

  async listMessagesByTrace(traceId: string): Promise<ConversationMessageRow[]> {
    return this.store.listMessagesByTrace(traceId);
  }

  async updateJobAgentRunId(jobId: string, agentRunId: string): Promise<JobRow> {
    return this.store.updateJobAgentRunId(jobId, agentRunId);
  }

  /**
   * Advance leftover C2 job.status along CONFIRM_NEXT. Skill-track jobs throw
   * SkillTrackConfirmNextError so HTTP confirm-next stays 409 (M16). Does not
   * cancel blocking findings, write Receipt, or mark submitted.
   */
  async confirmNext(jobId: string): Promise<JobRow> {
    const job = await this.store.getJob(jobId);
    if (!job) {
      throw new Error(`job not found: ${jobId}`);
    }
    if (job.track === "skill") {
      throw new SkillTrackConfirmNextError();
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

/**
 * Skill track allows xlsx so later patch_excel can rewrite the original bytes.
 * Legacy stays jpeg/png/pdf: fixture OCR/DSL must not ingest Office XML as a scan.
 */
export function validateUploadInput(
  input: Pick<OpenUploadJobInput, "mime" | "bytes" | "track">,
): void {
  if (input.bytes.length > MAX_UPLOAD_BYTES) {
    throw new UploadValidationError(`upload exceeds ${MAX_UPLOAD_BYTES} bytes`);
  }
  const mime = normalizeMime(input.mime);
  const track = input.track ?? "skill";
  if (track === "legacy") {
    if (!isImageOrPdfMime(mime)) {
      throw new UploadValidationError(`unsupported mime: ${input.mime}`);
    }
    return;
  }
  if (!isImageOrPdfMime(mime) && !isXlsxMime(mime)) {
    throw new UploadValidationError(`unsupported mime: ${input.mime}`);
  }
}

function isXlsxMime(mime: string): boolean {
  return XLSX_MIME_ALIASES.has(normalizeMime(mime));
}

function isImageOrPdfMime(mime: string): boolean {
  const normalized = normalizeMime(mime);
  return ALLOWED_IMAGE_MIMES.has(normalized) || normalized === PDF_MIME;
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
 * PDF: Unicode text-layer first (unpdf). Usable copy → vendor=pdf-text and skip OCR.
 * Empty / below-threshold layers fall through to OcrPort so scans are not labelled
 * pdf-text garbage. JPEG/PNG never take the PDF branch.
 */
async function recognizeUploadText(
  input: Pick<OpenUploadJobInput, "bytes" | "mime" | "fileName">,
  ocr: OcrPort,
): Promise<{ text: string; vendor: string }> {
  const mime = normalizeMime(input.mime);
  if (mime === PDF_MIME) {
    const decoded = await extractPdfUnicodeText(input.bytes);
    if (hasUsablePdfTextLayer(decoded)) {
      return { text: decoded, vendor: "pdf-text" };
    }
  }
  const result = await ocr.recognize({
    bytes: input.bytes,
    mime: input.mime,
    fileName: input.fileName,
  });
  return { text: result.text, vendor: result.vendor };
}

function toExcelLoadBytes(bytes: Uint8Array): ArrayBuffer {
  const copy = Uint8Array.from(bytes);
  return copy.buffer.slice(0, copy.byteLength);
}

async function extractXlsxCellText(bytes: Uint8Array): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(toExcelLoadBytes(bytes));
  const lines: string[] = [];
  for (const sheet of workbook.worksheets) {
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        const text = String(cell.text ?? cell.value ?? "").trim();
        if (text.length > 0) lines.push(text);
      });
    });
  }
  return lines.join("\n");
}

type SkillReadResult =
  | { ok: true; text: string; vendor: string }
  | { ok: false };

/**
 * Skill path never calls ocr.recognize: flattening would drop table pipes (D3).
 * xlsx is cell text only; PDF uses Unicode then recognizeLayout; both empty → unreadable.
 */
async function readSkillUploadText(
  input: Pick<OpenUploadJobInput, "bytes" | "mime" | "fileName">,
  ocr: OcrPort,
): Promise<SkillReadResult> {
  const mime = normalizeMime(input.mime);
  if (isXlsxMime(mime)) {
    return readSkillXlsxText(input.bytes);
  }
  if (mime === PDF_MIME) {
    const decoded = await extractPdfUnicodeText(input.bytes);
    if (hasUsablePdfTextLayer(decoded)) {
      return { ok: true, text: decoded, vendor: "pdf-text" };
    }
  }
  return readSkillLayoutText(input, ocr);
}

async function readSkillXlsxText(bytes: Uint8Array): Promise<SkillReadResult> {
  try {
    const text = await extractXlsxCellText(bytes);
    if (text.trim().length === 0) return { ok: false };
    return { ok: true, text, vendor: "xlsx-cells" };
  } catch {
    return { ok: false };
  }
}

async function readSkillLayoutText(
  input: Pick<OpenUploadJobInput, "bytes" | "mime" | "fileName">,
  ocr: OcrPort,
): Promise<SkillReadResult> {
  try {
    const result = await ocr.recognizeLayout({
      bytes: input.bytes,
      mime: input.mime,
      fileName: input.fileName,
    });
    if (!result.text || result.text.trim().length === 0) return { ok: false };
    return { ok: true, text: result.text, vendor: result.vendor };
  } catch {
    return { ok: false };
  }
}
