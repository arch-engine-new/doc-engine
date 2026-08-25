-- agent-runtime schema apply
-- stack: sql-fallback
-- source: docs/schema/agent-runtime-schema.md
-- generated: 2026-08-25T03:38:38.789Z
-- NOTE: reference DDL only; not auto-executed against a live DB.
-- SQLite: map JSON->TEXT, AUTO_INCREMENT->AUTOINCREMENT, DATETIME ok as TEXT/NUMERIC.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS t_agent_graph (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  graph_id VARCHAR(64) NOT NULL,
  name VARCHAR(128) NULL,
  version INTEGER NOT NULL DEFAULT 1,
  def_json TEXT NOT NULL,
  status INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  creator VARCHAR(64) NOT NULL DEFAULT 'system',
  updater VARCHAR(64) NOT NULL DEFAULT 'system',
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_t_agent_graph_graph_id ON t_agent_graph(graph_id);
CREATE INDEX IF NOT EXISTS idx_t_agent_graph_name ON t_agent_graph(name);

CREATE TABLE IF NOT EXISTS t_agent_run (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id VARCHAR(64) NOT NULL,
  graph_id VARCHAR(64) NOT NULL,
  thread_id VARCHAR(64) NULL,
  status VARCHAR(32) NOT NULL,
  input_json TEXT NULL,
  output_json TEXT NULL,
  error_json TEXT NULL,
  current_node_id VARCHAR(64) NULL,
  parent_run_id VARCHAR(64) NULL,
  started_at TEXT NULL,
  finished_at TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  creator VARCHAR(64) NOT NULL DEFAULT 'system',
  updater VARCHAR(64) NOT NULL DEFAULT 'system',
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_t_agent_run_run_id ON t_agent_run(run_id);
CREATE INDEX IF NOT EXISTS idx_t_agent_run_graph_id ON t_agent_run(graph_id);
CREATE INDEX IF NOT EXISTS idx_t_agent_run_thread_id ON t_agent_run(thread_id);
CREATE INDEX IF NOT EXISTS idx_t_agent_run_status ON t_agent_run(status);

CREATE TABLE IF NOT EXISTS t_agent_node_execution (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id VARCHAR(64) NOT NULL,
  node_id VARCHAR(64) NOT NULL,
  node_type VARCHAR(32) NOT NULL,
  attempt INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(32) NOT NULL,
  input_json TEXT NULL,
  output_json TEXT NULL,
  error_json TEXT NULL,
  started_at TEXT NULL,
  finished_at TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  creator VARCHAR(64) NOT NULL DEFAULT 'system',
  updater VARCHAR(64) NOT NULL DEFAULT 'system',
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_t_agent_node_execution_run_id ON t_agent_node_execution(run_id);
CREATE INDEX IF NOT EXISTS idx_t_agent_node_execution_node_id ON t_agent_node_execution(node_id);
CREATE UNIQUE INDEX IF NOT EXISTS uk_t_agent_node_execution_run_node_attempt
  ON t_agent_node_execution(run_id, node_id, attempt);

CREATE TABLE IF NOT EXISTS t_agent_checkpoint (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id VARCHAR(64) NOT NULL,
  seq INTEGER NOT NULL,
  node_id VARCHAR(64) NULL,
  state_json TEXT NOT NULL,
  metadata_json TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  creator VARCHAR(64) NOT NULL DEFAULT 'system',
  updater VARCHAR(64) NOT NULL DEFAULT 'system',
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_t_agent_checkpoint_run_id ON t_agent_checkpoint(run_id);
CREATE UNIQUE INDEX IF NOT EXISTS uk_t_agent_checkpoint_run_seq ON t_agent_checkpoint(run_id, seq);

CREATE TABLE IF NOT EXISTS t_agent_tool_call (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id VARCHAR(64) NOT NULL,
  node_execution_id INTEGER NULL,
  tool_name VARCHAR(128) NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  request_json TEXT NULL,
  response_json TEXT NULL,
  status VARCHAR(32) NOT NULL,
  error_json TEXT NULL,
  duration_ms INTEGER NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  creator VARCHAR(64) NOT NULL DEFAULT 'system',
  updater VARCHAR(64) NOT NULL DEFAULT 'system',
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_t_agent_tool_call_run_id ON t_agent_tool_call(run_id);
CREATE UNIQUE INDEX IF NOT EXISTS uk_t_agent_tool_call_idempotency ON t_agent_tool_call(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_t_agent_tool_call_tool_name ON t_agent_tool_call(tool_name);

CREATE TABLE IF NOT EXISTS t_agent_run_event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id VARCHAR(64) NOT NULL,
  seq INTEGER NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  creator VARCHAR(64) NOT NULL DEFAULT 'system',
  updater VARCHAR(64) NOT NULL DEFAULT 'system',
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_t_agent_run_event_run_id ON t_agent_run_event(run_id);
CREATE INDEX IF NOT EXISTS idx_t_agent_run_event_type ON t_agent_run_event(event_type);
CREATE UNIQUE INDEX IF NOT EXISTS uk_t_agent_run_event_run_seq ON t_agent_run_event(run_id, seq);

CREATE TABLE IF NOT EXISTS t_agent_hitl_interrupt (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id VARCHAR(64) NOT NULL,
  node_id VARCHAR(64) NOT NULL,
  token VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL,
  payload_json TEXT NULL,
  decision_json TEXT NULL,
  expires_at TEXT NULL,
  resumed_at TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  creator VARCHAR(64) NOT NULL DEFAULT 'system',
  updater VARCHAR(64) NOT NULL DEFAULT 'system',
  deleted INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_t_agent_hitl_interrupt_token ON t_agent_hitl_interrupt(token);
CREATE INDEX IF NOT EXISTS idx_t_agent_hitl_interrupt_run_id ON t_agent_hitl_interrupt(run_id);
CREATE INDEX IF NOT EXISTS idx_t_agent_hitl_interrupt_status ON t_agent_hitl_interrupt(status);
