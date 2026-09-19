# Task F2-5 Brief — 入库/检索 await embed + A12 回归

- **Plan:** `docs/apt/plans/2026-09-19-dashscope-text-embedding-v3-plan.md` Task 5
- **BASE_SHA:** `1528f571b4362f34403d4c361370b5ce699950b3`
- **Report:** `.apt/orchestration/task-f2-5-report.md`
- **Rn:** R7 / R8 / T8

## 目标

`ingest-worker.ts` 两处 `ports.embed.embed` 改为 `await`。live smoke 在无 `DASHSCOPE_API_KEY` 时 skip（与无 QDRANT 同类），有 live 环境时若能 scroll 到向量则 length ≠ 48。CI Hash 路径 A12（自然语言与「1.1」同 clause_id）仍绿。不改 Vue / DSL / 路由算法。

## 步骤

1. 只读 MCP：StandardIngestWorker、StandardLibrary。禁止掀 `.ai/arch/`。
2. ingest-worker 两处 upsert 向量改为 `await ports.embed.embed(...)`。
3. `live-rag-ingest.test.ts`：`hasLiveEnv` 增加 `DASHSCOPE_API_KEY`；有环境时断言某点向量 length !== 48（scroll `with_vector: true` 或等价）。无环境 skip，不是回退 Hash。
4. 确认 standard-rag A12 仍绿（库内已 await）。
5. git add **仅白名单**。工作区有大量无关脏文件，禁止 `git add -A`。
6. 微闭环 refresh_asset ingest-worker.ts。
7. commit；写 report。

## Files 白名单

- `packages/core-engine/src/retrieve/ingest-worker.ts`
- `packages/core-engine/src/retrieve/library.ts`（仅当仍有未 await 的 embed；Task 4 可能已 await，无改动可不提交此文件）
- `packages/core-engine/test/standard-rag.test.ts`（仅当 A12 断言需要补强）
- `packages/core-engine/test/ingest-pdf.test.ts`
- `packages/core-engine/test/live-rag-ingest.test.ts`

## Verify

```
npx vitest run test/standard-rag.test.ts test/ingest-pdf.test.ts test/live-rag-ingest.test.ts test/rerank.test.ts test/dashscope-embeddings.test.ts test/qdrant-collection.test.ts test/reindex-vectors.test.ts
```

cwd: `packages/core-engine`

## 禁止

- `git add -A` / 提交无关文件
- 改 Vue / 其它 8 页 / DSL / chat embed
- apiKey 写入夹具
- `audit_arch_changes`

## 上一 Task handoff

Task 4 Approved。library.ts 已 await embed 并有 reindex。Commit `1528f57`。ingest-worker 仍同步 embed。
