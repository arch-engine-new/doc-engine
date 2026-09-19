# Task 2 Review — retrieve 对齐 + 标准库不绑无关 Job

review-tier: full
Plan: `docs/apt/plans/2026-09-17-b1-standard-lib-stepchat-fix-plan.md` Task 2
Brief: `.apt/orchestration/task-2-brief.md` / `.apt/orchestration/task-2-review-brief.md`
Report: `.apt/orchestration/task-2-report.md`
HEAD: `c01b4e2717a906c8e98f17245ec79d03fd871ca5`（= BASE_SHA；未 commit）
Status (implementer): `DONE_WITH_CONCERNS`
Verify（主 Agent，审查方未重跑）: vitest 3 files / 10 passed；`tsc --noEmit` exit 0
projectType: component（跳过 B2 `test-cases.md`）

对照工作区 vs HEAD：白名单 8 个已跟踪文件 modified；`packages/core-engine/test/standard-lib-stepchat.test.ts` 与 `apps/web/src/components/StepChat.vue` 相对 git 为未跟踪。未改 `designs/v0/**` / `page.logic.md`（工作区另有 tickAll 脏文件，不在本 Task FilesChanged）。未改 Task 1 的 `provider.ts`。

### Spec Compliance
- ✅ Spec compliant

相对 plan Task 2 与 brief：**无 Missing / Extra（白名单外）/ Misunderstood**。

| 检查项 | 结果 | 证据 |
|--------|------|------|
| `shouldSearchClause("retrieve")` ≡ `standard_lib` | **YES** | `normalizeChatStep` 把 `retrieve` 映射为 `standard_lib`；`CLAUSE_STEPS.has(normalizeChatStep(step))`；单测与 `agent-connect.test.ts` 均断言二者同为 true |
| `stepSystemPrompt("retrieve")` 走标准库步文案 | **YES** | 与 `standard_lib` 全文相等；含「标准库」「命中条款」「未命中」；不再落「就本页结果提问。」 |
| 标准库对话不绑 `/api/jobs[0]` | **YES** | `loadPack` 改为 `pack:${packId}`；`packChatTraceId`；`appendChat` 在 retrieve/standard_lib 无 Job 不 throw；单测 `thread.trace_id` ≠ `listJobs()[0].trace_id` |
| context 无 `fixture-reversed.json` / 无关 findings | **YES** | `isRetrieveChatStep` 走 `retrieveSnapshot`，`formatJobContextForPrompt` 只输出 pack_id / step / retrieve_hits；即使用 fixture `trace_id` 调 retrieve 也不拼 finding 原文 |
| 有 hits 或明确未命中 | **YES** | 空 hits → `未命中`；有 hits → `clause_id` / `unit_id` / `file_name`；`POST /api/chat` 收 `pack_id` + `hits` |
| Vue `loadPack` 删除 jobs[0] 绑定；StepChat 仍可发 | **YES** | `canSend` = `traceId \|\| packId`；body 带 `trace_id` / `pack_id` / `hits`；`step="retrieve"` 仍发 |
| 既有 `forceFakeLlm` checking 用例仍绿 | **YES** | `agent-connect.test.ts` 仍 `forceFakeLlm: true` 且断言 `[fake-llm`；本片 `standard-lib-stepchat` 的 bridge.reply 同为显式 fake |
| 禁止 F-1 详情 UI、禁止改 page.logic | **YES** | 仍用既有 `RetrieveHitsTable`；未新增命中详情入口；FilesChanged 无 `designs/v0` |
| 白名单 | **YES** | 业务改动恰 brief 九路径 + report；未改 `session.ts` / `agent-runtime-factory.ts` / `provider.ts` |
| 新增 export 注释（为什么） | **YES** | 见 Strengths；公开方法注释抽检通过 |
| 新类型 `register_contract` | **YES** | MCP 已命中更新后的 `JobContextSnapshot`、`BuildJobContextOptions`、`StepChatInput`；`shouldSearchClause` / `RetrieveHit` 未重复登记 |
| component：不查 test-cases.md | **YES** | 未查 |

**Missing：** 无。brief 三条测试（retrieve≡standard_lib、context 不含 fixture/findings、不依赖 `listJobs()[0]`）均有对应用例。

**Extra（白名单外）：** 无。白名单内有两处顺手改动，不构成 spec Extra：`standard_lib/index.vue` 增加 PDF ingest 中文错误映射；`job-pipeline.ts` `openStandardLibrary` / memory `openLiveFromEnv` 传入 `PaddleOcr.fromEnv()`。后者与本 Task 目标无关，记 Minor。

