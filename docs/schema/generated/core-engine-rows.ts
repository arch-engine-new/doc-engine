/** Generated companion types for core-engine schema (sql-fallback apply). */

export type JsonValue = string;

export interface AuditColumns {
  id: number;
  created_at: string;
  updated_at: string;
  creator: string;
  updater: string;
  deleted: number;
}

export interface ProjectRow extends AuditColumns {
  project_id: string;
  name: string;
}

export interface SpecPackRow extends AuditColumns {
  pack_id: string;
  project_id: string;
  name: string;
  version: string;
  group_keys_json: JsonValue | null;
  order_key: string | null;
  effective_standard_version_id: string | null;
}

export interface DocTypeRow extends AuditColumns {
  doc_type_id: string;
  pack_id: string;
  parent_doc_type_id: string | null;
  name: string;
}

export interface FieldDefRow extends AuditColumns {
  doc_type_id: string;
  field_key: string;
  value_type: string;
  required: number;
}

export interface TemplateRow extends AuditColumns {
  template_id: string;
  pack_id: string;
  doc_type_id: string;
  name: string;
  page_image_uri: string | null;
}

export interface FieldBoxRow extends AuditColumns {
  template_id: string;
  field_key: string;
  value_type: string;
  page: number;
  x: string;
  y: string;
  w: string;
  h: string;
}

export interface RuleRow extends AuditColumns {
  rule_id: string;
  pack_id: string;
  title: string | null;
}

export interface RuleVersionRow extends AuditColumns {
  version_id: string;
  rule_id: string;
  dsl_json: JsonValue;
  status: string;
  blocking: number;
}

export interface RuleFixtureRow extends AuditColumns {
  version_id: string;
  kind: string;
  payload_json: JsonValue;
  last_result: string | null;
}

export interface StandardDocRow extends AuditColumns {
  doc_id: string;
  pack_id: string;
  title: string;
  file_uri: string;
}

export interface StandardVersionRow extends AuditColumns {
  version_id: string;
  doc_id: string;
  status: string;
}

export interface ClauseRow extends AuditColumns {
  clause_id: string;
  version_id: string;
  parent_clause_id: string | null;
  heading: string | null;
  body: string;
  span_json: JsonValue | null;
  qdrant_point_id: string | null;
}

export interface StandardEdgeRow extends AuditColumns {
  from_clause_id: string;
  to_clause_id: string;
  kind: string;
}

export interface JobRow extends AuditColumns {
  job_id: string;
  project_id: string;
  pack_id: string | null;
  trace_id: string;
  status: string;
  template_id: string | null;
  doc_type_id: string | null;
  agent_run_id: string | null;
}

export interface DocumentRow extends AuditColumns {
  doc_id: string;
  job_id: string;
  file_name: string;
  file_uri: string;
  mime: string | null;
}

export interface ExtractionRow extends AuditColumns {
  extraction_id: string;
  job_id: string;
  ocr_text: string | null;
  fields_json: JsonValue;
}

export interface FindingRow extends AuditColumns {
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

export interface ProposalRow extends AuditColumns {
  proposal_id: string;
  job_id: string;
  status: string;
  wording: string;
  agent_run_id: string | null;
}

export interface ReceiptRow extends AuditColumns {
  receipt_id: string;
  proposal_id: string | null;
  job_id: string;
  status: string;
  payload_json: JsonValue | null;
}

export interface VolumePreviewRow extends AuditColumns {
  preview_id: string;
  job_id: string;
  tree_json: JsonValue;
}

export interface AuditEventRow extends AuditColumns {
  trace_id: string;
  seq: number;
  event_type: string;
  ref_id: string | null;
  payload_json: JsonValue;
}

export interface ConversationThreadRow extends AuditColumns {
  thread_id: string;
  trace_id: string;
  step: string;
  job_id: string | null;
  hitl_token: string | null;
}

export interface ConversationMessageRow extends AuditColumns {
  thread_id: string;
  role: string;
  body: string;
}
