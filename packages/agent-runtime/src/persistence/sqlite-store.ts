/**
 * SQLite implementation of the StateStore interface.
 * Uses better-sqlite3 with prepared statements for performance.
 * JSON columns are stored as TEXT.
 */

import Database from "better-sqlite3";
import type {
  StateStore,
  StoredGraph,
  StoredRun,
  StoredNodeExecution,
  StoredCheckpoint,
  StoredToolCall,
  StoredRunEvent,
  StoredHitlInterrupt,
  ListRunsOptions,
} from "./types.js";

/** Current timestamp in ISO format. */
function now(): string {
  return new Date().toISOString();
}

/** Default creator/updater. */
const SYSTEM = "system";

/**
 * SQLiteStateStore provides persistent storage for agent runtime state.
 * All methods use prepared statements for efficiency.
 * JSON data is serialized to TEXT columns.
 */
export class SQLiteStateStore implements StateStore {
  private db: Database.Database;
  private initialized = false;

  // Prepared statements (lazy-initialized)
  private stmts: {
    // Graph
    upsertGraph?: Database.Statement;
    getGraph?: Database.Statement;
    listGraphs?: Database.Statement;

    // Run
    createRun?: Database.Statement;
    getRun?: Database.Statement;
    updateRun?: Database.Statement;
    listRunsAsc?: Database.Statement;
    listRunsDesc?: Database.Statement;
    deleteRun?: Database.Statement;

    // Node Execution
    createNodeExecution?: Database.Statement;
    updateNodeExecution?: Database.Statement;
    getNodeExecutions?: Database.Statement;
    getNodeExecution?: Database.Statement;

    // Checkpoint
    createCheckpoint?: Database.Statement;
    getLatestCheckpoint?: Database.Statement;
    getCheckpoint?: Database.Statement;
    listCheckpoints?: Database.Statement;

    // Tool Call
    createToolCall?: Database.Statement;
    updateToolCall?: Database.Statement;
    getToolCalls?: Database.Statement;
    getToolCallByIdempotencyKey?: Database.Statement;

    // Run Event
    appendEvent?: Database.Statement;
    getEvents?: Database.Statement;
    getEventsFromSeq?: Database.Statement;

    // HITL Interrupt
    createHitlInterrupt?: Database.Statement;
    updateHitlInterrupt?: Database.Statement;
    getHitlInterruptByToken?: Database.Statement;
    getHitlInterrupts?: Database.Statement;
  } = {};