**Misunderstood：** 无。未把 F-1 当成本片范围；显式 fake 测试仍允许 `[fake-llm`。

### Strengths
- TDD 路径清楚：RED 时 retrieve 不搜条款、系统提示走兜底、pack 线程 `job not found`；GREEN 用 `normalizeChatStep` + pack 级 snapshot，而不是把 retrieve 硬塞进 CLAUSE_STEPS 或继续绑 Job。
- 解绑完整：Vue `loadPack`、`packChatTraceId`、`appendChat`、`prepareStepChat`、`POST /api/chat` 同一套 `pack:` 线程；单测还覆盖「误传 fixture trace_id 仍不泄漏 findings」。
- 新公开面注释说为什么：`normalizeChatStep` / `isRetrieveChatStep`（Vue alias）、`packChatTraceId`（永不借 `listJobs()[0]`）、`formatRetrieveHitsForPrompt`（空列表即未命中）、`BuildJobContextOptions`、`prepareStepChat`、`JobContextSnapshot.retrieve_hits_summary`。
- 既有 checking 假模型路径未误伤；`insertThread` 本就接受 `job_id: null`。
- 未越权实现 F-1、未改产品 logic、未碰 Task 1 provider。

### Issues
#### Critical (Must Fix)
- 无。

#### Important (Should Fix)
- **默认 demo 用户对话仍可能 `[fake-llm`，B-1 验收标准 1 在 Vite 无 live env 时不成立。** 白名单外只读：`DemoHttpSession.getAgentRuntimeFactory` 在 `mode === "memory"` 时仍 `forceFakeLlm: true`；`AgentRuntimeFactory.bootstrap` 随之 `setDefaultLlmProvider(new FakeLlmProvider())`，覆盖 Task 1 的 `UnconfiguredLlmProvider`。`openFromEnv()` 在无三件套时为 memory。未配置 `.apt/agent-runtime.llm.json` 的默认 Vite 会话发送本步对话，助手仍会 echo HITL 系统提示，而不是中文「尚未配置」。本 Task 白名单不含 `session.ts` / `agent-runtime-factory.ts`，审查方不改代码；留给后续切片或最终 closeout。Task 2 自身规格（retrieve 对齐 + 不绑无关 Job）已满足。
- `refresh_asset` 把 core-engine 登记到 `frontend/core-engine/util/*`，`StandardLib` 文档为「扫描失败，待人工补充」。批次禁止 `audit_arch_changes` / 手工改 `.ai/`；不阻断本 Task 源码验收。

#### Minor (Nice to Have)
- `StepChat.vue` 日志 `v-for` 使用 `:key="i"`。文件相对 git 未跟踪，无法证明是否本次新引入；按 review-brief 记下。`log` 只追加、不重排，实际风险低。
- 白名单内顺手：`ingestError`（PDF 光栅失败文案）；memory `openLiveFromEnv` 开始挂 `PaddleOcr.fromEnv()`。与 retrieve/Job 解绑无关。
- Vue 仍 `v-if="chatReady"`（检索有命中才出 StepChat）。report 已披露；符合既有「命中后提问」，未做空 hits 的页面未命中对话。引擎层空 hits →「未命中」已覆盖。
- `formatJobContextForPrompt` 签名未变、无新增 why 注释；retrieve 分支行为已由 `buildJobContext` 注释覆盖。
- `retrieveSnapshot` 在确有 hits 时仍把 `findings_summary` 写成 `"未命中"`（占位）；retrieve 的 prompt 格式化不用该字段，测试看的是 `retrieve_hits`。
- 未在浏览器点过发送（implementer 披露）；HTTP `/api/chat` 的 pack_id/hits 无独立单测，由 Vue 组包 + `parseRetrieveHits` + bridge 单测间接覆盖。
- 新 helper `normalizeChatStep` / `packChatTraceId` 等未 `register_contract`；brief 只要求 Snapshot 新字段，已登记。

### Assessment
**Task quality:** Approved
**Reasoning:** retrieve 与 standard_lib 提示词/检索分支已对齐，pack 级线程不再借 `listJobs()[0]`，prompt 上下文是本次 RetrieveHit 或明确未命中；白名单、注释与契约登记合格，F-1 / page.logic 未越权。默认 memory demo 仍 `forceFakeLlm`，计划级验收标准 1 在无 live env 时可能失败，记 Important 且不改本片代码，不改本 Task 源码结论。
