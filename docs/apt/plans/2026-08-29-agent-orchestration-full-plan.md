# C3 Agent Orchestration Full Implementation Plan

> **Spec:** `docs/superpowers/specs/2026-08-29-agent-orchestration-full-design.md`
> **Command:** `/plan-from-spec`
> **Status:** approved
> **projectType:** component（§0.5 设计寻址跳过；UI 以 `designs/v0/agent-runtime-control/page.logic.md` 为 SSOT）

**Goal:** 接通 C3 剩余能力：Job 步 `startRun`/`resumeHitl`、`checking` 自动 `check_wording`、`/internal/agent-runtime` 控制面 + `/api/agent/*`。

**Architecture:** 引入 `AgentRuntimeFactory` 单例持久化 `ControlPlane`（`SQLiteStateStore` 文件 `agent-runtime.db` 与 ledger 同目录）；`JobStepOrchestrator` 编译 `job-step-v1` 长图并在步进/confirm-next 时驱动 HITL；`StepChatBridge` 复用同一 plane；HTTP 挂载 `createFetchHandler` 前缀 `/api/agent`。

---

## Part 1 — 技术方案（APT 寻址）

### 1.1 范围与约束

**In scope：** Factory、JobStepOrchestrator、job-step-v1、confirm-next→resumeHitl、自动 check_wording、/api/agent/*、/internal/agent-runtime Vue 页、测试与契约登记。

**Out of scope：** submit_* Tool、Temporal、独立 agent 进程、改造 audit_design_changes MCP、search_clause（nice，本 plan 不排 Task）。

**冻结：** 认知仅写 Proposal；9 产品页不变；internal 路由不出现在业务侧栏；CI 强制 FakeLlm。

### 1.2 设计寻址

**N/A**（component Profile）。UI 实现以 `designs/v0/agent-runtime-control/page.logic.md` 为 SSOT；`query_design(page=agent-runtime-control)` 当前未入库，实现后 `refresh_asset`。

| 项 | 结果 | 约束摘要 |
|----|------|----------|
| page.logic | `designs/v0/agent-runtime-control/page.logic.md` | 操作：compileGraph/startRun/getRun/cancelRun/resumeHitl/getTrace |
| global tokens | 跳过 MCP | 复用现有 web 布局与 Element Plus 风格 |
| 9 页冻结 | goal.md | `/internal/agent-runtime` 仅 internal |

### 1.3 依赖寻址表

| 依赖 | 来源 | 引用 | 摘要 |
|------|------|------|------|
| StepChatBridge | contract | `packages/core-engine/src/agent/step-chat-bridge.ts` | 每消息 step-chat-v1；需 refactor 用 Factory |
| JobStepOrchestrator | **新建** | `packages/core-engine/src/agent/job-step-orchestrator.ts` | contract 查询失败（幽灵登记）；本切片创建并 register |
| ControlPlane | contract | `packages/agent-runtime/src/api/control.ts` | compileGraph/startRun/resumeHitl/listRunsFromStore |
| createControlPlane | arch | `packages/agent-runtime/src/api/control.ts` | 可注入 StateStore |
| SQLiteStateStore | arch | `packages/agent-runtime/src/persistence/sqlite-store.ts` | 持久化 run/checkpoint/HITL |
| createFetchHandler | arch | `packages/agent-runtime/src/api/http.ts` | REST 适配 ControlPlane |
| JobPipeline.confirmNext | arch | `packages/core-engine/src/pipeline/job-pipeline.ts` | CONFIRM_NEXT 状态机；由 orchestrator fn 节点调用 |
| ReviewDesk.checkWording | arch | `packages/core-engine/src/pipeline/review.ts` | Tool 回调写 Proposal |
| registerStepChatTools | 已有 | `packages/core-engine/src/agent/tools.ts` | check_wording / get_job_context |
| t_job.agent_run_id | schema | `docs/schema/core-engine-schema.md` | 已有列，orchestrator 写入 |
| agent-runtime 表 | schema | `docs/schema/agent-runtime-schema.md` | 复用 t_agent_run 等，**无新 DDL** |

### 1.4 拟改动模块与文件

| 文件/模块 | 变更类型 | 说明 |
|-----------|----------|------|
| `packages/core-engine/src/agent/agent-runtime-factory.ts` | 新建 | 单例 plane + registry + 双图编译 |
| `packages/core-engine/src/agent/job-step-orchestrator.ts` | 新建 | job-step-v1 + onStepEntered/resumeConfirm |
| `packages/core-engine/src/agent/step-chat-bridge.ts` | 修改 | 注入 Factory，去掉独立 createControlPlane |
| `packages/core-engine/src/agent/prompts.ts` | 修改 | 自动措辞 prompt |
| `packages/core-engine/src/pipeline/job-pipeline.ts` | 修改 | 步进后调 orchestrator；confirmNext 可 package-private 供 fn |
| `packages/core-engine/src/http/session.ts` | 修改 | 持有 Factory + Orchestrator |
| `packages/core-engine/src/http/handle-request.ts` | 修改 | confirm-next 委托；挂载 /api/agent/* |
| `packages/core-engine/test/job-step-orchestrator.test.ts` | 新建 | AC-orchestrator-start/auto-wording/confirm |
| `packages/core-engine/test/http-adapter.test.ts` | 修改 | agent routes + confirm 409 |
| `apps/web/src/router.ts` | 修改 | `/internal/agent-runtime` |
| `apps/web/src/views/agent_runtime_control/index.vue` | 新建 | 列表 + trace + resume |
| `apps/web/src/services/agent-runtime.ts` | 新建 | fetch 封装 |
| `designs/v0/agent-runtime-control/test-cases.md` | 新建 | B1.5 用例 |
| `packages/core-engine/src/index.ts` | 修改 | 导出 JobStepOrchestrator（可选） |

### 1.5 风险与未决项

| 风险 | 缓解 |
|------|------|
| 新 public contract JobStepOrchestrator | Task 末 `register_contract` |
| 一期每消息内存 plane → 二期持久化 | Factory 统一；单测仍可用 `:memory:` |
| 无 open HITL 时 confirm-next | HTTP 409 `{ error: "no_open_hitl" }` |
| design 未入库 | 以 page.logic 为准；finish 时 refresh_asset |
| ontology 幽灵 JobStepOrchestrator | 实现后覆盖登记 |

### 1.6 需求锁定对照

| Rn | 优先级 | 覆盖 Task | 备注 |
|----|--------|-----------|------|
| R1 | must | Task 3, 5 | startRun on step entered |
| R2 | must | Task 4, 5 | confirm→resumeHitl |
| R3 | must | Task 3 | auto check_wording in graph |
| R4 | must | Task 8, 9 | control UI |
| R5 | must | Task 6 | /api/agent/* |
| R6 | must | Task 1, 2 | shared Factory |
| R7 | must | Task 2 | StepChat 行为回归 |
| R8 | nice | — | 延期 |
| R9 | must | Task 8 | 不在业务侧栏 |

---

## Part 2 — 可执行任务清单

### Task 1: AgentRuntimeFactory — 持久化 ControlPlane

- [ ] 新建 `agent-runtime-factory.ts`：`getOrCreate({ pipeline, projectRoot, forceFakeLlm })` 返回 `{ plane, registry, store }`
  - **MCP:** `query_contract` name=`ControlPlane`；`search_arch` query=`SQLiteStateStore`
  - **Files:** `packages/core-engine/src/agent/agent-runtime-factory.ts`
- [ ] 使用 `SQLiteStateStore` 文件路径 `{repoRoot}/.apt/agent-runtime.db`（或 `resolveRepoRoot()` 同目录）；`createControlPlane(store)` + `createHitlGateway`
  - **Files:** `packages/core-engine/src/agent/agent-runtime-factory.ts`, `packages/core-engine/src/agent/repo-root.ts`
- [ ] 集中 `createStepChatRegistry(pipeline)`、`initDefaultLlmProvider` / FakeLlm 分支
  - **Files:** `packages/core-engine/src/agent/agent-runtime-factory.ts`, `packages/core-engine/src/agent/tools.ts`
- [ ] 编译并缓存 `step-chat-v1` 与 `job-step-v1`（job 图定义可占位 export，Task 3 填充）
  - **Files:** `packages/core-engine/src/agent/agent-runtime-factory.ts`
- **Verify:** `npx tsc -p packages/core-engine --noEmit`
- **Contracts:** 无（内部模块）

### Task 2: 重构 StepChatBridge 使用 Factory

- [ ] `StepChatBridge.create` 改为从 `AgentRuntimeFactory.getOrCreate` 取 plane/registry，删除独立 `createControlPlane()`
  - **MCP:** `query_contract` name=`StepChatBridge`
  - **Files:** `packages/core-engine/src/agent/step-chat-bridge.ts`
- [ ] `session.getStepChatBridge()` 改为经 Factory 单例（session 持有 factory 引用）
  - **Files:** `packages/core-engine/src/http/session.ts`
- **Verify:** `npm test -w core-engine -- agent-connect`（**R7 / A15-reg / A16-reg**）

### Task 3: JobStepOrchestrator + job-step-v1 图

- [ ] 新建 `job-step-orchestrator.ts`：`onStepEntered(job, step)`、`resumeConfirm(jobId)`、`getOpenHitl(jobId)`
  - **MCP:** `query_arch` path=`packages/core-engine/src/pipeline/job-pipeline.ts` anchor=`CONFIRM_NEXT`
  - **Files:** `packages/core-engine/src/agent/job-step-orchestrator.ts`
- [ ] 定义 `job-step-v1`：`enter_step`(fn 写上下文) → `maybe_auto_wording`(branch: open blocking → tool check_wording) → `wait_confirm`(hitl) → 循环/结束
  - **Files:** `packages/core-engine/src/agent/job-step-orchestrator.ts`, `packages/core-engine/src/agent/prompts.ts`
- [ ] `startRun({ graphId: "job-step-v1", threadId: "job:{jobId}", input: { jobId, step } })`；首次写入 `t_job.agent_run_id`
  - **Files:** `packages/core-engine/src/agent/job-step-orchestrator.ts`
- [ ] 在 `openUploadJob` / `runFixtureJob` 到达 `checking`（及后续认知 step 若需）后调用 `onStepEntered`
  - **Files:** `packages/core-engine/src/pipeline/job-pipeline.ts`
- **Verify:** `npm test -w core-engine -- job-step-orchestrator`（**R1 AC-orchestrator-start, R3 AC-auto-wording**）

### Task 4: confirm-next → resumeHitl 接线

- [ ] `JobStepOrchestrator.resumeConfirm(jobId)`：查 open HITL token → `plane.resumeHitl({ runId, token, decision: { action: "approve" } })` → fn 节点内 `pipeline.confirmNext(jobId)`
  - **MCP:** `query_contract` name=`ControlPlane`（resumeHitl 签名）
  - **Files:** `packages/core-engine/src/agent/job-step-orchestrator.ts`, `packages/core-engine/src/pipeline/job-pipeline.ts`
- [ ] `handle-request.ts`：`POST /api/jobs/:id/confirm-next` 委托 orchestrator；无 open HITL → 409
  - **Files:** `packages/core-engine/src/http/handle-request.ts`, `packages/core-engine/src/http/session.ts`
- **Verify:** `npm test -w core-engine -- http-adapter` 扩展用例（**R2 AC-confirm-resume, AC-no-double-advance**）

### Task 5: job-step 集成测试与契约

- [ ] 新建 `job-step-orchestrator.test.ts`：FakeLlm + fixture job → checking → proposal 自动创建 → confirm-next → pending
  - **Files:** `packages/core-engine/test/job-step-orchestrator.test.ts`
- [ ] `register_contract` name=`JobStepOrchestrator` tsFilePath=`packages/core-engine/src/agent/job-step-orchestrator.ts`
  - **MCP:** `register_contract`
  - **Files:** （MCP 登记）
- **Verify:** `npm test -w core-engine -- job-step-orchestrator`（**R1, R2, R3, R6**）

### Task 6: HTTP — 挂载 /api/agent/*

- [ ] 在 `handle-request.ts` 对 `/api/agent/*` 使用 `createFetchHandler(plane, { prefix: "/api/agent" })` 分发
  - **MCP:** `search_arch` query=`createFetchHandler`
  - **Files:** `packages/core-engine/src/http/handle-request.ts`, `packages/core-engine/src/http/session.ts`
- [ ] 暴露 `GET /api/agent/runs`、`GET /api/agent/runs/:id`、`GET /api/agent/runs/:id/trace`、`POST /api/agent/runs/:id/resume`
  - **Files:** 同上
- [ ] HTTP 单测：list runs 含 job-step run；get trace 非空
  - **Files:** `packages/core-engine/test/http-adapter.test.ts`
- **Verify:** `npm test -w core-engine -- http-adapter`（**R5**）

### Task 7: agent-runtime-control — B1.5 测试用例

- [ ] 从 `page.logic.md` 提取用例写入 `designs/v0/agent-runtime-control/test-cases.md`
  - **MCP:** N/A（designs/v0 SSOT）
  - **Files:** `designs/v0/agent-runtime-control/test-cases.md`
- **Verify:** test-cases.md 覆盖 page.logic 全部操作（compileGraph/startRun/getRun/cancelRun/resumeHitl/getTrace）与 Run.status 边界

### Task 8: agent-runtime-control — B2 前端页面

- [ ] `router.ts` 增加 `{ path: "/internal/agent-runtime", name: "agent_runtime_control", ... }`（不在 App 业务侧栏链接）
  - **Files:** `apps/web/src/router.ts`
- [ ] 新建 `services/agent-runtime.ts`：listRuns、getRun、getTrace、resumeHitl
  - **Files:** `apps/web/src/services/agent-runtime.ts`
- [ ] 新建 `views/agent_runtime_control/index.vue`：Run 表格（runId/graphId/threadId/status）、trace 抽屉、resume 表单（runId+token+decision JSON）
  - **Files:** `apps/web/src/views/agent_runtime_control/index.vue`
- **Verify:** `npx tsc -p apps/web --noEmit`；按 test-cases.md T1–T3 手工或 vitest smoke（**R4 AC-control-list/trace, R9**）

### Task 9: 全量回归与文档

- [ ] 确认 `npm test -w core-engine` 与 `npm test -w agent-runtime` 全绿
  - **Files:** —
- [ ] `docs/使用手册.md` 增补：internal 控制面 URL、confirm-next 与 HITL 关系、agent-runtime.db 路径
  - **Files:** `docs/使用手册.md`
- [ ] `audit_arch_changes` → 触及文件 `refresh_asset`；`JobStepOrchestrator` 契约已登记
  - **MCP:** `audit_arch_changes`, `refresh_asset`
  - **Files:** —
- **Verify:** `npm test` 根脚本（**回归 AC-shared-plane + A15/A16**）

---

## 实现顺序

```
Task 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9
```

Task 3/4 可同批实现但须先完成 Task 1。Task 7 可与 Task 6 并行。

---

## 验收对照（/verify 输入）

| Spec AC | 验证命令 |
|---------|----------|
| AC-orchestrator-start | Task 5 单测 |
| AC-auto-wording | Task 5 单测 |
| AC-confirm-resume | Task 4 HTTP 测 |
| AC-control-list/trace | Task 8 + Task 6 |
| AC-shared-plane | Task 5 断言同 store 路径 |
| A15/A16 回归 | Task 2 + Task 9 |
