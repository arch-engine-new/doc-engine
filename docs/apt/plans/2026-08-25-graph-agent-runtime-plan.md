# Graph Agent Runtime Implementation Plan

> **Spec:** `docs/superpowers/specs/2026-08-25-graph-agent-runtime-design.md`
> **Command:** `/plan-from-spec`
> **Status:** approved
> **projectType:** component

**Goal:** 交付可嵌入的 TypeScript Graph 工作流 Agent Runtime（调度 / checkpoint / tool / HITL / 可观测）+ 最小控制面 API，默认 SQLite 持久化。

**Architecture:** 自研 monorepo 包 `packages/agent-runtime`：graph-core 编译校验 → runtime Scheduler/RunManager → ToolRuntime → CheckpointService/StateStore(SQLite) → EventLog + 可选 OTel 钩子 → 进程内/轻量 HTTP 控制面。业务能力通过 Tool 注册与子图扩展，不写死域逻辑。

---

## Part 1 — 技术方案（APT 寻址）

### 1.1 范围与约束

**In scope（来自 spec）：**
- Graph 模型（llm/tool/fn/branch/fan-in-out/hitl/subgraph）
- 执行引擎、checkpoint 崩溃恢复、tool 幂等、retry、HITL resume
- EventLog + OTel 钩子；SQLite StateStore；控制面 API
- AC-1…AC-7 验收夹具与单测

**Out of scope：**
- 可视化编排 UI、完整 IAM、训练/向量库、改 mcp-server/arch-engine
- 绑定特定云 Agent 产品

**约束：**
- Node ≥ 20 / TypeScript
- 禁止默认任意 shell tool
- 建表已 apply：`docs/schema/generated/agent-runtime-migration.sql`（sql-fallback）

### 1.2 设计寻址

N/A（projectType=component；pmUi=false；无产品 UI Task）

### 1.3 依赖寻址表

| 依赖 | 来源 | 引用 | 摘要 |
|------|------|------|------|
| AgentRuntimeSchemaSql | arch (register_asset) | `docs/schema/generated/agent-runtime-migration.sql` | 7 表 SQLite DDL |
| agent-runtime-rows | filesystem | `docs/schema/generated/agent-runtime-rows.ts` | 行类型 companion |
| EntityGraph | contract | **未命中（空仓）** | 实现后由 scan 入图；禁止手改 entities.json |
| compileGraph / StateStore / AgentRuntime | contract | **待建** | 本 plan 产出并 `register_contract` |
| 外部 LangGraph/Temporal | — | **不引入** | spec 方案 B 自研内核 |

> 空仓无既有 runtime 契约；缺失项均为本功能交付物，不 `report_missing` 阻塞。DDL 资产已可检索。

### 1.4 拟改动模块与文件

| 文件/模块 | 变更类型 | 说明 |
|-----------|----------|------|
| `package.json` / workspace | create | monorepo 根 + scripts |
| `packages/agent-runtime/package.json` | create | 包清单、exports |
| `packages/agent-runtime/tsconfig.json` | create | TS 配置 |
| `packages/agent-runtime/src/graph/*` | create | 类型、Compiler |
| `packages/agent-runtime/src/runtime/*` | create | Scheduler、RunManager、reducers |
| `packages/agent-runtime/src/tools/*` | create | ToolRegistry、ToolRuntime |
| `packages/agent-runtime/src/persistence/*` | create | StateStore、SQLite、migration runner |
| `packages/agent-runtime/src/hitl/*` | create | HitlGateway |
| `packages/agent-runtime/src/api/*` | create | 控制面 in-proc + 可选 HTTP |
| `packages/agent-runtime/src/obs/*` | create | EventLog、OTel hooks |
| `packages/agent-runtime/src/index.ts` | create | 公共导出 |
| `packages/agent-runtime/test/*` | create | 单元/集成 |
| `packages/agent-runtime/examples/crash-recovery/*` | create | 示例图 |
| `src/contracts/agent-runtime.ts` | create | 对外 TS 契约 |
| `docs/schema/generated/*` | reuse | 已 apply 的 DDL/类型 |

### 1.5 表设计（§0.6）

已评审并 apply（sql-fallback）：

| 表 | 作用 |
|----|------|
| t_agent_graph | 图定义快照 |
| t_agent_run | 一次执行 |
| t_agent_node_execution | 节点尝试 |
| t_agent_checkpoint | 状态快照 |
| t_agent_tool_call | 工具调用+幂等键 |
| t_agent_run_event | 事件流 |
| t_agent_hitl_interrupt | HITL token |

DDL：`docs/schema/generated/agent-runtime-migration.sql`  
公共字段：id / created_at / updated_at / creator / updater / deleted（无 tenant_id 豁免已记）

### 1.6 风险与未决项

| 风险 | 缓解 |
|------|------|
| 并行 fan-out/fan-in 复杂度 | M1 先串行+简单 barrier；测试锁定语义 |
| checkpoint 全量状态膨胀 | 首版全量 JSON；后续可增量 |
| LLM 真实联调 | fake provider；不阻塞 AC |
| EntityGraph 扫描对 SQL 覆盖 | implement 后 `start_init`/`sync-changes`；契约靠 register_contract |

---

## Part 2 — 可执行任务清单

> 实现由 `/implement-plan` 子 Agent 串行；每 Task 含 Files + Verify。component Profile：无 B2 页面 test-cases 门禁。

### Task 1: 脚手架 monorepo + agent-runtime 包
- [ ] 初始化根 package.json（workspaces）、packages/agent-runtime、tsconfig、vitest
  - **MCP:** `search_arch` query=`agent runtime`（确认仅有 schema SQL 资产）
  - **Files:** `package.json`, `packages/agent-runtime/package.json`, `packages/agent-runtime/tsconfig.json`, `packages/agent-runtime/vitest.config.ts`, `packages/agent-runtime/src/index.ts`
  - **Verify:** `npm install` && `npx tsc -p packages/agent-runtime --noEmit`

