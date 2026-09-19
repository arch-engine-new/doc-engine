# Utils

## AGENT_RUNTIME_VERSION

| Field | Value |
|-------|-------|
| Summary | 公开的包版本常量 AGENT_RUNTIME_VERSION，供 embedder（嵌入方）在不依赖 package. 解析的情况下，对 runtime 能力做版本门控（gate）。 |
| When to use | 调用方需要按 runtime 版本判断能力开关，或希望避免在 call sites 依赖 package. resolution 时使用。 |
| How to use | 从 packages/agent-runtime/src/index.ts 直接 import { AGENT_RUNTIME_VERSION }，在代码中比较版本号以启用或禁用特定 runtime 能力。 |
| Exports | AGENT_RUNTIME_VERSION |
| Related | 暂无 |
| Tags | TypeScript, agent-runtime, version, embedder, AGENT_RUNTIME_VERSION |
| Source | scan |
| Path | packages/agent-runtime/src/index.ts |
| Updated | 2026-09-14T06:16:03.819Z |

## BranchExecutor

| Field | Value |
|-------|-------|
| Summary | BranchExecutor：面向分支类型 GraphNode 的节点执行器（实现 NodeExecutor 接口），将执行逻辑与调度（scheduling）解耦，使每个 executor 可独立测试与替换。 |
| When to use | 在 graph 编译后的运行期需要执行 branch 分支节点，或需要替换/自定义内置执行器逻辑时使用。 |
| How to use | 通过 BUILTIN_EXECUTORS 集合注册到 scheduler，也可自行实现 NodeExecutor 接口替换 BranchExecutor；单独实例化即可对分支执行逻辑做单元测试。 |
| Exports | BranchExecutor |
| Related | BUILTIN_EXECUTORS, compileGraph, ControlPlane |
| Tags | TypeScript, agent-runtime, BranchExecutor, NodeExecutor, GraphNode, BUILTIN_EXECUTORS, scheduler, BranchExecutorimplements |
| Source | scan |
| Path | packages/agent-runtime/src/runtime/node-executors.ts |
| Updated | 2026-09-14T06:16:03.820Z |

## BUILTIN_EXECUTORS

| Field | Value |
|-------|-------|
| Summary | BUILTIN_EXECUTORS：内置节点执行器集合，覆盖各 GraphNode 类型；执行逻辑与调度分离，每个 executor 可独立测试与替换。 |
| When to use | 初始化 runtime 调度器需要按节点类型分发执行器，或在保留默认行为基础上扩展自定义 executor 时使用。 |
| How to use | 从 packages/agent-runtime/src/runtime/node-executors.ts 导入 BUILTIN_EXECUTORS 注入 scheduler；可与 BranchExecutor 等 NodeExecutor 组合或替换其中的执行器实现。 |
| Exports | BUILTIN_EXECUTORS |
| Related | BranchExecutor, compileGraph, ControlPlane |
| Tags | TypeScript, agent-runtime, BUILTIN_EXECUTORS, NodeExecutor, GraphNode, scheduler |
| Source | scan |
| Path | packages/agent-runtime/src/runtime/node-executors.ts |
| Updated | 2026-09-14T06:16:03.820Z |

## cancelRun

| Field | Value |
|-------|-------|
| Summary | cancelRun(runId: string): boolean —— 取消指定 run；由 RunManager（内存态 run 生命周期与元数据存储）集中管理 created→running→completed/failed/cancelled 状态流转，并集成 compileGraph + scheduler，支持基于 checkpoint 的崩溃恢复。 |
| When to use | 需要从外部终止一个正在执行的 run，或配合 getRun 查询 run 状态、结合 checkpoint 崩溃恢复管理 run 生命周期时使用。 |
| How to use | 调用 cancelRun(runId) 取消运行，成功返回 true；可先通过 getRun 获取 run 元数据再执行取消，也可经由 ControlPlane 以编程方式管理整个 run 生命周期。 |
| Exports | cancelRun |
| Related | ControlPlane, CheckpointService, compileGraph |
| Tags | TypeScript, agent-runtime, cancelRun, RunManager, getRun, lifecycle, checkpoint, scheduler, runId, compileGraph |
| Source | scan |
| Path | packages/agent-runtime/src/runtime/run-manager.ts |
| Updated | 2026-09-14T06:16:03.820Z |

## CheckpointService

| Field | Value |
|-------|-------|
| Summary | CheckpointService：持久化与恢复 run 状态，用于崩溃恢复（crash recovery）；每个节点执行后写入包含完整 channel state 与执行元数据的 checkpoint。 |
| When to use | 需要在进程崩溃后加载最新 checkpoint，从下一个 ready 节点继续执行，并通过 node execution records 幂等跳过已完成节点（idempotency）时使用。 |
| How to use | 通过 createCheckpointService(store: StateStore) 创建 CheckpointService 实例；resume 时加载最新 checkpoint，依据已记录的节点执行记录跳过 completed 节点继续调度。 |
| Exports | CheckpointService |
| Related | createCheckpointService, cancelRun, ControlPlane |
| Tags | TypeScript, agent-runtime, CheckpointService, checkpoint, crash recovery, StateStore, idempotency, channel state, createCheckpointService |
| Source | scan |
| Path | packages/agent-runtime/src/runtime/checkpoint-service.ts |
| Updated | 2026-09-14T06:16:03.820Z |

## compileGraph

| Field | Value |
|-------|-------|
| Summary | compileGraph(def: GraphDefinition): CompiledGraph —— 图编译入口；当 GraphDefinition 未通过静态检查时抛出携带 code 的异常，调用方应将 code 透传给控制 API，而不是解析 message 文本。 |
| When to use | 在启动 run 之前需要将 GraphDefinition 编译为 CompiledGraph，并对图结构做静态校验（失败时按 code 分类处理）时使用。 |
| How to use | 调用 compileGraph(def) 获得 CompiledGraph，随后交给 RunManager/ControlPlane 调度执行；捕获编译异常时读取错误对象上的 code 字段做分支处理并上抛给控制 API。 |
| Exports | compileGraph |
| Related | ControlPlane, cancelRun, BUILTIN_EXECUTORS |
| Tags | TypeScript, agent-runtime, compileGraph, GraphDefinition, CompiledGraph, compiler, static checks |
| Source | scan |
| Path | packages/agent-runtime/src/graph/compiler.ts |
| Updated | 2026-09-14T06:16:03.820Z |

## ControlPlane

| Field | Value |
|-------|-------|
| Summary | ControlPlane：agent-runtime 的进程内控制 API，为编译 graph、启动/管理 run、HITL（Human-in-the-loop）恢复（HITL resumption）与 trace 检索提供干净的编程接口，是 embedder 与 HTTP adapter 的首选 API。 |
| When to use | embedder（嵌入方）或 HTTP adapter 需要以编程方式接入 runtime —— 编译图、管理 run 生命周期、HITL 恢复、检索 trace 时使用。 |
| How to use | 通过 await createControlPlane(store?: StateStore) 获得 ControlPlane 实例，随后调用其方法完成 graph 编译、run 启动与管理、HITL resumption 与 trace 查询；可选注入自定义 StateStore。 |
| Exports | ControlPlane, createControlPlane |
| Related | compileGraph, cancelRun, CheckpointService, createCheckpointService |
| Tags | TypeScript, agent-runtime, ControlPlane, createControlPlane, HITL, StateStore, trace, HTTP adapter, embedder, API, HTTP |
| Source | scan |
| Path | packages/agent-runtime/src/api/control.ts |
| Updated | 2026-09-14T06:16:03.820Z |

