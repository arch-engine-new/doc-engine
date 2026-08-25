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

## Relations

_No relations discovered._
