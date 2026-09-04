# Utils

## checkpoint-service

CheckpointService: Persists and restores run state for crash recovery. Why: After each node execution, a checkpoint is written containing the full channel state and execution metadata. On resume, the latest checkpoint is loaded and execution continues from the next ready node, skipping already completed nodes (idempotency via node execution records).

File: `src/runtime/checkpoint-service.ts`

Exports:

- `export function createCheckpointService(store: StateStore): CheckpointService`
- `export class CheckpointService`
- `export type CheckpointRow`
- `export type WriteCheckpointOptions`
- `export type ResumeResult`

## compiler

Thrown when a GraphDefinition fails static checks. Callers should surface `code` to control APIs without parsing message text.

File: `src/graph/compiler.ts`

Exports:

- `export function compileGraph(def: GraphDefinition): CompiledGraph`
- `export class GraphCompileErrorextends Error`

## config

Runtime LLM configuration loader. Reads `.apt/agent-runtime.llm.json` (or AGENT_RUNTIME_LLM_CONFIG path). Does not use `.ai/arch/arch.secrets.json`.

File: `src/llm/config.ts`

Exports:

- `export function loadLlmRuntimeConfig(projectRoot?: string): LlmRuntimeConfig | null`
- `export type LlmRuntimeConfig`

## control

ControlPlane: In-process control API for agent-runtime. Why: Provides a clean programmatic interface for compiling graphs, starting/managing runs, HITL resumption, and trace retrieval. This is the primary API for embedders and the HTTP adapter.

File: `src/api/control.ts`

Exports:

- `export function createControlPlane(store?: StateStore): Promise<ControlPlane>`
- `export class ControlPlane`
- `export type CompileResult`
- `export type RunView`
- `export type StartRunControlOptions`
- `export type StartRunResult`
- `export type ResumeHitlOptions`
- `export type ResumeHitlResult`
- `export type ListRunsFromStoreOptions`

## event-log

EventLog: append-only event store for run traces. Why: Provides a durable, ordered event stream per runId for debugging, replay, audit, and observability. Uses SQLiteStateStore for persistence. Events are typed and ordered by sequence number.

File: `src/obs/event-log.ts`

Exports:

- `export function createEventLog(store: StateStore): EventLog`
- `export class EventLog`
- `export type EventType=
  | "node_start"
  | "node_end"
  | "tool_call"
  | "checkpoint"
  | "hitl"
  | "run_started"
  | "run_completed"
  | "run_failed"
  | "run_cancelled"`
- `export type NodeStartPayload`
- `export type NodeEndPayload`
- `export type ToolCallPayload`
- `export type CheckpointPayload`
- `export type HitlPayload`
- `export type RunCompletedPayload`
- `export type RunFailedPayload`
- `export type RunCancelledPayload`
- `export type RunStartedPayload`
- `export type EventPayload=
  | NodeStartPayload
  | NodeEndPayload
  | ToolCallPayload
  | CheckpointPayload
  | HitlPayload
  | RunCompletedPayload
  | RunFailedPayload
  | RunCancelledPayload
  | RunStartedPayload`
- `export type EventRow`
- `export type AppendEventOptions`

## gateway

HITL (Human-in-the-Loop) Gateway. Manages interrupt lifecycle: create, retrieve, resume, and cleanup. Integrates with StateStore for persistence.

File: `src/hitl/gateway.ts`

Exports:

- `export function createHitlGateway(store: StateStore): HitlGateway`
- `export class HitlGateway`
- `export type HitlInterruptStatus= "pending" | "resumed" | "expired" | "cancelled"`
- `export type HitlDecision`
- `export type CreateInterruptResult`
- `export type HitlInterruptRow`

## http

Minimal HTTP adapter for ControlPlane. Why: Provides a REST API over the in-process ControlPlane for remote access. Uses native fetch/Request/Response (works in Node 18+, Cloudflare Workers, etc.) No external framework dependency - can be adapted to Express/Fastify if needed.

File: `src/api/http.ts`

Exports:

- `export function createHttpServer(controlPlane: ControlPlane, options?: HttpServerOptions): Promise<HttpServer>`
- `export function createFetchHandler(controlPlane: ControlPlane, options?:`
- `export type HttpServerOptions`
- `export type HttpServer`

## index

Public package version pin so embedders can gate on runtime capabilities without relying on package.json resolution at call sites.