  /**
   * Create a new SQLiteStateStore.
   * @param dbPath - Path to SQLite database file (or ":memory:" for in-memory)
   */
  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("foreign_keys = ON");
    this.db.pragma("journal_mode = WAL");
  }

  /**
   * Initialize the store (run migrations, prepare statements).
   * Must be called before any other operations.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Run migration
    const { runMigrationOnDb } = await import("./migrate.js");
    runMigrationOnDb(this.db);

    // Prepare all statements
    this.prepareStatements();
    this.initialized = true;
  }

  /**
   * Prepare all SQL statements.
   */
  private prepareStatements(): void {
    // Graph statements
    this.stmts.upsertGraph = this.db.prepare(`
      INSERT INTO t_agent_graph (graph_id, name, version, def_json, status, created_at, updated_at, creator, updater, deleted)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      ON CONFLICT(graph_id) DO UPDATE SET
        name = excluded.name,
        version = excluded.version,
        def_json = excluded.def_json,
        status = excluded.status,
        updated_at = excluded.updated_at,
        updater = excluded.updater
    `);

    this.stmts.getGraph = this.db.prepare(`
      SELECT * FROM t_agent_graph WHERE graph_id = ? AND deleted = 0
    `);

    this.stmts.listGraphs = this.db.prepare(`
      SELECT * FROM t_agent_graph
      WHERE deleted = 0
        AND (? IS NULL OR name = ?)
        AND (? IS NULL OR status = ?)
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `);

    // Run statements
    this.stmts.createRun = this.db.prepare(`
      INSERT INTO t_agent_run (
        run_id, graph_id, thread_id, status, input_json, output_json, error_json,
        current_node_id, parent_run_id, started_at, finished_at,
        created_at, updated_at, creator, updater, deleted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `);

    this.stmts.getRun = this.db.prepare(`
      SELECT * FROM t_agent_run WHERE run_id = ? AND deleted = 0
    `);

    this.stmts.updateRun = this.db.prepare(`
      UPDATE t_agent_run SET
        status = COALESCE(?, status),
        output_json = COALESCE(?, output_json),
        error_json = COALESCE(?, error_json),
        current_node_id = COALESCE(?, current_node_id),
        finished_at = COALESCE(?, finished_at),
        updated_at = ?,
        updater = ?
      WHERE run_id = ? AND deleted = 0
    `);

    this.stmts.listRunsAsc = this.db.prepare(`
      SELECT * FROM t_agent_run
      WHERE deleted = 0
        AND (? IS NULL OR graph_id = ?)
        AND (? IS NULL OR thread_id = ?)
        AND (? IS NULL OR status = ?)
      ORDER BY created_at ASC
      LIMIT ? OFFSET ?
    `);

    this.stmts.listRunsDesc = this.db.prepare(`
      SELECT * FROM t_agent_run
      WHERE deleted = 0
        AND (? IS NULL OR graph_id = ?)
        AND (? IS NULL OR thread_id = ?)
        AND (? IS NULL OR status = ?)
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);

    this.stmts.deleteRun = this.db.prepare(`
      UPDATE t_agent_run SET deleted = 1, updated_at = ?, updater = ? WHERE run_id = ?
    `);

    // Node Execution statements
    this.stmts.createNodeExecution = this.db.prepare(`
      INSERT INTO t_agent_node_execution (
        run_id, node_id, node_type, attempt, status, input_json, output_json, error_json,
        started_at, finished_at, created_at, updated_at, creator, updater, deleted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `);

    this.stmts.updateNodeExecution = this.db.prepare(`
      UPDATE t_agent_node_execution SET
        status = COALESCE(?, status),
        output_json = COALESCE(?, output_json),
        error_json = COALESCE(?, error_json),
        finished_at = COALESCE(?, finished_at),
        updated_at = ?,
        updater = ?
      WHERE id = ? AND deleted = 0
    `);

    this.stmts.getNodeExecutions = this.db.prepare(`
      SELECT * FROM t_agent_node_execution
      WHERE run_id = ? AND deleted = 0
      ORDER BY attempt ASC, started_at ASC
    `);

    this.stmts.getNodeExecution = this.db.prepare(`
      SELECT * FROM t_agent_node_execution
      WHERE run_id = ? AND node_id = ? AND attempt = ? AND deleted = 0
    `);

    // Checkpoint statements
    this.stmts.createCheckpoint = this.db.prepare(`
      INSERT INTO t_agent_checkpoint (
        run_id, seq, node_id, state_json, metadata_json,
        created_at, updated_at, creator, updater, deleted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `);

    this.stmts.getLatestCheckpoint = this.db.prepare(`
      SELECT * FROM t_agent_checkpoint
      WHERE run_id = ? AND deleted = 0
      ORDER BY seq DESC
      LIMIT 1
    `);

    this.stmts.getCheckpoint = this.db.prepare(`
      SELECT * FROM t_agent_checkpoint
      WHERE run_id = ? AND seq = ? AND deleted = 0
    `);

    this.stmts.listCheckpoints = this.db.prepare(`
      SELECT * FROM t_agent_checkpoint
      WHERE run_id = ? AND deleted = 0
      ORDER BY seq ASC
    `);

    // Tool Call statements
    this.stmts.createToolCall = this.db.prepare(`
      INSERT INTO t_agent_tool_call (
        run_id, node_execution_id, tool_name, idempotency_key, request_json, response_json,
        status, error_json, duration_ms, created_at, updated_at, creator, updater, deleted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `);

    this.stmts.updateToolCall = this.db.prepare(`
      UPDATE t_agent_tool_call SET
        response_json = COALESCE(?, response_json),
        status = COALESCE(?, status),
        error_json = COALESCE(?, error_json),
        duration_ms = COALESCE(?, duration_ms),
        updated_at = ?,
        updater = ?
      WHERE id = ? AND deleted = 0
    `);

    this.stmts.getToolCalls = this.db.prepare(`
      SELECT * FROM t_agent_tool_call
      WHERE run_id = ? AND deleted = 0
      ORDER BY created_at ASC
    `);

    this.stmts.getToolCallByIdempotencyKey = this.db.prepare(`
      SELECT * FROM t_agent_tool_call
      WHERE idempotency_key = ? AND deleted = 0
    `);

    // Run Event statements
    this.stmts.appendEvent = this.db.prepare(`
      INSERT INTO t_agent_run_event (
        run_id, seq, event_type, payload_json, created_at, updated_at, creator, updater, deleted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
    `);

    this.stmts.getEvents = this.db.prepare(`
      SELECT * FROM t_agent_run_event
      WHERE run_id = ? AND deleted = 0
      ORDER BY seq ASC
    `);

    this.stmts.getEventsFromSeq = this.db.prepare(`
      SELECT * FROM t_agent_run_event
      WHERE run_id = ? AND seq >= ? AND deleted = 0
      ORDER BY seq ASC
    `);

    // HITL Interrupt statements
    this.stmts.createHitlInterrupt = this.db.prepare(`
      INSERT INTO t_agent_hitl_interrupt (
        run_id, node_id, token, status, payload_json, decision_json,
        expires_at, resumed_at, created_at, updated_at, creator, updater, deleted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `);

    this.stmts.updateHitlInterrupt = this.db.prepare(`
      UPDATE t_agent_hitl_interrupt SET
        status = COALESCE(?, status),
        decision_json = COALESCE(?, decision_json),
        resumed_at = COALESCE(?, resumed_at),
        updated_at = ?,
        updater = ?
      WHERE token = ? AND deleted = 0
    `);

    this.stmts.getHitlInterruptByToken = this.db.prepare(`
      SELECT * FROM t_agent_hitl_interrupt
      WHERE token = ? AND deleted = 0
    `);

    this.stmts.getHitlInterrupts = this.db.prepare(`
      SELECT * FROM t_agent_hitl_interrupt
      WHERE run_id = ? AND deleted = 0
      ORDER BY created_at DESC
    `);
  }

  /** Helper to serialize JSON to TEXT. */
  private json(value: unknown): string | null {
    return value === null || value === undefined ? null : JSON.stringify(value);
  }

  /** Helper to parse JSON from TEXT. */
  private parse<T>(value: string | null): T | null {
    if (value === null || value === undefined) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  /** Map database row to StoredGraph. */
  private mapGraph(row: any): StoredGraph {
    return {
      graphId: row.graph_id,
      name: row.name,
      version: row.version,
      defJson: this.parse(row.def_json),
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      creator: row.creator,
      updater: row.updater,
      deleted: row.deleted,
    };
  }

  /** Map database row to StoredRun. */
  private mapRun(row: any): StoredRun {
    return {
      runId: row.run_id,
      graphId: row.graph_id,
      threadId: row.thread_id,
      status: row.status as StoredRun["status"],
      inputJson: this.parse(row.input_json),
      outputJson: this.parse(row.output_json),
      errorJson: this.parse(row.error_json),
      currentNodeId: row.current_node_id,
      parentRunId: row.parent_run_id,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      creator: row.creator,
      updater: row.updater,
      deleted: row.deleted,
    };
  }

  /** Map database row to StoredNodeExecution. */
  private mapNodeExecution(row: any): StoredNodeExecution {
    return {
      id: row.id,
      runId: row.run_id,
      nodeId: row.node_id,
      nodeType: row.node_type,
      attempt: row.attempt,
      status: row.status,
      inputJson: this.parse(row.input_json),
      outputJson: this.parse(row.output_json),
      errorJson: this.parse(row.error_json),
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      creator: row.creator,
      updater: row.updater,
      deleted: row.deleted,
    };
  }

  /** Map database row to StoredCheckpoint. */
  private mapCheckpoint(row: any): StoredCheckpoint {
    return {
      id: row.id,
      runId: row.run_id,
      seq: row.seq,
      nodeId: row.node_id,
      stateJson: this.parse(row.state_json),
      metadataJson: this.parse(row.metadata_json),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      creator: row.creator,
      updater: row.updater,
      deleted: row.deleted,
    };
  }

  /** Map database row to StoredToolCall. */
  private mapToolCall(row: any): StoredToolCall {
    return {
      id: row.id,
      runId: row.run_id,
      nodeExecutionId: row.node_execution_id,
      toolName: row.tool_name,
      idempotencyKey: row.idempotency_key,
      requestJson: this.parse(row.request_json),
      responseJson: this.parse(row.response_json),
      status: row.status,
      errorJson: this.parse(row.error_json),
      durationMs: row.duration_ms,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      creator: row.creator,
      updater: row.updater,
      deleted: row.deleted,
    };
  }

  /** Map database row to StoredRunEvent. */
  private mapRunEvent(row: any): StoredRunEvent {
    return {
      id: row.id,
      runId: row.run_id,
      seq: row.seq,
      eventType: row.event_type,
      payloadJson: this.parse(row.payload_json),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      creator: row.creator,
      updater: row.updater,
      deleted: row.deleted,
    };
  }

  /** Map database row to StoredHitlInterrupt. */
  private mapHitlInterrupt(row: any): StoredHitlInterrupt {
    return {
      id: row.id,
      runId: row.run_id,
      nodeId: row.node_id,
      token: row.token,
      status: row.status,
      payloadJson: this.parse(row.payload_json),
      decisionJson: this.parse(row.decision_json),
      expiresAt: row.expires_at,
      resumedAt: row.resumed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      creator: row.creator,
      updater: row.updater,
      deleted: row.deleted,
    };
  }

  async close(): Promise<void> {
    this.db.close();
  }

  // Graph operations

  async upsertGraph(graph: Omit<StoredGraph, "createdAt" | "updatedAt" | "creator" | "updater" | "deleted">): Promise<void> {
    const ts = now();
    this.stmts.upsertGraph!.run(
      graph.graphId,
      graph.name,
      graph.version,
      this.json(graph.defJson),
      graph.status,
      ts,
      ts,
      SYSTEM,
      SYSTEM,
    );
  }

  async getGraph(graphId: string): Promise<StoredGraph | null> {
    const row = this.stmts.getGraph!.get(graphId) as Database.RunResult | undefined;
    return row ? this.mapGraph(row) : null;
  }

  async listGraphs(options?: { name?: string; status?: number; limit?: number; offset?: number }): Promise<StoredGraph[]> {
    const rows = this.stmts.listGraphs!.all(
      options?.name ?? null,
      options?.name ?? null,
      options?.status ?? null,
      options?.status ?? null,
      options?.limit ?? 100,
      options?.offset ?? 0,
    ) as Database.RunResult[];
    return rows.map((r) => this.mapGraph(r));
  }

  // Run operations

  async createRun(run: Omit<StoredRun, "createdAt" | "updatedAt" | "creator" | "updater" | "deleted">): Promise<void> {
    const ts = now();
    this.stmts.createRun!.run(
      run.runId,
      run.graphId,
      run.threadId,
      run.status,
      this.json(run.inputJson),
      this.json(run.outputJson),
      this.json(run.errorJson),
      run.currentNodeId,
      run.parentRunId,
      run.startedAt,
      run.finishedAt,
      ts,
      ts,
      SYSTEM,
      SYSTEM,
    );
  }

  async getRun(runId: string): Promise<StoredRun | null> {
    const row = this.stmts.getRun!.get(runId) as Database.RunResult | undefined;
    return row ? this.mapRun(row) : null;
  }

  async updateRun(
    runId: string,
    updates: Partial<Pick<StoredRun, "status" | "outputJson" | "errorJson" | "currentNodeId" | "finishedAt" | "updatedAt">>,
  ): Promise<void> {
    const ts = updates.updatedAt ?? now();
    this.stmts.updateRun!.run(
      updates.status ?? null,
      this.json(updates.outputJson),
      this.json(updates.errorJson),
      updates.currentNodeId ?? null,
      updates.finishedAt ?? null,
      ts,
      SYSTEM,
      runId,
    );
  }

  async listRuns(options?: ListRunsOptions): Promise<StoredRun[]> {
    const order = options?.order ?? "DESC";
    const stmt = order === "ASC" ? this.stmts.listRunsAsc! : this.stmts.listRunsDesc!;
    const rows = stmt.all(
      options?.graphId ?? null,
      options?.graphId ?? null,
      options?.threadId ?? null,
      options?.threadId ?? null,
      options?.status ?? null,
      options?.status ?? null,
      options?.limit ?? 100,
      options?.offset ?? 0,
    ) as Database.RunResult[];
    return rows.map((r) => this.mapRun(r));
  }

  async deleteRun(runId: string): Promise<void> {
    const ts = now();
    this.stmts.deleteRun!.run(ts, SYSTEM, runId);
  }

  // Node Execution operations

  async createNodeExecution(
    execution: Omit<StoredNodeExecution, "id" | "createdAt" | "updatedAt" | "creator" | "updater" | "deleted">,
  ): Promise<number> {
    const ts = now();
    const result = this.stmts.createNodeExecution!.run(
      execution.runId,
      execution.nodeId,
      execution.nodeType,
      execution.attempt,
      execution.status,
      this.json(execution.inputJson),
      this.json(execution.outputJson),
      this.json(execution.errorJson),
      execution.startedAt,
      execution.finishedAt,
      ts,
      ts,
      SYSTEM,
      SYSTEM,
    );
    return result.lastInsertRowid as number;
  }

  async updateNodeExecution(
    id: number,
    updates: Partial<Pick<StoredNodeExecution, "status" | "outputJson" | "errorJson" | "finishedAt" | "updatedAt">>,
  ): Promise<void> {
    const ts = updates.updatedAt ?? now();
    this.stmts.updateNodeExecution!.run(
      updates.status ?? null,
      this.json(updates.outputJson),
      this.json(updates.errorJson),
      updates.finishedAt ?? null,
      ts,
      SYSTEM,
      id,
    );
  }

  async getNodeExecutions(runId: string): Promise<StoredNodeExecution[]> {
    const rows = this.stmts.getNodeExecutions!.all(runId) as Database.RunResult[];
    return rows.map((r) => this.mapNodeExecution(r));
  }

  async getNodeExecution(runId: string, nodeId: string, attempt: number): Promise<StoredNodeExecution | null> {
    const row = this.stmts.getNodeExecution!.get(runId, nodeId, attempt) as Database.RunResult | undefined;
    return row ? this.mapNodeExecution(row) : null;
  }

  // Checkpoint operations

  async createCheckpoint(
    checkpoint: Omit<StoredCheckpoint, "id" | "createdAt" | "updatedAt" | "creator" | "updater" | "deleted">,
  ): Promise<number> {
    const ts = now();
    const result = this.stmts.createCheckpoint!.run(
      checkpoint.runId,
      checkpoint.seq,
      checkpoint.nodeId,
      this.json(checkpoint.stateJson),
      this.json(checkpoint.metadataJson),
      ts,
      ts,
      SYSTEM,
      SYSTEM,
    );
    return result.lastInsertRowid as number;
  }

  async getLatestCheckpoint(runId: string): Promise<StoredCheckpoint | null> {
    const row = this.stmts.getLatestCheckpoint!.get(runId) as Database.RunResult | undefined;
    return row ? this.mapCheckpoint(row) : null;
  }

  async getCheckpoint(runId: string, seq: number): Promise<StoredCheckpoint | null> {
    const row = this.stmts.getCheckpoint!.get(runId, seq) as Database.RunResult | undefined;
    return row ? this.mapCheckpoint(row) : null;
  }

  async listCheckpoints(runId: string): Promise<StoredCheckpoint[]> {
    const rows = this.stmts.listCheckpoints!.all(runId) as Database.RunResult[];
    return rows.map((r) => this.mapCheckpoint(r));
  }

  // Tool Call operations

  async createToolCall(
    toolCall: Omit<StoredToolCall, "id" | "createdAt" | "updatedAt" | "creator" | "updater" | "deleted">,
  ): Promise<number> {
    const ts = now();
    const result = this.stmts.createToolCall!.run(
      toolCall.runId,
      toolCall.nodeExecutionId,
      toolCall.toolName,
      toolCall.idempotencyKey,
      this.json(toolCall.requestJson),
      this.json(toolCall.responseJson),
      toolCall.status,
      this.json(toolCall.errorJson),
      toolCall.durationMs,
      ts,
      ts,
      SYSTEM,
      SYSTEM,
    );
    return result.lastInsertRowid as number;
  }

  async updateToolCall(
    id: number,
    updates: Partial<Pick<StoredToolCall, "responseJson" | "status" | "errorJson" | "durationMs" | "updatedAt">>,
  ): Promise<void> {
    const ts = updates.updatedAt ?? now();
    this.stmts.updateToolCall!.run(
      this.json(updates.responseJson),
      updates.status ?? null,
      this.json(updates.errorJson),
      updates.durationMs ?? null,
      ts,
      SYSTEM,
      id,
    );
  }

  async getToolCalls(runId: string): Promise<StoredToolCall[]> {
    const rows = this.stmts.getToolCalls!.all(runId) as Database.RunResult[];
    return rows.map((r) => this.mapToolCall(r));
  }

  async getToolCallByIdempotencyKey(key: string): Promise<StoredToolCall | null> {
    const row = this.stmts.getToolCallByIdempotencyKey!.get(key) as Database.RunResult | undefined;
    return row ? this.mapToolCall(row) : null;
  }

  // Run Event operations

  async appendEvent(event: Omit<StoredRunEvent, "id" | "createdAt" | "updatedAt" | "creator" | "updater" | "deleted">): Promise<number> {
    const ts = now();
    const result = this.stmts.appendEvent!.run(
      event.runId,
      event.seq,
      event.eventType,
      this.json(event.payloadJson),
      ts,
      ts,
      SYSTEM,
      SYSTEM,
    );
    return result.lastInsertRowid as number;
  }

  async getEvents(runId: string, fromSeq?: number): Promise<StoredRunEvent[]> {
    if (fromSeq !== undefined && fromSeq > 0) {
      const rows = this.stmts.getEventsFromSeq!.all(runId, fromSeq) as Database.RunResult[];
      return rows.map((r) => this.mapRunEvent(r));
    }
    const rows = this.stmts.getEvents!.all(runId) as Database.RunResult[];
    return rows.map((r) => this.mapRunEvent(r));
  }

  // HITL Interrupt operations

  async createHitlInterrupt(
    interrupt: Omit<StoredHitlInterrupt, "id" | "createdAt" | "updatedAt" | "creator" | "updater" | "deleted">,
  ): Promise<number> {
    const ts = now();
    const result = this.stmts.createHitlInterrupt!.run(
      interrupt.runId,
      interrupt.nodeId,
      interrupt.token,
      interrupt.status,
      this.json(interrupt.payloadJson),
      this.json(interrupt.decisionJson),
      interrupt.expiresAt,
      interrupt.resumedAt,
      ts,
      ts,
      SYSTEM,
      SYSTEM,
    );
    return result.lastInsertRowid as number;
  }

  async updateHitlInterrupt(
    token: string,
    updates: Partial<Pick<StoredHitlInterrupt, "status" | "decisionJson" | "resumedAt" | "updatedAt">>,
  ): Promise<void> {
    const ts = updates.updatedAt ?? now();
    this.stmts.updateHitlInterrupt!.run(
      updates.status ?? null,
      this.json(updates.decisionJson),
      updates.resumedAt ?? null,
      ts,
      SYSTEM,
      token,
    );
  }

  async getHitlInterruptByToken(token: string): Promise<StoredHitlInterrupt | null> {
    const row = this.stmts.getHitlInterruptByToken!.get(token) as Database.RunResult | undefined;
    return row ? this.mapHitlInterrupt(row) : null;
  }

  async getHitlInterrupts(runId: string): Promise<StoredHitlInterrupt[]> {
    const rows = this.stmts.getHitlInterrupts!.all(runId) as Database.RunResult[];
    return rows.map((r) => this.mapHitlInterrupt(r));
  }
}