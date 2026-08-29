/**
 * Excel document pipeline: generate xlsx artifact → mock adapter upload → signature tasks → Receipt.
 */

import type { BlobStore } from "../blob/port.js";
import { blobObjectUri, safeName } from "../blob/minio.js";
import { uploadDocument } from "../adapter/mock.js";
import { ExcelFillService } from "../excel/fill-service.js";
import { resolveEffectiveExcelMappings } from "../excel/effective-mappings.js";
import type { LedgerStore } from "../persistence/ledger.js";
import { newId } from "../ids.js";
import type {
  DocumentArtifactRow,
  ReceiptRow,
  SignatureTaskRow,
  TemplateRow,
} from "../types.js";

const DEFAULT_BLOB_BUCKET = "docengine";

export interface GenerateArtifactInput {
  projectId: string;
  docTypeId: string;
  templateId?: string;
  fieldValues?: Record<string, string | number | boolean | null | undefined>;
  traceId?: string;
}

export interface UploadArtifactResult {
  artifact: DocumentArtifactRow;
  receipt: ReceiptRow;
  signatureTasks: SignatureTaskRow[];
}

export interface ConfirmSignatureResult {
  task: SignatureTaskRow;
  receipt: ReceiptRow;
}

type PipelineStore = LedgerStore & {
  listEffectiveFieldDefs(docTypeId: string): ReturnType<LedgerStore["listFieldDefs"]>;
};

function blobKeyFromUri(uri: string): string {
  if (uri.startsWith("s3://")) {
    const withoutScheme = uri.slice(5);
    const slash = withoutScheme.indexOf("/");
    if (slash < 0) {
      throw new Error(`invalid file_uri: ${uri}`);
    }
    return withoutScheme.slice(slash + 1);
  }
  throw new Error(`unsupported file_uri scheme: ${uri}`);
}

function blobBucketName(blob: BlobStore): string {
  const maybe = blob as { bucket?: string };
  return typeof maybe.bucket === "string" ? maybe.bucket : DEFAULT_BLOB_BUCKET;
}

export class DocumentPipeline {
  private readonly fillService = new ExcelFillService();

  constructor(
    private readonly store: PipelineStore,
    private readonly blob: BlobStore,
  ) {}

