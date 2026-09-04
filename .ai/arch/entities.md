# Entities

## t_agent_graph

Table: `t_agent_graph` | Source: sql | Module: 

| Field | Type | Column | Nullable |
|-------|------|--------|----------|
| id | INTEGER | id | yes |
| graph_id | VARCHAR | graph_id | no |
| name | VARCHAR | name | yes |
| version | INTEGER | version | no |
| def_json | TEXT | def_json | no |
| status | INTEGER | status | no |
| created_at | TEXT | created_at | no |
| updated_at | TEXT | updated_at | no |
| creator | VARCHAR | creator | no |
| updater | VARCHAR | updater | no |
| deleted | INTEGER | deleted | no |

## t_agent_run

Table: `t_agent_run` | Source: sql | Module: 

| Field | Type | Column | Nullable |
|-------|------|--------|----------|
| id | INTEGER | id | yes |
| run_id | VARCHAR | run_id | no |
| graph_id | VARCHAR | graph_id | no |
| thread_id | VARCHAR | thread_id | yes |
| status | VARCHAR | status | no |
| input_json | TEXT | input_json | yes |
| output_json | TEXT | output_json | yes |
| error_json | TEXT | error_json | yes |
| current_node_id | VARCHAR | current_node_id | yes |
| parent_run_id | VARCHAR | parent_run_id | yes |
| started_at | TEXT | started_at | yes |
| finished_at | TEXT | finished_at | yes |
| created_at | TEXT | created_at | no |
| updated_at | TEXT | updated_at | no |
| creator | VARCHAR | creator | no |
| updater | VARCHAR | updater | no |
| deleted | INTEGER | deleted | no |

## t_agent_node_execution

Table: `t_agent_node_execution` | Source: sql | Module: 

| Field | Type | Column | Nullable |
|-------|------|--------|----------|
| id | INTEGER | id | yes |
| run_id | VARCHAR | run_id | no |
| node_id | VARCHAR | node_id | no |
| node_type | VARCHAR | node_type | no |
| attempt | INTEGER | attempt | no |
| status | VARCHAR | status | no |
| input_json | TEXT | input_json | yes |
| output_json | TEXT | output_json | yes |
| error_json | TEXT | error_json | yes |
| started_at | TEXT | started_at | yes |
| finished_at | TEXT | finished_at | yes |
| created_at | TEXT | created_at | no |
| updated_at | TEXT | updated_at | no |
| creator | VARCHAR | creator | no |
| updater | VARCHAR | updater | no |
| deleted | INTEGER | deleted | no |

## t_agent_checkpoint

Table: `t_agent_checkpoint` | Source: sql | Module: 

| Field | Type | Column | Nullable |
|-------|------|--------|----------|
| id | INTEGER | id | yes |
| run_id | VARCHAR | run_id | no |
| seq | INTEGER | seq | no |
| node_id | VARCHAR | node_id | yes |
| state_json | TEXT | state_json | no |
| metadata_json | TEXT | metadata_json | yes |
| created_at | TEXT | created_at | no |
| updated_at | TEXT | updated_at | no |
| creator | VARCHAR | creator | no |
| updater | VARCHAR | updater | no |
| deleted | INTEGER | deleted | no |

## t_agent_tool_call

Table: `t_agent_tool_call` | Source: sql | Module: 

| Field | Type | Column | Nullable |
|-------|------|--------|----------|
| id | INTEGER | id | yes |
| run_id | VARCHAR | run_id | no |
| node_execution_id | INTEGER | node_execution_id | yes |
| tool_name | VARCHAR | tool_name | no |
| idempotency_key | VARCHAR | idempotency_key | no |
| request_json | TEXT | request_json | yes |
| response_json | TEXT | response_json | yes |
| status | VARCHAR | status | no |
| error_json | TEXT | error_json | yes |
| duration_ms | INTEGER | duration_ms | yes |
| created_at | TEXT | created_at | no |
| updated_at | TEXT | updated_at | no |
| creator | VARCHAR | creator | no |
| updater | VARCHAR | updater | no |
| deleted | INTEGER | deleted | no |

## t_agent_run_event

Table: `t_agent_run_event` | Source: sql | Module: 

