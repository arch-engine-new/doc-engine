## Task F2-1 Report
**Status:** DONE_WITH_CONCERNS
### Tests
- Command: `npx vitest run test/rerank.test.ts test/standard-rag.test.ts test/ingest-pdf.test.ts`（cwd: `packages/core-engine`）。
- TDD RED（只改 `rerank.test.ts`、未改 ports/rerank）：`Test Files  1 failed (1)` / `Tests  1 failed | 2 passed (3)`。Duration 4.72s。失败断言：

```
FAIL  test/rerank.test.ts > IndependentReranker > reranks when embed returns a Promise
AssertionError: expected 'wrong' to be 'right'
```

  未 `await embed` 时 cosine 吃到 Promise，排序退回输入顺序。`HashEmbeddings embed length is 48 when awaited` 当时已绿（Hash 本就 48 维）。
- TDD GREEN：`Embeddings.embed` 改为 `number[] | Promise<number[]>`；`IndependentReranker.rerank` 对 query/候选 `await this.embed.embed(...)`；ingest-pdf 把 `embed()` 结果当向量处加 `await`。Verify：`Test Files  3 passed (3)` / `Tests  22 passed (22)`。Duration 6.62s。
### APT Micro-closeout
- ContractsRegistered: `Embeddings`（签名演进：`embed(text): number[] | Promise<number[]>`；`tsFilePath=packages/core-engine/src/retrieve/ports.ts`；MCP `register_contract` 返回 Contract updated）。
- AssetsRefreshed: `packages/core-engine/src/retrieve/ports.ts`（MCP `refresh_asset` → `frontend/packages/util/ports` action=updated）；`packages/core-engine/src/retrieve/rerank.ts`（→ `frontend/packages/util/rerank` action=created）；`packages/core-engine/src/retrieve/embeddings.ts`（首次因 `.ai` 文件锁失败，重试 → `frontend/packages/util/embeddings` action=created）。
- AssetsRemoved: 无
- 禁止 `audit_arch_changes`；未手工改 `.ai/`。
### FilesChanged
- `packages/core-engine/src/retrieve/ports.ts`
- `packages/core-engine/src/retrieve/embeddings.ts`
- `packages/core-engine/src/retrieve/rerank.ts`
- `packages/core-engine/test/rerank.test.ts`
- `packages/core-engine/test/ingest-pdf.test.ts`
- `.apt/orchestration/task-f2-1-report.md`（未纳入 commit）
### Commits
- `bcce1e2` `feat(retrieve): allow Embeddings.embed to return a Promise`（白名单 5 文件；未 push）
### Blockers / Concerns
- 开始前只读 MCP：`query_contract Embeddings` 为同步 `embed(text: string): number[]`；`query_contract HashEmbeddings` 为 CI 48 维 n-gram，非生产。
- `BASE_SHA` `fa80d32` 的 tree **不含** `embeddings.ts` / `rerank.ts` / `rerank.test.ts`（工作区已有未跟踪副本）。本 commit 以 `create` 纳入这三份文件（含既有 Hash/rerank 实现 + 本 Task 的 await/注释），不是纯签名 diff。
- `refresh_asset` 落到 `frontend/packages/util/*`，未覆盖既有 `frontend/core-engine` 条目。禁止 audit，未手工改索引。
- 未实现 DashScope、未改 `live-ports` / Qdrant / Vue；未写入 apiKey。`library.ts` / `ingest-worker.ts` 仍同步调 embed，留给 Task 5。
- 白名单中 `standard-rag.test.ts` / `agent-native-graph.test.ts` / `standard-lib-stepchat.test.ts` 无 `embed()` 当 `number[]` 使用处，未改。
