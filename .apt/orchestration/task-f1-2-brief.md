# Task 2 Brief — F-1 本步对话引用正文

review-tier: full
BASE_SHA: 45a2a731ad99e0cf8421b2f512cff42e972c8127
plan: docs/apt/plans/2026-09-19-standard-lib-hit-detail-plan.md
report: .apt/orchestration/task-f1-2-report.md
spec: docs/superpowers/specs/2026-09-19-standard-lib-hit-detail-design.md

## Goal

本步对话能引用命中正文：`formatRetrieveHitsForPrompt` 含 heading + body 片段（单条 body 最多 800 字符，超出加 `…`）；`parseRetrieveHits` 往返保留 heading/body；空列表仍「未命中」。禁止改 StepChat.vue。

## 上一 Task handoff

Task 1 `45a2a73`：`RetrieveHit` 已有可选 heading/body；`toHit`/`toUnitHit` 已水合。refresh_asset 路径错挂留给 PB-5。

## Part 1 摘要

Vue 把 hits POST 到 `/api/chat`；若 parse 丢掉 heading/body，对话仍只能报 clause_id。必须透传并写入 prompt。

## 步骤（TDD 先红后绿）

- [ ] 只读 MCP：`query_contract` name=`JobContextSnapshot`；`query_arch` path=`frontend/core-engine/util#formatretrievehitsforprompt`；`query_contract` name=`DemoHttpAdapter`。禁止未经 MCP 读 `.ai/`。
- [ ] **先写失败测试**（尽量先改测试文件）：`packages/core-engine/test/standard-lib-stepchat.test.ts`
  - 给 SAMPLE_HIT（或等价）设 heading/body，`formatRetrieveHitsForPrompt([hit])` 含 heading 与 body 片段，且不只是 `clause_id=`
  - 空数组返回「未命中」
  - 超长 body（>800）格式化结果含 `…` 且该条明显短于原文
  - 通过 `handleDemoRequest` POST `/api/chat`（或直接测 parse 若已导出；未导出则走 HTTP 往返）证明 heading/body 进入上下文——可用 FakeLlm 看到 prompt 或断言 `buildJobContext`/`formatJobContextForPrompt` 含正文
  - 先跑 Verify：**必须 RED**。写入 report
- [ ] **最小实现**
  - `formatRetrieveHitsForPrompt`：每行含 heading 与截断 body；空 heading 写「无标题」；空 body 写「无正文」；单条 body 最多 800 字符
  - `parseRetrieveHits`：若 rec.heading / rec.body 为 string 则透传（含空串）；不要丢字段
  - 禁止改 StepChat.vue、禁止改检索算法
- [ ] GREEN
- [ ] 微闭环：若 JobContextSnapshot 导出形状未变则不 `register_contract`。refresh_asset `context.ts` 与 `handle-request.ts`。禁止 `audit_arch_changes`。
- [ ] git add **仅白名单** commit。subject：`feat(retrieve): include hit heading and body in step-chat prompt`

## Files 白名单

- `packages/core-engine/src/agent/context.ts`
- `packages/core-engine/src/http/handle-request.ts`
- `packages/core-engine/test/standard-lib-stepchat.test.ts`
- `.apt/orchestration/task-f1-2-report.md`

## Verify

```
npx vitest run test/standard-lib-stepchat.test.ts
```

cwd: `packages/core-engine`

对应 Rn：R4 / R8

## 编码规范

- 注释说为什么（截断只用于 prompt，不是详情全文）
- TS return type 明确
- 函数体 ≤80 行
- 禁止无意义注释

## Report

写满 `.apt/orchestration/task-f1-2-report.md`。
