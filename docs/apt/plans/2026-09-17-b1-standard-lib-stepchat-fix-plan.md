---
status: approved
feature: B-1 standard_lib step-chat
slice: B-1
---

# B-1 标准库本步对话修复

> 全自动自答，未经用户确认（`/apt-goal --continue` programMode 夜间切片）。

**Goal：** 修好标准库本步对话：未配模型不回显系统提示，且上下文是本次检索而非无关 Job。不实现 F-1 检索详情，不改 `designs/v0/standard_lib` 产品 logic。

**验收标准：**

1. 未配置 `.apt/agent-runtime.llm.json` 时，助手回复不得以 `[fake-llm` 开头回显 HITL 系统提示，须中文说明未配置模型。
2. 标准库对话不得展示无关 Job 的 `fixture-reversed.json` / findings；问条款时只依据本次检索命中或明确未命中。
3. 按 queue.md B-1 复现步骤执行达期望态（先红后绿测试覆盖上述两点）。

**漂移注记：** `query_project_status` 返回 `nextAction=accept`（残留 accept 相位）。程序模式以 `playbook-state.json` 切片为准，本批未带 `--accept`，不跑 ACCEPT-BATCH。

## 范围

- 做：未配置 LLM 的用户可见回复；标准库 StepChat 不绑 `/api/jobs` 第一条 Job；`step=retrieve` 与 `standard_lib` 提示词/检索分支对齐；prompt 上下文带本次 RetrieveHit 而非无关 Job findings。
- 不做：F-1 命中详情；改 `page.logic.md` / refine；真实模型联调。

## 设计寻址

- global tokens：apt-skyline-clean / Vue bindings；StepChatPanel = `aside.step-chat`。
- page `standard_lib`：logic 已有 `openStepChat`（检索命中后就条款提问）。gaps=`no-implementation-ref`（项目全局缺 page.tsx，Vue 已有实现）。本任务是既有绑定 bug，不新增视觉组件，不改 logic。
- component `StepChatPanel`：本步 HITL，不写账本。

## 依赖寻址

| 依赖 | 来源 | sourcePath |
|------|------|------------|
| FakeLlmProvider / LlmProvider / createLlmProvider | contract | `packages/agent-runtime/src/llm/provider.ts` |
| LlmRuntimeConfig | contract | `packages/agent-runtime/src/llm/config.ts` |
| shouldSearchClause / stepSystemPrompt | contract + arch | `packages/core-engine/src/agent/prompts.ts` |
| RetrieveHit | contract | `packages/core-engine/src/retrieve/ports.ts` |
| buildJobContext / formatJobContextForPrompt | search_arch → query_arch | `packages/core-engine/src/agent/context.ts` |
| StepChatBridge / prepareStepChat | search_arch | `packages/core-engine/src/agent/step-chat-bridge.ts` |
| StandardLib loadPack | search_arch | `apps/web/src/views/standard_lib/index.vue` |
| StepChat | search_arch | `apps/web/src/components/StepChat.vue` |
| POST /api/chat | arch via handle-request | `packages/core-engine/src/http/handle-request.ts` |

未单独登记的 `Job` / `JobContextSnapshot` / `stepSystemPrompt` 名称：已由同文件契约或 arch 覆盖，不 `report_missing`。

## 风险

- 显式 `forceFakeLlm` / `FakeLlmProvider` 单测仍依赖 `[fake-llm` 回显；须把「测试替身」与「未配置用户路径」分开，避免误伤 scheduler/gap-fix。
- `buildJobContext` 目前无 Job 即 throw；标准库解绑 jobs[0] 后必须有 pack 级上下文路径。
- armed：禁止改 `designs/v0/standard_lib`。

## Part 2 Tasks

### Task 1 — 未配置 LLM 不回显系统提示

- [ ] 先写失败测试：`createLlmProvider(null)` / 缺 llm.json 时 `complete` 返回中文未配置说明，且不得包含 `[fake-llm` 或 HITL 系统提示原文（如「禁止：确认提案」）
- [ ] 最小实现：未配置路径与测试用 FakeLlmProvider 分离（或等价开关）
- [ ] 显式 `new FakeLlmProvider()` / `forceFakeLlm` 既有测试保持可运行
- [ ] 微闭环 refresh 改动资产

