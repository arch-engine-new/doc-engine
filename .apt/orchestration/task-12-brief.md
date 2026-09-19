# Task 12 Brief — Docker live 冒烟（非 CI 强制）

plan: `docs/apt/plans/2026-09-15-rag-ingest-metadata-graph-plan.md`
projectType: component
BASE_SHA: `08657a3533b6564a00514641ff466d4e73b9c7de`

## 步骤

- [ ] MCP：`query_contract` name=`liveRetrievePorts`。禁止读 `.ai/`。
- [ ] 新测 `packages/core-engine/test/live-rag-ingest.test.ts`：
  - `describe.skipIf(!process.env.DATABASE_URL)`（可同时要求 QDRANT_URL/NEO4J_URI，与 live-triple-store 一致）。
  - **无 Docker / 无 env → skip，CI 仍绿。**
  - 有 live：JSON ingest 请假夹具或 tick `rules/` 前 N 页（默认 5，可用 `LIVE_RAG_PAGES`）；抽查任一 Qdrant point payload `file_name` 非空。
  - **禁止**把公路条文写入 `demo/reset` seed。
  - 全书 OCR 完成不是门禁。

## Files 白名单

- `packages/core-engine/test/live-rag-ingest.test.ts`（新）
- 仅当必须才改 `packages/core-engine/src/retrieve/live-ports.ts`

不要改 seed.ts 塞公路。不要涨 Job 4MB。

## Verify

```
npx vitest run packages/core-engine/test/live-rag-ingest.test.ts
```

无 DATABASE_URL 时 skipped 且 exit 0。

## Report + commit

`.apt/orchestration/task-12-report.md`
有测试文件则 commit：`test(retrieve): skip live RAG ingest smoke without DATABASE_URL`
无改动不要空 commit。
