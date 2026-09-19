/**
 * Public package version pin so embedders can gate on runtime capabilities
 * without relying on package.json resolution at call sites.
 */
export const AGENT_RUNTIME_VERSION = "0.1.0";

/**
 * compileGraph validates authoring-time graphs before any run is scheduled,
 * so control APIs fail fast on dangling edges / missing terminals.
 */
export { compileGraph, GraphCompileError } from "./graph/compiler.js";

/**
 * Graph authoring types are part of the public SDK surface so hosts can
 * construct definitions without depending on internal paths.
 */
export type {
  CompiledGraph,
  GraphDefinition,
  GraphEdge,
  GraphNode,
  NodeType,
  RetryPolicy,
} from "./graph/types.js";

export { NODE_TYPES } from "./graph/types.js";

/**
 * Runtime types for execution state, channels, and run metadata.
 */
export type {
  Channel,
  ChannelMap,
  MergeResult,
  ExecutionContext,
  RunMetadata,
  RunStatus,
  NodeExecutionRecord,
} from "./runtime/state.js";

export {
  createInitialChannels,
  mergeChannels,
  getChannel,
  hasChannel,
  getChannelNames,
  serializeChannels,
  deserializeChannels,
} from "./runtime/state.js";

/**
 * Node executors and executor registry.
 */
export type {
  NodeExecutor,
  NodeResult,
} from "./runtime/node-executors.js";

export {
  FnExecutor,
  BranchExecutor,
  LLMExecutor,
  ToolExecutor,
  HITLExecutor,
  SubgraphExecutor,
  StartExecutor,
  EndExecutor,
  BUILTIN_EXECUTORS,
  getExecutor,
  NotImplementedError,
} from "./runtime/node-executors.js";

/**
 * HITL (Human-in-the-Loop) gateway and types.
 */
export type {
  HitlInterruptStatus,
  HitlDecision,
  CreateInterruptResult,
  HitlInterruptRow,
} from "./hitl/gateway.js";

export {
  HitlGateway,
  createHitlGateway,
} from "./hitl/gateway.js";

/**
 * Scheduler: serial execution engine.
 */
export type {
  SchedulerOptions,
  SchedulerResult,
} from "./runtime/scheduler.js";

export { runGraph } from "./runtime/scheduler.js";

/**
 * LLM provider abstraction.
 * FakeLlmProvider is the test double; UnconfiguredLlmProvider is the user-visible
 * missing-config path so chat never echoes HITL system prompts.
 */
export type { LlmProvider, LlmCompleteOptions } from "./llm/provider.js";
export {
  UNCONFIGURED_LLM_MESSAGE,
  UnconfiguredLlmProvider,
  FakeLlmProvider,
  getDefaultLlmProvider,
  setDefaultLlmProvider,
  createLlmProvider,
  initDefaultLlmProvider,
} from "./llm/provider.js";
export type { LlmRuntimeConfig } from "./llm/config.js";
export { loadLlmRuntimeConfig } from "./llm/config.js";
export { ZhipuLlmProvider } from "./llm/zhipu-provider.js";

/**
 * RunManager: run lifecycle, metadata, cancellation.
 */
export type {
  StartRunOptions,
  StartRunResult,
} from "./runtime/run-manager.js";

export {
  RunManager,
  defaultRunManager,
  startRun,
  getRun,
  cancelRun,
  waitForRun,
} from "./runtime/run-manager.js";

/**
 * CheckpointService: crash recovery checkpoint persistence.
 */
export type {
  CheckpointRow,
  WriteCheckpointOptions,
  ResumeResult,
} from "./runtime/checkpoint-service.js";

export {
  CheckpointService,
  createCheckpointService,
} from "./runtime/checkpoint-service.js";

/**
 * Tools: Registry and runtime with validation, timeout, retry, idempotency.
 */
export type {
  ToolSchema,
  ToolHandler,
  RegisteredTool,
} from "./tools/registry.js";

export {
  ToolRegistry,
  getDefaultRegistry,
  setDefaultRegistry,
} from "./tools/registry.js";

export type {
  ExecuteOptions,
  ToolExecutionResult,
} from "./tools/runtime.js";

export {
  ToolRuntime,
  ToolExecutionError,
  createToolRuntime,
  getDefaultRegistry as getDefaultToolRegistry,
  setDefaultRegistry as setDefaultToolRegistry,
} from "./tools/runtime.js";

/**
 * Persistence: SQLite state store and migration.
 */
export type {
  StateStore,
  StoredGraph,
  StoredRun,
  StoredNodeExecution,
  StoredCheckpoint,
  StoredToolCall,
  StoredRunEvent,
  StoredHitlInterrupt,
  ListRunsOptions,
} from "./persistence/types.js";

export {
  SQLiteStateStore,
} from "./persistence/sqlite-store.js";

export {
  runMigration,
  isMigrated,
} from "./persistence/migrate.js";

export {
  runMetadataToStoredRun,
  nodeExecutionRecordToStored,
} from "./persistence/types.js";

/**
 * Observability: Event logging and OpenTelemetry hooks.
 */
export type {
  EventType,
  EventPayload,
  EventRow,
  AppendEventOptions,
  NodeStartPayload,
  NodeEndPayload,
  ToolCallPayload,
  CheckpointPayload,
  HitlPayload,
  RunCompletedPayload,
  RunFailedPayload,
  RunCancelledPayload,
  RunStartedPayload,
} from "./obs/event-log.js";

export {
  EventLog,
  createEventLog,
} from "./obs/event-log.js";

export {
  registerOtelHooks,
  createRunSpan,
  endRunSpan,
  isOtelAvailable,
  getOtelApi,
} from "./obs/otel-hooks.js";

/**
 * Control Plane: In-process API and HTTP adapter.
 */
export type {
  CompileResult,
  RunView,
  StartRunControlOptions,
  ResumeHitlOptions,
  ResumeHitlResult,
  ListRunsFromStoreOptions,
} from "./api/control.js";

export {
  ControlPlane,
  createControlPlane,
} from "./api/control.js";

export type {
  HttpServer,
} from "./api/http.js";

export {
  createHttpServer,
  createFetchHandler,
} from "./api/http.js";