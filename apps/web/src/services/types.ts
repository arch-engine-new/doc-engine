/** API shapes used by Walking Skeleton views. Field names match ledger snake_case. */

export interface JobView {
  job_id: string;
  project_id: string;
  pack_id: string | null;
  trace_id: string;
  status: string;
  template_id: string | null;
  doc_type_id: string | null;
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

export interface DocTypeView {
  doc_type_id: string;
  pack_id: string;
  parent_doc_type_id: string | null;
  name: string;
}

export interface FieldDefView {
  doc_type_id: string;
  field_key: string;
  value_type: string;
  required: number;
}

export interface TemplateView {
  template_id: string;
  pack_id: string;
  doc_type_id: string;
  name: string;
  page_image_uri: string | null;
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

export interface EffectiveFieldBoxView {
  field_key: string;
  value_type: string;
  page: number;
  x: string;
  y: string;
  w: string;
  h: string;
  inherited?: boolean;
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
