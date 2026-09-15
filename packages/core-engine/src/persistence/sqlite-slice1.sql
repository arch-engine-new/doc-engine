-- SLICE-1/2 SQLite mapping of core-engine PG contract.
-- JSONB→TEXT, IDENTITY→AUTOINCREMENT INTEGER PK, TIMESTAMP→TEXT, SMALLINT→INTEGER, NUMERIC→TEXT.
-- Table names match production: t_project, t_spec_pack, t_doc_type, t_field_def, t_template, t_field_box, t_job, t_document,
-- t_extraction, t_rule, t_rule_version, t_rule_fixture, t_finding, t_proposal, t_receipt,
-- t_volume_preview, t_audit_event, t_conversation_thread, t_conversation_message,
-- t_standard_doc, t_standard_version, t_clause, t_standard_edge,
-- t_layout_unit, t_layout_edge, t_ingest_run, t_ingest_page.
-- Not a substitute for docs/schema/generated/core-engine-migration.sql (PostgreSQL).

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS t_project (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id VARCHAR(64) NOT NULL,
  name VARCHAR(128) NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  creator VARCHAR(64) NOT NULL DEFAULT 'system',
  updater VARCHAR(64) NOT NULL DEFAULT 'system',
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_t_project_project_id ON t_project(project_id);

CREATE TABLE IF NOT EXISTS t_spec_pack (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pack_id VARCHAR(64) NOT NULL,
  project_id VARCHAR(64) NOT NULL,
  name VARCHAR(128) NOT NULL,
  version VARCHAR(32) NOT NULL,
  group_keys_json TEXT NULL,
  order_key VARCHAR(64) NULL,
  effective_standard_version_id VARCHAR(64) NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  creator VARCHAR(64) NOT NULL DEFAULT 'system',
  updater VARCHAR(64) NOT NULL DEFAULT 'system',
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_t_spec_pack_pack_id ON t_spec_pack(pack_id);
CREATE INDEX IF NOT EXISTS idx_t_spec_pack_project_id ON t_spec_pack(project_id);

CREATE TABLE IF NOT EXISTS t_doc_type (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_type_id VARCHAR(64) NOT NULL,
  pack_id VARCHAR(64) NOT NULL,
  parent_doc_type_id VARCHAR(64) NULL,
  name VARCHAR(128) NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  creator VARCHAR(64) NOT NULL DEFAULT 'system',
  updater VARCHAR(64) NOT NULL DEFAULT 'system',
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_t_doc_type_doc_type_id ON t_doc_type(doc_type_id);
CREATE INDEX IF NOT EXISTS idx_t_doc_type_pack_id ON t_doc_type(pack_id);
CREATE INDEX IF NOT EXISTS idx_t_doc_type_parent_doc_type_id ON t_doc_type(parent_doc_type_id);

CREATE TABLE IF NOT EXISTS t_field_def (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_type_id VARCHAR(64) NOT NULL,
  field_key VARCHAR(64) NOT NULL,
  value_type VARCHAR(32) NOT NULL,
  required INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  creator VARCHAR(64) NOT NULL DEFAULT 'system',
  updater VARCHAR(64) NOT NULL DEFAULT 'system',
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_t_field_def_doc_type_id ON t_field_def(doc_type_id);
CREATE UNIQUE INDEX IF NOT EXISTS uk_t_field_def_doc_type_field ON t_field_def(doc_type_id, field_key);

CREATE TABLE IF NOT EXISTS t_template (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id VARCHAR(64) NOT NULL,
  pack_id VARCHAR(64) NOT NULL,
  doc_type_id VARCHAR(64) NOT NULL DEFAULT '',
  name VARCHAR(128) NOT NULL,
  page_image_uri VARCHAR(512) NULL,
  layout_kind VARCHAR(16) NOT NULL DEFAULT 'raster',
  excel_template_uri VARCHAR(512) NULL,
  excel_sheet_name VARCHAR(128) NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  creator VARCHAR(64) NOT NULL DEFAULT 'system',
  updater VARCHAR(64) NOT NULL DEFAULT 'system',
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_t_template_template_id ON t_template(template_id);
CREATE INDEX IF NOT EXISTS idx_t_template_pack_id ON t_template(pack_id);
CREATE INDEX IF NOT EXISTS idx_t_template_doc_type_id ON t_template(doc_type_id);

CREATE TABLE IF NOT EXISTS t_excel_cell_mapping (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mapping_id VARCHAR(64) NOT NULL,
  template_id VARCHAR(64) NOT NULL,
  sheet_name VARCHAR(128) NOT NULL,
  cell VARCHAR(16) NOT NULL,
  field_key VARCHAR(64) NOT NULL,
  value_type VARCHAR(32) NOT NULL,
  signature_role VARCHAR(64) NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  creator VARCHAR(64) NOT NULL DEFAULT 'system',
  updater VARCHAR(64) NOT NULL DEFAULT 'system',
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_t_excel_cell_mapping_mapping_id ON t_excel_cell_mapping(mapping_id);
CREATE INDEX IF NOT EXISTS idx_t_excel_cell_mapping_template_id ON t_excel_cell_mapping(template_id);
CREATE UNIQUE INDEX IF NOT EXISTS uk_t_excel_cell_mapping_template_sheet_cell ON t_excel_cell_mapping(template_id, sheet_name, cell);

CREATE TABLE IF NOT EXISTS t_field_fill_rule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_type_id VARCHAR(64) NOT NULL,
  field_key VARCHAR(64) NOT NULL,
  required INTEGER NOT NULL DEFAULT 0,
  pattern VARCHAR(256) NULL,
  min_num TEXT NULL,
  max_num TEXT NULL,
  default_generator VARCHAR(32) NULL,
  default_literal TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  creator VARCHAR(64) NOT NULL DEFAULT 'system',
  updater VARCHAR(64) NOT NULL DEFAULT 'system',
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_t_field_fill_rule_doc_type_id ON t_field_fill_rule(doc_type_id);
CREATE UNIQUE INDEX IF NOT EXISTS uk_t_field_fill_rule_doc_type_field ON t_field_fill_rule(doc_type_id, field_key);

CREATE TABLE IF NOT EXISTS t_document_artifact (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  artifact_id VARCHAR(64) NOT NULL,
  project_id VARCHAR(64) NOT NULL,
  doc_type_id VARCHAR(64) NOT NULL,
  template_id VARCHAR(64) NOT NULL,
  file_uri VARCHAR(512) NOT NULL,
  adapter_document_id VARCHAR(64) NULL,
  status VARCHAR(32) NOT NULL,
  trace_id VARCHAR(64) NOT NULL,
  receipt_id VARCHAR(64) NULL,
  metadata_json TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  creator VARCHAR(64) NOT NULL DEFAULT 'system',
  updater VARCHAR(64) NOT NULL DEFAULT 'system',
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_t_document_artifact_artifact_id ON t_document_artifact(artifact_id);
CREATE INDEX IF NOT EXISTS idx_t_document_artifact_project_id ON t_document_artifact(project_id);
CREATE INDEX IF NOT EXISTS idx_t_document_artifact_doc_type_id ON t_document_artifact(doc_type_id);
CREATE INDEX IF NOT EXISTS idx_t_document_artifact_trace_id ON t_document_artifact(trace_id);

CREATE TABLE IF NOT EXISTS t_signature_task (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id VARCHAR(64) NOT NULL,
  artifact_id VARCHAR(64) NOT NULL,
  role VARCHAR(64) NOT NULL,
  assignee_label VARCHAR(128) NULL,
  status VARCHAR(32) NOT NULL,
  signer_name VARCHAR(128) NULL,
  trace_id VARCHAR(64) NOT NULL,
  receipt_id VARCHAR(64) NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  creator VARCHAR(64) NOT NULL DEFAULT 'system',
  updater VARCHAR(64) NOT NULL DEFAULT 'system',
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_t_signature_task_task_id ON t_signature_task(task_id);
CREATE INDEX IF NOT EXISTS idx_t_signature_task_artifact_id ON t_signature_task(artifact_id);
CREATE INDEX IF NOT EXISTS idx_t_signature_task_trace_id ON t_signature_task(trace_id);

CREATE TABLE IF NOT EXISTS t_completeness_rule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id VARCHAR(64) NOT NULL,
  pack_id VARCHAR(64) NOT NULL,
  doc_type_id VARCHAR(64) NOT NULL,
  label VARCHAR(128) NOT NULL,
  required INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  creator VARCHAR(64) NOT NULL DEFAULT 'system',
  updater VARCHAR(64) NOT NULL DEFAULT 'system',
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_t_completeness_rule_rule_id ON t_completeness_rule(rule_id);
CREATE INDEX IF NOT EXISTS idx_t_completeness_rule_pack_id ON t_completeness_rule(pack_id);

CREATE TABLE IF NOT EXISTS t_field_box (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id VARCHAR(64) NOT NULL,
  field_key VARCHAR(64) NOT NULL,
  value_type VARCHAR(32) NOT NULL,
  page INTEGER NOT NULL,
  x TEXT NOT NULL,
  y TEXT NOT NULL,
  w TEXT NOT NULL,
  h TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  creator VARCHAR(64) NOT NULL DEFAULT 'system',
  updater VARCHAR(64) NOT NULL DEFAULT 'system',
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_t_field_box_template_id ON t_field_box(template_id);
CREATE UNIQUE INDEX IF NOT EXISTS uk_t_field_box_template_field ON t_field_box(template_id, field_key);

CREATE TABLE IF NOT EXISTS t_job (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id VARCHAR(64) NOT NULL,
  project_id VARCHAR(64) NOT NULL,
  pack_id VARCHAR(64) NULL,
  trace_id VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  template_id VARCHAR(64) NULL,
  doc_type_id VARCHAR(64) NULL,
  agent_run_id VARCHAR(64) NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  creator VARCHAR(64) NOT NULL DEFAULT 'system',
  updater VARCHAR(64) NOT NULL DEFAULT 'system',
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_t_job_job_id ON t_job(job_id);
CREATE UNIQUE INDEX IF NOT EXISTS uk_t_job_trace_id ON t_job(trace_id);
CREATE INDEX IF NOT EXISTS idx_t_job_project_id ON t_job(project_id);
CREATE INDEX IF NOT EXISTS idx_t_job_status ON t_job(status);
CREATE INDEX IF NOT EXISTS idx_t_job_doc_type_id ON t_job(doc_type_id);

CREATE TABLE IF NOT EXISTS t_document (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_id VARCHAR(64) NOT NULL,
  job_id VARCHAR(64) NOT NULL,
  file_name VARCHAR(256) NOT NULL,
  file_uri VARCHAR(512) NOT NULL,
  mime VARCHAR(64) NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  creator VARCHAR(64) NOT NULL DEFAULT 'system',
  updater VARCHAR(64) NOT NULL DEFAULT 'system',
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_t_document_doc_id ON t_document(doc_id);
CREATE INDEX IF NOT EXISTS idx_t_document_job_id ON t_document(job_id);

CREATE TABLE IF NOT EXISTS t_extraction (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  extraction_id VARCHAR(64) NOT NULL,
  job_id VARCHAR(64) NOT NULL,
  ocr_text TEXT NULL,
  fields_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  creator VARCHAR(64) NOT NULL DEFAULT 'system',
  updater VARCHAR(64) NOT NULL DEFAULT 'system',
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_t_extraction_extraction_id ON t_extraction(extraction_id);
CREATE INDEX IF NOT EXISTS idx_t_extraction_job_id ON t_extraction(job_id);

CREATE TABLE IF NOT EXISTS t_rule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_id VARCHAR(64) NOT NULL,
  pack_id VARCHAR(64) NOT NULL,
  title VARCHAR(128) NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  creator VARCHAR(64) NOT NULL DEFAULT 'system',
  updater VARCHAR(64) NOT NULL DEFAULT 'system',
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_t_rule_rule_id ON t_rule(rule_id);
CREATE INDEX IF NOT EXISTS idx_t_rule_pack_id ON t_rule(pack_id);

CREATE TABLE IF NOT EXISTS t_rule_version (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version_id VARCHAR(64) NOT NULL,
  rule_id VARCHAR(64) NOT NULL,
  dsl_json TEXT NOT NULL,
  status VARCHAR(32) NOT NULL,
  blocking INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  creator VARCHAR(64) NOT NULL DEFAULT 'system',
  updater VARCHAR(64) NOT NULL DEFAULT 'system',
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_t_rule_version_version_id ON t_rule_version(version_id);
CREATE INDEX IF NOT EXISTS idx_t_rule_version_rule_id ON t_rule_version(rule_id);

CREATE TABLE IF NOT EXISTS t_rule_fixture (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version_id VARCHAR(64) NOT NULL,
  kind VARCHAR(32) NOT NULL,
  payload_json TEXT NOT NULL,
  last_result VARCHAR(32) NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  creator VARCHAR(64) NOT NULL DEFAULT 'system',
  updater VARCHAR(64) NOT NULL DEFAULT 'system',
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_t_rule_fixture_version_id ON t_rule_fixture(version_id);

CREATE TABLE IF NOT EXISTS t_finding (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  finding_id VARCHAR(64) NOT NULL,
  job_id VARCHAR(64) NOT NULL,
  rule_version_id VARCHAR(64) NOT NULL,
  result VARCHAR(32) NOT NULL,
  blocking INTEGER NOT NULL,
  detail VARCHAR(512) NULL,
  clause_id VARCHAR(64) NULL,
  standard_version_id VARCHAR(64) NULL,
  retrieve_path VARCHAR(64) NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  creator VARCHAR(64) NOT NULL DEFAULT 'system',
  updater VARCHAR(64) NOT NULL DEFAULT 'system',
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_t_finding_finding_id ON t_finding(finding_id);
CREATE INDEX IF NOT EXISTS idx_t_finding_job_id ON t_finding(job_id);
CREATE INDEX IF NOT EXISTS idx_t_finding_clause_id ON t_finding(clause_id);

CREATE TABLE IF NOT EXISTS t_proposal (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proposal_id VARCHAR(64) NOT NULL,
  job_id VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  wording TEXT NOT NULL,
  agent_run_id VARCHAR(64) NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  creator VARCHAR(64) NOT NULL DEFAULT 'system',
  updater VARCHAR(64) NOT NULL DEFAULT 'system',
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_t_proposal_proposal_id ON t_proposal(proposal_id);
CREATE INDEX IF NOT EXISTS idx_t_proposal_job_id ON t_proposal(job_id);

CREATE TABLE IF NOT EXISTS t_receipt (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  receipt_id VARCHAR(64) NOT NULL,
  proposal_id VARCHAR(64) NULL,
  job_id VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  payload_json TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  creator VARCHAR(64) NOT NULL DEFAULT 'system',
  updater VARCHAR(64) NOT NULL DEFAULT 'system',
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_t_receipt_receipt_id ON t_receipt(receipt_id);
CREATE INDEX IF NOT EXISTS idx_t_receipt_proposal_id ON t_receipt(proposal_id);

CREATE TABLE IF NOT EXISTS t_volume_preview (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  preview_id VARCHAR(64) NOT NULL,
  job_id VARCHAR(64) NOT NULL,
  tree_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  creator VARCHAR(64) NOT NULL DEFAULT 'system',
  updater VARCHAR(64) NOT NULL DEFAULT 'system',
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_t_volume_preview_preview_id ON t_volume_preview(preview_id);
CREATE INDEX IF NOT EXISTS idx_t_volume_preview_job_id ON t_volume_preview(job_id);

CREATE TABLE IF NOT EXISTS t_audit_event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trace_id VARCHAR(64) NOT NULL,
  seq INTEGER NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  ref_id VARCHAR(64) NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  creator VARCHAR(64) NOT NULL DEFAULT 'system',
  updater VARCHAR(64) NOT NULL DEFAULT 'system',
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_t_audit_event_trace_id ON t_audit_event(trace_id);
CREATE UNIQUE INDEX IF NOT EXISTS uk_t_audit_event_trace_seq ON t_audit_event(trace_id, seq);

CREATE TABLE IF NOT EXISTS t_conversation_thread (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id VARCHAR(64) NOT NULL,
  trace_id VARCHAR(64) NOT NULL,
  step VARCHAR(32) NOT NULL,
  job_id VARCHAR(64) NULL,
  hitl_token VARCHAR(128) NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  creator VARCHAR(64) NOT NULL DEFAULT 'system',
  updater VARCHAR(64) NOT NULL DEFAULT 'system',
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_t_conversation_thread_thread_id ON t_conversation_thread(thread_id);
CREATE UNIQUE INDEX IF NOT EXISTS uk_t_conversation_thread_trace_step ON t_conversation_thread(trace_id, step);

CREATE TABLE IF NOT EXISTS t_conversation_message (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id VARCHAR(64) NOT NULL,
  role VARCHAR(32) NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  creator VARCHAR(64) NOT NULL DEFAULT 'system',
  updater VARCHAR(64) NOT NULL DEFAULT 'system',
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_t_conversation_message_thread_id ON t_conversation_message(thread_id);

CREATE TABLE IF NOT EXISTS t_standard_doc (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_id VARCHAR(64) NOT NULL,
  pack_id VARCHAR(64) NOT NULL,
  title VARCHAR(256) NOT NULL,
  file_uri VARCHAR(512) NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  creator VARCHAR(64) NOT NULL DEFAULT 'system',
  updater VARCHAR(64) NOT NULL DEFAULT 'system',
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_t_standard_doc_doc_id ON t_standard_doc(doc_id);
CREATE INDEX IF NOT EXISTS idx_t_standard_doc_pack_id ON t_standard_doc(pack_id);

CREATE TABLE IF NOT EXISTS t_standard_version (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version_id VARCHAR(64) NOT NULL,
  doc_id VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  creator VARCHAR(64) NOT NULL DEFAULT 'system',
  updater VARCHAR(64) NOT NULL DEFAULT 'system',
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_t_standard_version_version_id ON t_standard_version(version_id);
CREATE INDEX IF NOT EXISTS idx_t_standard_version_doc_id ON t_standard_version(doc_id);

CREATE TABLE IF NOT EXISTS t_clause (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  clause_id VARCHAR(64) NOT NULL,
  version_id VARCHAR(64) NOT NULL,
  parent_clause_id VARCHAR(64) NULL,
  heading VARCHAR(256) NULL,
  body TEXT NOT NULL,
  span_json TEXT NULL,
  qdrant_point_id VARCHAR(64) NULL,
  file_name VARCHAR(512) NULL,
  page_start INTEGER NULL,
  page_end INTEGER NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  creator VARCHAR(64) NOT NULL DEFAULT 'system',
  updater VARCHAR(64) NOT NULL DEFAULT 'system',
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_t_clause_clause_id ON t_clause(clause_id);
CREATE INDEX IF NOT EXISTS idx_t_clause_version_id ON t_clause(version_id);
CREATE INDEX IF NOT EXISTS idx_t_clause_file_page ON t_clause(file_name, page_start);

CREATE TABLE IF NOT EXISTS t_standard_edge (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_clause_id VARCHAR(64) NOT NULL,
  to_clause_id VARCHAR(64) NOT NULL,
  kind VARCHAR(32) NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  creator VARCHAR(64) NOT NULL DEFAULT 'system',
  updater VARCHAR(64) NOT NULL DEFAULT 'system',
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_t_standard_edge_from ON t_standard_edge(from_clause_id);
CREATE INDEX IF NOT EXISTS idx_t_standard_edge_to ON t_standard_edge(to_clause_id);

CREATE TABLE IF NOT EXISTS t_layout_unit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id VARCHAR(64) NOT NULL,
  version_id VARCHAR(64) NOT NULL,
  chunk_kind VARCHAR(16) NOT NULL,
  clause_id VARCHAR(64) NULL,
  file_name VARCHAR(512) NOT NULL,
  page_start INTEGER NOT NULL,
  page_end INTEGER NOT NULL,
  heading VARCHAR(256) NULL,
  body_markdown TEXT NOT NULL,
  qdrant_point_id VARCHAR(64) NOT NULL,
  ingest_run_id VARCHAR(64) NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  creator VARCHAR(64) NOT NULL DEFAULT 'system',
  updater VARCHAR(64) NOT NULL DEFAULT 'system',
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_t_layout_unit_unit_id ON t_layout_unit(unit_id);
CREATE INDEX IF NOT EXISTS idx_t_layout_unit_version_id ON t_layout_unit(version_id);

CREATE TABLE IF NOT EXISTS t_layout_edge (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_unit_id VARCHAR(64) NOT NULL,
  to_unit_id VARCHAR(64) NOT NULL,
  kind VARCHAR(32) NOT NULL,
  link_method VARCHAR(16) NOT NULL,
  confidence REAL NULL DEFAULT 1.0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  creator VARCHAR(64) NOT NULL DEFAULT 'system',
  updater VARCHAR(64) NOT NULL DEFAULT 'system',
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_t_layout_edge_from ON t_layout_edge(from_unit_id);
CREATE INDEX IF NOT EXISTS idx_t_layout_edge_to ON t_layout_edge(to_unit_id);

CREATE TABLE IF NOT EXISTS t_ingest_run (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ingest_run_id VARCHAR(64) NOT NULL,
  doc_id VARCHAR(64) NOT NULL,
  pack_id VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  file_name VARCHAR(512) NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  creator VARCHAR(64) NOT NULL DEFAULT 'system',
  updater VARCHAR(64) NOT NULL DEFAULT 'system',
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_t_ingest_run_ingest_run_id ON t_ingest_run(ingest_run_id);

CREATE TABLE IF NOT EXISTS t_ingest_page (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ingest_run_id VARCHAR(64) NOT NULL,
  doc_id VARCHAR(64) NOT NULL,
  page_no INTEGER NOT NULL,
  status VARCHAR(16) NOT NULL,
  error VARCHAR(512) NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  creator VARCHAR(64) NOT NULL DEFAULT 'system',
  updater VARCHAR(64) NOT NULL DEFAULT 'system',
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_t_ingest_page_run_page ON t_ingest_page(ingest_run_id, page_no);