| Field | Type | Column | Nullable |
|-------|------|--------|----------|
| id | INTEGER | id | yes |
| run_id | VARCHAR | run_id | no |
| seq | INTEGER | seq | no |
| event_type | VARCHAR | event_type | no |
| payload_json | TEXT | payload_json | no |
| created_at | TEXT | created_at | no |
| updated_at | TEXT | updated_at | no |
| creator | VARCHAR | creator | no |
| updater | VARCHAR | updater | no |
| deleted | INTEGER | deleted | no |

## t_agent_hitl_interrupt

Table: `t_agent_hitl_interrupt` | Source: sql | Module: 

| Field | Type | Column | Nullable |
|-------|------|--------|----------|
| id | INTEGER | id | yes |
| run_id | VARCHAR | run_id | no |
| node_id | VARCHAR | node_id | no |
| token | VARCHAR | token | no |
| status | VARCHAR | status | no |
| payload_json | TEXT | payload_json | yes |
| decision_json | TEXT | decision_json | yes |
| expires_at | TEXT | expires_at | yes |
| resumed_at | TEXT | resumed_at | yes |
| created_at | TEXT | created_at | no |
| updated_at | TEXT | updated_at | no |
| creator | VARCHAR | creator | no |
| updater | VARCHAR | updater | no |
| deleted | INTEGER | deleted | no |

## t_project

Table: `t_project` | Source: sql | Module: 

| Field | Type | Column | Nullable |
|-------|------|--------|----------|
| id | BIGINT | id | yes |
| project_id | VARCHAR | project_id | no |
| name | VARCHAR | name | no |
| created_at | TIMESTAMP | created_at | no |
| updated_at | TIMESTAMP | updated_at | no |
| creator | VARCHAR | creator | no |
| updater | VARCHAR | updater | no |
| deleted | SMALLINT | deleted | no |

## t_spec_pack

Table: `t_spec_pack` | Source: sql | Module: 

| Field | Type | Column | Nullable |
|-------|------|--------|----------|
| id | BIGINT | id | yes |
| pack_id | VARCHAR | pack_id | no |
| project_id | VARCHAR | project_id | no |
| name | VARCHAR | name | no |
| version | VARCHAR | version | no |
| group_keys_json | JSONB | group_keys_json | yes |
| order_key | VARCHAR | order_key | yes |
| effective_standard_version_id | VARCHAR | effective_standard_version_id | yes |
| created_at | TIMESTAMP | created_at | no |
| updated_at | TIMESTAMP | updated_at | no |
| creator | VARCHAR | creator | no |
| updater | VARCHAR | updater | no |
| deleted | SMALLINT | deleted | no |

## t_doc_type

Table: `t_doc_type` | Source: sql | Module: 

| Field | Type | Column | Nullable |
|-------|------|--------|----------|
| id | BIGINT | id | yes |
| doc_type_id | VARCHAR | doc_type_id | no |
| pack_id | VARCHAR | pack_id | no |
| parent_doc_type_id | VARCHAR | parent_doc_type_id | yes |
| name | VARCHAR | name | no |
| created_at | TIMESTAMP | created_at | no |
| updated_at | TIMESTAMP | updated_at | no |
| creator | VARCHAR | creator | no |
| updater | VARCHAR | updater | no |
| deleted | SMALLINT | deleted | no |

## t_field_def

Table: `t_field_def` | Source: sql | Module: 

| Field | Type | Column | Nullable |
|-------|------|--------|----------|
| id | BIGINT | id | yes |
| doc_type_id | VARCHAR | doc_type_id | no |
| field_key | VARCHAR | field_key | no |
| value_type | VARCHAR | value_type | no |
| required | SMALLINT | required | no |
| created_at | TIMESTAMP | created_at | no |
| updated_at | TIMESTAMP | updated_at | no |
| creator | VARCHAR | creator | no |
| updater | VARCHAR | updater | no |
| deleted | SMALLINT | deleted | no |

## t_template

Table: `t_template` | Source: sql | Module: 

