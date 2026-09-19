# Task F4-4 Brief — IndependentReranker / defaultRetrievePorts / A12 回归

- **Plan:** `docs/apt/plans/2026-09-19-live-http-rerank-plan.md` Task 4
- **Slice:** F-4
- **BASE_SHA:** `b0fec81`
- **Report:** `.apt/orchestration/task-f4-4-report.md`
- **review-tier:** full

## 目标

确认 **不改** `rerank.ts` 算法、**不改** `library.ts` 路由、**不改** `Reranker` 签名。`defaultRetrievePorts()` 仍默认 IndependentReranker。A12 / rerank.test.ts 仍绿。

本 Task **无强制改文件**。仅当测试注释与 live 事实冲突时才允许改测试文案，禁止改断言语义。若无需改文件：跑 Verify，写 report，**不要空 commit**。

## Files 白名单（仅当必须改测试文案）

- `packages/core-engine/test/rerank.test.ts`
- `packages/core-engine/test/standard-rag.test.ts`

只读允许：`packages/core-engine/src/retrieve/rerank.ts`、`packages/core-engine/src/retrieve/library.ts`

## Verify

```
npx vitest run test/rerank.test.ts test/standard-rag.test.ts test/http-rerank.test.ts
```

cwd: `packages/core-engine`

## 禁止

- 改 rerank 算法 / library 路由 / Vue / live-ports / http-rerank
- 把无关脏文件加入 commit
- 真实密钥 / audit_arch_changes

## 上一 Task

F4-3 Approved `b0fec81`：live 已装配 HttpReranker。测试 IndependentReranker 必须继续可用。
