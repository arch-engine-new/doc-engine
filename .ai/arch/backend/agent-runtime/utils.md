# Utils

_No utils discovered._

## RunManager

| Field | Value |
|-------|-------|
| Summary | Run lifecycle manager: startRun/cancelRun/waitForRun/getRun/listRuns over in-memory scheduler + optional SQLite persistence; supports compile-time graph caching and HITL resume. |
| When to use | Need to start a compiled graph run, track run metadata/status, cancel long-running runs, or resume interrupted HITL runs inside the app process. |
| How to use | Use defaultRunManager/startRun(graph, {input, runId?, store?, threadId?}) or getRun/cancelRun/waitForRun free functions exported from agent-runtime. |
| Exports | RunManager, defaultRunManager, startRun, getRun, cancelRun, waitForRun, StartRunOptions, StartRunResult |
| Related | 暂无 |
| Tags | agent-runtime, run, lifecycle, scheduler |
| Source | register |
| Path | packages/agent-runtime/src/runtime/run-manager.ts |
| Updated | 2026-08-25T10:42:15.010Z |

## Scheduler

| Field | Value |
|-------|-------|
| Summary | Serial graph execution engine (runGraph): resolves node order via in-degree/adjacency, runs node executors with retry/backoff, collects channel state and node history, supports abort, checkpoints and HITL interrupts. |
| When to use | Need to execute a CompiledGraph node by node with retry policy, timeout, abort signal, or want to hook node start/complete/error/checkpoint events. |
| How to use | runGraph(compiledGraph, input, abortSignal, {schedulerOptions}?) — returns SchedulerResult with status, channels, history and optional hitlInterrupt. |
| Exports | runGraph, SchedulerOptions, SchedulerResult, getLastTerminalOutput |
| Related | 暂无 |
| Tags | agent-runtime, scheduler, graph-execution, retry |
| Source | register |
| Path | packages/agent-runtime/src/runtime/scheduler.ts |
| Updated | 2026-08-25T10:42:17.650Z |

## NodeExecutors

| Field | Value |
|-------|-------|
| Summary | Built-in node executor set: Fn/Branch/LLM/Tool/HITL/Subgraph/Start/End executors implementing NodeExecutor, registered in BUILTIN_EXECUTORS via getExecutor(nodeType). |
| When to use | Need default behavior for a graph node type, or want to extend/replace an executor for fn/tool/branch nodes. |
| How to use | getExecutor(nodeType) returns a NodeExecutor; pass custom executors map in SchedulerOptions.executors to override built-ins. |
| Exports | NodeExecutor, NodeResult, FnExecutor, BranchExecutor, LLMExecutor, ToolExecutor, HITLExecutor, SubgraphExecutor, StartExecutor, EndExecutor, BUILTIN_EXECUTORS, getExecutor, NotImplementedError |
| Related | 暂无 |
| Tags | agent-runtime, node, executor, graph |
| Source | register |
| Path | packages/agent-runtime/src/runtime/node-executors.ts |
| Updated | 2026-08-25T10:42:20.386Z |

## CheckpointService

| Field | Value |
|-------|-------|
| Summary | Crash recovery: persists run checkpoints (channels + node history) per run/seq, exposes getLatest/getAll and resume() that rebuilds executing state into ResumeResult. |
| When to use | Need to make long graph runs crash-safe or restore a run after a process restart. |
| How to use | new CheckpointService(store); write({runId, seq, nodeId, channels, metadata?}) then resume(runId, compiledGraph) to rebuild channels/history after a crash. |
| Exports | CheckpointService, createCheckpointService, CheckpointRow, WriteCheckpointOptions, ResumeResult |
| Related | 暂无 |
| Tags | agent-runtime, checkpoint, resume, crash-recovery |
| Source | register |
| Path | packages/agent-runtime/src/runtime/checkpoint-service.ts |
| Updated | 2026-08-25T10:42:23.005Z |

## EventLog

