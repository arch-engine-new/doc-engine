/**
 * Persistence types and StateStore interface for agent-runtime.
 * Provides CRUD operations for runs, node executions, checkpoints, tool calls, events, HITL interrupts, and graphs.
 */

import type { RunStatus, NodeExecutionRecord } from "../runtime/state.js";

/** Graph definition stored in the database. */
export interface StoredGraph {
  /** Unique graph identifier. */
  graphId: string;
  /** Optional human-readable name. */
  name: string | null;
  /** Graph version. */
  version: number;
  /** Serialized graph definition as JSON. */
  defJson: unknown;
  /** Status (1 = active, 0 = archived). */
  status: number;
  /** ISO timestamp of creation. */
  createdAt: string;
  /** ISO timestamp of last update. */
  updatedAt: string;
  /** Creator identifier. */
  creator: string;
  /** Last updater identifier. */
  updater: string;
  /** Soft delete flag. */
  deleted: number;
}

/** Run record stored in the database. */
export interface StoredRun {
  /** Unique run identifier. */
  runId: string;
  /** Graph identifier this run executes. */
  graphId: string;
  /** Optional thread identifier for conversation grouping. */
  threadId: string | null;
  /** Current run status. */
  status: RunStatus;
  /** Run input as JSON. */
  inputJson: unknown | null;
  /** Run output as JSON. */
  outputJson: unknown | null;
  /** Error as JSON. */
  errorJson: unknown | null;
  /** Currently executing node ID. */
  currentNodeId: string | null;
  /** Parent run ID for subgraph runs. */
  parentRunId: string | null;
  /** ISO timestamp when run started. */
  startedAt: string | null;
  /** ISO timestamp when run finished. */
  finishedAt: string | null;
  /** ISO timestamp of creation. */
  createdAt: string;
  /** ISO timestamp of last update. */
  updatedAt: string;
  /** Creator identifier. */
  creator: string;
  /** Last updater identifier. */
  updater: string;
  /** Soft delete flag. */
  deleted: number;
}

/** Node execution record stored in the database. */
export interface StoredNodeExecution {
  /** Unique execution identifier (auto-increment). */
  id: number;
  /** Run identifier. */
  runId: string;
  /** Node identifier. */
  nodeId: string;
  /** Node type. */
  nodeType: string;
  /** Attempt number (1-based). */
  attempt: number;
  /** Execution status. */
  status: string;
  /** Node input as JSON. */
  inputJson: unknown | null;
  /** Node output as JSON. */
  outputJson: unknown | null;
  /** Error as JSON. */
  errorJson: unknown | null;
  /** ISO timestamp when execution started. */
  startedAt: string | null;
  /** ISO timestamp when execution finished. */
  finishedAt: string | null;
  /** ISO timestamp of creation. */
  createdAt: string;
  /** ISO timestamp of last update. */
  updatedAt: string;
  /** Creator identifier. */
  creator: string;
  /** Last updater identifier. */
  updater: string;
  /** Soft delete flag. */
  deleted: number;
}

/** Checkpoint record stored in the database. */
export interface StoredCheckpoint {
  /** Unique checkpoint identifier (auto-increment). */
  id: number;
  /** Run identifier. */
  runId: string;
  /** Sequence number within the run. */
  seq: number;
  /** Node identifier where checkpoint was created. */
  nodeId: string | null;
  /** Serialized channel state as JSON. */
  stateJson: unknown;
  /** Optional metadata as JSON. */
  metadataJson: unknown | null;
  /** ISO timestamp of creation. */
  createdAt: string;
  /** ISO timestamp of last update. */
  updatedAt: string;
  /** Creator identifier. */
  creator: string;
  /** Last updater identifier. */
  updater: string;
  /** Soft delete flag. */
  deleted: number;
}

/** Tool call record stored in the database. */
export interface StoredToolCall {
  /** Unique tool call identifier (auto-increment). */
  id: number;
  /** Run identifier. */
  runId: string;
  /** Associated node execution ID. */
  nodeExecutionId: number | null;
  /** Tool name. */
  toolName: string;
  /** Idempotency key for deduplication. */
  idempotencyKey: string;
  /** Tool request as JSON. */
  requestJson: unknown | null;
  /** Tool response as JSON. */
  responseJson: unknown | null;
  /** Call status. */
  status: string;
  /** Error as JSON. */
  errorJson: unknown | null;
  /** Duration in milliseconds. */
  durationMs: number | null;
  /** ISO timestamp of creation. */
  createdAt: string;
  /** ISO timestamp of last update. */
  updatedAt: string;
  /** Creator identifier. */
  creator: string;
  /** Last updater identifier. */
  updater: string;
  /** Soft delete flag. */
  deleted: number;
}

