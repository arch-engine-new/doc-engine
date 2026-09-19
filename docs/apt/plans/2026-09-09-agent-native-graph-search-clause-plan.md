# 用满原生图节点 + search_clause Implementation Plan

> **Spec:** `docs/superpowers/specs/2026-09-09-agent-native-graph-search-clause-design.md`
> **Command:** `/plan-from-spec`
> **Status:** approved
> **projectType:** component（§0.5 设计寻址跳过）

**Goal:** 把 `step-chat-v1` 改成原生 `fn`/`branch`/`llm`/`tool` 节点，并接通只读 `search_clause`；不换扣子/LangGraph，不写 Receipt。

**Architecture:** `prepare` 读 Job 上下文并判定检索/起草意图；`branch` 决定是否跑 `search_clause`；`LLMExecutor` 生成回复；再 `branch` 决定是否跑 `check_wording`；`assemble` 输出 `{ reply, proposalId }`。`search_clause` 复用已有 `createSearchClauseToolHandler(pipeline.library)`。

---

## Part 1 — 技术方案（APT 寻址）

### 1.1 范围与约束

**In scope：** ToolExecutor `inputFrom`、`JobContextSnapshot.pack_id`、`shouldSearchClause`、注册 `search_clause`、`step-chat-v1` 原生图、assemble 保持 `StepChatBridge.reply` 契约、单测与手册。

**Out of scope：** 扣子/Dify/n8n/LangGraph 重做、Temporal、独立 agent 进程、`job-step-v1` 改造、LlmProvider function-calling、新 UI 页、submit_*、Agent 写 Finding/Receipt。

**冻结：** 认知仅写 Proposal；9 页不变；CI FakeLlm；无命中禁止编造 `clause_id`。

### 1.2 设计寻址（无 UI 则写 N/A）

| 项 | MCP 结果 | 约束摘要 |
|----|----------|----------|
| §0.5 | N/A（`projectType: component`） | 条款写入 `assistant_reply` 纯文本；不改 StepChat 布局 |
| 9 页冻结 | goal.md | 无新路由 |

### 1.3 依赖寻址表

| 依赖 | 来源 | 引用（tsFilePath / sourcePath / path） | 摘要 |
|------|------|----------------------------------------|------|
| StepChatBridge | contract | `packages/core-engine/src/agent/step-chat-bridge.ts` | `buildStepChatGraphDefinition` 现为单 fn；`reply()` 读 `output.{reply,proposalId}` |
| ControlPlane | contract | `packages/agent-runtime/src/api/control.ts` | `startRun`/`waitForRun`/`getTrace`；已为 tool 节点打 `tool_call` |
| AgentRuntimeFactory | contract | `packages/core-engine/src/agent/agent-runtime-factory.ts` | `createStepChatRegistry` + `compileGraph(step-chat-v1)` |
| ToolRegistry | contract | `packages/agent-runtime/src/tools/registry.ts` | 禁 `submit_*`；`setDefaultRegistry` |
| ToolRuntime | contract | `packages/agent-runtime/src/tools/runtime.ts` | schema 校验、幂等、`onToolCall` |
| LlmProvider | contract | `packages/agent-runtime/src/llm/provider.ts` | 仅 `complete({prompt})`，无 tools |
| JobPipeline | contract | `packages/core-engine/src/pipeline/job-pipeline.ts` | `.library`、`searchStandard`、`checkWording` |
| StandardLibrary | contract | `packages/core-engine/src/retrieve/library.ts` | `searchStandard({packId,query,jobId?})` |
| createSearchClauseToolHandler | arch | `frontend/core-engine/util#createsearchclausetoolhandler` → `packages/core-engine/src/retrieve/library.ts` | 只读 handler，**未**挂到 Agent registry |
| LLMExecutor | arch | `frontend/agent-runtime/utils` `#node-executors` | `prompt` / `promptTemplate`；写 string channel |
| ToolExecutor | arch | 同上 | `toolName` + `inputChannels` 会包一层 channel 名；需 `inputFrom` |
| BranchExecutor | arch | 同上 | `config.condition` 函数 + 边 `condition` |
| buildJobContext | arch | `frontend/core-engine/util#buildjobcontext` | 快照缺 `pack_id` |
| shouldDraftWording | arch | `frontend/core-engine/util#shoulddraftwording` | `WORDING_STEPS` + 关键词 |
| JobStepOrchestrator | contract（本片不改） | `packages/core-engine/src/agent/job-step-orchestrator.ts` | 长图保持不动 |

### 1.4 拟改动模块与文件

