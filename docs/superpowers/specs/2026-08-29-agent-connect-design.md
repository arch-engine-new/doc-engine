---
title: C3 Agent Connect — 认知层接入本步对话
date: 2026-08-29
status: approved
risk: medium
phase: approved
topic: agent-connect
approvedAt: 2026-08-29T01:21:00.000Z
approvedBy: user
---

# Design Spec: C3 Agent Connect（agent-runtime ↔ core-engine ↔ StepChat）

## Goal

接通 `.apt/goal.md` **C3 两层运行时**中尚未落地的部分：在 **不推倒** 现有 `JobPipeline` 确定性流水线的前提下，把 `packages/agent-runtime` 嵌入 `core-engine` HTTP 会话，使 **本步对话（StepChat）** 经智谱 LLM 生成回复，并在允许步骤通过 **`check_wording` Tool** 写入 `Proposal`（仍不写 Receipt）。

## 范围（In Scope）

1. **LLM 配置**：读取 `.apt/agent-runtime.llm.json`（已 gitignore）；无配置时回退 `FakeLlmProvider`（CI/单测不触网）。
2. **Agent 桥接层**（`packages/core-engine/src/agent/*`）：
   - 进程内 `ControlPlane` + `step-chat-v1` 图（`fn` 节点编排上下文 → LLM → 可选 Tool）。
   - 注册 Tool：`check_wording`（回调 `JobPipeline.checkWording`）、`get_job_context`（只读 Job/Findings/Extraction 摘要）。
3. **HTTP**：`POST /api/chat` 在落库用户消息后调用桥接层，落库助手回复，响应含 `assistant_reply`、`agent_run_id`；若触发 `check_wording` 则含 `proposal_id`。
4. **前端**：`StepChat.vue` 展示 API 返回的 `assistant_reply`，移除写死 `HITL_REPLY`。
5. **Health**：`GET /api/health` 增加 `llm` 探针（`ok` = 配置有效；`skip` = Fake；`fail` = 配置存在但探针失败）。
6. **测试**：`agent-connect.test.ts` + 更新 `http-adapter.test.ts`；单测强制 FakeLlm，禁止 CI 打智谱。

## 非目标（Out of Scope）

- 新开 `agent-runtime-control` Vue 页或独立 HTTP 服务端口。
- Agent 直连 MinIO / OCR / 业务库；`submit_*` Tool。
- 对话内 `confirmProposal`、推进 `Job.status`、`confirm-next`、取消 blocking finding。
- 每步自动 `startRun` 长生命周期图（本片按 **每条消息** 短图 run）。
- 智谱 Embedding / 标准库向量替换（检索仍走现有 `StandardLibrary`）。
- 改造 `audit_design_changes` MCP。

## 约束（冻结）

| 约束 | 说明 |
|------|------|
| 认知写库 | 仅 `check_wording` → `t_proposal` pending |
| Receipt | 仅人点 `confirmProposal` |
| Tool 白名单 | `check_wording`、`get_job_context`；禁 `submit_*` |
| 对话边界 | `appendChat` 不得改 Job.status / 不写 Receipt |
| 允许起草措辞的 step | `checking`、`pending`、`pending_review`、`check_findings` |
| 触发起草 | 用户消息含「起草」「生成提案」「措辞」等关键词时尝试 `check_wording` |

## 验收标准

| ID | 标准 |
|----|------|
| A15 | `POST /api/chat` 返回非空 `assistant_reply`；用户消息与助手消息均落库 |
| A16 | 对话不能 confirm/submit/改 Job.status；blocking 不因对话取消 |
| A6-reg | `pending_review` 步用户说「生成提案」→ 产生 pending Proposal；对话本身不写 Receipt |
| AC-bridge | `step-chat-v1` 经 `ControlPlane.startRun` 完成，`agent_run_id` 可审计 |
| AC-fake | 无 llm.json 时 FakeLlm 回复，`health.llm=skip` |
| AC-live | 有 llm.json 时 `health.llm=ok`（开发机） |
| 回归 | `npm test -w core-engine` 与 `npm test -w agent-runtime` 全绿 |

## 依赖寻址

| 依赖 | 路径 |
|------|------|
| ControlPlane / runGraph | `packages/agent-runtime` |
| ZhipuLlmProvider | `packages/agent-runtime/src/llm/zhipu-provider.ts` |
| JobPipeline.checkWording | `packages/core-engine/src/pipeline/review.ts` |
| appendChat | `packages/core-engine/src/pipeline/job-pipeline.ts` |
| StepChat | `apps/web/src/components/StepChat.vue` |
| ToolRegistry submit_ ban | `packages/agent-runtime/src/tools/registry.ts` |

## 拟改动文件

| 文件 | 变更 |
|------|------|
| `packages/core-engine/package.json` | 依赖 `agent-runtime` |
| `packages/core-engine/src/agent/*` | 新：桥接、tools、图、prompts |
| `packages/core-engine/src/http/session.ts` | 持有 `StepChatBridge` |
| `packages/core-engine/src/http/handle-request.ts` | chat 响应扩展 |
| `apps/web/src/components/StepChat.vue` | 用 `assistant_reply` |
| `packages/core-engine/test/agent-connect.test.ts` | 新 |
| `docs/使用手册.md` | LLM 配置与对话说明 |
