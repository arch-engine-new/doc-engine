/** Generated companion types for agent-runtime schema (sql-fallback apply). */
export type JsonText = string;

export interface AgentGraphRow {
  id: number;
  graph_id: string;
  name: string | null;
  version: number;
  def_json: JsonText;
  status: number;
  created_at: string;
  updated_at: string;
  creator: string;
  updater: string;
  deleted: number;
}

export interface AgentRunRow {
  id: number;
  run_id: string;
  graph_id: string;
  thread_id: string | null;
  status: string;
  input_json: JsonText | null;
  output_json: JsonText | null;
  error_json: JsonText | null;
  current_node_id: string | null;
  parent_run_id: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
  creator: string;
  updater: string;
  deleted: number;
}

export interface AgentNodeExecutionRow {
  id: number;
  run_id: string;
  node_id: string;
  node_type: string;
  attempt: number;
  status: string;
  input_json: JsonText | null;
  output_json: JsonText | null;
  error_json: JsonText | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
  creator: string;
  updater: string;
  deleted: number;
}

export interface AgentCheckpointRow {
  id: number;
  run_id: string;
  seq: number;
  node_id: string | null;
  state_json: JsonText;
  metadata_json: JsonText | null;
  created_at: string;
  updated_at: string;
  creator: string;
  updater: string;
  deleted: number;
}

export interface AgentToolCallRow {
  id: number;
  run_id: string;
  node_execution_id: number | null;
  tool_name: string;
  idempotency_key: string;
  request_json: JsonText | null;
  response_json: JsonText | null;
  status: string;
  error_json: JsonText | null;
  duration_ms: number | null;
  created_at: string;
  updated_at: string;
  creator: string;
  updater: string;
  deleted: number;
}

export interface AgentRunEventRow {
  id: number;
  run_id: string;
  seq: number;
  event_type: string;
  payload_json: JsonText;
  created_at: string;
  updated_at: string;
  creator: string;
  updater: string;
  deleted: number;
}

export interface AgentHitlInterruptRow {
  id: number;
  run_id: string;
  node_id: string;
  token: string;
  status: string;
  payload_json: JsonText | null;
  decision_json: JsonText | null;
  expires_at: string | null;
  resumed_at: string | null;
  created_at: string;
  updated_at: string;
  creator: string;
  updater: string;
  deleted: number;
}

export const AGENT_RUNTIME_TABLES = [
  "t_agent_graph",
  "t_agent_run",
  "t_agent_node_execution",
  "t_agent_checkpoint",
  "t_agent_tool_call",
  "t_agent_run_event",
  "t_agent_hitl_interrupt",
] as const;