File: `src/index.ts`

Exports:

- `export const AGENT_RUNTIME_VERSION`

## migrate

Database migration runner for agent-runtime SQLite schema. Reads the generated SQL migration file and executes it idempotently.

File: `src/persistence/migrate.ts`

Exports:

- `export function runMigration(dbPath: string): Promise<void>`
- `export function isMigrated(dbPath: string): Promise<boolean>`
- `export function runMigrationOnDb(db: Database.Database): void`

## node-executors

Node executors for each GraphNode type. Why: Separates execution logic from scheduling, making each executor independently testable and replaceable.

File: `src/runtime/node-executors.ts`

Exports:

- `export function getExecutor(nodeType: GraphNode["type"]): NodeExecutor`
- `export class NotImplementedErrorextends Error`
- `export class FnExecutorimplements NodeExecutor`
- `export class BranchExecutorimplements NodeExecutor`
- `export class LLMExecutorimplements NodeExecutor`
- `export class ToolExecutorimplements NodeExecutor`
- `export class HITLExecutorimplements NodeExecutor`
- `export class SubgraphExecutorimplements NodeExecutor`
- `export class StartExecutorimplements NodeExecutor`
- `export class EndExecutorimplements NodeExecutor`
- `export type NodeResult`
- `export type NodeExecutor`
- `export const BUILTIN_EXECUTORS`

## otel-hooks