  async generateArtifact(input: GenerateArtifactInput): Promise<DocumentArtifactRow> {
    const project = (await this.store.listProjects()).find((row) => row.project_id === input.projectId);
    if (!project) {
      throw new Error(`project not found: ${input.projectId}`);
    }

    const docType = await this.store.getDocType(input.docTypeId);
    if (!docType) {
      throw new Error(`doc type not found: ${input.docTypeId}`);
    }

    const template = await this.resolveTemplate(input.docTypeId, input.templateId);
    if (template.layout_kind !== "excel") {
      throw new Error(`template ${template.template_id} layout_kind must be excel`);
    }
    if (!template.excel_template_uri) {
      throw new Error(`template ${template.template_id} missing excel_template_uri`);
    }

    const traceId = input.traceId ?? newId("trc");
    const mappings = await resolveEffectiveExcelMappings(
      input.docTypeId,
      template.template_id,
      this.store,
    );
    const rules = await this.store.listFieldFillRules(input.docTypeId);

    const templateKey = blobKeyFromUri(template.excel_template_uri);
    const templateBytes = await this.blob.get(templateKey);

    const filled = await this.fillService.fill({
      template: Buffer.from(templateBytes),
      sheetName: template.excel_sheet_name,
      mappings,
      fieldValues: input.fieldValues ?? {},
      rules,
    });

    const artifactId = newId("art");
    const fileName = `${safeName(template.name)}-filled.xlsx`;
    const outputKey = `artifacts/${artifactId}/${fileName}`;
    const bucket = blobBucketName(this.blob);
    await this.blob.ensureBucket();
    await this.blob.put({
      key: outputKey,
      bytes: new Uint8Array(filled),
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const artifact = await this.store.insertDocumentArtifact({
      artifact_id: artifactId,
      project_id: input.projectId,
      doc_type_id: input.docTypeId,
      template_id: template.template_id,
      file_uri: blobObjectUri(bucket, outputKey),
      status: "generated",
      trace_id: traceId,
      metadata: { fieldValues: input.fieldValues ?? {} },
    });

    await this.store.appendAudit({
      trace_id: traceId,
      event_type: "document_generated",
      ref_id: artifact.artifact_id,
      payload: {
        artifact_id: artifact.artifact_id,
        project_id: input.projectId,
        doc_type_id: input.docTypeId,
        template_id: template.template_id,
      },
    });

    return artifact;
  }

  async uploadArtifact(artifactId: string): Promise<UploadArtifactResult> {
    const artifact = await this.store.getDocumentArtifact(artifactId);
    if (!artifact) {
      throw new Error(`artifact not found: ${artifactId}`);
    }
    if (artifact.status === "uploaded") {
      throw new Error(`artifact ${artifactId} is already uploaded`);
    }

    const key = blobKeyFromUri(artifact.file_uri);
    const bytes = await this.blob.get(key);

    const adapterResult = uploadDocument({
      projectId: artifact.project_id,
      docTypeId: artifact.doc_type_id,
      buffer: Buffer.from(bytes),
      metadata: artifact.metadata_json,
      traceId: artifact.trace_id,
    });

    if (!adapterResult.receipt_id) {
      throw new Error("adapter upload requires receipt_id");
    }

    const receipt = await this.store.insertReceipt({
      proposal_id: null,
      job_id: "",
      status: "accepted",
      payload: {
        artifact_id: artifact.artifact_id,
        adapter_document_id: adapterResult.document_id,
        receipt_id: adapterResult.receipt_id,
      },
    });

    const updated = await this.store.updateDocumentArtifact(artifactId, {
      status: "uploaded",
      adapter_document_id: adapterResult.document_id,
      receipt_id: receipt.receipt_id,
    });

    await this.store.appendAudit({
      trace_id: artifact.trace_id,
      event_type: "document_uploaded",
      ref_id: receipt.receipt_id,
      payload: {
        artifact_id: artifact.artifact_id,
        receipt_id: receipt.receipt_id,
        adapter_document_id: adapterResult.document_id,
      },
    });

    const signatureTasks = await this.createSignatureTasks(artifactId);
    return { artifact: updated, receipt, signatureTasks };
  }

  async createSignatureTasks(artifactId: string): Promise<SignatureTaskRow[]> {
    const artifact = await this.store.getDocumentArtifact(artifactId);
    if (!artifact) {
      throw new Error(`artifact not found: ${artifactId}`);
    }

    const existing = await this.store.listSignatureTasksByArtifact(artifactId);
    if (existing.length > 0) {
      return existing;
    }

    const mappings = await resolveEffectiveExcelMappings(
      artifact.doc_type_id,
      artifact.template_id,
      this.store,
    );

    const roles = new Map<string, string | null>();
    for (const mapping of mappings) {
      if (mapping.signature_role) {
        roles.set(mapping.signature_role, mapping.field_key);
      }
    }

    const tasks: SignatureTaskRow[] = [];
    for (const [role, fieldKey] of roles) {
      const task = await this.store.insertSignatureTask({
        artifact_id: artifactId,
        role,
        assignee_label: fieldKey,
        trace_id: artifact.trace_id,
      });
      tasks.push(task);
    }
    return tasks;
  }

  async confirmSignatureTask(taskId: string, signerName: string): Promise<ConfirmSignatureResult> {
    const task = await this.store.getSignatureTask(taskId);
    if (!task) {
      throw new Error(`signature task not found: ${taskId}`);
    }
    if (task.status !== "pending") {
      throw new Error(`signature task ${taskId} is ${task.status}, not pending`);
    }
    if (!signerName.trim()) {
      throw new Error("signerName is required");
    }

    const artifact = await this.store.getDocumentArtifact(task.artifact_id);
    if (!artifact) {
      throw new Error(`artifact not found: ${task.artifact_id}`);
    }

    const receipt = await this.store.insertReceipt({
      proposal_id: null,
      job_id: "",
      status: "accepted",
      payload: {
        artifact_id: artifact.artifact_id,
        task_id: task.task_id,
        role: task.role,
        signer_name: signerName.trim(),
      },
    });

    if (!receipt.receipt_id) {
      throw new Error("receipt_id must be non-empty to persist");
    }

    const updated = await this.store.updateSignatureTask(taskId, {
      status: "signed",
      signer_name: signerName.trim(),
      receipt_id: receipt.receipt_id,
    });

    await this.store.appendAudit({
      trace_id: task.trace_id,
      event_type: "signature_confirmed",
      ref_id: receipt.receipt_id,
      payload: {
        task_id: task.task_id,
        artifact_id: artifact.artifact_id,
        role: task.role,
        signer_name: signerName.trim(),
        receipt_id: receipt.receipt_id,
      },
    });

    return { task: updated, receipt };
  }

  async listPendingSignatures(): Promise<SignatureTaskRow[]> {
    return this.store.listPendingSignatureTasks();
  }

  private async resolveTemplate(docTypeId: string, templateId?: string): Promise<TemplateRow> {
    if (templateId) {
      const template = await this.store.getTemplate(templateId);
      if (!template) {
        throw new Error(`template not found: ${templateId}`);
      }
      return template;
    }

    const templates = await this.store.listTemplatesByDocType(docTypeId);
    const excel = templates.find((row) => row.layout_kind === "excel");
    if (!excel) {
      throw new Error(`no excel template for doc type: ${docTypeId}`);
    }
    return excel;
  }
}
