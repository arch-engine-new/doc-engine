# Task 3 Brief — memory demo 未配置不走 FakeLlm 回显

review-tier: full
BASE_SHA: c01b4e2717a906c8e98f17245ec79d03fd871ca5
plan: docs/apt/plans/2026-09-17-b1-standard-lib-stepchat-fix-plan.md
report: .apt/orchestration/task-3-report.md

## 为何有本 Task

Task 2 reviewer Important：`DemoHttpSession.getAgentRuntimeFactory` 在 `mode==="memory"` 时 `forceFakeLlm: true`，默认 Vite demo（无 live env）用户对话仍 `[fake-llm` 回显系统提示。B-1 验收标准 1 要求未配置 `.apt/agent-runtime.llm.json` 时不得如此。

Handoff：Task 1 UnconfiguredLlmProvider；Task 2 pack 级 retrieve 上下文。不要回退那两处。

## 步骤

- [ ] RED：HTTP/session 在 memory 模式、无有效 llm.json 时，POST /api/chat（retrieve 或任意步）assistant_reply 不得含 `[fake-llm`，须含中文未配置（/未配置/）
- [ ] 实现：Vite/memory **用户路径**不要把 FakeLlmProvider 设为默认。测试仍可用 `StepChatBridge.create({ forceFakeLlm: true })` / 显式 FakeLlmProvider
- [ ] GREEN：新测绿；既有 http-adapter / agent-connect / agent-native-graph / job-step-orchestrator 仍绿
- [ ] 微闭环 refresh_asset

建议：`getAgentRuntimeFactory` 对 memory 用户会话走 `initDefaultLlmProvider`（缺配置 → UnconfiguredLlmProvider）。`forceFakeLlm` 仅测试显式传入。注意 http-adapter 用 `new DemoHttpSession()`（memory）——改完后 /api/chat 应变未配置文案，不要再 echo。

## MCP

- query_contract FakeLlmProvider
- search_arch AgentRuntimeFactory / DemoHttpSession / HitlGateway

## Files 白名单

- `packages/core-engine/src/http/session.ts`
- `packages/core-engine/src/agent/agent-runtime-factory.ts`
- `packages/core-engine/test/http-adapter.test.ts`
- `packages/core-engine/test/standard-lib-stepchat.test.ts`

## Verify

```
npx vitest run test/http-adapter.test.ts test/standard-lib-stepchat.test.ts test/agent-connect.test.ts test/agent-native-graph.test.ts test/job-step-orchestrator.test.ts
```
cwd: packages/core-engine。另 tsc --noEmit。

## 禁止

git commit；改 designs/v0；改 Task 1/2 已完成的 prompt 对齐逻辑（除非测试被迫）。

## Status

写满 `.apt/orchestration/task-3-report.md`。
