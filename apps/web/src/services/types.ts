/** API shapes used by Walking Skeleton views. Field names match ledger snake_case. */

export interface JobView {
  job_id: string;
  project_id: string;
  pack_id: string | null;
  trace_id: string;
  status: string;
  template_id: string | null;
  file_name: string | null;
}

export interface ExtractionView {
  extraction_id: string;
  job_id: string;
  ocr_text: string | null;
  fields_json: unknown;
}

export interface FindingView {
  finding_id: string;
  job_id: string;
  rule_version_id: string;
  result: string;
  blocking: number;
  detail: string | null;
  clause_id: string | null;
  standard_version_id: string | null;
  retrieve_path: string | null;
}

export interface ProposalView {
  proposal_id: string;
  job_id: string;
  status: string;
  wording: string;
  agent_run_id: string | null;
}

export interface ReceiptView {
  receipt_id: string;
  proposal_id: string | null;
  job_id: string;
  status: string;
}

/** Generated Excel document artifact from document generate/upload APIs. */
export interface DocumentArtifactView {
  artifact_id: string;
  project_id: string;
  doc_type_id: string;
  template_id: string;
  file_uri: string;
  adapter_document_id: string | null;
  status: string;
  trace_id: string;
  receipt_id: string | null;
}

/** Pending signature task from GET /api/pending/signatures. */
export interface SignatureTaskView {
  task_id: string;
  artifact_id: string;
  role: string;
  assignee_label: string | null;
  status: string;
  signer_name: string | null;
  trace_id: string;
  receipt_id: string | null;
}

/** Missing required document from GET /api/projects/:id/document-gaps. */
export interface DocumentGapView {
  doc_type_id: string;
  label: string;
  pack_id: string;
}

/** HITL confirm-next machine. Submit is not a valid next status. */
export const CONFIRM_NEXT: Record<string, string> = {
  uploaded: "inspecting",
  inspecting: "extracting",
  extracting: "checking",
  checking: "pending",
  pending: "previewed",
};

export interface ProjectView {
  project_id: string;
  name: string;
}

export interface TemplateView {
  template_id: string;
  pack_id: string;
  doc_type_id?: string;
  name: string;
  page_image_uri: string | null;
  layout_kind?: string;
  excel_template_uri?: string | null;
  excel_sheet_name?: string | null;
}

/** Writable Excel cell mapping (PUT /api/templates/:id/excel-mappings). */
export interface ExcelCellMappingWrite {
  sheet_name: string;
  cell: string;
  field_key: string;
  value_type: string;
  signature_role: string | null;
}

/** Excel cell mapping row from GET /api/templates/:id/excel-mappings. */
export interface ExcelCellMappingView extends ExcelCellMappingWrite {
  mapping_id: string;
  template_id: string;
}

export interface FieldDefView {
  doc_type_id: string;
  field_key: string;
  value_type: string;
  required: number;
}

export interface DocTypeView {
  doc_type_id: string;
  pack_id: string;
  parent_doc_type_id: string | null;
  name: string;
  parent_name?: string | null;
  template_count?: number;
}

export interface EffectiveFieldBoxView extends FieldBoxView {
  inherited?: boolean;
}

export interface SpecPackView {
  pack_id: string;
  project_id: string;
  name: string;
  version: string;
  group_keys_json: string | null;
  order_key: string | null;
  effective_standard_version_id: string | null;
  templates?: TemplateView[];
}

export interface FieldBoxView {
  template_id: string;
  field_key: string;
  value_type: string;
  page: number;
  x: string;
  y: string;
  w: string;
  h: string;
}

export interface RuleVersionView {
  version_id: string;
  rule_id: string;
  dsl_json: string;
  status: string;
  blocking: number;
}

export interface RuleFixtureView {
  id: number;
  version_id: string;
  kind: string;
  payload_json: string;
  last_result: string | null;
}

export interface RetrieveHitView {
  clause_id: string;
  standard_version_id: string;
  span: { start: number; end: number } | null;
  retrieve_path: string;
}

export interface VolumeLeafNode {
  kind: "leaf";
  extractionId: string;
  fields: Record<string, unknown>;
}

export interface VolumeGroupNode {
  kind: "group";
  key: string;
  value: string;
  children: VolumePreviewNode[];
}

export type VolumePreviewNode = VolumeGroupNode | VolumeLeafNode;

export interface VolumePreviewTree {
  submitted: false;
  groupKeys: string[];
  orderKey: string | null;
  nodes: VolumePreviewNode[];
}

export interface AuditEventView {
  trace_id: string;
  seq: number;
  event_type: string;
  ref_id: string | null;
  payload_json: string;
  created_at: string;
}

export interface ChatThreadView {
  thread_id: string;
  trace_id: string;
  step: string;
}

export interface ChatMessageView {
  thread_id: string;
  role: string;
  body: string;
  created_at?: string;
}

/** Pretty-print extraction / payload JSON for the findings and audit panels. */
export function prettyJson(value: unknown): string {
  if (value == null) return "null";
  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
