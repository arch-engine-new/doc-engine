---
title: C3 Agent Native Graph + search_clause
date: 2026-09-09
status: approved
risk: medium
phase: approved
topic: agent-native-graph-search-clause
parentSpec: docs/superpowers/specs/2026-08-29-agent-connect-design.md
approvedAt: 2026-09-09T15:34:00.000Z
approvedBy: user
---

# Design Spec: 用满原生图节点 + 只读 `search_clause`

## Goal

在 **不推倒** `packages/agent-runtime`、不引入扣子 / Dify / LangGraph / Temporal 的前提下，把 `step-chat-v1` 从「单 `fn` 内调 LLM」改成 **原生 `fn` / `branch` / `llm` / `tool` 节点**，并接通已有只读检索 `createSearchClauseToolHandler`，使本步对话可引用标准条款，且仍只写 pending `Proposal`。

## 范围（In Scope）

1. **`step-chat-v1` 图重构**：`start → prepare(fn) → branch(search) → tool(search_clause)? → llm → branch(draft) → tool(check_wording)? → assemble(fn) → end`。
2. **Tool 白名单扩展**：注册 `search_clause`（`pipeline.library.searchStandard`），禁 `submit_*`、禁 `attachStandardFitFinding`。
3. **意图闸门**：`shouldSearchClause`（关键词或检查类 step + 有 `pack_id`）；无 pack / 无命中则跳过检索，LLM 仍回复，**禁止编造 `clause_id`**。
4. **上下文**：`JobContextSnapshot` 增加 `pack_id`，供检索入参。
5. **`ToolExecutor` 入参**：支持把单一 channel 的对象直接作为 tool input（避免 `{ search_args: {...} }` 对不上 `SearchStandardInput`）。
6. **回归**：A15 / A16 / 关键词 `check_wording`；CI 强制 FakeLlm。

## 非目标（Out of Scope）

- 用扣子 / Dify / n8n / LangGraph **重做**认知层或 Job 主循环。
- Temporal / 独立 agent-runtime 进程。
- 改造 `job-step-v1`（仍为 prepare → HITL → confirmNext）。
- `LlmProvider` 原生 function-calling / ReAct 循环（本期仍是 **关键词 + branch**，因 `complete({prompt})` 无 tool 协议）。
- 新 UI 页、改 9 页导航、StepChat 富文本引用组件（条款写入 `assistant_reply` 纯文本即可）。
- Agent 写 Receipt、改 `Job.status`、取消 blocking、直连 MinIO/OCR。

## 约束（冻结）

| 约束 | 说明 |
|------|------|
| 内核 | 复用自研 `agent-runtime`，禁止换平台 |
| 认知写库 | 仅 `check_wording` → `t_proposal` pending |
| Tool 白名单 | `get_job_context`、`check_wording`、`search_clause`；禁 `submit_*` |
| `search_clause` | 只读 `searchStandard`；不 `attachHit`、不发明 `clause_id` |
| 对话边界 | `appendChat` 不得改 Job.status / 不写 Receipt |
| LLM | `.apt/agent-runtime.llm.json`；无配置 FakeLlm |
| 9 页冻结 | 不新增产品页 |

## 验收标准

| ID | 标准 | 可判定方式 |
|----|------|------------|
| AC-native-nodes | 一次 `step-chat-v1` run 的 trace 含 `node_start`，且节点类型覆盖 `fn`、`llm`；触发检索/起草时另有 `tool` | `getTrace(runId)` |
| AC-search-tool | 用户在 `checking` 且消息含「条款/规范/标准/查条」且 job 有 `pack_id` → 调用 `search_clause` | 单测 + `tool_call` 事件 |
| AC-no-invent | 无命中或无 pack 时回复不含伪造条款号；不写 Finding | 单测 ingest 空包 / 无命中 query |
| AC-wording-reg | 关键词「生成提案」仍产生 pending Proposal，无 Receipt | 现有 `agent-connect.test.ts` |
| A15-reg | `POST /api/chat` 返回非空 `assistant_reply` + `agent_run_id` | 现有/回归测 |
| A16-reg | 对话不能 confirm/submit/改 Job.status | 现有测 |
| AC-fake | 单测 `forceFakeLlm`，不触网 | CI |
| AC-no-submit | 注册 `submit_*` 仍抛错 | 现有 registry 测 |