/** Run event record stored in the database. */
export interface StoredRunEvent {
  /** Unique event identifier (auto-increment). */
  id: number;
  /** Run identifier. */
  runId: string;
  /** Sequence number within the run. */
  seq: number;
  /** Event type (e.g., "node.start", "node.complete", "tool.call"). */
  eventType: string;
  /** Event payload as JSON. */
  payloadJson: unknown;
  /** ISO timestamp of creation. */
  createdAt: string;
  /** ISO timestamp of last update. */
  updatedAt: string;
  /** Creator identifier. */
  creator: string;
  /** Last updater identifier. */
  updater: string;
  /** Soft delete flag. */
  deleted: number;
}

/** HITL interrupt record stored in the database. */
export interface StoredHitlInterrupt {
  /** Unique interrupt identifier (auto-increment). */
  id: number;
  /** Run identifier. */
  runId: string;
  /** Node identifier waiting for human input. */
  nodeId: string;
  /** Unique token for resumption. */
  token: string;
  /** Interrupt status. */
  status: string;
  /** Interrupt payload as JSON. */
  payloadJson: unknown | null;
  /** Human decision as JSON. */
  decisionJson: unknown | null;
  /** ISO timestamp when interrupt expires. */
  expiresAt: string | null;
  /** ISO timestamp when interrupt was resumed. */
  resumedAt: string | null;
  /** ISO timestamp of creation. */
  createdAt: string;
  /** ISO timestamp of last update. */
  updatedAt: string;
  /** Creator identifier. */
  creator: string;
  /** Last updater identifier. */
  updater: string;
  /** Soft delete flag. */
  deleted: number;
}

/** Query options for listing runs. */
export interface ListRunsOptions {
  /** Filter by graph ID. */
  graphId?: string;
  /** Filter by thread ID. */
  threadId?: string;
  /** Filter by status. */
  status?: RunStatus;
  /** Maximum number of results. */
  limit?: number;
  /** Offset for pagination. */
  offset?: number;
  /** Sort order (default: "DESC" for newest first). */
  order?: "ASC" | "DESC";
}

/** StateStore interface for persistent run state management. */
export interface StateStore {
  /**
   * Initialize the store (run migrations, etc.).
   * Called once at application startup.
   */
  initialize(): Promise<void>;

  /**
   * Close the store and release resources.
   */
  close(): Promise<void>;

  // Graph operations

  /**
   * Store or update a graph definition.
   */
  upsertGraph(graph: Omit<StoredGraph, "createdAt" | "updatedAt" | "creator" | "updater" | "deleted">): Promise<void>;

  /**
   * Get a graph by ID.
   */
  getGraph(graphId: string): Promise<StoredGraph | null>;

  /**
   * List graphs with optional filters.
   */
  listGraphs(options?: { name?: string; status?: number; limit?: number; offset?: number }): Promise<StoredGraph[]>;

  // Run operations

  /**
   * Create a new run record.
   */
  createRun(run: Omit<StoredRun, "createdAt" | "updatedAt" | "creator" | "updater" | "deleted">): Promise<void>;

  /**
   * Get a run by ID.
   */
  getRun(runId: string): Promise<StoredRun | null>;

  /**
   * Update run fields (status, output, error, currentNodeId, finishedAt, etc.).
   */
  updateRun(runId: string, updates: Partial<Pick<StoredRun, "status" | "outputJson" | "errorJson" | "currentNodeId" | "finishedAt" | "updatedAt">>): Promise<void>;

  /**
   * List runs with optional filters.
   */
  listRuns(options?: ListRunsOptions): Promise<StoredRun[]>;

  /**
   * Delete a run (soft delete).
   */
  deleteRun(runId: string): Promise<void>;

  // Node execution operations

  /**
   * Create a node execution record.
   */
  createNodeExecution(execution: Omit<StoredNodeExecution, "id" | "createdAt" | "updatedAt" | "creator" | "updater" | "deleted">): Promise<number>;

  /**
   * Update a node execution record.
   */
  updateNodeExecution(id: number, updates: Partial<Pick<StoredNodeExecution, "status" | "outputJson" | "errorJson" | "finishedAt" | "updatedAt">>): Promise<void>;

  /**
   * Get node executions for a run.
   */
  getNodeExecutions(runId: string): Promise<StoredNodeExecution[]>;