| Field | Value |
|-------|-------|
| Summary | Sequenced event trace log persisted via StateStore: typed append helpers (node_start/node_end/tool_call/checkpoint/hitl/run_*), monotonic seq cache, getTrace for run inspection. |
| When to use | Need an append-only, ordered event stream per run for debugging, auditing, or feeding a UI timeline. |
| How to use | new EventLog(store) or createEventLog(store); append* helpers write typed rows, getTrace(runId, fromSeq?) reads ordered trace for a run. |
| Exports | EventLog, createEventLog, EventType, EventRow, AppendEventOptions, EventPayload |
| Related | 暂无 |
| Tags | agent-runtime, events, trace, observability |
| Source | register |
| Path | packages/agent-runtime/src/obs/event-log.ts |
| Updated | 2026-08-25T10:42:25.656Z |

## GraphCompiler

| Field | Value |
|-------|-------|
| Summary | Graph validation + compile pipeline: definition shape → node ids/types/retry → edge endpoints → terminal reachability → entry resolution; precomputes adjacency/terminals/entry so the scheduler never runs authoring-time checks. Throws typed GraphCompileError (INVALID_DEFINITION, EMPTY_GRAPH, DUPLICATE_NODE, UNKNOWN_NODE_TYPE, INVALID_RETRY, INVALID_EDGE, MISSING_NODE, MISSING_ENTRY, AMBIGUOUS_ENTRY). |
| When to use | Before scheduling any run, to fail fast on malformed authoring-time graph definitions; compileGraph output is the immutable input to runGraph. |
| How to use | compileGraph({graphId?, nodes, edges, entryNodeId?}) -> CompiledGraph with adjacency/terminals/entry; NODE_TYPES/serializeChannels helpers exported. |
| Exports | compileGraph, isNodeType |
| Related | backend/agent-runtime/pojo/Graph types |
| Tags | 暂无 |
| Source | register |
| Path | packages/agent-runtime/src/graph/compiler.ts |
| Updated | 2026-08-25T11:07:52.523Z |

## HitlGateway

| Field | Value |
|-------|-------|
| Summary | Human-in-the-loop gateway: creates pending interrupts with unique tokens (status pending/resumed/expired/cancelled, expiry), stores decisions, resumes via HitlDecision. |
| When to use | Run needs human approval/decision mid-graph, with token-based resume and audit trail. |
| How to use | createHitlGateway(store); intercept on a scheduler/run, then resume(token, decision) or getInterrupt(token) for audit; expires/cancels managed in store. |
| Exports | HitlGateway, createHitlGateway, HitlInterruptStatus, HitlDecision, CreateInterruptResult, HitlInterruptRow |
| Related | 暂无 |
| Tags | agent-runtime, hitl, interrupt, resume |
| Source | register |
| Path | packages/agent-runtime/src/hitl/gateway.ts |
| Updated | 2026-08-25T10:42:38.793Z |

## ToolRegistry

| Field | Value |
|-------|-------|
| Summary | Tool registry with JSON-schema definition + single handler type, list/get/lookup, and default-registry accessors. |
| When to use | Need to define tools an agent may call, and pass them to ToolRuntime or a tool node. |
| How to use | new ToolRegistry(); register(name, schema, handler) then pass into ToolRuntime or use getDefaultRegistry/setDefaultRegistry singletons. |
| Exports | ToolRegistry, getDefaultRegistry, setDefaultRegistry, ToolSchema, ToolHandler, RegisteredTool |
| Related | 暂无 |
| Tags | agent-runtime, tools, registry |
| Source | register |
| Path | packages/agent-runtime/src/tools/registry.ts |
| Updated | 2026-08-25T10:42:41.138Z |

## ToolRuntime

| Field | Value |
|-------|-------|
| Summary | Tool execution runtime: JSON-schema validation, timeout, retry/backoff, idempotency keys persisted via StateStore, and call observation/allowedtools filtering. |
| When to use | Need to call tools safely: validate inputs, enforce timeout/retry, dedup repeated calls, or record tool calls for replay. |
| How to use | createToolRuntime(store?) or new ToolRuntime(registry, store?); call execute({tool, input, idempotencyKey?, timeoutMs?, ...}) with retry/idempotency support. |
| Exports | ToolRuntime, createToolRuntime, ToolExecutionError, ExecuteOptions, ToolExecutionResult, RetryPolicy |
| Related | 暂无 |
| Tags | agent-runtime, tools, runtime, retry, idempotency |
| Source | register |
| Path | packages/agent-runtime/src/tools/runtime.ts |
| Updated | 2026-08-25T10:42:43.786Z |

