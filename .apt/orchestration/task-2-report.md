## Task 2 Report
**Status:** DONE_WITH_CONCERNS
### Tests
- Command: `npx vitest run test/agent-connect.test.ts test/standard-lib-stepchat.test.ts test/agent-native-graph.test.ts`（cwd: `packages/core-engine`）。另跑 `npx tsc -p packages/core-engine/tsconfig.json --noEmit`（exit 0）。
- Result: 3 files / 10 tests passed；tsc 无错误。
- TDD RED/GREEN: RED 时 `shouldSearchClause("retrieve","你好","pack-1")` 为 false（与 standard_lib 不一致）；`stepSystemPrompt("retrieve")` 走「就本页结果提问。」；`buildJobContext(..., "retrieve")` / `appendChat(pack:…)` throw `job not found`。GREEN：retrieve 与 standard_lib 同为 true 且系统提示相同（含「标准库」「命中条款」「未命中」）；pack 上下文无 `fixture-reversed.json` / finding 原文，空 hits 为「未命中」，有 hits 含 clause_id/unit_id/file_name；`appendChat` + `StepChatBridge.reply` 用 `pack:${packId}`，不取 `listJobs()[0]`。`forceFakeLlm` checking 用例仍含 `[fake-llm`。
### APT Micro-closeout
- ContractsRegistered: `JobContextSnapshot`、`BuildJobContextOptions`（`packages/core-engine/src/agent/context.ts`）；`StepChatInput`（`packages/core-engine/src/agent/step-chat-bridge.ts`）。`shouldSearchClause` / `RetrieveHit` 已有，未重复登记。
- AssetsRefreshed: `prompts.ts`（shouldSearchClause / stepSystemPrompt / isRetrieveChatStep / normalizeChatStep）；`context.ts`（buildJobContext / formatJobContextForPrompt / packChatTraceId / formatRetrieveHitsForPrompt）；`step-chat-bridge.ts`（StepChatBridge / prepareStepChat）；`handle-request.ts`（handleDemoRequest）；`job-pipeline.ts`（JobPipeline）；`apps/web/src/views/standard_lib/index.vue`（StandardLib）；`apps/web/src/components/StepChat.vue`（StepChat）。prepareStepChat / normalizeChatStep 首次 refresh 因 `.ai` 文件锁失败后已重试成功。
- AssetsRemoved: none
### FilesChanged
- `packages/core-engine/src/agent/prompts.ts`
- `packages/core-engine/src/agent/context.ts`
- `packages/core-engine/src/agent/step-chat-bridge.ts`
- `packages/core-engine/src/http/handle-request.ts`
- `packages/core-engine/src/pipeline/job-pipeline.ts`
- `packages/core-engine/test/agent-connect.test.ts`
- `packages/core-engine/test/standard-lib-stepchat.test.ts`
- `apps/web/src/views/standard_lib/index.vue`
- `apps/web/src/components/StepChat.vue`
- `.apt/orchestration/task-2-report.md`
### Commits
- none (batch forbids commit)
### Blockers / Concerns
- `refresh_asset` 多数登记为 `frontend/core-engine/util/*` / `frontend/web/component/*` 的 created；禁止 `audit_arch_changes`，未手工改 `.ai/`。
- `query_contract JobContextSnapshot` 实现前未命中；brief 写明不 `report_missing`，完成后才 register。
- 标准库页未在浏览器点过发送（无本任务浏览器工具）；行为由 vitest 覆盖。Vue 仍 `v-if="chatReady"`（检索有命中才出 StepChat），未做 F-1 命中详情 UI。
- 未改 agent-runtime provider。