  /**
   * Get a specific node execution by run ID, node ID, and attempt.
   */
  getNodeExecution(runId: string, nodeId: string, attempt: number): Promise<StoredNodeExecution | null>;

  // Checkpoint operations

  /**
   * Create a checkpoint.
   */
  createCheckpoint(checkpoint: Omit<StoredCheckpoint, "id" | "createdAt" | "updatedAt" | "creator" | "updater" | "deleted">): Promise<number>;

  /**
   * Get the latest checkpoint for a run.
   */
  getLatestCheckpoint(runId: string): Promise<StoredCheckpoint | null>;

  /**
   * Get a checkpoint by run ID and sequence.
   */
  getCheckpoint(runId: string, seq: number): Promise<StoredCheckpoint | null>;

  /**
   * List checkpoints for a run.
   */
  listCheckpoints(runId: string): Promise<StoredCheckpoint[]>;

  // Tool call operations

  /**
   * Create a tool call record.
   */
  createToolCall(toolCall: Omit<StoredToolCall, "id" | "createdAt" | "updatedAt" | "creator" | "updater" | "deleted">): Promise<number>;

  /**
   * Update a tool call record.
   */
  updateToolCall(id: number, updates: Partial<Pick<StoredToolCall, "responseJson" | "status" | "errorJson" | "durationMs" | "updatedAt">>): Promise<void>;

  /**
   * Get tool calls for a run.
   */
  getToolCalls(runId: string): Promise<StoredToolCall[]>;

  /**
   * Get a tool call by idempotency key.
   */
  getToolCallByIdempotencyKey(key: string): Promise<StoredToolCall | null>;

  // Run event operations

  /**
   * Append an event to the run event log.
   */
  appendEvent(event: Omit<StoredRunEvent, "id" | "createdAt" | "updatedAt" | "creator" | "updater" | "deleted">): Promise<number>;

  /**
   * Get events for a run (for trace reconstruction).
   */
  getEvents(runId: string, fromSeq?: number): Promise<StoredRunEvent[]>;

  // HITL interrupt operations

  /**
   * Create a HITL interrupt.
   */
  createHitlInterrupt(interrupt: Omit<StoredHitlInterrupt, "id" | "createdAt" | "updatedAt" | "creator" | "updater" | "deleted">): Promise<number>;

  /**
   * Update a HITL interrupt (e.g., on resume).
   */
  updateHitlInterrupt(token: string, updates: Partial<Pick<StoredHitlInterrupt, "status" | "decisionJson" | "resumedAt" | "updatedAt">>): Promise<void>;

  /**
   * Get a HITL interrupt by token.
   */
  getHitlInterruptByToken(token: string): Promise<StoredHitlInterrupt | null>;

  /**
   * Get HITL interrupts for a run.
   */
  getHitlInterrupts(runId: string): Promise<StoredHitlInterrupt[]>;
}

/**
 * Convert RunMetadata to StoredRun for persistence.
 */
export function runMetadataToStoredRun(metadata: {
  runId: string;
  graphId: string;
  threadId?: string | null;
  status: RunStatus;
  input?: unknown;
  output?: unknown;
  error?: { message: string; code?: string; cause?: unknown } | null;
  currentNodeId?: string | null;
  parentRunId?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}): Omit<StoredRun, "createdAt" | "updatedAt" | "creator" | "updater" | "deleted"> {
  return {
    runId: metadata.runId,
    graphId: metadata.graphId,
    threadId: metadata.threadId ?? null,
    status: metadata.status,
    inputJson: metadata.input ?? null,
    outputJson: metadata.output ?? null,
    errorJson: metadata.error ?? null,
    currentNodeId: metadata.currentNodeId ?? null,
    parentRunId: metadata.parentRunId ?? null,
    startedAt: metadata.startedAt ?? null,
    finishedAt: metadata.finishedAt ?? null,
  };
}

/**
 * Convert NodeExecutionRecord to StoredNodeExecution for persistence.
 */
export function nodeExecutionRecordToStored(
  runId: string,
  record: NodeExecutionRecord,
): Omit<StoredNodeExecution, "id" | "createdAt" | "updatedAt" | "creator" | "updater" | "deleted"> {
  return {
    runId,
    nodeId: record.nodeId,
    nodeType: record.nodeType,
    attempt: record.attempt,
    status: record.status,
    inputJson: record.input ?? null,
    outputJson: record.output ?? null,
    errorJson: record.error ?? null,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt ?? null,
  };
}