## createCheckpointService

| Field | Value |
|-------|-------|
| Summary | createCheckpointService(store: StateStore): CheckpointService —— CheckpointService 工厂函数；将 checkpoint 持久化接入指定 StateStore，支撑节点执行后的状态写入与崩溃恢复。 |
| When to use | 需要为 CheckpointService 指定底层 StateStore，使 run 在崩溃后能从最新 checkpoint 恢复、依据 node execution records 跳过已完成节点时使用。 |
| How to use | 传入 StateStore 调用 createCheckpointService(store) 得到 CheckpointService 实例并接入 runtime，使每个节点执行后自动写入完整 channel state 与执行元数据。 |
| Exports | createCheckpointService |
| Related | CheckpointService, cancelRun, ControlPlane |
| Tags | TypeScript, agent-runtime, createCheckpointService, CheckpointService, StateStore, checkpoint, crash recovery |
| Source | scan |
| Path | packages/agent-runtime/src/runtime/checkpoint-service.ts |
| Updated | 2026-09-14T06:16:03.821Z |

## createControlPlane

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function createControlPlane(store?: StateStore): Promise<ControlPlane> |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/agent-runtime/src/api/control.ts |
| Updated | 2026-09-14T06:17:16.842Z |

## createEventLog

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function createEventLog(store: StateStore): EventLog |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/agent-runtime/src/obs/event-log.ts |
| Updated | 2026-09-14T06:17:16.842Z |

