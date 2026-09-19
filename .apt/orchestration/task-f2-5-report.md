## Task F2-5 Report
**Status:** DONE_WITH_CONCERNS
### Tests
- Command: `npx vitest run test/standard-rag.test.ts test/ingest-pdf.test.ts test/live-rag-ingest.test.ts test/rerank.test.ts test/dashscope-embeddings.test.ts test/qdrant-collection.test.ts test/reindex-vectors.test.ts`（cwd: `packages/core-engine`）。
- Verify：`Test Files  6 passed | 1 skipped (7)` / `Tests  35 passed | 1 skipped (36)`。Duration 11.15s。
- A12 仍绿（`standard-rag.test.ts` 15 passed；自然语言 paraphrase 与「1.1」同 `clause_id`）。
- `ingest-pdf.test.ts` 4 passed（PDF tick 经 worker upsert 现 `await embed`）。
- `live-rag-ingest.test.ts` skip（本机无完整 live：`DATABASE_URL` / `QDRANT_URL` / `NEO4J_URI` / `DASHSCOPE_API_KEY`）。skipIf 已加 `DASHSCOPE_API_KEY`；有环境时 scroll `with_vector: true` 断言向量 `length !== HASH_EMBED_DIM`（48）。无环境 skip，不是回退 Hash。
- 其余：`rerank` 3 / `dashscope-embeddings` 8 / `qdrant-collection` 2 / `reindex-vectors` 3 均绿。
### APT Micro-closeout
- ContractsRegistered: 无（只读 `query_contract` StandardIngestWorker / StandardLibrary；未 `register_contract`）。
- AssetsRefreshed: `packages/core-engine/src/retrieve/ingest-worker.ts`（MCP `refresh_asset` → `frontend/packages/util/StandardIngestWorker` action=created）。
- AssetsRemoved: 无
- 禁止 `audit_arch_changes`；未手工改 `.ai/`；未掀 `.ai/arch/`。
### FilesChanged
- `packages/core-engine/src/retrieve/ingest-worker.ts`（clause/table upsert 两处 `await ports.embed.embed(...)`）
- `packages/core-engine/test/live-rag-ingest.test.ts`
- `library.ts` / `standard-rag.test.ts` / `ingest-pdf.test.ts` 无改动（Task 4 已 await；A12 无需补强）
- `.apt/orchestration/task-f2-5-report.md`（未纳入 commit）
### Commits
- `17fee66` `feat(retrieve): await ingest-worker embeddings for async DashScope`（白名单 2 文件；未 push）
### Blockers / Concerns
- 开始前只读 MCP：`query_contract` StandardIngestWorker / StandardLibrary 命中；未掀 `.ai/arch/`。
- `refresh_asset` 落到新建 `frontend/packages/util/StandardIngestWorker`，未覆盖既有 `frontend/core-engine` 路径。禁止 audit，未手工改索引。
- ingest-worker 工作区另有与本 Task 无关的未提交改动（`unpdf` `getDocumentProxy` 计页）。commit 只含两处 `await embed`；其余改动已还原到工作区未提交。
- live smoke 本机 skip，未打真实百炼 / Qdrant 断言 1024 维；未写入 apiKey。
- MCP `refresh_asset` 可能改了 `.ai/`；未纳入本 commit。
