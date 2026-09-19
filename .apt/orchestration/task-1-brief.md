# Task 1 Brief — 未配置 LLM 不回显系统提示

review-tier: full
BASE_SHA: c01b4e2717a906c8e98f17245ec79d03fd871ca5
plan: docs/apt/plans/2026-09-17-b1-standard-lib-stepchat-fix-plan.md
report: .apt/orchestration/task-1-report.md

## Goal

未配置 `.apt/agent-runtime.llm.json` 时，助手不以 `[fake-llm` 回显 HITL 系统提示，须中文说明未配置模型。

## 全自动

`/apt-goal --continue` 切片 B-1 PB-1。禁止 commit（批次执行体要求）。禁止改 `designs/v0/**`。禁止实现 F-1。

## 步骤

- [ ] TDD RED：缺配置时 `complete({ prompt: 含「禁止：确认提案」的系统提示 })` 返回中文未配置说明，不得包含 `[fake-llm`，不得回显系统提示原文
- [ ] 最小实现：`createLlmProvider(null)` / `initDefaultLlmProvider` 未配置路径与测试用 `FakeLlmProvider` 分离（推荐 UnconfiguredLlmProvider 或等价；FakeLlmProvider 可保留 echo 给 forceFakeLlm 单测）
- [ ] GREEN：Verify 命令全绿；gap-fix / scheduler 里显式 FakeLlmProvider 仍可 `[fake-llm`
- [ ] 新增/变更 export 写有效注释（为什么）
- [ ] 微闭环：对白名单内已索引 modified 调 MCP `refresh_asset`；新对外类型 `register_contract`；写 report

## MCP

- query_contract `FakeLlmProvider`
- query_contract `LlmRuntimeConfig`
- search_arch `FakeLlmProvider` → query_arch 命中 path

禁止未经 MCP 读 `.ai/`。

## Files 白名单

- `packages/agent-runtime/src/llm/provider.ts`
- `packages/agent-runtime/src/llm/config.ts`
- `packages/agent-runtime/test/unconfigured-llm.test.ts`
- `packages/agent-runtime/test/zhipu-provider.test.ts`
- `packages/agent-runtime/src/index.ts`

## Verify

```
npx vitest run --config packages/agent-runtime/vitest.config.ts packages/agent-runtime/test/unconfigured-llm.test.ts packages/agent-runtime/test/zhipu-provider.test.ts packages/agent-runtime/test/gap-fix.test.ts packages/agent-runtime/test/scheduler.test.ts
```

若 agent-runtime 无独立 vitest.config，改用该包 package.json 的 test 脚本，但必须包含上述测试文件。

## Contracts

FakeLlmProvider, LlmProvider, LlmRuntimeConfig。新增导出类型才 register_contract。

## 编码规范

见 `.apt/code-standards.md`：camelCase / 函数注释说为什么 / 禁止无意义注释。

## 微闭环（禁止 audit_arch_changes）

1. 新对外类型 → register_contract
2. 白名单 modified/new 已索引路径 → refresh_asset(sourcePath)
3. report 写 ContractsRegistered / AssetsRefreshed / AssetsRemoved

## 禁止

- git commit / git push / force push
- 改白名单外文件
- 改 Vue / core-engine（Task 2）
- 改 page.logic.md

## Status

回报 `DONE` | `DONE_WITH_CONCERNS` | `BLOCKED` | `NEEDS_CONTEXT`，写满 report。