Optional OpenTelemetry hooks for EventLog. Why: Provides distributed tracing integration without mandatory OTel dependency. Uses try/catch require to gracefully degrade when @opentelemetry/* packages are not installed. Emits span events alongside EventLog for correlation.

File: `src/obs/otel-hooks.ts`

Exports:

- `export function registerOtelHooks(eventLog: EventLog): EventLog`
- `export function createRunSpan(runId: string, graphId: string, input?: unknown): OtelSpan | null`
- `export function endRunSpan(span: OtelSpan | null, status: "completed" | "failed" | "cancelled", output?: unknown, error?: Error): void`
- `export function isOtelAvailable(): boolean`
- `export function getOtelApi(): OtelApi | null`

## provider

LLM provider abstraction for llm nodes. Production integrations plug in real providers; tests use FakeLlmProvider.

File: `src/llm/provider.ts`

Exports:

- `export function createLlmProvider(config?: LlmRuntimeConfig | null, projectRoot?: string): LlmProvider`
- `export function initDefaultLlmProvider(projectRoot?: string): LlmProvider`
- `export class FakeLlmProviderimplements LlmProvider`
- `export type LlmCompleteOptions`
- `export type LlmProvider`

## registry

ToolRegistry manages tool definitions and their schemas. Tools are registered with input/output schemas for validation. The registry is used by ToolRuntime to look up tools at execution time.

File: `src/tools/registry.ts`

Exports:

- `export function getDefaultRegistry(): ToolRegistry`
- `export function setDefaultRegistry(registry: ToolRegistry): void`
- `export class ToolRegistry`
- `export type ToolSchema`
- `export type ToolHandler<Input = unknown, Output = unknown> = (
  input: Input,
) => Promise<Output>`
- `export type RegisteredTool<Input = unknown, Output = unknown>`

## run-manager

RunManager: in-memory run lifecycle and metadata store. Why: Centralizes run state (created→running→completed/failed/cancelled), provides getRun/cancelRun, and integrates compileGraph + scheduler. Supports checkpoint-based crash recovery (Task 5).

File: `src/runtime/run-manager.ts`

Exports:

- `export function startRun(
  graph: GraphDefinition | CompiledGraph,
  options: StartRunOptions,
): Promise<StartRunResult>`
- `export function waitForRun(runId: string): Promise<SchedulerResult | undefined>`
- `export function getRun(runId: string): RunMetadata | undefined`
- `export function cancelRun(runId: string): boolean`
- `export class RunManager`
- `export type StartRunOptions`
- `export type StartRunResult`
- `export const defaultRunManager`

## runtime

ToolRuntime executes registered tools with validation, timeout, retry, and idempotency. Features: - Input/output schema validation - Configurable timeout with AbortController - Retry policy with exponential backoff and optional jitter - Idempotency key support with persistent storage

File: `src/tools/runtime.ts`

Exports:

- `export function createToolRuntime(store?: StateStore): ToolRuntime`
- `export class ToolExecutionErrorextends Error`
- `export class ToolRuntime`
- `export type RetryPolicy`
- `export type ExecuteOptions`
- `export type ToolExecutionResult<Output = unknown>`
- `export type ToolCallObserved`
- `export type JsonSchema`

## scheduler

In-memory serial scheduler for compiled graphs. Why: Uses Kahn's algorithm to compute ready set from precomputed adjacency. Default: serial (one ready node per step). Optional parallelExecution runs the entire ready set as a batch (fan-out); fan-in uses in-degree barriers. Supports HITL (Human-in-the-Loop) nodes that pause execution awaiting human input.

File: `src/runtime/scheduler.ts`

Exports:

- `export function runGraph(
  compiledGraph: CompiledGraph,
  input: unknown,
  abortSignal: AbortSignal,
  options: SchedulerOptions =`
- `export function executeWithRetry(
  node: import("../graph/types.js").GraphNode,
  executor: NodeExecutor,
  context: ExecutionContext,
  retryPolicy?: import("../graph/types.js").RetryPolicy,
): Promise<NodeResult>`
- `export function getLastTerminalOutput(
  compiledGraph: CompiledGraph,
  channels: Map<string,`
- `export type SchedulerOptions`
- `export type SchedulerResult`

## sqlite-store

SQLite implementation of the StateStore interface. Uses better-sqlite3 with prepared statements for performance. JSON columns are stored as TEXT.

File: `src/persistence/sqlite-store.ts`

Exports:

- `export class SQLiteStateStoreimplements StateStore`

## state

Channel/Reducer state model for the in-memory scheduler. Why: Provides a predictable, serializable state container with deterministic merge semantics for partial updates from node executors. Avoids implicit mutation bugs and enables future checkpointing.

File: `src/runtime/state.ts`

Exports:

- `export function createInitialChannels(input: unknown): ChannelMap`
- `export function mergeChannels(
  channels: ChannelMap,
  updates: Record<string, unknown>,
): MergeResult`
- `export function hasChannel(channels: ChannelMap, name: string): boolean`
- `export function getChannelNames(channels: ChannelMap): string[]`
- `export function serializeChannels(channels: ChannelMap): Record<string, unknown>`
- `export function deserializeChannels(data: Record<string, unknown>): ChannelMap`
- `export type Channel<T = unknown>`
- `export type ChannelMap= Map<string, Channel>`
- `export type MergeResult`
- `export type ExecutionContext`
- `export type RunMetadata`
- `export type RunStatus=
  | "created"
  | "running"
  | "waiting_hitl"
  | "completed"
  | "failed"
  | "cancelled"`
- `export type NodeExecutionRecord`

## types

Executable node kinds for the self-built graph workflow engine. Kept closed so GraphCompiler can reject typos before a run starts.

File: `src/graph/types.ts`

Exports:

- `export type NodeType=
  | "start"
  | "end"
  | "llm"
  | "tool"
  | "fn"
  | "branch"
  | "hitl"
  | "subgraph"`
- `export type RetryPolicy`
- `export type GraphNode`
- `export type GraphEdge`
- `export type GraphDefinition`
- `export type CompiledGraph`
- `export const NODE_TYPES`

## types

Persistence types and StateStore interface for agent-runtime. Provides CRUD operations for runs, node executions, checkpoints, tool calls, events, HITL interrupts, and graphs.

File: `src/persistence/types.ts`

Exports:

- `export function runMetadataToStoredRun(metadata:`
- `export function nodeExecutionRecordToStored(
  runId: string,
  record: NodeExecutionRecord,
): Omit<StoredNodeExecution, "id" | "createdAt" | "updatedAt" | "creator" | "updater" | "deleted">`
- `export type StoredGraph`
- `export type StoredRun`
- `export type StoredNodeExecution`
- `export type StoredCheckpoint`
- `export type StoredToolCall`
- `export type StoredRunEvent`
- `export type StoredHitlInterrupt`
- `export type ListRunsOptions`
- `export type StateStore`

## zhipu-provider

Zhipu (智谱) GLM — OpenAI-compatible Chat Completions API. Base URL: https://open.bigmodel.cn/api/coding/paas/v4 (Coding Plan)

File: `src/llm/zhipu-provider.ts`

Exports:

- `export class ZhipuLlmProviderimplements LlmProvider`
- `export type ZhipuLlmProviderOptions`