## createFetchHandler

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function createFetchHandler(controlPlane: ControlPlane, options?: |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/agent-runtime/src/api/http.ts |
| Updated | 2026-09-14T06:17:16.842Z |

## createHitlGateway

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function createHitlGateway(store: StateStore): HitlGateway |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/agent-runtime/src/hitl/gateway.ts |
| Updated | 2026-09-14T06:17:16.842Z |

## createHttpServer

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function createHttpServer(controlPlane: ControlPlane, options?: HttpServerOptions): Promise<HttpServer> |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/agent-runtime/src/api/http.ts |
| Updated | 2026-09-14T06:17:16.842Z |

## createInitialChannels

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function createInitialChannels(input: unknown): ChannelMap |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/agent-runtime/src/runtime/state.ts |
| Updated | 2026-09-14T06:17:16.842Z |

## createLlmProvider

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function createLlmProvider(config?: LlmRuntimeConfig \| null, projectRoot?: string): LlmProvider |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/agent-runtime/src/llm/provider.ts |
| Updated | 2026-09-14T06:17:16.842Z |

## createRunSpan

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function createRunSpan(runId: string, graphId: string, input?: unknown): OtelSpan \| null |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/agent-runtime/src/obs/otel-hooks.ts |
| Updated | 2026-09-14T06:17:16.842Z |

## createToolRuntime

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function createToolRuntime(store?: StateStore): ToolRuntime |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/agent-runtime/src/tools/runtime.ts |
| Updated | 2026-09-14T06:22:49.638Z |

## defaultRunManager

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export const defaultRunManager |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/agent-runtime/src/runtime/run-manager.ts |
| Updated | 2026-09-14T06:22:49.638Z |

## deserializeChannels

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function deserializeChannels(data: Record<string, unknown>): ChannelMap |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/agent-runtime/src/runtime/state.ts |
| Updated | 2026-09-14T06:22:49.638Z |

## EndExecutor

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export class EndExecutorimplements NodeExecutor |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/agent-runtime/src/runtime/node-executors.ts |
| Updated | 2026-09-14T06:22:49.638Z |

## endRunSpan

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function endRunSpan(span: OtelSpan \| null, status: "completed" \| "failed" \| "cancelled", output?: unknown, error?: Error): void |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/agent-runtime/src/obs/otel-hooks.ts |
| Updated | 2026-09-14T06:22:49.638Z |

## EventLog

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function createEventLog(store: StateStore): EventLog, export class EventLog |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/agent-runtime/src/obs/event-log.ts |
| Updated | 2026-09-14T06:22:49.638Z |

## executeWithRetry

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function executeWithRetry(   node: import("../graph/types.js").GraphNode,   executor: NodeExecutor,   context: ExecutionContext,   retryPolicy?: import("../graph/types.js").RetryPolicy, ): Promise<NodeResult> |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/agent-runtime/src/runtime/scheduler.ts |
| Updated | 2026-09-14T06:22:49.638Z |

## FakeLlmProvider

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export class FakeLlmProviderimplements LlmProvider |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/agent-runtime/src/llm/provider.ts |
| Updated | 2026-09-14T06:22:49.638Z |

## FnExecutor

| Field | Value |
|-------|-------|
| Summary | GraphNode 节点执行器 FnExecutor，实现 NodeExecutor 接口。职责：将节点执行逻辑与调度（scheduling）分离，使每个 executor 可独立测试、独立替换。位于 packages/agent-runtime/src/runtime/node-executors.ts。 |
| When to use | 需要为函数类型节点提供执行逻辑，或在单测中独立测试/替换某个 NodeExecutor 时使用。 |
| How to use | 通过 getExecutor(nodeType) 按 GraphNode 类型获取对应 NodeExecutor（含 FnExecutor），由内存调度器在节点就绪时调用执行。 |
| Exports | FnExecutor |
| Related | getExecutor, NodeExecutor, GraphNode |
| Tags | agent-runtime, TypeScript, FnExecutor, NodeExecutor, GraphNode, node-executors, executor, 调度器, FnExecutorimplements |
| Source | scan |
| Path | packages/agent-runtime/src/runtime/node-executors.ts |
| Updated | 2026-09-14T06:24:13.203Z |

## getChannel

| Field | Value |
|-------|-------|
| Summary | Channel/Reducer 状态模型：为内存调度器提供可预测、可序列化的状态容器。node executor 的部分更新通过 Reducer 以确定性（deterministic merge semantics）方式合并，避免隐式突变 bug，并为未来 checkpointing 预留能力。 (getChannelNames, ChannelMap) |
| When to use | 需要在 scheduler 中管理图状态、保证部分更新合并结果可预测，或为实现 checkpointing 打基础时使用。 |
| How to use | 操作 ChannelMap 定位指定 channel；节点执行器返回部分更新，由 Reducer 决定合并语义；可配合 getChannelNames 枚举全部 channel。 |
| Exports | getChannel |
| Related | getChannelNames, ChannelMap, scheduler, getLastTerminalOutput |
| Tags | agent-runtime, TypeScript, Channel, Reducer, ChannelMap, state, checkpointing, deterministic merge, getChannelNames |
| Source | scan |
| Path | packages/agent-runtime/src/runtime/state.ts |
| Updated | 2026-09-14T06:24:13.203Z |

## getChannelNames

| Field | Value |
|-------|-------|
| Summary | getChannelNames(channels: ChannelMap): string[] — 从 Channel/Reducer 状态模型中枚举全部 channel 名称，用于内存调度器的状态检查与调试。 |
| When to use | 需要列出状态容器中的 channel、调试状态快照或校验 Reducer 合并结果时使用。 |
| How to use | 传入 ChannelMap 实例，返回 string[] 形式的 channel 名列表；通常与 getChannel 配合读取状态。 |
| Exports | getChannelNames |
| Related | getChannel, ChannelMap |
| Tags | agent-runtime, TypeScript, getChannelNames, ChannelMap, Channel, Reducer, state |
| Source | scan |
| Path | packages/agent-runtime/src/runtime/state.ts |
| Updated | 2026-09-14T06:24:13.203Z |

## getDefaultLlmProvider

| Field | Value |
|-------|-------|
| Summary | LLM provider 抽象的默认提供者，供 llm 类型节点调用。生产环境接入真实 provider，测试使用 FakeLlmProvider 替换。位于 packages/agent-runtime/src/llm/provider.ts。 |
| When to use | 为 llm 节点获取默认 LLM provider，或在测试环境中用 FakeLlmProvider 隔离真实模型调用时使用。 |
| How to use | 调用 getDefaultLlmProvider() 获取默认 provider 实例；生产集成注入真实实现，测试注入 FakeLlmProvider。 |
| Exports | getDefaultLlmProvider |
| Related | FakeLlmProvider, getExecutor |
| Tags | agent-runtime, TypeScript, LLM, provider, FakeLlmProvider, getDefaultLlmProvider, llm nodes |
| Source | scan |
| Path | packages/agent-runtime/src/llm/provider.ts |
| Updated | 2026-09-14T06:24:13.203Z |

## getDefaultRegistry

| Field | Value |
|-------|-------|
| Summary | getDefaultRegistry(): ToolRegistry — 返回默认工具注册表。ToolRegistry 管理工具定义及其 input/output schema 校验，由 ToolRuntime 在执行期查找工具。 |
| When to use | 需要注册带 schema 校验的工具，或让 ToolRuntime 在运行时查找可用工具时使用。 |
| How to use | 调用 getDefaultRegistry() 获取 ToolRegistry，向其注册带输入/输出 schema 的工具定义，供 ToolRuntime 按名查找并校验参数。 |
| Exports | getDefaultRegistry, ToolRegistry |
| Related | ToolRuntime |
| Tags | agent-runtime, TypeScript, getDefaultRegistry, ToolRegistry, ToolRuntime, schema, tools, registry |
| Source | scan |
| Path | packages/agent-runtime/src/tools/registry.ts |
| Updated | 2026-09-14T06:24:13.204Z |

## getExecutor

| Field | Value |
|-------|-------|
| Summary | getExecutor(nodeType: GraphNode["type"]): NodeExecutor — 按 GraphNode 类型返回对应节点执行器。设计动机：将执行逻辑与调度分离，使每个 executor 可独立测试与替换。 |
| When to use | 调度器执行节点前需根据 nodeType 获取 executor，或需要为某类节点替换/单测执行逻辑时使用。 |
| How to use | 在 runtime/node-executors.ts 中传入 GraphNode 的 type 字段，取得对应 NodeExecutor（如 FnExecutor）后由调度循环调用。 |
| Exports | getExecutor |
| Related | FnExecutor, NodeExecutor, GraphNode |
| Tags | agent-runtime, TypeScript, getExecutor, NodeExecutor, GraphNode, node-executors, executor, nodeType |
| Source | scan |
| Path | packages/agent-runtime/src/runtime/node-executors.ts |
| Updated | 2026-09-14T06:24:13.204Z |

## getLastTerminalOutput

| Field | Value |
|-------|-------|
| Summary | getLastTerminalOutput(compiledGraph, channels) — 从已编译图与 channel 状态中读取最后一个 terminal 节点的输出。底层为内存串行 scheduler：使用 Kahn 算法基于预计算邻接表计算 ready set；默认串行（每步一个就绪节点），可选 parallelExecution 将整个 ready set 作为 batch 执行（fan-out），fan-in 使用 in-degree barriers；支持 HITL（Human-in-the-Loop）节点暂停执行等待人工输入。 |
| When to use | 图执行结束后需要读取终态输出，或调试 serial scheduler、parallelExecution、fan-out/fan-in、HITL 暂停行为时使用。 |
| How to use | 传入 CompiledGraph 与 channels Map（配合 getChannel 构建），返回 terminal 节点输出；可与 OTel hooks 结合观察执行轨迹。 |
| Exports | getLastTerminalOutput |
| Related | getChannel, CompiledGraph, scheduler, getOtelApi |
| Tags | agent-runtime, TypeScript, scheduler, Kahn, ready set, parallelExecution, fan-out, fan-in, in-degree barriers, HITL, getLastTerminalOutput, CompiledGraph, serial scheduler, compiledGraph |
| Source | scan |
| Path | packages/agent-runtime/src/runtime/scheduler.ts |
| Updated | 2026-09-14T06:24:13.204Z |

## getOtelApi

| Field | Value |
|-------|-------|
| Summary | getOtelApi(): OtelApi \| null — 为 EventLog 提供可选的 OpenTelemetry hooks。通过 try/catch require 在 @opentelemetry/* 包未安装时优雅降级返回 null，不引入强制 OTel 依赖；span 事件与 EventLog 一并发出以便关联（correlation）。位于 src/obs/otel-hooks.ts。 |
| When to use | 需要分布式 tracing 集成但不希望强制依赖 OpenTelemetry，或在缺少 @opentelemetry/* 时安全降级时使用。 |
| How to use | 调用 getOtelApi() 判断返回的 OtelApi 是否为 null；非空 |
| Exports | export function getOtelApi(): OtelApi \| null |
| Related | 暂无 |
| Tags | getOtelApi, OtelApi, OpenTelemetry, EventLog |
| Source | scan |
| Path | packages/agent-runtime/src/obs/otel-hooks.ts |
| Updated | 2026-09-14T06:24:13.204Z |

## getRun

| Field | Value |
|-------|-------|
| Summary | RunManager 内存态 run 生命周期与元数据存储，状态流转 created→running→completed/failed/cancelled，提供 getRun/cancelRun，集成 compileGraph + scheduler，支持基于 checkpoint 的崩溃恢复（Task 5）。 |
| When to use | 需要按 runId 查询 RunMetadata、跟踪 run 生命周期状态，或在崩溃恢复时读取 checkpoint 元数据时使用 getRun。 |
| How to use | 调用 getRun(runId: string): RunMetadata \| undefined 查询运行元数据；返回 undefined 表示 run 不存在。配合 cancelRun 取消运行，与 compileGraph、scheduler 联动。 |
| Exports | getRun, RunMetadata |
| Related | cancelRun, compileGraph, scheduler |
| Tags | agent-runtime, run-manager, RunManager, getRun, cancelRun, RunMetadata, compileGraph, scheduler, checkpoint, run lifecycle, runId |
| Source | scan |
| Path | packages/agent-runtime/src/runtime/run-manager.ts |
| Updated | 2026-09-14T06:25:16.430Z |

## GraphCompileError

| Field | Value |
|-------|-------|
| Summary | GraphDefinition 静态检查（static checks）失败时抛出的错误类，继承 Error；调用方应将 code 字段透传给控制 API（control APIs），不要解析 message 文本。 |
| When to use | 编译 GraphDefinition 失败时捕获 GraphCompileError，或在控制 API 层基于 code 做结构化错误处理时使用。 |
| How to use | 通过 try/catch 捕获 GraphCompileError，读取其 code 属性并原样透传给控制 API 用于错误分类；避免依赖 message 文本判断。 |
| Exports | GraphCompileError |
| Related | GraphDefinition, compiler |
| Tags | agent-runtime, compiler, GraphCompileError, GraphDefinition, static checks, Error, code, GraphCompileErrorextends |
| Source | scan |
| Path | packages/agent-runtime/src/graph/compiler.ts |
| Updated | 2026-09-14T06:25:16.430Z |

## hasChannel

| Field | Value |
|-------|-------|
| Summary | 内存调度器的 Channel/Reducer 状态模型，提供可预测、可序列化的状态容器，对 node executor 的部分更新做确定性合并（deterministic merge），避免隐式变更并支持未来 checkpoint。hasChannel 用于判断 ChannelMap 中是否存在指定 channel。 |
| When to use | 需要检查 ChannelMap 中是否包含某个 channel，或基于 Channel/Reducer 模型做确定性状态合并、避免隐式 mutation、支持 checkpoint 时使用。 |
| How to use | 调用 hasChannel(channels: ChannelMap, name: string): boolean 判断 channel 是否存在；配合 Reducer 对 node executor 的部分更新做确定性合并。 |
| Exports | hasChannel, ChannelMap |
| Related | Channel, Reducer, scheduler |
| Tags | agent-runtime, state, Channel, Reducer, hasChannel, ChannelMap, scheduler, deterministic merge, checkpoint |
| Source | scan |
| Path | packages/agent-runtime/src/runtime/state.ts |
| Updated | 2026-09-14T06:25:16.430Z |

## HITLExecutor

| Field | Value |
|-------|-------|
| Summary | 各 GraphNode 类型的 node executor 之一，实现 NodeExecutor 接口，负责 HITL（Human-in-the-Loop）节点的执行逻辑；执行与调度分离，便于独立测试和替换。 |
| When to use | 需要执行 HITL 类型的 GraphNode，或将 HITLExecutor 作为可独立测试、可替换的 NodeExecutor 注入调度流程时使用。 |
| How to use | 实现 NodeExecutor 接口，在 scheduler 调度对应 GraphNode 时注入 HITLExecutor 执行；执行逻辑与调度解耦，可单独测试或替换。 |
| Exports | HITLExecutor, NodeExecutor |
| Related | HitlGateway, GraphNode, scheduler |
| Tags | agent-runtime, node-executors, HITLExecutor, HITL, human-in-the-loop, NodeExecutor, GraphNode, scheduler |
| Source | scan |
| Path | packages/agent-runtime/src/runtime/node-executors.ts |
| Updated | 2026-09-14T06:25:16.430Z |

## HitlGateway

| Field | Value |
|-------|-------|
| Summary | HITL（Human-in-the-Loop）网关，管理 interrupt 生命周期：create、retrieve、resume、cleanup，集成 StateStore 做持久化；通过 createHitlGateway(store: StateStore) 创建。 |
| When to use | 需要创建、查询、恢复（resume）或清理 HITL interrupt，或需要基于 StateStore 持久化中断状态时使用。 |
| How to use | 调用 createHitlGateway(store: StateStore): HitlGateway 创建网关实例，再用其管理 interrupt 的 create/retrieve/resume/cleanup 生命周期，状态经 StateStore 持久化。 |
| Exports | createHitlGateway, HitlGateway |
| Related | StateStore, HITLExecutor |
| Tags | agent-runtime, HITL, human-in-the-loop, HitlGateway, createHitlGateway, interrupt, StateStore, resume, cleanup |
| Source | scan |
| Path | packages/agent-runtime/src/hitl/gateway.ts |
| Updated | 2026-09-14T06:25:16.430Z |

## initDefaultLlmProvider

| Field | Value |
|-------|-------|
| Summary | 面向 llm 节点的 LLM provider 抽象层。生产集成接入真实 provider，测试使用 FakeLlmProvider；initDefaultLlmProvider(projectRoot?) 初始化默认 LlmProvider。 |
| When to use | 需要为 llm 节点初始化 LlmProvider，或需要在生产实现与测试用 FakeLlmProvider 之间切换 LLM 提供方时使用。 |
| How to use | 调用 initDefaultLlmProvider(projectRoot?: string): LlmProvider 获取默认 provider 实例；测试场景注入 FakeLlmProvider 替代真实 provider。 |
| Exports | initDefaultLlmProvider, LlmProvider |
| Related | FakeLlmProvider |
| Tags | agent-runtime, llm, LLM provider, initDefaultLlmProvider, LlmProvider, FakeLlmProvider, projectRoot, LLM |
| Source | scan |
| Path | packages/agent-runtime/src/llm/provider.ts |
| Updated | 2026-09-14T06:25:16.430Z |

## isMigrated

| Field | Value |
|-------|-------|
| Summary | agent-runtime SQLite schema 的数据库迁移 runner。读取生成的 SQL migration 文件并以幂等（idempotent）方式执行；isMigrated(dbPath) 查询迁移状态。 |
| When to use | 需要按 dbPath 检查 SQLite 数据库是否已完成 schema 迁移，或在启动时保证 idempotent 迁移只执行一次时使用。 |
| How to use | 调用 isMigrated(dbPath: string): Promise<boolean> 判断迁移状态；迁移 runner 读取生成的 SQL migration 文件并幂等执行，可安全重复调用。 |
| Exports | isMigrated |
| Related | migrate, SQLite |
| Tags | agent-runtime, persistence, isMigrated, migration, SQLite, schema, dbPath, idempotent, SQL |
| Source | scan |
| Path | packages/agent-runtime/src/persistence/migrate.ts |
| Updated | 2026-09-14T06:25:16.430Z |

## isOtelAvailable

| Field | Value |
|-------|-------|
| Summary | EventLog 的可选 OpenTelemetry hooks。通过 try/catch require 在未安装 @opentelemetry/* 包时优雅降级，实现无强依赖的分布式 tracing 集成，并与 EventLog 一同发射 span 事件用于关联（correlation）。 |
| When to use | 需要为 EventLog 增加分布式 tracing、检测 OpenTelemetry（OTel）依赖是否可用，或在缺失 @opentelemetry/* 包时优雅降级时使用。 |
| How to use | 调用 isOtelAvailable(): boolean 检测 @opentelemetry/* 是否可用；可用时挂接 OTel hooks，与 EventLog 并行发射 span 事件做跨服务关联分析。 |
| Exports | isOtelAvailable |
| Related | EventLog, otel-hooks |
| Tags | agent-runtime, obs, isOtelAvailable, OpenTelemetry, OTel, EventLog, tracing, span, @opentelemetry/* |
| Source | scan |
| Path | packages/agent-runtime/src/obs/otel-hooks.ts |
| Updated | 2026-09-14T06:25:16.430Z |

## LLMExecutor

| Field | Value |
|-------|-------|
| Summary | GraphNode 的 LLM 节点执行器，实现 NodeExecutor 接口（见 node-executors.ts）。将执行逻辑与调度分离，使每个 executor 可独立测试与替换。 |
| When to use | 需要为 graph workflow 中的 LLM 类型 GraphNode 提供执行逻辑，或希望独立单测/替换某个 NodeExecutor 时。 |
| How to use | 实现 NodeExecutor 接口创建 LLMExecutor，由 runtime 调度器在执行到对应 GraphNode 时调用；与其他 executor（如 NotImplementedError 占位）共同位于 node-executors.ts。 |
| Exports | LLMExecutor |
| Related | runGraph, NODE_TYPES, NotImplementedError |
| Tags | agent-runtime, LLMExecutor, NodeExecutor, GraphNode, LLM, node-executors, executor, TypeScript |
| Source | scan |
| Path | packages/agent-runtime/src/runtime/node-executors.ts |
| Updated | 2026-09-14T06:26:25.339Z |

## loadLlmRuntimeConfig

| Field | Value |
|-------|-------|
| Summary | 运行时 LLM 配置加载器：读取 .apt/agent-runtime.llm.（或通过环境变量 AGENT_RUNTIME_LLM_CONFIG 指定路径），返回 LlmRuntimeConfig；不使用 .ai/arch/arch.secrets.。 |
| When to use | agent-runtime 启动或执行 LLM 节点前需要加载运行时 LLM 配置（模型、密钥等）时。 |
| How to use | 调用 loadLlmRuntimeConfig(projectRoot?) 加载 .apt/agent-runtime.llm.，或设置 AGENT_RUNTIME_LLM_CONFIG 指向自定义配置路径；返回 null 表示无可加载配置。 |
| Exports | loadLlmRuntimeConfig |
| Related | LLMExecutor |
| Tags | agent-runtime, loadLlmRuntimeConfig, LlmRuntimeConfig, AGENT_RUNTIME_LLM_CONFIG, .apt/agent-runtime.llm., config, LLM, projectRoot |
| Source | scan |
| Path | packages/agent-runtime/src/llm/config.ts |
| Updated | 2026-09-14T06:26:25.339Z |

## mergeChannels

| Field | Value |
|-------|-------|
| Summary | Channel/Reducer 状态模型：面向 in-memory scheduler，将 node executor 产生的部分更新按确定性 reducer 语义合并进 ChannelMap，返回 MergeResult。状态可预测、可序列化，避免隐式变更 bug，并为未来 checkpointing 打基础。 |
| When to use | 节点执行输出需要合并回图状态，或需要确定性、可序列化的状态容器以支撑部分更新与 checkpointing 时。 |
| How to use | 调用 mergeChannels(channels, updates)，传入当前 ChannelMap 与节点更新的 Record<string, unknown>，依据 MergeResult 写回 scheduler 状态。 |
| Exports | mergeChannels |
| Related | runGraph |
| Tags | agent-runtime, mergeChannels, ChannelMap, MergeResult, Channel, Reducer, state, checkpointing, scheduler, in-memory |
| Source | scan |
| Path | packages/agent-runtime/src/runtime/state.ts |
| Updated | 2026-09-14T06:26:25.339Z |

## NODE_TYPES

| Field | Value |
|-------|-------|
| Summary | 自建 graph workflow 引擎的可执行节点类型集合 NODE_TYPES；刻意保持封闭集合（closed set），使 GraphCompiler 能在运行开始前拒绝拼写错误的节点类型。 |
| When to use | 定义或校验 GraphNode 的 kind、在 GraphCompiler 编译阶段做合法性检查，或扩展新的可执行节点类型时。 |
| How to use | 从 graph/types.ts 导入 NODE_TYPES 校验节点类型；新增节点 kind 时在此常量中扩展，GraphCompiler 将在 run 前拒绝不在集合内的类型。 |
| Exports | NODE_TYPES |
| Related | runGraph, LLMExecutor |
| Tags | agent-runtime, NODE_TYPES, GraphNode, GraphCompiler, graph, workflow, types, TypeScript |
| Source | scan |
| Path | packages/agent-runtime/src/graph/types.ts |
| Updated | 2026-09-14T06:26:25.339Z |

## nodeExecutionRecordToStored

| Field | Value |
|-------|-------|
| Summary | persistence 类型与 StateStore 接口的一部分：将 NodeExecutionRecord 转换为 StoredNodeExecution 存储形态（绑定 runId，剔除 id/createdAt/updatedAt/creator/updater/deleted 等系统字段）。StateStore 提供 runs、node executions、checkpoints、tool calls、events、HITL interrupts、graphs 的 CRUD。 |
| When to use | 需要将节点执行记录持久化到 StateStore，或实现自定义 persistence 后端并复用运行时记录转换逻辑时。 |
| How to use | 调用 nodeExecutionRecordToStored(runId, record) 生成 Omit<StoredNodeExecution, ...> 存储记录，再交由 StateStore 的 CRUD 写入；系统字段由存储层填充。 |
| Exports | nodeExecutionRecordToStored |
| Related | runGraph, mergeChannels |
| Tags | agent-runtime, nodeExecutionRecordToStored, NodeExecutionRecord, StoredNodeExecution, StateStore, persistence, CRUD, checkpoint, HITL, tool calls, runId, createdAt, updatedAt |
| Source | scan |
| Path | packages/agent-runtime/src/persistence/types.ts |
| Updated | 2026-09-14T06:26:25.339Z |

## NotImplementedError

| Field | Value |
|-------|-------|
| Summary | node-executors.ts 中的 NotImplementedError 错误类（extends Error），用于标记尚未实现的 GraphNode executor 或执行分支。 |
| When to use | 为暂不支持执行的节点类型提供占位 executor，或在 NodeExecutor 实现中遇到未实现路径时抛出以快速失败。 |
| How to use | 在 NodeExecutor 实现中 throw new NotImplementedError(...)；调用方可通过 instanceof NotImplementedError 识别未实现路径并做降级或提示。 |
| Exports | NotImplementedError |
| Related | LLMExecutor, NODE_TYPES |
| Tags | agent-runtime, NotImplementedError, Error, NodeExecutor, node-executors, GraphNode, NotImplementedErrorextends |
| Source | scan |
| Path | packages/agent-runtime/src/runtime/node-executors.ts |
| Updated | 2026-09-14T06:26:25.339Z |

## registerOtelHooks

| Field | Value |
|-------|-------|
| Summary | 为 EventLog 注册可选的 OpenTelemetry（OTel）hooks，提供分布式 tracing 集成。通过 try/catch require 在 @opentelemetry/* 包未安装时优雅降级；span events 与 EventLog 一并发出以便关联。 |
| When to use | 需要分布式追踪/可观测性能力，但不希望强制依赖 OpenTelemetry 包时；对 EventLog 事件做 OTel span 关联时。 |
| How to use | 调用 registerOtelHooks(eventLog) 包装 EventLog 并返回增强后的 EventLog；若 @opentelemetry/* 已安装则随事件发出 span events，否则静默降级不影响运行。 |
| Exports | registerOtelHooks |
| Related | 暂无 |
| Tags | agent-runtime, registerOtelHooks, OpenTelemetry, OTel, EventLog, @opentelemetry/*, tracing, observability, hooks, eventLog |
| Source | scan |
| Path | packages/agent-runtime/src/obs/otel-hooks.ts |
| Updated | 2026-09-14T06:26:25.339Z |

## 

| Field | Value |
|-------|-------|
| Summary | 暂无 (runGraph, compiledGraph, CompiledGraph, abortSignal, AbortSignal) |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function runGraph(   compiledGraph: CompiledGraph,   input: unknown,   abortSignal: AbortSignal,   options: SchedulerOptions = |
| Related | 暂无 |
| Tags | runGraph, compiledGraph, CompiledGraph, abortSignal, AbortSignal, SchedulerOptions, parallelExecution, HITL |
| Source | scan |
| Path | packages/agent-runtime/src/runtime/scheduler.ts |
| Updated | 2026-09-14T06:26:25.339Z |

## RunManager

| Field | Value |
|-------|-------|
| Summary | RunManager：内存中的 run 生命周期与元数据存储，集中管理 run 状态流转（created→running→completed/failed/cancelled），提供 getRun/cancelRun，并集成 compileGraph 与 scheduler（调度器），支持基于 checkpoint（检查点）的崩溃恢复（Task 5）。 |
| When to use | 需要创建/查询/取消 agent run、集中管理运行状态元数据，或在崩溃后基于 checkpoint 恢复运行时使用；需要全局单例时可直接用 defaultRunManager。 |
| How to use | 通过 defaultRunManager 单例或实例化 RunManager 获取运行管理器；调用 getRun 查询 run 元数据，cancelRun 取消运行；先用 compileGraph 编译图再交由 scheduler 调度执行，崩溃恢复依赖 checkpoint 数据（Task 5）。 |
| Exports | RunManager, defaultRunManager |
| Related | serializeChannels, SQLiteStateStore, runMetadataToStoredRun |
| Tags | agent-runtime, TypeScript, RunManager, defaultRunManager, getRun, cancelRun, compileGraph, scheduler, checkpoint, run lifecycle, Task 5 |
| Source | scan |
| Path | packages/agent-runtime/src/runtime/run-manager.ts |
| Updated | 2026-09-14T06:28:39.763Z |

## runMetadataToStoredRun

| Field | Value |
|-------|-------|
| Summary | agent-runtime 持久化类型与 StateStore 接口，提供 runs、node executions、checkpoints、tool calls、events、HITL interrupts（人工中断）、graphs 的 CRUD 操作；runMetadataToStoredRun 将内存中的 run 元数据转换为 StoredRun 持久化结构。 |
| When to use | 需要为 agent-runtime 接入或实现 StateStore 持久化（覆盖 runs/node executions/checkpoints/tool calls/events/HITL interrupts/graphs），或在 RunMetadata 与存储结构间转换时使用。 |
| How to use | 实现 StateStore 接口提供各类资源的 CRUD 能力；用 runMetadataToStoredRun 将 RunMetadata 转换为可存储结构后写入存储；可搭配 SQLiteStateStore 作为具体实现。 |
| Exports | runMetadataToStoredRun |
| Related | SQLiteStateStore, RunManager, runMigration |
| Tags | agent-runtime, TypeScript, StateStore, runMetadataToStoredRun, CRUD, checkpoints, tool calls, HITL interrupts, persistence, HITL |
| Source | scan |
| Path | packages/agent-runtime/src/persistence/types.ts |
| Updated | 2026-09-14T06:28:39.763Z |

## runMigration

| Field | Value |
|-------|-------|
| Summary | agent-runtime SQLite schema 的数据库迁移执行器（migration runner），读取生成的 SQL 迁移文件并幂等执行；runMigration(dbPath) 按文件路径打开数据库后执行迁移。 |
| When to use | 初始化 agent-runtime SQLite 数据库，或需要按路径 dbPath 对数据库文件执行幂等 schema 迁移时使用。 |
| How to use | 传入数据库文件路径并 await runMigration(dbPath)；若已持有 Database.Database 连接则改用 runMigrationOnDb(db)；迁移 SQL 为幂等设计，可安全重复执行。 |
| Exports | runMigration |
| Related | runMigrationOnDb, SQLiteStateStore |
| Tags | agent-runtime, TypeScript, runMigration, SQLite, migration, idempotent, schema, better-sqlite3, dbPath, runMigrationOnDb, SQL |
| Source | scan |
| Path | packages/agent-runtime/src/persistence/migrate.ts |
| Updated | 2026-09-14T06:28:39.763Z |

## runMigrationOnDb

| Field | Value |
|-------|-------|
| Summary | agent-runtime SQLite schema 的数据库迁移执行器，读取生成的 SQL 迁移文件并幂等执行；runMigrationOnDb(db) 直接接受已打开的 better-sqlite3 Database.Database 连接。 |
| When to use | 已持有 Database.Database 连接、需要对其执行幂等 schema 迁移而不想重新按路径打开数据库时使用。 |
| How to use | 用 better-sqlite3 打开数据库得到 db 连接后，同步调用 runMigrationOnDb(db) 执行迁移；按文件路径初始化场景请改用 runMigration(dbPath)。 |
| Exports | runMigrationOnDb |
| Related | runMigration, SQLiteStateStore |
| Tags | agent-runtime, TypeScript, runMigrationOnDb, SQLite, migration, better-sqlite3, idempotent, schema, Database.Database, SQL |
| Source | scan |
| Path | packages/agent-runtime/src/persistence/migrate.ts |
| Updated | 2026-09-14T06:28:39.763Z |

## serializeChannels

| Field | Value |
|-------|-------|
| Summary | 内存调度器的 Channel/Reducer 状态模型：提供可预测、可序列化的状态容器，对 node executor 的部分更新执行确定性 merge；serializeChannels 将 ChannelMap 序列化为 Record<string, unknown>，deserializeChannels 反向还原为 ChannelMap，为未来 checkpointing 打基础。 |
| When to use | 需要在 scheduler 中保存图执行状态、以确定性语义合并节点的部分更新（partial updates），或在 checkpoint 持久化前后对 ChannelMap 做序列化/反序列化时使用。 |
| How to use | 用 deserializeChannels(data) 从持久化数据还原 ChannelMap；节点执行产出部分更新后经 reducer 确定性合并；再调用 serializeChannels(channels) 序列化写入 checkpoint；避免隐式 mutation 保证状态可预测。 |
| Exports | serializeChannels, deserializeChannels |
| Related | RunManager, runMetadataToStoredRun |
| Tags | agent-runtime, TypeScript, serializeChannels, deserializeChannels, ChannelMap, Channel, Reducer, state, merge, checkpointing, scheduler |
| Source | scan |
| Path | packages/agent-runtime/src/runtime/state.ts |
| Updated | 2026-09-14T06:28:39.763Z |

## setDefaultLlmProvider

| Field | Value |
|-------|-------|
| Summary | 面向 llm 节点的 LLM provider 抽象层；setDefaultLlmProvider 用于设置默认 provider，生产环境接入真实 provider 实现，测试环境使用 FakeLlmProvider 替身。 |
| When to use | 执行包含 llm 节点的图之前需要配置默认 LLM provider，或在单测/集成测试中注入 FakeLlmProvider 隔离真实模型调用时使用。 |
| How to use | 在启动或测试准备阶段调用 setDefaultLlmProvider(provider) 注册实现；生产环境传入真实 provider，测试传入 FakeLlmProvider；llm 节点执行时自动读取该默认 provider。 |
| Exports | setDefaultLlmProvider |
| Related | setDefaultRegistry |
| Tags | agent-runtime, TypeScript, setDefaultLlmProvider, FakeLlmProvider, LLM provider, llm nodes, dependency injection, LLM |
| Source | scan |
| Path | packages/agent-runtime/src/llm/provider.ts |
| Updated | 2026-09-14T06:28:39.764Z |

## setDefaultRegistry

| Field | Value |
|-------|-------|
| Summary | ToolRegistry 负责管理工具定义及其 input/output schemas（用于校验）；setDefaultRegistry(registry) 设置全局默认 ToolRegistry，ToolRuntime 在工具执行时据此查找。 |
| When to use | 需要在执行前注册带 input/output schema 的工具定义，或为 ToolRuntime 配置默认工具查找入口（ToolRegistry）时使用。 |
| How to use | 构建 ToolRegistry 并注册工具定义（附带 input/output schemas 用于参数与结果校验），随后调用 setDefaultRegistry(registry) 设为默认；tool 节点执行时由 ToolRuntime 经 registry 查找工具并校验后调用。 |
| Exports | setDefaultRegistry |
| Related | setDefaultLlmProvider |
| Tags | agent-runtime, TypeScript, setDefaultRegistry, ToolRegistry, ToolRuntime, tools, input/output schemas, schema validation |
| Source | scan |
| Path | packages/agent-runtime/src/tools/registry.ts |
| Updated | 2026-09-14T06:28:39.764Z |

## SQLiteStateStore

| Field | Value |
|-------|-------|
| Summary | StateStore 接口的 SQLite 实现：基于 better-sqlite3 并使用 prepared statements（预编译语句）提升性能，JSON 列以 TEXT 存储，持久化 runs、node executions、checkpoints、tool calls、events、HITL interrupts、graphs。 |
| When to use | 需要将 agent-runtime 的 runs/node executions/checkpoints/tool calls/events/HITL interrupts/graphs 持久化到 SQLite 文件数据库时使用。 |
| How to use | 先用 runMigration/runMigrationOnDb 执行 schema 建表，再实例化 SQLiteStateStore 作为 StateStore 注入 RunManager 等消费方；JSON 类型字段自动序列化为 TEXT 列存储。 |
| Exports | SQLiteStateStore |
| Related | runMigration, runMigrationOnDb, runMetadataToStoredRun, RunManager |
| Tags | agent-runtime, TypeScript, SQLiteStateStore, StateStore, SQLite, better-sqlite3, prepared statements, persistence, JSON TEXT, SQLiteStateStoreimplements, JSON, TEXT |
| Source | scan |
| Path | packages/agent-runtime/src/persistence/sqlite-store.ts |
| Updated | 2026-09-14T06:28:39.764Z |

## StartExecutor

| Field | Value |
|-------|-------|
| Summary | GraphNode 各类型节点执行器之一，StartExecutor 实现 NodeExecutor 接口，负责 start 类型节点的执行逻辑。Why：将执行逻辑与调度（scheduler）分离，使每个 executor 可独立测试与替换。 |
| When to use | 需要自定义、替换或单测 start 类型 GraphNode 的执行行为时；或在 scheduler 中注册各节点类型的 NodeExecutor 时。 |
| How to use | 实现 NodeExecutor 接口，将 StartExecutor 连同其他 executor（如 SubgraphExecutor、ToolExecutor）注册到 scheduler，由 run-manager 在调度 start 节点时调用。 |
| Exports | StartExecutor |
| Related | SubgraphExecutor, ToolExecutor, NodeExecutor |
| Tags | StartExecutor, NodeExecutor, GraphNode, scheduler, agent-runtime, TypeScript, StartExecutorimplements |
| Source | scan |
| Path | packages/agent-runtime/src/runtime/node-executors.ts |
| Updated | 2026-09-14T06:29:50.019Z |

## startRun

| Field | Value |
|-------|-------|
| Summary | RunManager（in-memory run 生命周期与元数据存储）的入口函数 startRun：启动一次 graph run，集中管理 run 状态流转（created→running→completed/failed/cancelled），提供 getRun/cancelRun，集成 compileGraph + scheduler，支持基于 checkpoint 的崩溃恢复（Task 5）。 |
| When to use | 需要启动一次 GraphDefinition 或 CompiledGraph 的执行、跟踪 run 状态并支持 crash recovery 时。 |
| How to use | 调用 startRun(graph, options)，传入 GraphDefinition 或 CompiledGraph 与 StartRunOptions，返回 Promise<StartRunResult>；随后可用 getRun 查询状态、cancelRun 取消、waitForRun 等待完成。 |
| Exports | startRun |
| Related | waitForRun, StartExecutor, SubgraphExecutor, ToolExecutor |
| Tags | startRun, RunManager, compileGraph, CompiledGraph, GraphDefinition, StartRunOptions, StartRunResult, getRun, cancelRun, checkpoint, run lifecycle, scheduler, agent-runtime |
| Source | scan |
| Path | packages/agent-runtime/src/runtime/run-manager.ts |
| Updated | 2026-09-14T06:29:50.019Z |

## SubgraphExecutor

| Field | Value |
|-------|-------|
| Summary | GraphNode 各类型节点执行器之一，SubgraphExecutor 实现 NodeExecutor 接口，负责 subgraph（子图）类型节点的执行逻辑。Why：将执行逻辑与调度（scheduler）分离，使每个 executor 可独立测试与替换。 |
| When to use | 需要自定义、替换或单测 subgraph 类型 GraphNode 的执行行为时；或需要在 run 中嵌套执行子图时。 |
| How to use | 实现 NodeExecutor 接口，将 SubgraphExecutor 连同其他 executor（如 StartExecutor、ToolExecutor）注册到 scheduler，由 run-manager 在调度 subgraph 节点时调用。 |
| Exports | SubgraphExecutor |
| Related | StartExecutor, ToolExecutor, NodeExecutor |
| Tags | SubgraphExecutor, NodeExecutor, GraphNode, subgraph, scheduler, agent-runtime, TypeScript, SubgraphExecutorimplements |
| Source | scan |
| Path | packages/agent-runtime/src/runtime/node-executors.ts |
| Updated | 2026-09-14T06:29:50.019Z |

## ToolExecutionError

| Field | Value |
|-------|-------|
| Summary | ToolRuntime 执行工具时的错误类 ToolExecutionError（extends Error）：当工具在 schema validation、timeout（AbortController）、retry（exponential backoff）或 idempotency 校验中失败时抛出。 |
| When to use | 需要在调用 ToolRuntime 执行工具时捕获并区分执行失败（校验失败、超时、重试耗尽等）的场景。 |
| How to use | 在调用 createToolRuntime 创建的 ToolRuntime 执行工具处用 try/catch 捕获 ToolExecutionError，根据错误信息定位 validation/timeout/retry/idempotency 失败原因。 |
| Exports | ToolExecutionError |
| Related | ToolRuntime, ToolRegistry, ToolExecutor |
| Tags | ToolExecutionError, ToolRuntime, validation, timeout, AbortController, retry, exponential backoff, idempotency, agent-runtime, TypeScript, ToolExecutionErrorextends |
| Source | scan |
| Path | packages/agent-runtime/src/tools/runtime.ts |
| Updated | 2026-09-14T06:29:50.019Z |

## ToolExecutor

| Field | Value |
|-------|-------|
| Summary | GraphNode 各类型节点执行器之一，ToolExecutor 实现 NodeExecutor 接口，负责 tool 类型节点的执行逻辑，执行时通过 ToolRuntime 调用注册的工具。Why：将执行逻辑与调度（scheduler）分离，使每个 executor 可独立测试与替换。 |
| When to use | 需要自定义、替换或单测 tool 类型 GraphNode 的执行行为时；或在图中让节点调用工具（经 ToolRuntime/ToolRegistry）时。 |
| How to use | 实现 NodeExecutor 接口，将 ToolExecutor 连同其他 executor（如 StartExecutor、SubgraphExecutor）注册到 scheduler，由 run-manager 在调度 tool 节点时通过 ToolRuntime 执行。 |
| Exports | ToolExecutor |
| Related | StartExecutor, SubgraphExecutor, ToolRuntime, ToolRegistry, NodeExecutor |
| Tags | ToolExecutor, NodeExecutor, GraphNode, ToolRuntime, ToolRegistry, scheduler, agent-runtime, TypeScript, ToolExecutorimplements |
| Source | scan |
| Path | packages/agent-runtime/src/runtime/node-executors.ts |
| Updated | 2026-09-14T06:29:50.019Z |

## ToolRegistry

| Field | Value |
|-------|-------|
| Summary | ToolRegistry 管理工具定义及其 schema 的注册表：工具以 input/output schemas 注册用于校验，ToolRuntime 在执行时通过 registry 查找工具。提供 getDefaultRegistry 与 setDefaultRegistry 管理全局默认 registry。 |
| When to use | 需要注册新工具（带 input/output schema）、查询工具定义，或为 ToolRuntime 配置/替换默认工具注册表时。 |
| How to use | 通过 getDefaultRegistry() 获取默认 ToolRegistry 并注册工具定义（含 schemas），或用 setDefaultRegistry(registry) 替换默认 registry；ToolRuntime 执行工具时自动从 registry 查找。 |
| Exports | ToolRegistry, getDefaultRegistry, setDefaultRegistry |
| Related | ToolRuntime, ToolExecutionError, ToolExecutor |
| Tags | ToolRegistry, getDefaultRegistry, setDefaultRegistry, schema, input schema, output schema, ToolRuntime, tool definitions, agent-runtime, TypeScript |
| Source | scan |
| Path | packages/agent-runtime/src/tools/registry.ts |
| Updated | 2026-09-14T06:29:50.019Z |

## ToolRuntime

| Field | Value |
|-------|-------|
| Summary | ToolRuntime 执行已注册工具，内置：input/output schema validation、基于 AbortController 的可配置 timeout、带 exponential backoff 与可选 jitter 的 retry 策略、基于持久化存储的 idempotency key 支持。可通过 createToolRuntime(store?: StateStore) 创建实例。 |
| When to use | 需要在运行时安全执行工具（自动校验、超时控制、失败重试、幂等保护）时；或作为 ToolExecutor 的底层工具执行引擎时。 |
| How to use | 调用 createToolRuntime(store) 创建 ToolRuntime（可传入 StateStore 以持久化 idempotency key），配合 ToolRegistry 查找工具后执行；失败时捕获 ToolExecutionError 处理。 |
| Exports | ToolRuntime, createToolRuntime |
| Related | ToolRegistry, ToolExecutionError, ToolExecutor |
| Tags | ToolRuntime, createToolRuntime, validation, timeout, AbortController, retry, exponential backoff, jitter, idempotency, StateStore, ToolRegistry, agent-runtime, TypeScript |
| Source | scan |
| Path | packages/agent-runtime/src/tools/runtime.ts |
| Updated | 2026-09-14T06:29:50.019Z |

## waitForRun

| Field | Value |
|-------|-------|
| Summary | RunManager（in-memory run 生命周期与元数据存储）提供的等待函数 waitForRun：按 runId 等待 run 进入终态（completed/failed/cancelled），返回 Promise<SchedulerResult \| undefined>。 |
| When to use | 在 startRun 启动 run 后需要同步等待其执行完成并获取 SchedulerResult 时；或脚本化执行 run 并收集最终结果时。 |
| How to use | 先调用 startRun 获得 runId，再调用 waitForRun(runId)，resolve 后得到 SchedulerResult（run 未找到时为 undefined）；可配合 getRun/cancelRun 管理状态。 |
| Exports | waitForRun |
| Related | startRun, StartExecutor, SubgraphExecutor, ToolExecutor |
| Tags | waitForRun, RunManager, runId, SchedulerResult, startRun, getRun, cancelRun, run lifecycle, agent-runtime, TypeScript, compileGraph |
| Source | scan |
| Path | packages/agent-runtime/src/runtime/run-manager.ts |
| Updated | 2026-09-14T06:29:50.019Z |

## ZhipuLlmProvider

| Field | Value |
|-------|-------|
| Summary | 智谱（Zhipu）GLM 的 LLM Provider：ZhipuLlmProvider 实现 LlmProvider 接口，基于 OpenAI-compatible Chat Completions API 调用智谱模型，Base URL 为 https://open.bigmodel.cn/api/coding/paas/v4（Coding Plan）。 |
| When to use | 当 agent-runtime 需要接入智谱（Zhipu）GLM 模型，或希望复用 LlmProvider 抽象、通过 OpenAI-compatible Chat Completions API 访问 https://open.bigmodel.cn/api/coding/paas/v4（Coding Plan）端点时使用。 |
| How to use | 从 packages/agent-runtime/src/llm/zhipu-provider.ts 导入 ZhipuLlmProvider，按 ZhipuLlmProviderOptions 传入 API Key 与模型配置，将实例以 LlmProvider 接口形式注入运行时调用链中使用。 |
| Exports | ZhipuLlmProvider, ZhipuLlmProviderOptions |
| Related | 暂无 |
| Tags | agent-runtime, TypeScript, llm, provider, LlmProvider, ZhipuLlmProvider, ZhipuLlmProviderOptions, Zhipu, 智谱, GLM, OpenAI-compatible, Chat Completions API, open.bigmodel.cn, Coding Plan, ZhipuLlmProviderimplements, OpenAI, API, URL |
| Source | scan |
| Path | packages/agent-runtime/src/llm/zhipu-provider.ts |
| Updated | 2026-09-14T06:30:26.199Z |