| Field | Type | Column | Nullable |
|-------|------|--------|----------|
| id | BIGINT | id | yes |
| template_id | VARCHAR | template_id | no |
| pack_id | VARCHAR | pack_id | no |
| doc_type_id | VARCHAR | doc_type_id | no |
| name | VARCHAR | name | no |
| page_image_uri | VARCHAR | page_image_uri | yes |
| layout_kind | VARCHAR | layout_kind | no |
| excel_template_uri | VARCHAR | excel_template_uri | yes |
| excel_sheet_name | VARCHAR | excel_sheet_name | yes |
| created_at | TIMESTAMP | created_at | no |
| updated_at | TIMESTAMP | updated_at | no |
| creator | VARCHAR | creator | no |
| updater | VARCHAR | updater | no |
| deleted | SMALLINT | deleted | no |

## t_excel_cell_mapping

Table: `t_excel_cell_mapping` | Source: sql | Module: 

| Field | Type | Column | Nullable |
|-------|------|--------|----------|
| id | BIGINT | id | yes |
| mapping_id | VARCHAR | mapping_id | no |
| template_id | VARCHAR | template_id | no |
| sheet_name | VARCHAR | sheet_name | no |
| cell | VARCHAR | cell | no |
| field_key | VARCHAR | field_key | no |
| value_type | VARCHAR | value_type | no |
| signature_role | VARCHAR | signature_role | yes |
| created_at | TIMESTAMP | created_at | no |
| updated_at | TIMESTAMP | updated_at | no |
| creator | VARCHAR | creator | no |
| updater | VARCHAR | updater | no |
| deleted | SMALLINT | deleted | no |

## t_field_fill_rule

Table: `t_field_fill_rule` | Source: sql | Module: 

| Field | Type | Column | Nullable |
|-------|------|--------|----------|
| id | BIGINT | id | yes |
| doc_type_id | VARCHAR | doc_type_id | no |
| field_key | VARCHAR | field_key | no |
| required | SMALLINT | required | no |
| pattern | VARCHAR | pattern | yes |
| min_num | NUMERIC | min_num | yes |
| max_num | NUMERIC | max_num | yes |
| default_generator | VARCHAR | default_generator | yes |
| default_literal | TEXT | default_literal | yes |
| created_at | TIMESTAMP | created_at | no |
| updated_at | TIMESTAMP | updated_at | no |
| creator | VARCHAR | creator | no |
| updater | VARCHAR | updater | no |
| deleted | SMALLINT | deleted | no |

## t_document_artifact

Table: `t_document_artifact` | Source: sql | Module: 

| Field | Type | Column | Nullable |
|-------|------|--------|----------|
| id | BIGINT | id | yes |
| artifact_id | VARCHAR | artifact_id | no |
| project_id | VARCHAR | project_id | no |
| doc_type_id | VARCHAR | doc_type_id | no |
| template_id | VARCHAR | template_id | no |
| file_uri | VARCHAR | file_uri | no |
| adapter_document_id | VARCHAR | adapter_document_id | yes |
| status | VARCHAR | status | no |
| trace_id | VARCHAR | trace_id | no |
| receipt_id | VARCHAR | receipt_id | yes |
| metadata_json | JSONB | metadata_json | yes |
| created_at | TIMESTAMP | created_at | no |
| updated_at | TIMESTAMP | updated_at | no |
| creator | VARCHAR | creator | no |
| updater | VARCHAR | updater | no |
| deleted | SMALLINT | deleted | no |

## t_signature_task

Table: `t_signature_task` | Source: sql | Module: 

| Field | Type | Column | Nullable |
|-------|------|--------|----------|
| id | BIGINT | id | yes |
| task_id | VARCHAR | task_id | no |
| artifact_id | VARCHAR | artifact_id | no |
| role | VARCHAR | role | no |
| assignee_label | VARCHAR | assignee_label | yes |
| status | VARCHAR | status | no |
| signer_name | VARCHAR | signer_name | yes |
| trace_id | VARCHAR | trace_id | no |
| receipt_id | VARCHAR | receipt_id | yes |
| created_at | TIMESTAMP | created_at | no |
| updated_at | TIMESTAMP | updated_at | no |
| creator | VARCHAR | creator | no |
| updater | VARCHAR | updater | no |
| deleted | SMALLINT | deleted | no |

## t_completeness_rule

Table: `t_completeness_rule` | Source: sql | Module: 

