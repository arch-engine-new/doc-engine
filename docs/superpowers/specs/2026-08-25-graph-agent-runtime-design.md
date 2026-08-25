---
title: Graph Workflow Industrial Agent Runtime
date: 2026-08-25
status: approved
risk: high
phase: approved
topic: graph-agent-runtime
approvedAt: 2026-08-25T12:00:00.000Z
approvedBy: user
---

# Design Spec: 工业级 Graph 工作流 Agent Runtime

## Goal

构建可生产落地的 **Agent Runtime / Orchestration 平台**，以**有向图（Graph）工作流**为执行模型：节点可组合、边可条件路由、状态可持久化、执行可观测、失败可重试、关键路径可人工介入。交付物是可被业务系统嵌入的 runtime SDK + 最小控制面 API，而非一次性 demo 脚本。

## 范围（In Scope）

1. **Graph 定义模型**：Node / Edge / Graph 元数据；节点类型至少覆盖：LLM 调用、Tool 调用、纯函数/代码、条件分支、并行汇合（fan-out/fan-in）、Human-in-the-loop、子图（subgraph）。
2. **执行引擎**：按图拓扑调度；支持同步 invoke 与异步 run；确定性逐步推进；可取消。
3. **状态与 Checkpoint**：线程级（thread/run）状态；节点前后 checkpoint；崩溃恢复后从最近合法 checkpoint 续跑。
4. **工具系统**：统一 Tool 注册表；入参/出参 schema 校验；超时、重试、幂等键；沙箱边界（禁止默认任意 shell）。
5. **错误与重试策略**：节点级 retry/backoff；图级 failure 路由边；死信与可查询失败原因。
6. **人工介入（HITL）**：节点挂起 → 等待外部决策/表单输入 → 恢复执行；超时策略。
7. **可观测性**：结构化 trace（run/node/tool 事件）；关联 runId；metrics 计数（成功/失败/延迟）；可导出 OpenTelemetry 友好事件流（首版可先 JSON 事件日志）。
8. **持久化**：Run、NodeExecution、Checkpoint、ToolCall、Event 等存储抽象；默认实现至少一种（SQLite 开发 / 可换 JDBC/Postgres 生产）。
9. **控制面 API（最小）**：创建/启动/查询/取消 run；提交 HITL 决策；查询 trace。
10. **验收夹具**：示例图（多步 tool + 条件分支 + HITL + 崩溃恢复）；单元/集成测试绿。

## 非目标（Out of Scope）

- 可视化编排控制台 UI（本 goal pmUi=false；可后续单独立项）。
- 多租户计费、完整 IAM 产品化（仅预留 authn 钩子）。
- 训练/微调模型；向量库产品本身。
- 与特定云厂商 Agent 服务的深度绑定（可做可选 adapter，非首版必达）。
- 修改 APT 的 mcp-server / arch-engine 管线本身。

## 成功标准 / 验收标准

| ID | 标准 |
|----|------|
| AC-1 | 可用 TypeScript API 定义一张含 ≥5 节点、含条件边与 1 个 tool 节点的 Graph，并成功跑通。 |
| AC-2 | Run 中途进程被杀后，重启能从最近 checkpoint 续跑且不重复产生副作用（tool 幂等键生效）。 |
| AC-3 | HITL 节点进入 waiting 状态；提交决策后图继续并到达 terminal。 |
| AC-4 | 任意失败节点可配置 retry；耗尽后走 failure 边或标记 run=failed，原因可查询。 |
| AC-5 | 一次 run 的事件流可按 runId 完整回放（node_start/node_end/tool_call/checkpoint/hitl）。 |
| AC-6 | 持久化层可切换（接口稳定）；默认 SQLite 本地可跑通全部示例测试。 |
| AC-7 | 公开 API 有类型契约与最小文档；核心路径单测覆盖调度、checkpoint、HITL、retry。 |

## 澄清结论（全自动自答）

| 问题 | 决策 |
|------|------|
| 交付形态 | Runtime 库 + 轻量 HTTP/进程内 API；先库后服务 |
| 语言 | **TypeScript (Node ≥20)**：与现有 APT 工具链一致，利于快速落地 |
| 图模型风格 | **显式 Graph 声明**（节点+边+reducer），类 LangGraph 语义但自研核心，避免黑盒锁定 |
| 状态模型 | **Channel/Reducer 状态**：多通道合并；checkpoint 序列化 JSON |
| 执行 | 单 worker 协程调度首版；预留队列接口 |
| 人机 | 中断通道 + external resume API |
| 存储 | StateStore 接口 + SQLite 默认实现 |

## 方案对比（核心决策：执行内核）

### 方案 A — 薄封装开源图引擎（如直接依赖 LangGraph JS）

- 优点：上手快、社区能力全
- 缺点：版本/协议绑定、工业定制（审计、多存储、严格幂等）受制于上游；升级风险高
- 适合：原型验证

### 方案 B — 自研 Graph Runtime 内核（推荐）

- 优点：调度/checkpoint/HITL/观测边界清晰；可定义稳定对外契约；满足工业可控
- 缺点：首版工作量大；需自建测试矩阵
- 适合：生产 runtime 平台

### 方案 C — 工作流引擎改造（Temporal/Cadence 风格）

- 优点：强耐久、强重试
- 缺点：Agent/LLM 节点语义与 tool schema 需大量适配；运维重量大
- 适合：已有 Temporal 基础设施的组织