| 文件/模块 | 变更类型 | 说明 |
|-----------|----------|------|
| `packages/agent-runtime/src/runtime/node-executors.ts` | 修改 | `ToolExecutor`：`config.inputFrom` 时用该 channel 对象作为 tool 入参 |
| `packages/agent-runtime/test/tool-runtime.test.ts` 或新测 | 修改/新建 | 覆盖 `inputFrom` |
| `packages/core-engine/src/agent/context.ts` | 修改 | `pack_id: string \| null` |
| `packages/core-engine/src/agent/prompts.ts` | 修改 | `shouldSearchClause`；系统提示禁止编造条款号 |
| `packages/core-engine/src/agent/tools.ts` | 修改 | 注册 `search_clause` |
| `packages/core-engine/src/agent/step-chat-bridge.ts` | 修改 | 原生图；assemble 兼容现 `reply()` |
| `packages/core-engine/test/agent-connect.test.ts` | 修改 | 回归 + 检索/无命中 |
| `docs/使用手册.md` | 修改 | 本步对话可查条款 |

**不改：** `job-step-orchestrator.ts`、`apps/web/src/components/StepChat.vue`（仍展示 `assistant_reply`）。

### 1.5 风险与未决项

1. **`ToolExecutor` 入参形状**：现实现把各 channel **名**当作 tool 字段；不改则 `search_clause` 收到 `{ search_args: {...} }` 校验失败。Task 1 必须先做。
2. **`LlmProvider` 无 tool-calling**：检索/起草由 `branch` + 关键词决定，不是模型自行选 Tool。若日后要 ReAct，需另开 spec。
3. **`query_project_status.typeHealth`**：声明 `component`、建议 `business`。本 plan 按声明类型跳过 §0.5；无新 UI。
4. **无 pack_id 的 Job**：必须 skip 检索，不能 throw 打断对话。
5. 未引入扣子/LangGraph；`package.json` 不得新增这类依赖。

### 1.6 需求锁定对照

| Rn | 优先级 | 覆盖 Task | 备注 |
|----|--------|-----------|------|
| R1 | must | Task 1, Task 4, Task 6 | 原生节点 + trace |
| R2 | must | Task 3, Task 4, Task 6 | 注册并走 tool 节点 |
| R3 | must | Task 2, Task 4, Task 6 | skip / 空命中 |
| R4 | must | Task 4, Task 6 | wording 改走 tool 节点 |
| R5 | must | Task 6 | A16 回归 |
| R6 | must | Task 7 | 依赖检查 |
| R7 | must | Task 6 | `forceFakeLlm` |

---

## Part 2 — 可执行任务清单

> 每步 2–5 分钟粒度；实现时由 **`/implement-plan`** **按 Task 派发子 Agent 串行执行**（主 Agent 编排，每 Task 全新上下文 + Task Review Gate）。子 Agent 每 Task 自动 `git commit`（无需在 plan 中写提交步骤）。

### Task 1: ToolExecutor `inputFrom`

- [ ] `query_arch` 确认 `ToolExecutor.execute` 当前用 `inputChannels` 拼 `{ [ch]: value }`
  - **MCP:** `query_arch` path=`frontend/agent-runtime/utils`
  - **Files:** `packages/agent-runtime/src/runtime/node-executors.ts`
- [ ] 增加 `config.inputFrom: string`：该 channel 的值若为 object 则直接作为 `runtime.execute` 的 input；未设置时保持旧行为
  - **Files:** `packages/agent-runtime/src/runtime/node-executors.ts`
- [ ] 单测：channel `{ packId, query }` + `inputFrom` → handler 收到扁平对象
  - **Verify:** `npm test -w agent-runtime -- tool-runtime`
  - **Contracts:** （可选）无新公开类型则跳过

### Task 2: 上下文 pack_id + 检索意图

- [ ] `query_arch` `buildJobContext`；从 `pipeline.getJobByTrace` 写入 `pack_id`
  - **MCP:** `query_arch` path=`frontend/core-engine/util#buildjobcontext`
  - **Files:** `packages/core-engine/src/agent/context.ts`
- [ ] 新增 `shouldSearchClause(step, userMessage, packId)`：无 pack → false；关键词 `/条款|规范|标准|查条|search_clause/` 或 step ∈ `{checking, check_findings, standard_lib}` 且有 pack → true
  - **MCP:** `query_arch` path=`frontend/core-engine/util#shoulddraftwording`
  - **Files:** `packages/core-engine/src/agent/prompts.ts`
- [ ] `stepSystemPrompt` 增加：只引用检索命中的 `clause_id`；未命中须明说，禁止编造
  - **Files:** `packages/core-engine/src/agent/prompts.ts`
  - **Verify:** `npx tsc -p packages/core-engine --noEmit`；`shouldSearchClause` 单测断言（可放进 Task 6 文件，本 Task 先导出函数）
  - **Verify 对照：** R3

### Task 3: 注册 `search_clause`

- [ ] `query_contract` `StandardLibrary`；复用 `createSearchClauseToolHandler`
  - **MCP:** `query_contract` name=`StandardLibrary`
  - **Files:** `packages/core-engine/src/agent/tools.ts`