| Field | Type | Column | Nullable |
|-------|------|--------|----------|
| id | BIGINT | id | yes |
| rule_id | VARCHAR | rule_id | no |
| pack_id | VARCHAR | pack_id | no |
| doc_type_id | VARCHAR | doc_type_id | no |
| label | VARCHAR | label | no |
| required | SMALLINT | required | no |
| created_at | TIMESTAMP | created_at | no |
| updated_at | TIMESTAMP | updated_at | no |
| creator | VARCHAR | creator | no |
| updater | VARCHAR | updater | no |
| deleted | SMALLINT | deleted | no |

## t_field_box

Table: `t_field_box` | Source: sql | Module: 

| Field | Type | Column | Nullable |
|-------|------|--------|----------|
| id | BIGINT | id | yes |
| template_id | VARCHAR | template_id | no |
| field_key | VARCHAR | field_key | no |
| value_type | VARCHAR | value_type | no |
| page | INT | page | no |
| x | NUMERIC | x | no |
| y | NUMERIC | y | no |
| w | NUMERIC | w | no |
| h | NUMERIC | h | no |
| created_at | TIMESTAMP | created_at | no |
| updated_at | TIMESTAMP | updated_at | no |
| creator | VARCHAR | creator | no |
| updater | VARCHAR | updater | no |
| deleted | SMALLINT | deleted | no |

## t_rule

Table: `t_rule` | Source: sql | Module: 

| Field | Type | Column | Nullable |
|-------|------|--------|----------|
| id | BIGINT | id | yes |
| rule_id | VARCHAR | rule_id | no |
| pack_id | VARCHAR | pack_id | no |
| title | VARCHAR | title | yes |
| created_at | TIMESTAMP | created_at | no |
| updated_at | TIMESTAMP | updated_at | no |
| creator | VARCHAR | creator | no |
| updater | VARCHAR | updater | no |
| deleted | SMALLINT | deleted | no |

## t_rule_version

Table: `t_rule_version` | Source: sql | Module: 

| Field | Type | Column | Nullable |
|-------|------|--------|----------|
| id | BIGINT | id | yes |
| version_id | VARCHAR | version_id | no |
| rule_id | VARCHAR | rule_id | no |
| dsl_json | JSONB | dsl_json | no |
| status | VARCHAR | status | no |
| blocking | SMALLINT | blocking | no |
| created_at | TIMESTAMP | created_at | no |
| updated_at | TIMESTAMP | updated_at | no |
| creator | VARCHAR | creator | no |
| updater | VARCHAR | updater | no |
| deleted | SMALLINT | deleted | no |

## t_rule_fixture

Table: `t_rule_fixture` | Source: sql | Module: 

| Field | Type | Column | Nullable |
|-------|------|--------|----------|
| id | BIGINT | id | yes |
| version_id | VARCHAR | version_id | no |
| kind | VARCHAR | kind | no |
| payload_json | JSONB | payload_json | no |
| last_result | VARCHAR | last_result | yes |
| created_at | TIMESTAMP | created_at | no |
| updated_at | TIMESTAMP | updated_at | no |
| creator | VARCHAR | creator | no |
| updater | VARCHAR | updater | no |
| deleted | SMALLINT | deleted | no |

## t_standard_doc

Table: `t_standard_doc` | Source: sql | Module: 

| Field | Type | Column | Nullable |
|-------|------|--------|----------|
| id | BIGINT | id | yes |
| doc_id | VARCHAR | doc_id | no |
| pack_id | VARCHAR | pack_id | no |
| title | VARCHAR | title | no |
| file_uri | VARCHAR | file_uri | no |
| created_at | TIMESTAMP | created_at | no |
| updated_at | TIMESTAMP | updated_at | no |
| creator | VARCHAR | creator | no |
| updater | VARCHAR | updater | no |
| deleted | SMALLINT | deleted | no |

## t_standard_version

Table: `t_standard_version` | Source: sql | Module: 

| Field | Type | Column | Nullable |
|-------|------|--------|----------|
| id | BIGINT | id | yes |
| version_id | VARCHAR | version_id | no |
| doc_id | VARCHAR | doc_id | no |
| status | VARCHAR | status | no |
| created_at | TIMESTAMP | created_at | no |
| updated_at | TIMESTAMP | updated_at | no |
| creator | VARCHAR | creator | no |
| updater | VARCHAR | updater | no |
| deleted | SMALLINT | deleted | no |