**推荐：方案 B**。理由：goal 明确「工业级 / 可生产 / 非 demo」，需要自有调度语义与持久化抽象；同时借鉴 A 的图+状态最佳实践，避免从零发明概念。

## 设计

### Architecture

分层：

1. **graph-core**：Graph/Node/Edge 类型、编译校验（入度/出度、环检测策略、终端节点）。
2. **runtime**：调度循环、状态 reducer、中断与恢复。
3. **tools**：Tool 定义与执行。
4. **persistence**：Run/Checkpoint/Event 仓储。
5. **api**：控制面。
6. **observability**：事件与 metrics 钩子。

控制流：Control API → Orchestrator(RunManager/Scheduler/HitlGateway) → NodeExecutors + ToolRuntime + CheckpointService → StateStore + EventLog。

### Components

| 组件 | 职责 |
|------|------|
| GraphCompiler | 校验图；生成可执行描述符 |
| RunManager | run 生命周期：created→running→waiting_hitl→completed/failed/cancelled |
| Scheduler | 选择可运行节点；处理并行 fan-out/fan-in 屏障 |
| NodeExecutor | 按类型执行；统一超时 |
| ToolRuntime | schema 校验、幂等、重试 |
| CheckpointService | 每节点边界快照 |
| HitlGateway | 挂起令牌、恢复载荷校验 |
| EventLog | 追加写事件 |
| StateStore | 抽象存储 |

### Data flow

1. 客户端 compile(graph) → 注册 graphId。
2. startRun({graphId, input, threadId}) → 写 Run → 初始 checkpoint → 入调度。
3. Scheduler 取 ready 节点 → Executor 读 state → 执行 → reducer 合并 → checkpoint → emit events。
4. 遇 HITL：run=waiting_hitl，写挂起记录，返回 interrupt payload。
5. resumeHitl({runId, token, decision}) → 合并决策到 state → 继续调度。
6. 无 ready 节点且存在终端 → completed；不可恢复错误 → failed。

### Error handling

| 场景 | 策略 |
|------|------|
| 节点抛错 | 按节点 RetryPolicy（max、backoff、jitter）；耗尽 → onError 边或 fail run |
| Tool 超时 | 取消+记事件；可重试若幂等 |
| Checkpoint 写失败 | 中止 run（避免脑裂）；告警 |
| 重复 resume | token 一次性；重复提交返回幂等成功 |
| 取消 | 协作式 cancel flag；节点检查点退出 |

### Testing

- 单元：编译器校验、reducer 合并、retry 策略、HITL token。
- 集成：SQLite 下完整示例图；崩溃恢复（kill 模拟用「仅加载 checkpoint 再跑」）。
- 契约：控制面 API 类型快照测试。
- 非目标：真实 LLM 计费联调（LLM 节点用 fake provider）。

## 对外契约（首版草案，稳定后 register_contract）

- compileGraph(def) -> { graphId }
- startRun(req) -> { runId, status }
- getRun(runId) -> RunView
- cancelRun(runId) -> void
- resumeHitl(req) -> { runId, status }
- getTrace(runId) -> Event[]

本 spec 引入新对外契约（SDK/API），风险按 high 处理。

## 拟改动文件规模（预估）

15–30 个文件（core/runtime/tools/persistence/api/tests/examples）→ 大于 8 文件 → high。

建议包结构（实现阶段）：

- packages/agent-runtime/src/graph/
- packages/agent-runtime/src/runtime/
- packages/agent-runtime/src/tools/
- packages/agent-runtime/src/persistence/
- packages/agent-runtime/src/api/
- packages/agent-runtime/src/obs/
- packages/agent-runtime/test/
- packages/agent-runtime/examples/crash-recovery/

## Ontology detection

### Query 记录

- query_ontology()（无参）— 2026-08-25 brainstorm
- query_project_status — phase idle，nextAction 曾提示 schema_design（建表信号）

### 检测到的既有资产

| 资产 | 状态 |
|------|------|
| modules / packages / contracts | 空 |
| designs/v0 页面 | 无 page.logic（仅 _features.md） |
| .ai/arch/last-scan.json | 存在，modules 空 |
| agent-protocol-mcp | 项目级配置可用（编排层，非本 runtime 实现） |

### 复用决策

| 决策 | 理由 |
|------|------|
| 不复用业务模块/契约 | 仓库为空，无现成 Agent/Graph 资产 |
| 复用 APT 工程纪律 | 后续 plan/implement/verify/schema 走 APT 门禁 |
| 不修改 mcp-server / arch-engine | 明确非目标，避免平台耦合 |
| 新建 StateStore 与 Run 相关表 | 持久化自有模型；PB-3/4 schema 步落地 |

## 风险分级

- frontmatter risk: high
- 正文含新对外契约
- 拟改动大于 8 个文件
- 非 mcp-server / 非 arch-engine 改动

判定：high → status: draft，phase: spec_pending_approval。

## 实现分期（供 plan-from-spec 拆任务）

1. M1 Graph+Scheduler+内存状态：无持久化可跑通单测图。
2. M2 Checkpoint+SQLite+崩溃恢复。
3. M3 ToolRuntime+Retry+幂等。
4. M4 HITL+控制面 API。
5. M5 EventLog/OTel 钩子+示例+文档。

---

Generated by apt-auto-brainstorm (full-auto under /apt-goal). Awaiting human approval.
