# Task F2-4 Brief — 账本 LayoutUnit 重嵌入

- **Plan:** `docs/apt/plans/2026-09-19-dashscope-text-embedding-v3-plan.md` Task 4
- **Spec:** `docs/superpowers/specs/2026-09-19-dashscope-text-embedding-v3-design.md`
- **BASE_SHA:** `3a5dcbea7c746d2865e8cff1f51435bad30599b5`
- **Report:** `.apt/orchestration/task-f2-4-report.md`
- **Rn:** R5 / T6

## 目标

`StandardLibrary.reindexVectorsFromLedger()`：从 Postgres/SQLite 账本枚举全部 LayoutUnit，按 v3/当前 `ports.embed` 重嵌入并 upsert。payload 必须含 `unit_id` / `file_name` / `chunk_kind`（及 page_start/page_end 以过 payload gate）。`JobPipeline.openLiveFromEnv` 仅在 live 分支、构造 pipeline 之后 `await pipeline.library.reindexVectorsFromLedger()`。memory 分支不调用。失败 throw，禁止回退 Hash。

## 步骤

1. 只读 MCP：`query_contract` StandardLibrary；LedgerStore；JobPipeline。禁止掀 `.ai/arch/`。
2. TDD：内存账本插入一条 clause unit + 一条 table unit（可走 ingest 夹具 + 再 insertLayoutUnit 表，或直接 store API）。用可记录 upsert 的 VectorStore（包装 MemoryVectorStore 或自写 spy）。`reindexVectorsFromLedger` 后至少两次 upsert；payload 含三字段；clause 文本来自 heading+body（或 unit heading + body_markdown）。
3. 实现 walk：`listProjects` → `listSpecPacks` → `listStandardDocs` → `listStandardVersions` → `listLayoutUnits`。
   - chunk_kind=clause：优先 `getClause(unit.clause_id)` 的 heading+body，否则 unit heading + body_markdown
   - table/annex：heading + body_markdown；payload 不得带非空 clause_id
4. `library.ts` 里所有 `ports.embed.embed(...)` 必须 `await`（否则 `number[] | Promise<number[]>` 不能赋给 `vector: number[]`）。本文件内 await 属于本 Task 白名单。
5. `openLiveFromEnv` live 分支调用 reindex；memory 不调用。
6. 微闭环：refresh_asset library.ts / job-pipeline.ts。reindex 若导出则 register_contract。
7. git commit；写 report。

## Files 白名单

- `packages/core-engine/src/retrieve/library.ts`
- `packages/core-engine/src/pipeline/job-pipeline.ts`
- `packages/core-engine/test/reindex-vectors.test.ts`

## Verify

```
npx vitest run test/reindex-vectors.test.ts test/standard-rag.test.ts
```

cwd: `packages/core-engine`

（standard-rag 回归：await embed 后入库/检索仍绿）

## 禁止

- 改 Vue / DSL / qdrant.ts / embeddings.ts / live-ports.ts
- 写入 apiKey
- `audit_arch_changes`
- ingest-worker.ts 留给 Task 5（除非本 Task 不碰它）

## 编码规范

`.apt/code-standards.md`。导出方法「为什么」注释；函数 ≤80 行（walk 可拆私有 helper）。

## 上一 Task handoff

Task 3 Approved。Qdrant 维数不匹配会重建。Commit `3a5dcbe`。
