# page.logic — Agent Runtime 控制面

## 元信息
- pageId: agent-runtime-control
- feature: agent-runtime
- title: Agent Runtime 控制面
- route: /internal/agent-runtime
- pageType: api-surface
- source: docs/superpowers/specs/2026-08-25-graph-agent-runtime-design.md

## 操作明细

| 操作 | 说明 | 入参要点 | 出参要点 |
|------|------|----------|----------|
| compileGraph | 编译并注册图定义 | graph def（nodes/edges/reducers） | graphId |
| startRun | 启动一次执行 | graphId, input, threadId? | runId, status |
| getRun | 查询 run | runId | RunView（status/error/progress） |
| cancelRun | 取消 run | runId | void/ok |
| resumeHitl | 提交人工决策恢复 | runId, token, decision | runId, status |
| getTrace | 按 run 回放事件 | runId | Event[] |

## 主流程

1. 业务方定义 Graph → compileGraph → 得到 graphId。
2. startRun(input) → 创建 Run + 初始 Checkpoint → Scheduler 调度节点。
3. 节点执行（llm/tool/fn/branch/hitl/subgraph）→ reducer 合并状态 → 写 Checkpoint → 写 Event。
4. 若 HITL：run=waiting_hitl，外部 resumeHitl 后继续。
5. 成功 completed / 失败 failed / 取消 cancelled。
6. 崩溃恢复：加载最近合法 Checkpoint 续跑；Tool 幂等键防重复副作用。

## 状态

### Run.status
- created
- running
- waiting_hitl
- completed
- failed
- cancelled

### NodeExecution.status
- pending
- running
- succeeded
- failed
- skipped
- waiting_hitl

### HitlInterrupt.status
- open
- resumed
- expired

## 依赖

- Graph 定义（内存/注册表，可持久化 graph 快照）
- StateStore（Run / Checkpoint / Event / ToolCall / Hitl）
- Tool 注册表（非表，运行时）
- 可选 LLM Provider（fake 可测）

## 数据实体推导（供 schema）

1. **GraphDefinition** — 已编译图快照（graphId, version, def_json）
2. **AgentRun** — 一次执行（runId, graphId, threadId, status, input, output, error）
3. **NodeExecution** — 节点执行记录
4. **Checkpoint** — 状态快照
5. **ToolCall** — 工具调用（含 idempotency_key）
6. **RunEvent** — 可回放事件流
7. **HitlInterrupt** — 人工介入挂起令牌

## 非目标
- 可视化 UI 页面字段
- 多租户 IAM 表（tenant_id 可预留空）
