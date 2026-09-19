# Task 2 Brief — retrieve 对齐 + 标准库不绑无关 Job

review-tier: full
BASE_SHA: c01b4e2717a906c8e98f17245ec79d03fd871ca5
plan: docs/apt/plans/2026-09-17-b1-standard-lib-stepchat-fix-plan.md
report: .apt/orchestration/task-2-report.md
handoff-from-task-1: UnconfiguredLlmProvider 已落地；createLlmProvider(null) 中文未配置、不 echo。FakeLlmProvider 仍给 forceFakeLlm。未 commit。

## Goal

1. Vue 目前 `step=retrieve`，提示词/检索分支认 `standard_lib`，必须对齐。
2. 标准库对话不得绑定 `/api/jobs` 第一条无关 Job（fixture-reversed.json / findings）。
3. 问条款时只依据本次检索命中或明确未命中。

禁止改 `designs/v0/**`（F-1 / logic）。禁止 commit。禁止实现命中详情 UI。

## 步骤（TDD 先红后绿）

- [ ] 测试：`shouldSearchClause("retrieve", "你好", packId)` 与 `standard_lib` 同为 true；`stepSystemPrompt("retrieve")` 含标准库步文案（命中条款 / 未命中须说明）
- [ ] 测试：retrieve/standard_lib 对话准备的 contextText **不得**含 `fixture-reversed.json` 或无关 Job findings；**应**含本次 RetrieveHit（clause_id/unit_id/file_name）或明确未命中
- [ ] 测试：标准库路径不再依赖 listJobs()[0].trace_id
- [ ] Vue `loadPack` 删除对 `/api/jobs` 第一条的绑定；StepChat 仍可发送（可用当前 pack 的 packId + 可选 pack 级 trace；若需扩展 `/api/chat` 收 pack_id / hits 则在白名单内做）
- [ ] `buildJobContext` / `prepareStepChat`：retrieve|standard_lib 走 pack/检索上下文，无 Job 不 throw、不拼无关 findings
- [ ] 既有 agent-connect `forceFakeLlm` checking 用例保持绿（可仍 `[fake-llm`，那是显式 fake）

## MCP

- query_contract `shouldSearchClause`
- query_contract `RetrieveHit`
- search_arch `buildJobContext` → query_arch path
- search_arch `StandardLib` / `stepSystemPrompt`

禁止未经 MCP 读 `.ai/`。

## Files 白名单

- `packages/core-engine/src/agent/prompts.ts`
- `packages/core-engine/src/agent/context.ts`
- `packages/core-engine/src/agent/step-chat-bridge.ts`
- `packages/core-engine/src/http/handle-request.ts`
- `packages/core-engine/src/pipeline/job-pipeline.ts`
- `packages/core-engine/test/agent-connect.test.ts`
- `packages/core-engine/test/standard-lib-stepchat.test.ts`
- `apps/web/src/views/standard_lib/index.vue`
- `apps/web/src/components/StepChat.vue`

## Verify

```
npx vitest run packages/core-engine/test/agent-connect.test.ts packages/core-engine/test/standard-lib-stepchat.test.ts packages/core-engine/test/agent-native-graph.test.ts
```

（在仓库根或 core-engine 包内按现有 vitest 配置执行，确保能找到文件。）

另跑 `npx tsc -p packages/core-engine/tsconfig.json --noEmit`（若项目惯用）。

## Contracts

shouldSearchClause, RetrieveHit。JobContextSnapshot 若新增对外字段 → register_contract。

## 编码规范

`.apt/code-standards.md`。新增 export 注释说为什么。Vue 不硬编码新 hex；不新增视觉组件。

## 微闭环

refresh_asset 白名单已索引路径；新类型 register_contract。禁止 audit_arch_changes。

## 禁止

git commit；改 page.logic；改 Task 1 已完成的 provider.ts（除非测试被迫，不要碰）。

## Status

写满 `.apt/orchestration/task-2-report.md`。