### Task 2: graph-core 类型与 GraphCompiler
- [ ] 定义 Node/Edge/Graph/RetryPolicy 类型；实现 compile 校验（缺终端、非法边、未知类型）
  - **MCP:** `query_arch` path=`backend/agent-runtime/pojo`（对照持久化字段语义）
  - **Files:** `packages/agent-runtime/src/graph/types.ts`, `packages/agent-runtime/src/graph/compiler.ts`, `packages/agent-runtime/test/graph-compiler.test.ts`
  - **Verify:** `npm test -w agent-runtime -- graph-compiler`

### Task 3: 内存 State + Scheduler + RunManager（M1）
- [ ] 实现 channel/reducer 状态、串行调度、run 生命周期（无持久化可跑通 ≥5 节点图）
  - **Files:** `packages/agent-runtime/src/runtime/state.ts`, `packages/agent-runtime/src/runtime/scheduler.ts`, `packages/agent-runtime/src/runtime/run-manager.ts`, `packages/agent-runtime/src/runtime/node-executors.ts`, `packages/agent-runtime/test/scheduler.test.ts`
  - **Verify:** `npm test -w agent-runtime -- scheduler`（AC-1 内存路径）

### Task 4: 接入 SQLite StateStore + migration（M2）
- [ ] 实现 StateStore 接口；better-sqlite3 执行 `agent-runtime-migration.sql`；Run/Checkpoint CRUD
  - **MCP:** `query_arch` path=`backend/agent-runtime/pojo`；复用 `docs/schema/generated/agent-runtime-migration.sql`
  - **Files:** `packages/agent-runtime/src/persistence/types.ts`, `packages/agent-runtime/src/persistence/sqlite-store.ts`, `packages/agent-runtime/src/persistence/migrate.ts`, `packages/agent-runtime/test/sqlite-store.test.ts`, `docs/schema/generated/agent-runtime-migration.sql`
  - **Verify:** `npm test -w agent-runtime -- sqlite-store`

### Task 5: Checkpoint 崩溃恢复（AC-2）
- [ ] 节点边界写 checkpoint；resume 从最近合法 seq；不重复副作用钩子
  - **Files:** `packages/agent-runtime/src/runtime/checkpoint-service.ts`, `packages/agent-runtime/test/checkpoint-recovery.test.ts`
  - **Verify:** `npm test -w agent-runtime -- checkpoint-recovery`

### Task 6: ToolRuntime + 幂等 + retry（M3 / AC-4）
- [ ] Tool 注册、schema 校验、timeout、RetryPolicy、idempotency_key 落 t_agent_tool_call
  - **Files:** `packages/agent-runtime/src/tools/registry.ts`, `packages/agent-runtime/src/tools/runtime.ts`, `packages/agent-runtime/test/tool-runtime.test.ts`
  - **Verify:** `npm test -w agent-runtime -- tool-runtime`

### Task 7: HITL + resume API（M4 / AC-3）
- [ ] waiting_hitl、一次性 token、resumeHitl 幂等、过期策略
  - **Files:** `packages/agent-runtime/src/hitl/gateway.ts`, `packages/agent-runtime/test/hitl.test.ts`
  - **Verify:** `npm test -w agent-runtime -- hitl`

### Task 8: EventLog + 控制面 API（AC-5/AC-7）
- [ ] 事件 append/getTrace；导出 compileGraph/startRun/getRun/cancelRun/resumeHitl/getTrace；可选 HTTP 适配
  - **Files:** `packages/agent-runtime/src/obs/event-log.ts`, `packages/agent-runtime/src/obs/otel-hooks.ts`, `packages/agent-runtime/src/api/control.ts`, `packages/agent-runtime/src/api/http.ts`, `packages/agent-runtime/src/index.ts`, `packages/agent-runtime/test/control-api.test.ts`
  - **Verify:** `npm test -w agent-runtime -- control-api`

### Task 9: 对外契约注册 + 示例 + 文档
- [ ] 写 `src/contracts/agent-runtime.ts`；示例 crash-recovery 图；README 最小用法
  - **MCP:** 完成后 `register_contract` name=`AgentRuntime`；`register_asset` 刷新核心模块
  - **Files:** `src/contracts/agent-runtime.ts`, `packages/agent-runtime/examples/crash-recovery/main.ts`, `packages/agent-runtime/README.md`
  - **Contracts:** `AgentRuntime` → `src/contracts/agent-runtime.ts`
  - **Verify:** `npm test -w agent-runtime`（全绿）&& `npx tsc -p packages/agent-runtime --noEmit`

### Task 10: 知识闭环预备
- [ ] `start_init` 或 `sync_arch_changes` 使新源码可检索；确认无高危未登记
  - **MCP:** `start_init` full 或 `audit_arch_changes` + `refresh_asset`
  - **Files:** （只读扫描；必要时补 export 注释）
  - **Verify:** `search_arch` query=`RunManager` 或 `compileGraph` 能命中源码资产

---

## 验收映射

| AC | Task |
|----|------|
| AC-1 ≥5 节点图 | T2–T3 |
| AC-2 checkpoint 恢复 | T5 |
| AC-3 HITL | T7 |
| AC-4 retry | T6 |
| AC-5 trace | T8 |
| AC-6 SQLite 可切换接口 | T4 |
| AC-7 契约+单测 | T8–T9 |

---

*Generated by /plan-from-spec. Status=draft until user 确认.*