## 依赖寻址（规划期）

| 依赖 | 路径 |
|------|------|
| ControlPlane | `packages/agent-runtime/src/api/control.ts` |
| LLMExecutor / ToolExecutor / BranchExecutor | `packages/agent-runtime/src/runtime/node-executors.ts` |
| LlmProvider | `packages/agent-runtime/src/llm/provider.ts`（仅 `complete`） |
| ToolRegistry / ToolRuntime | `packages/agent-runtime/src/tools/registry.ts` / `runtime.ts` |
| StepChatBridge | `packages/core-engine/src/agent/step-chat-bridge.ts` |
| AgentRuntimeFactory | `packages/core-engine/src/agent/agent-runtime-factory.ts` |
| createSearchClauseToolHandler | `packages/core-engine/src/retrieve/library.ts` |
| StandardLibrary.searchStandard | 同上；`JobPipeline.library` |
| shouldDraftWording | `packages/core-engine/src/agent/prompts.ts` |

## 拟改动文件

| 文件 | 变更 |
|------|------|
| `packages/agent-runtime/src/runtime/node-executors.ts` | Tool 节点 `inputFrom`：channel 值即 tool 入参对象 |
| `packages/core-engine/src/agent/context.ts` | `pack_id` |
| `packages/core-engine/src/agent/prompts.ts` | `shouldSearchClause`；prompt 禁止编造条款 |
| `packages/core-engine/src/agent/tools.ts` | 注册 `search_clause` |
| `packages/core-engine/src/agent/step-chat-bridge.ts` | 原生图 + assemble 输出 `{ reply, proposalId }` |
| `packages/core-engine/test/agent-connect.test.ts`（或新测） | 原生节点 + 检索 + 回归 |
| `docs/使用手册.md` | 本步对话可查条款、仍不能确认 |

## 方案对比

| Option | 描述 | 结论 |
|-------|------|------|
| A 扣子/Dify 重做 | 第二套编排脑，HITL/账本对不齐 | **否决**（用户确认） |
| B 单 fn 继续包 LLM | 实现快，图内核空转 | 否决 |
| **C 原生节点 + 关键词 branch** | 用满现有 executor；检索只读 | **采用** |
| D 等 LlmProvider 支持 tools 再 ReAct | 质量更好但要改智谱协议 | 延期 |

## 需求锁定表

| ID | 需求描述 | 来源 | 验收标准 | 优先级 |
|----|----------|------|----------|--------|
| R1 | `step-chat-v1` 使用原生 `llm`/`tool`/`branch` 节点，不再单 fn 包办 | 用户确认建议 | AC-native-nodes | must |
| R2 | 注册只读 `search_clause` | 用户确认建议；orchestration 原 nice 项 | AC-search-tool | must |
| R3 | 无 pack / 无命中不编造条款 | 冻结 RAG 口径 | AC-no-invent | must |
| R4 | 关键词起草仍走 `check_wording` 工具节点 | 一期回归 | AC-wording-reg | must |
| R5 | 对话不写 Receipt、不改 Job.status | A16 | A16-reg | must |
| R6 | 不引入扣子/LangGraph/Temporal | 用户确认建议 | 代码与依赖检查 | must |
| R7 | FakeLlm 单测 | CI | AC-fake | must |

## 追问记录

**收敛方式**：上一轮对话用户确认「依你的建议，走 plan-from-spec」，本 spec 即该建议的冻结稿。

| 镜头 | 结论 |
|------|------|
| 主路径 | 本步对话可引用标准条款；起草仍 pending |
| 破坏 | 若 LLM 自行编条款号 → 产品口径破 → **must** 无命中明确说未命中 |
| 可行 | `LLMExecutor`/`ToolExecutor`/`createSearchClauseToolHandler` 均已存在，缺的是接线 |
| 不做 | 换平台、ReAct、job-step 长图改造 |
