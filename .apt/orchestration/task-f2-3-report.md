## Task F2-3 Report
**Status:** DONE_WITH_CONCERNS
### Tests
- Command: `npx vitest run test/qdrant-collection.test.ts`（cwd: `packages/core-engine`）。
- TDD RED（仅新增 `qdrant-collection.test.ts`，constructor 尚无 `client` 注入）：`Test Files  1 failed (1)` / `Tests  2 failed (2)`。Duration 1.90s。失败：`Qdrant URL not configured (set QDRANT_URL)`（注入的 mock 被忽略，未读 `getCollection` size）。
- TDD GREEN：constructor 可选 `client`；`ensureCollection` 对已有 `clauses` 读 `getCollection().config.params.vectors.size`；size≠dim 则 `deleteCollection('clauses')` + `createCollection` size=dim distance Cosine，再 upsert；size 已匹配不 delete。向量保持 1024 维，禁止截断。Verify：`Test Files  1 passed (1)` / `Tests  2 passed (2)`。Duration 1.67s。
### APT Micro-closeout
- ContractsRegistered: `QdrantVectorStore`（`tsFilePath=packages/core-engine/src/retrieve/qdrant.ts`；MCP `register_contract` 返回 Contract registered and INDEX.md updated）。
- AssetsRefreshed: `packages/core-engine/src/retrieve/qdrant.ts`（MCP `refresh_asset` → `frontend/packages/util/QdrantVectorStore` action=created）。
- AssetsRemoved: 无
- 禁止 `audit_arch_changes`；未手工改 `.ai/`。
### FilesChanged
- `packages/core-engine/src/retrieve/qdrant.ts`
- `packages/core-engine/test/qdrant-collection.test.ts`
- `.apt/orchestration/task-f2-3-report.md`（未纳入 commit）
### Commits
- `3a5dcbe` `feat(retrieve): rebuild Qdrant clauses on embedding dimension mismatch`（白名单 2 文件；未 push）
### Blockers / Concerns
- 开始前只读 MCP：`search_arch` 命中 `frontend/core-engine/util#qdrantvectorstore`；`query_arch` 摘要仍是「扫描失败，待人工补充」，collection 名 `clauses` 以源码为准。
- `refresh_asset` 落到新建 `frontend/packages/util/QdrantVectorStore`，未覆盖既有 `frontend/core-engine/util#qdrantvectorstore`。禁止 audit，未手工改索引。
- 未命名 VectorParams 读 `config.params.vectors.size`；若是 named vector map（无顶层 size）视为不一致并重建，避免往未知维 upsert。
- 未打真实 Qdrant / 未改 live-ports / embeddings / library / Vue；payload 过 `assertVectorPayload`（`file_name` / `unit_id` / `chunk_kind` / `page_start` / `page_end`）。
- MCP `refresh_asset`/`register_contract` 可能改了 `.ai/`；未纳入本 commit。