**MCP：** query_contract `FakeLlmProvider` `LlmRuntimeConfig`；search_arch `FakeLlmProvider`
**Files：**
- `packages/agent-runtime/src/llm/provider.ts`
- `packages/agent-runtime/src/llm/config.ts`（仅当必须区分 unconfigured）
- `packages/agent-runtime/test/unconfigured-llm.test.ts`
- `packages/agent-runtime/test/zhipu-provider.test.ts`（仅当断言冲突）
- `packages/agent-runtime/src/index.ts`（仅当需导出新类型）
**Verify：** `npx vitest run --config packages/agent-runtime/vitest.config.ts packages/agent-runtime/test/unconfigured-llm.test.ts packages/agent-runtime/test/zhipu-provider.test.ts packages/agent-runtime/test/gap-fix.test.ts packages/agent-runtime/test/scheduler.test.ts`
**Contracts：** FakeLlmProvider, LlmProvider, LlmRuntimeConfig（已有则不重复登记；新增导出类型才 register_contract）

### Task 2 — retrieve 对齐 + 标准库不绑无关 Job

- [ ] 先写失败测试：`shouldSearchClause("retrieve", …)` 与 `standard_lib` 同分支；`stepSystemPrompt("retrieve")` 走标准库步文案
- [ ] 先写失败测试：标准库/retrieve 对话上下文不含 `fixture-reversed.json` 与无关 findings；含本次 RetrieveHit 或明确未命中
- [ ] Vue `loadPack` 不再取 `/api/jobs` 第一条 `trace_id`；对话仍可发送（pack 级 trace/packId，由实现选定，须可测）
- [ ] `buildJobContext` / `prepareStepChat` / 如需 `/api/chat`：retrieve/standard_lib 不拼无关 Job；可带检索命中
- [ ] 微闭环 refresh 改动资产

**MCP：** query_contract `shouldSearchClause` `RetrieveHit`；query_arch `frontend/core-engine/util#buildjobcontext`；search_arch `StandardLib`
**Files：**
- `packages/core-engine/src/agent/prompts.ts`
- `packages/core-engine/src/agent/context.ts`
- `packages/core-engine/src/agent/step-chat-bridge.ts`
- `packages/core-engine/src/http/handle-request.ts`
- `packages/core-engine/src/pipeline/job-pipeline.ts`
- `packages/core-engine/test/agent-connect.test.ts`
- `packages/core-engine/test/standard-lib-stepchat.test.ts`
- `apps/web/src/views/standard_lib/index.vue`
- `apps/web/src/components/StepChat.vue`
**Verify：** `npx vitest run packages/core-engine/test/agent-connect.test.ts packages/core-engine/test/standard-lib-stepchat.test.ts packages/core-engine/test/agent-native-graph.test.ts`
**Contracts：** shouldSearchClause, RetrieveHit, JobContextSnapshot（若新增对外字段则 register_contract）

### Task 3 — memory demo 未配置不走 FakeLlm 回显

- [ ] RED：memory 会话无 llm.json 时 POST /api/chat 不得含 `[fake-llm`
- [ ] Vite/memory 用户路径走 UnconfiguredLlmProvider（initDefaultLlmProvider）；forceFakeLlm 仅测试显式传入
- [ ] 既有 http-adapter / agent-connect / native-graph / orchestrator 仍绿

**MCP：** query_contract FakeLlmProvider；search_arch AgentRuntimeFactory
**Files：**
- `packages/core-engine/src/http/session.ts`
- `packages/core-engine/src/agent/agent-runtime-factory.ts`
- `packages/core-engine/test/http-adapter.test.ts`
- `packages/core-engine/test/standard-lib-stepchat.test.ts`
**Verify：** `npx vitest run test/http-adapter.test.ts test/standard-lib-stepchat.test.ts test/agent-connect.test.ts test/agent-native-graph.test.ts test/job-step-orchestrator.test.ts`（cwd packages/core-engine）
**Contracts：** 无新契约则不登记