## t_clause

Table: `t_clause` | Source: sql | Module: 

| Field | Type | Column | Nullable |
|-------|------|--------|----------|
| id | BIGINT | id | yes |
| clause_id | VARCHAR | clause_id | no |
| version_id | VARCHAR | version_id | no |
| parent_clause_id | VARCHAR | parent_clause_id | yes |
| heading | VARCHAR | heading | yes |
| body | TEXT | body | no |
| span_json | JSONB | span_json | yes |
| qdrant_point_id | VARCHAR | qdrant_point_id | yes |
| created_at | TIMESTAMP | created_at | no |
| updated_at | TIMESTAMP | updated_at | no |
| creator | VARCHAR | creator | no |
| updater | VARCHAR | updater | no |
| deleted | SMALLINT | deleted | no |

## t_standard_edge

Table: `t_standard_edge` | Source: sql | Module: 

| Field | Type | Column | Nullable |
|-------|------|--------|----------|
| id | BIGINT | id | yes |
| from_clause_id | VARCHAR | from_clause_id | no |
| to_clause_id | VARCHAR | to_clause_id | no |
| kind | VARCHAR | kind | no |
| created_at | TIMESTAMP | created_at | no |
| updated_at | TIMESTAMP | updated_at | no |
| creator | VARCHAR | creator | no |
| updater | VARCHAR | updater | no |
| deleted | SMALLINT | deleted | no |

## t_job

Table: `t_job` | Source: sql | Module: 

| Field | Type | Column | Nullable |
|-------|------|--------|----------|
| id | BIGINT | id | yes |
| job_id | VARCHAR | job_id | no |
| project_id | VARCHAR | project_id | no |
| pack_id | VARCHAR | pack_id | yes |
| trace_id | VARCHAR | trace_id | no |
| status | VARCHAR | status | no |
| template_id | VARCHAR | template_id | yes |
| doc_type_id | VARCHAR | doc_type_id | yes |
| agent_run_id | VARCHAR | agent_run_id | yes |
| created_at | TIMESTAMP | created_at | no |
| updated_at | TIMESTAMP | updated_at | no |
| creator | VARCHAR | creator | no |
| updater | VARCHAR | updater | no |
| deleted | SMALLINT | deleted | no |

## t_document

Table: `t_document` | Source: sql | Module: 

| Field | Type | Column | Nullable |
|-------|------|--------|----------|
| id | BIGINT | id | yes |
| doc_id | VARCHAR | doc_id | no |
| job_id | VARCHAR | job_id | no |
| file_name | VARCHAR | file_name | no |
| file_uri | VARCHAR | file_uri | no |
| mime | VARCHAR | mime | yes |
| created_at | TIMESTAMP | created_at | no |
| updated_at | TIMESTAMP | updated_at | no |
| creator | VARCHAR | creator | no |
| updater | VARCHAR | updater | no |
| deleted | SMALLINT | deleted | no |

## t_extraction

Table: `t_extraction` | Source: sql | Module: 

| Field | Type | Column | Nullable |
|-------|------|--------|----------|
| id | BIGINT | id | yes |
| extraction_id | VARCHAR | extraction_id | no |
| job_id | VARCHAR | job_id | no |
| ocr_text | TEXT | ocr_text | yes |
| fields_json | JSONB | fields_json | no |
| created_at | TIMESTAMP | created_at | no |
| updated_at | TIMESTAMP | updated_at | no |
| creator | VARCHAR | creator | no |
| updater | VARCHAR | updater | no |
| deleted | SMALLINT | deleted | no |

## t_finding

Table: `t_finding` | Source: sql | Module: 

| Field | Type | Column | Nullable |
|-------|------|--------|----------|
| id | BIGINT | id | yes |
| finding_id | VARCHAR | finding_id | no |
| job_id | VARCHAR | job_id | no |
| rule_version_id | VARCHAR | rule_version_id | no |
| result | VARCHAR | result | no |
| blocking | SMALLINT | blocking | no |
| detail | VARCHAR | detail | yes |
| clause_id | VARCHAR | clause_id | yes |
| standard_version_id | VARCHAR | standard_version_id | yes |
| retrieve_path | VARCHAR | retrieve_path | yes |
| created_at | TIMESTAMP | created_at | no |
| updated_at | TIMESTAMP | updated_at | no |
| creator | VARCHAR | creator | no |
| updater | VARCHAR | updater | no |
| deleted | SMALLINT | deleted | no |