- [ ] `registerStepChatTools` 增加 `search_clause`：input `{ packId, query, jobId? }`，output array/object；handler = `createSearchClauseToolHandler(pipeline.library)`；描述写明只读、不 attach Finding
  - **Files:** `packages/core-engine/src/agent/tools.ts`
- [ ] 确认不注册 `attachStandardFitFinding` / `submit_*`
  - **Verify:** `npm test -w agent-runtime -- submit-tool-ban`；`npm test -w core-engine -- agent-connect`
  - **Verify 对照：** R2、R6

### Task 4: 重构 `step-chat-v1` 原生图

- [ ] `query_contract` `StepChatBridge`；按 spec 图替换 `handle` 单 fn
  - **MCP:** `query_contract` name=`StepChatBridge`
  - **Files:** `packages/core-engine/src/agent/step-chat-bridge.ts`
- [ ] `prepare` fn：`buildJobContext` + `shouldSearchClause` / `shouldDraftWording`；写 channel `search_args` `{packId,query,jobId}`、`should_search`、`should_draft`、`prep`（含 prompt 素材）
  - **Files:** `packages/core-engine/src/agent/step-chat-bridge.ts`
- [ ] `branch` 检索：`search` → tool `search_clause`（`inputFrom: search_args`，`idempotencyKey: {{runId}}-search_clause`）→ `llm`；`skip` → `llm`
  - **Files:** `packages/core-engine/src/agent/step-chat-bridge.ts`
- [ ] `llm` 节点：`promptTemplate` 拼 system + 上下文 + 命中条款（无命中写「未检索到条款」）+ 用户消息
  - **MCP:** `query_arch` path=`frontend/agent-runtime/utils`
  - **Files:** `packages/core-engine/src/agent/step-chat-bridge.ts`
- [ ] `branch` 起草：`draft` → tool `check_wording`（`inputFrom` 含 jobId/wording/agentRunId）→ `assemble`；`skip` → `assemble`
- [ ] `assemble` fn：`output = { reply, proposalId? }`；有 proposal 时追加「请在待审页确认」；有命中时 reply 含真实 `clause_id`
  - **Files:** `packages/core-engine/src/agent/step-chat-bridge.ts`
  - **Verify:** `npx tsc -p packages/core-engine --noEmit`
  - **Verify 对照：** R1、R2、R4

### Task 5: 空命中与缺 pack 不打断对话

- [ ] `search_clause` 无 pack 不得进入 tool 节点（prepare 已 skip）；tool 返回 `[]` 时 llm/assemble 仍成功
  - **Files:** `packages/core-engine/src/agent/step-chat-bridge.ts`, `packages/core-engine/src/agent/tools.ts`
- [ ] 回复文本包含「未命中」或等价说明，且不出现虚构 `clause_id` 前缀模式（测里用固定 query）
  - **Files:** `packages/core-engine/src/agent/step-chat-bridge.ts`
  - **Verify:** 由 Task 6 用例 AC-no-invent 覆盖
  - **Verify 对照：** R3

### Task 6: 测试（FakeLlm）

- [ ] 扩展 `packages/core-engine/test/agent-connect.test.ts`（或新建 `agent-native-graph.test.ts`）：`forceFakeLlm: true`
  - **Files:** `packages/core-engine/test/agent-connect.test.ts`
- [ ] A15：普通提问仍返回 `[fake-llm` 与 `agentRunId`，无 `proposalId`（R5/R7）
- [ ] A16 / wording：`请生成提案措辞` 仍增 pending Proposal、Receipt 仍 0（R4/R5）
- [ ] 检索：ingest 标准后，`checking` + 「查一下规范条款」→ trace 含 `tool_call` 且 `toolName=search_clause`；reply 含命中 `clause_id`（R1/R2）
- [ ] 无命中：乱码 query → 不 throw、无新 Finding、reply 不含该次编造号（R3）
- [ ] 用 `plane.getTrace(runId)` 断言节点类型含 `llm`（R1）
  - **MCP:** `query_contract` name=`ControlPlane`
  - **Verify:** `npm test -w core-engine -- agent-connect`；`npm test -w agent-runtime`
  - **Verify 对照：** R1–R5、R7、A15-reg、A16-reg、AC-native-nodes、AC-search-tool、AC-no-invent、AC-wording-reg、AC-fake

### Task 7: 手册与依赖门禁

- [ ] `docs/使用手册.md`：本步对话可查条款；不能确认/submit；未命中不编号
  - **Files:** `docs/使用手册.md`
- [ ] 确认 `packages/core-engine/package.json` 与 `packages/agent-runtime/package.json` 无 coze/dify/langgraph/temporal 依赖
  - **Files:** `packages/core-engine/package.json`, `packages/agent-runtime/package.json`
  - **Verify:** `npm test -w core-engine -- agent-connect`；根 `npm test` 若过慢则至少两 workspace 全绿
  - **Verify 对照：** R6
