# C3 Agent Connect Implementation Plan

> **Spec:** `docs/superpowers/specs/2026-08-29-agent-connect-design.md`
> **Command:** `/plan-from-spec`
> **Status:** approved
> **projectType:** component

**Goal:** 接通 agent-runtime ↔ core-engine ↔ StepChat：智谱 LLM 回复本步对话，`check_wording` Tool 写 Proposal，不写 Receipt。

---

## Part 1 — 技术方案

### 1.1 架构

`POST /api/chat` → `appendChat`(user) → `StepChatBridge.reply()` → `ControlPlane.startRun("step-chat-v1")` → fn 节点：读上下文 → LLM → 可选 `check_wording` → `appendChat`(assistant) → JSON 响应。

`step-chat-v1` 图为 `start → handle(fn) → end`；fn 内使用 `getDefaultLlmProvider()` 与 `ToolRuntime`（已注册 `check_wording` / `get_job_context`）。

### 1.2 依赖

| 依赖 | 状态 |
|------|------|
| agent-runtime ControlPlane | 已有 |
| JobPipeline.checkWording | 已有 |
| ZhipuLlmProvider | 已有；配置 `.apt/agent-runtime.llm.json` |
| StepChat.vue | 已有；改响应解析 |

### 1.3 风险

- Vite dev `cwd` 可能是 `apps/web` → 桥接层需 `resolveRepoRoot()` 定位 `.apt/agent-runtime.llm.json`。
- CI 必须用 FakeLlm；单测设 `provider: fake` 或删配置。

---

## Part 2 — 可执行任务清单

### Task 1: core-engine 依赖 agent-runtime

- [ ] `packages/core-engine/package.json` 增加 `"agent-runtime": "0.1.0"`
- **Verify:** `npx tsc -p packages/core-engine --noEmit`

### Task 2: Agent 桥接模块

- [ ] `src/agent/repo-root.ts` — 向上查找含 `.apt/agent-runtime.llm.json` 的仓库根
- [ ] `src/agent/prompts.ts` — 各 step 系统提示（禁止 submit/confirm）
- [ ] `src/agent/context.ts` — `buildJobContext(pipeline, traceId)`
- [ ] `src/agent/tools.ts` — 注册 `check_wording`、`get_job_context`
- [ ] `src/agent/step-chat-graph.ts` — `step-chat-v1` 定义 + `createStepChatBridge(pipeline)`
- **Verify:** `npm test -w core-engine -- agent-connect`

### Task 3: HTTP 接线

- [ ] `session.ts` — `StepChatBridge` 实例；`health.llm` 探针
- [ ] `handle-request.ts` — chat 返回 `assistant_reply`、`agent_run_id`、`proposal_id?`
- **Verify:** `npm test -w core-engine -- http-adapter`

### Task 4: StepChat 前端

- [ ] `StepChat.vue` — 解析 `assistant_reply`；保留 step 引导首条消息
- **Verify:** `npx tsc -p apps/web --noEmit`

### Task 5: 手册与导出

- [ ] `docs/使用手册.md` — LLM 配置路径、对话边界
- [ ] `index.ts` 导出 `StepChatBridge`（可选）
- **Verify:** `npm test` 根脚本全绿
