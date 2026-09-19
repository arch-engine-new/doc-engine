## Task F2-2 Report
**Status:** DONE_WITH_CONCERNS
### Tests
- Command: `npx vitest run test/dashscope-embeddings.test.ts test/rerank.test.ts`（cwd: `packages/core-engine`）。
- TDD RED（仅新增 `dashscope-embeddings.test.ts`，未实现类）：`Test Files  1 failed (1)` / `Tests  8 failed (8)`。Duration 6.16s。失败：`DashScopeEmbeddings is not a constructor`；缺 key 时 `liveRetrievePorts()` 仍抛 `Qdrant URL not configured`（仍走 Hash 装配）。
- TDD GREEN：`DashScopeEmbeddings` 注入 fetch/env，POST 兼容模式 `/embeddings`（model=`text-embedding-v3`、`dimensions=1024`、`encoding_format=float`）；缺 `DASHSCOPE_API_KEY` 构造即 throw；`liveRetrievePorts` 先 `new DashScopeEmbeddings()` 再注入 `IndependentReranker({ embed })`，禁止 Hash 回退。Verify：`Test Files  2 passed (2)` / `Tests  11 passed (11)`。Duration 7.78s。
### APT Micro-closeout
- ContractsRegistered: `DashScopeEmbeddings`（`tsFilePath=packages/core-engine/src/retrieve/embeddings.ts`；MCP `register_contract` 返回 Contract registered and INDEX.md updated）。
- AssetsRefreshed: `packages/core-engine/src/retrieve/embeddings.ts`（MCP `refresh_asset` → `frontend/core-engine/util/embeddings` action=created）；`packages/core-engine/src/retrieve/live-ports.ts`（→ `frontend/core-engine/util/live-ports` action=created）。
- AssetsRemoved: 无
- 禁止 `audit_arch_changes`；未手工改 `.ai/`。
### FilesChanged
- `packages/core-engine/src/retrieve/embeddings.ts`
- `packages/core-engine/src/retrieve/live-ports.ts`
- `packages/core-engine/src/index.ts`
- `packages/core-engine/test/dashscope-embeddings.test.ts`
- `.apt/orchestration/task-f2-2-report.md`（未纳入 commit）
### Commits
- `6361de7` `feat(retrieve): switch live embed to DashScope text-embedding-v3`（白名单 4 文件；未 push）
### Blockers / Concerns
- 开始前只读 MCP：`query_contract liveRetrievePorts` 仍为 `embed: new HashEmbeddings()` + 未注入的 `IndependentReranker()`；`IndependentReranker` 缺 embed 时默认 Hash，禁止 `complete()`；`ZhipuLlmProvider` 是 `POST /chat/completions`，未复用当 embed。
- 共用实例测试需临时设 `QDRANT_URL` / `NEO4J_URI` 才能过 Qdrant/Neo4j 构造；Qdrant client 会对 dummy URL 打 version-check stdout/stderr，测试仍绿。
- `IndependentReranker` 未注入时仍默认 Hash（白名单不含 rerank.ts，live 路径已注入同一实例）。
- 未改 qdrant / library reindex / Vue / DSL；未写入真实 apiKey / `sk-` 字面量。Error 只含变量名与 HTTP status。
- MCP `refresh_asset`/`register_contract` 可能改了 `.ai/`；未纳入本 commit。