## t_proposal

Table: `t_proposal` | Source: sql | Module: 

| Field | Type | Column | Nullable |
|-------|------|--------|----------|
| id | BIGINT | id | yes |
| proposal_id | VARCHAR | proposal_id | no |
| job_id | VARCHAR | job_id | no |
| status | VARCHAR | status | no |
| wording | TEXT | wording | no |
| agent_run_id | VARCHAR | agent_run_id | yes |
| created_at | TIMESTAMP | created_at | no |
| updated_at | TIMESTAMP | updated_at | no |
| creator | VARCHAR | creator | no |
| updater | VARCHAR | updater | no |
| deleted | SMALLINT | deleted | no |

## t_receipt

Table: `t_receipt` | Source: sql | Module: 

| Field | Type | Column | Nullable |
|-------|------|--------|----------|
| id | BIGINT | id | yes |
| receipt_id | VARCHAR | receipt_id | no |
| proposal_id | VARCHAR | proposal_id | yes |
| job_id | VARCHAR | job_id | no |
| status | VARCHAR | status | no |
| payload_json | JSONB | payload_json | yes |
| created_at | TIMESTAMP | created_at | no |
| updated_at | TIMESTAMP | updated_at | no |
| creator | VARCHAR | creator | no |
| updater | VARCHAR | updater | no |
| deleted | SMALLINT | deleted | no |

## t_volume_preview

Table: `t_volume_preview` | Source: sql | Module: 

| Field | Type | Column | Nullable |
|-------|------|--------|----------|
| id | BIGINT | id | yes |
| preview_id | VARCHAR | preview_id | no |
| job_id | VARCHAR | job_id | no |
| tree_json | JSONB | tree_json | no |
| created_at | TIMESTAMP | created_at | no |
| updated_at | TIMESTAMP | updated_at | no |
| creator | VARCHAR | creator | no |
| updater | VARCHAR | updater | no |
| deleted | SMALLINT | deleted | no |

## t_audit_event

Table: `t_audit_event` | Source: sql | Module: 

| Field | Type | Column | Nullable |
|-------|------|--------|----------|
| id | BIGINT | id | yes |
| trace_id | VARCHAR | trace_id | no |
| seq | INT | seq | no |
| event_type | VARCHAR | event_type | no |
| ref_id | VARCHAR | ref_id | yes |
| payload_json | JSONB | payload_json | no |
| created_at | TIMESTAMP | created_at | no |
| updated_at | TIMESTAMP | updated_at | no |
| creator | VARCHAR | creator | no |
| updater | VARCHAR | updater | no |
| deleted | SMALLINT | deleted | no |

## t_conversation_thread

Table: `t_conversation_thread` | Source: sql | Module: 

| Field | Type | Column | Nullable |
|-------|------|--------|----------|
| id | BIGINT | id | yes |
| thread_id | VARCHAR | thread_id | no |
| trace_id | VARCHAR | trace_id | no |
| step | VARCHAR | step | no |
| job_id | VARCHAR | job_id | yes |
| hitl_token | VARCHAR | hitl_token | yes |
| created_at | TIMESTAMP | created_at | no |
| updated_at | TIMESTAMP | updated_at | no |
| creator | VARCHAR | creator | no |
| updater | VARCHAR | updater | no |
| deleted | SMALLINT | deleted | no |

## t_conversation_message

Table: `t_conversation_message` | Source: sql | Module: 

| Field | Type | Column | Nullable |
|-------|------|--------|----------|
| id | BIGINT | id | yes |
| thread_id | VARCHAR | thread_id | no |
| role | VARCHAR | role | no |
| body | TEXT | body | no |
| created_at | TIMESTAMP | created_at | no |
| updated_at | TIMESTAMP | updated_at | no |
| creator | VARCHAR | creator | no |
| updater | VARCHAR | updater | no |
| deleted | SMALLINT | deleted | no |

## Relations

_No relations discovered._
