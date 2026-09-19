# verify-fix: orchestration

> **Source verify:** `.apt/verify/latest.md`
> **Overall:** FAIL
> **Status:** approved
> **Command:** `$apt-plan-from-verify`
> **classify:** `recommended=plan-from-verify`
> **implementation dims:** Plan 对照、设计 audit、代码质量、测试/构建、测试用例覆盖率

## Part 1 — 背景与范围

来自 `.apt/verify/latest.md` Failures F1–F5；架构 audit / 契约登记已 PASS（finish-feature 已完成），本 plan 不重复 closeout。

| Failure | 修复策略 |
|---------|----------|
| F1 tsc HITL status | `job-step-orchestrator.ts` 用 `"pending"` 匹配 `HitlInterruptStatus` |
| F2 代码质量 | `agent-runtime.ts` 四个导出函数补 why 注释（解除 high；medium 降至 <5） |
| F3 设计 audit | 终端 `design-sync` 入库 `agent-runtime-control`（参照 `designs/v0/.../page.logic.md`） |
| F4 测试用例 T2/T3 | `http-adapter.test.ts` 补 trace + resume 探针 |
| F5 文档 Task 9 | `docs/使用手册.md` 增补 internal 控制面章节 |

**非目标：** 不改业务语义（confirm-next 流程、图结构）；不碰 `demo-session.ts` 预存 medium（修复后 mediumCount<5 即可）。

### 依赖寻址

| 依赖 | 来源 | 路径 |
|------|------|------|
| JobStepOrchestrator | contract | `packages/core-engine/src/agent/job-step-orchestrator.ts` |
| HitlInterruptStatus | arch | `packages/agent-runtime/src/hitl/gateway.ts` → `"pending"` |
| page.logic SSOT | designs/v0 | `designs/v0/agent-runtime-control/page.logic.md` |
| test-cases | designs/v0 | `designs/v0/agent-runtime-control/test-cases.md` |

---

## Part 2 — Tasks

### Task 1: 修复 HITL interrupt status 类型（F1）

- [x] `getOpenHitl` / `onStepEntered` 中将 `row.status === "open"` 改为 `row.status === "pending"`
  - **MCP:** `query_contract` name=`JobStepOrchestrator`
  - **Files:** `packages/core-engine/src/agent/job-step-orchestrator.ts`
- **Verify:** `npx tsc -p packages/core-engine --noEmit`

### Task 2: agent-runtime.ts 公开 API 注释（F2）

- [x] 为 `listAgentRuns`、`getAgentRun`、`getAgentTrace`、`resumeAgentHitl` 各加一行 why 注释（≥8 字）
  - **Files:** `apps/web/src/services/agent-runtime.ts`
- **Verify:** `check_code_quality`（projectRoot）→ `highCount=0` 且 `mediumCount<5`

### Task 3: HTTP 测试补 T2/T3（F4）

- [x] 在 `http-adapter.test.ts` 增加：`demo reset` 后取 `job-step-v1` runId → `GET /api/agent/runs/:id/trace` 断言 `trace.length > 0` 且含 `run_started`（T2）
- [x] 同一 run 若有 open HITL：从 orchestrator 缓存或 trace 取 token → `POST /api/agent/runs/:id/resume` with `{action:"approve"}` 返回 200（T3）；或断言 resume 后 run status 变化
  - **Files:** `packages/core-engine/test/http-adapter.test.ts`
- **Verify:** `npm test -w core-engine -- http-adapter`；对照 `test-cases.md` T2/T3

### Task 4: 使用手册增补（F5 / Plan Task 9）

- [x] `docs/使用手册.md` 增加小节：**Agent 控制面** — URL `/internal/agent-runtime`、`.apt/agent-runtime.db`、`confirm-next` 须经 `resumeHitl`、与 StepChat 区别
  - **Files:** `docs/使用手册.md`
- **Verify:** 文档含 `internal/agent-runtime`、`agent-runtime.db`、`confirm-next` 三关键词

### Task 5: design-sync 入库 agent-runtime-control（F3）

- [x] 项目根执行 design-sync（或等价命令），使 `query_design(page=agent-runtime-control)` 可读
  - **Files:** （终端；可能更新 `.ai/design/pages/agent-runtime-control.json`）
  - **Verify:** `query_design` page=`agent-runtime-control` 不报错；`audit_design_changes` 的 `stale` 清空或 page 配方存在

### Task 6: 全量回归

- [x] `npm test -w core-engine` + `npm test -w agent-runtime` + 双 tsc
  - **Verify:** 全绿后 `/verify`

---

## Failure → Task 映射

| Failure | Task |
|---------|------|
| F1 | Task 1 |
| F2 | Task 2 |
| F3 | Task 5 |
| F4 | Task 3 |
| F5 | Task 4 |
