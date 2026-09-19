# Task F4-5 Brief — .env.example 变量名 + 登记 HttpReranker

- **Plan:** `docs/apt/plans/2026-09-19-live-http-rerank-plan.md` Task 5
- **Slice:** F-4
- **BASE_SHA:** `b0fec81`
- **Report:** `.apt/orchestration/task-f4-5-report.md`
- **review-tier:** full

## 目标

1. `apps/web/.env.example` 用**注释**写出 `RERANK_URL` / `RERANK_MODEL` / `RERANK_API_KEY` 变量名（可空）。可注明未设时密钥回退 `DASHSCOPE_API_KEY` **变量名**。禁止写入任何密钥值 / `sk-` 字面量。
2. 确认 `index.ts` 已 re-export `HttpReranker`。源文件与测试 grep 夹具密钥只有 `test-key`。
3. 微闭环：`register_contract` name=`HttpReranker`；可选补登记 `Reranker`；`refresh_asset` `http-rerank.ts` 与 `live-ports.ts`。

## Files 白名单

- `apps/web/.env.example`
- `packages/core-engine/src/index.ts`
- `packages/core-engine/src/retrieve/http-rerank.ts`
- `packages/core-engine/test/http-rerank.test.ts`

index.ts / http-rerank.ts / 测试若无需改则不要无谓改动。`.env.example` 必须改。

## Verify

```
npx vitest run test/http-rerank.test.ts test/dashscope-embeddings.test.ts test/live-zhipu-prequery.test.ts test/rerank.test.ts test/standard-rag.test.ts
```

cwd: `packages/core-engine`

另：`.env.example` 含三个变量名且无密钥值。

## 禁止

- 写入真实密钥 / sk- 字面量
- 改 Vue / job-pipeline / PdfTickPanel
- 把无关脏文件加入 commit
- `audit_arch_changes`

## 编码规范

`.apt/code-standards.md`

## 上一 Task

F4-4 回归 26 passed，无 commit。HEAD 仍 `b0fec81`。
