# Task F4-2 Brief — 实现 HttpReranker（后绿）

- **Plan:** `docs/apt/plans/2026-09-19-live-http-rerank-plan.md` Task 2
- **Slice:** F-4
- **BASE_SHA:** `8c8ea79`
- **Report:** `.apt/orchestration/task-f4-2-report.md`
- **review-tier:** full

## 目标

最小实现 `HttpReranker implements Reranker`，使 Task 1 红灯测试变绿。本 Task **不改** `live-ports.ts`。

## 步骤

严格按 plan Part 2 Task 2。要点：

- 缺 `RERANK_API_KEY` 且缺 `DASHSCOPE_API_KEY` 构造 throw，消息含变量名，不含密钥值
- 默认 URL `https://dashscope.aliyuncs.com/compatible-api/v1/reranks`（不是 compatible-mode，不是 /embeddings）
- POST `{ model, query, documents }`，不要 top_n
- 空候选不发网
- 非 2xx throw `Rerank HTTP <status>`
- 不得 import HashEmbeddings / DashScopeEmbeddings / IndependentReranker
- 不得调用 embed()/complete()，不得本地算余弦
- `index.ts` re-export HttpReranker
- 可按测试微调 `http-rerank.test.ts`（仍在白名单）但不得删验收断言

## Files 白名单

- `packages/core-engine/src/retrieve/http-rerank.ts`
- `packages/core-engine/src/index.ts`
- `packages/core-engine/test/http-rerank.test.ts`

## Verify（必须 PASS）

```
npx vitest run test/http-rerank.test.ts
```

cwd: `packages/core-engine`

## 禁止

- 改 live-ports / rerank.ts / library.ts / Vue
- 真实 HTTP / 真实密钥 / audit_arch_changes

## 编码规范

`.apt/code-standards.md`。导出类/方法须有「为什么」注释；函数 ≤80 行；明确 return type。

## 微闭环

本 Task 可先实现，`register_contract` 可做或留给 Task 5。若做：name=`HttpReranker`，tsFilePath=`packages/core-engine/src/retrieve/http-rerank.ts`。refresh_asset 该源文件。

## 上一 Task

F4-1 Approved。RED 测试 `8c8ea79`。