## SQLiteStateStore

| Field | Value |
|-------|-------|
| Summary | SQLite-backed StateStore implementation: runs, node executions, checkpoints, tool calls, events, HITL interrupts over prepared statements; supports list/filter queries. |
| When to use | Need durable storage for agent runs/events/checkpoints, or to share one store across scheduler, HITL and tools. |
| How to use | new SQLiteStateStore(dbPath or better-sqlite3 Database); then initialize() and pass to RunManager/CheckpointService/ToolRuntime/EventLog as the StateStore. |
| Exports | SQLiteStateStore |
| Related | 暂无 |
| Tags | agent-runtime, sqlite, persistence, statestore |
| Source | register |
| Path | packages/agent-runtime/src/persistence/sqlite-store.ts |
| Updated | 2026-08-25T10:42:52.023Z |

## SQLite migration runner

| Field | Value |
|-------|-------|
| Summary | Idempotent SQLite migration runner: creates the agent-runtime schema tables (graph, run, node execution, checkpoint, tool call, event, hitl interrupt). |
| When to use | Initializing a fresh SQLite DB before using SQLiteStateStore. |
| How to use | runMigration(store) or runMigrationOnDb(db) applies the DDL idempotently (CREATE TABLE IF NOT EXISTS); isMigrated() checks state. |
| Exports | runMigration, runMigrationOnDb |
| Related | 暂无 |
| Tags | agent-runtime, sqlite, migration, ddl |
| Source | register |
| Path | packages/agent-runtime/src/persistence/migrate.ts |
| Updated | 2026-08-25T10:42:57.027Z |

## OtelHooks

| Field | Value |
|-------|-------|
| Summary | OpenTelemetry integration points: optional hook registration bridging EventLog events into OTel spans plus run-span helpers (createRunSpan/endRunSpan); no-ops cleanly when OTel is absent. Output/error attributes are size-capped (2KB) and failure-guarded so telemetry never breaks the run. |
| When to use | Want run/node/tool events to appear in an existing OTel pipeline without hard dependency on the OTel SDK. |
| How to use | registerOtelHooks(eventLog?) attaches OTel-instrumenting listeners (best-effort when @opentelemetry API present); createRunSpan(runId, graphId, input?) starts a run span; endRunSpan(span, status, output?, error?) finalizes it with status/output/error attributes — attributes must be written before span.end() since spans are immutable after end. |
| Exports | registerOtelHooks, createRunSpan, endRunSpan, isOtelAvailable, getOtelApi |
| Related | backend/agent-runtime/util/agent-runtime index |
| Tags | otel, telemetry, span |
| Source | register |
| Path | packages/agent-runtime/src/obs/otel-hooks.ts |
| Updated | 2026-08-25T11:08:05.306Z |

## agent-runtime index

| Field | Value |
|-------|-------|
| Summary | Public API barrel of agent-runtime (version constant, graph compiler/types, executors, scheduler, RunManager, checkpoint, HITL, tools, SQLite store, migration, events, OTel hooks, ControlPlane + HTTP adapter). |
| When to use | Find or use the whole agent-runtime SDK surface; typecheck examples against exactly the public exports. |
| How to use | import from "agent-runtime" — this barrel is the single public surface; every runtime API listed here is exported from index.ts. |
| Exports | AGENT_RUNTIME_VERSION, compileGraph, RunManager, startRun, ControlPlane, SQLiteStateStore, EventLog, HitlGateway, ToolRuntime, all public types |
| Related | 暂无 |
| Tags | agent-runtime, public-api, barrel, module |
| Source | register |
| Path | packages/agent-runtime/src/index.ts |
| Updated | 2026-08-25T10:43:15.753Z |





