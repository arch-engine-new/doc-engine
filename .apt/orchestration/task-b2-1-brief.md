# Task 1 Brief — B-2 arch.config.json chat 回退

review-tier: full
BASE_SHA: c01b4e2717a906c8e98f17245ec79d03fd871ca5
plan: docs/apt/plans/2026-09-17-b2-arch-config-chat-fallback-plan.md
report: .apt/orchestration/task-1-report.md

注意：`.apt/orchestration/task-1-*.md` 会被覆盖为 **本切片 B-2**。B-1 报告已存在历史文件；本 Task 写同一路径（批次惯例每片重置账本）。若与 B-1 文件冲突，把 B-2 报告写到 `.apt/orchestration/task-b2-1-report.md` 并在 progress 引用。

为避免覆盖 B-1 证据，**本切片 report 用：**
- brief: `.apt/orchestration/task-b2-1-brief.md`（本文件请复制/以本内容为准）
- report: `.apt/orchestration/task-b2-1-report.md`

## Goal

缺 `.apt/agent-runtime.llm.json` 时，从 `.ai/arch/arch.config.json` 的 `chat`（baseUrl / apiKey 或 apiKeyEnv / model=glm-5.3-flash）构建 ZhipuLlmProvider。不得 FakeLlmProvider。不得把仓库密钥写入测试或源码。

## 步骤

- [ ] MCP query_contract LlmRuntimeConfig、FakeLlmProvider、search_arch loadLlmRuntimeConfig
- [ ] TDD 用**临时目录夹具**写 arch.config.json（假 key `test-key`），禁止读取或打印仓库真实 `.ai/arch/arch.config.json` 的 apiKey
- [ ] 实现 loadLlmRuntimeConfig：llm.json 有效优先；否则读 `<root>/.ai/arch/arch.config.json` 的 chat；apiKeyEnv 从 process.env 取
- [ ] 无两份配置 → UnconfiguredLlmProvider（保持 B-1）
- [ ] 不要 commit；不要改 Vue / core-engine（除非测试被迫）

## Files 白名单

- packages/agent-runtime/src/llm/config.ts
- packages/agent-runtime/src/llm/provider.ts
- packages/agent-runtime/test/arch-chat-fallback.test.ts
- packages/agent-runtime/test/unconfigured-llm.test.ts

## Verify

```
npx vitest run test/arch-chat-fallback.test.ts test/unconfigured-llm.test.ts test/zhipu-provider.test.ts
```
cwd: packages/agent-runtime。另 tsc --noEmit。

## 禁止

git commit；打印/提交真实 API key；改 designs/v0；回退 B-1 Unconfigured 在「两份配置都没有」时的行为。
