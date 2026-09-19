## Task F4-3 Report

**Status:** DONE

live `RetrievePorts.rerank` 装配 `HttpReranker`，不再 `IndependentReranker({ embed })`。改写 F-2/F-3 把「live 共用 embed」当绿的测试。未打真实网。夹具/Error 不含真实密钥。

### Tests
- Command: `npx vitest run test/live-zhipu-prequery.test.ts test/dashscope-embeddings.test.ts test/http-rerank.test.ts`（cwd: `packages/core-engine`）。
- Result: **PASS** `Test Files  3 passed (3)` / `Tests  20 passed (20)`。Duration 4.29s。exit 0。
- T5 / F-2/F-3 改写证据：

```
✓ test/http-rerank.test.ts (8 tests) 33ms
✓ test/dashscope-embeddings.test.ts (8 tests) 60ms
✓ test/live-zhipu-prequery.test.ts (4 tests) 76ms

Test Files  3 passed (3)
     Tests  20 passed (20)
```

- 覆盖（对应 R1/R3/R7/T5）：
  - T5：`liveRetrievePorts()`（`DASHSCOPE_API_KEY=test-key` + 临时 `agent-runtime.llm.json`，同 F-3）`.rerank` 为 `HttpReranker`，`not.toBeInstanceOf(IndependentReranker)`
  - 调用 `ports.rerank.rerank(...)` 时 spy `ports.embed.embed` 次数 = 0
  - stub `globalThis.fetch`：`/reranks` 返回精排 `results`；精排 URL 不含 `chat/completions`、不以 `/embeddings` 结尾
  - `prequery` 仍为 `ZhipuPrequery`；embed 仍为 `DashScopeEmbeddings`，非 `HashEmbeddings`
  - 删除 `dashscope-embeddings.test.ts`「shares one DashScopeEmbeddings instance with IndependentReranker」
  - 改写 `live-zhipu-prequery.test.ts`「keeps IndependentReranker on embed only…」
- `http-rerank.test.ts` 回归仍绿（8 tests，未改该文件）。夹具 apiKey 字面量只用 `test-key`。mock `fetch`，未打真实网，未写入真实密钥。

### Implementation
- `packages/core-engine/src/retrieve/live-ports.ts`：
  - `rerank: new HttpReranker()`；**禁止** `?? new IndependentReranker()`；**禁止**把 `embed` / `llm` 传入 rerank
  - 删除过时注释「Live retrieve must share one v3 embedder with rerank」；改为说明 live embed 仍是 DashScope v3、共用 embed 会冒充独立精排
  - embed 继续 `new DashScopeEmbeddings()`；prequery 继续 `ZhipuPrequery` + `requireConfiguredLlm`（不回退 FakePrequery）
  - 去掉 `IndependentReranker` import
- 编码规范：导出函数有「为什么」注释；函数 ≤80 行；明确 `RetrievePorts` return type

### APT Micro-closeout
- ContractsRegistered: `liveRetrievePorts`（description 改为 HttpReranker，不再写共用 embed；`tsFilePath=packages/core-engine/src/retrieve/live-ports.ts`）
- AssetsRefreshed: `packages/core-engine/src/retrieve/live-ports.ts` → `frontend/core-engine/util/liveRetrievePorts`（updated）
- AssetsRemoved: 无
- 禁止 `audit_arch_changes`；未手工改 `.ai/`。`HttpReranker` contract 仍未登记（query_contract missing；plan 允许留给 Task 5）。

### FilesChanged
- `packages/core-engine/src/retrieve/live-ports.ts`
- `packages/core-engine/test/dashscope-embeddings.test.ts`
- `packages/core-engine/test/live-zhipu-prequery.test.ts`
- `.apt/orchestration/task-f4-3-report.md`（未纳入 commit）

### Commits
- `b0fec81` `feat(retrieve): assemble liveRetrievePorts with HttpReranker`（白名单 3 文件；未捎 PdfTickPanel.vue / job-pipeline.ts 等脏文件；未 push）
- 基于 F4-2 DONE `cb785c5` `feat(retrieve): add HttpReranker for independent HTTP rerank`

### Blockers / Concerns
- 开始前只读 MCP：`query_project_status` phase=done / loopDone=true（相位机误判，按切片 F-4 继续）。`query_contract liveRetrievePorts` 命中旧描述「IndependentReranker gets embed only」——本 Task 已更新。`query_contract ZhipuPrequery` 命中 glm rewrite，must not be used as rerank。`query_contract IndependentReranker` 命中余弦+词面。`query_contract HttpReranker` missing（预期，F4-2 留给 Task 5 登记）；未 `report_missing` 停工。
- 未改 `rerank.ts` / `library.ts` / `http-rerank.ts` / Vue / job-pipeline。
- `liveRetrievePorts()` 构造 `Neo4jGraphStore` 会异步打 version check（stderr `Client version 1.19.0 is incompatible with server version undefined`）。T5 因此不把 `fetch` 总次数钉死为 1，只断言精排 path 含 `/reranks`、embed.embed=0、无 `chat/completions`。属既有 Neo4j 构造副作用，非精排回归。
- 未回显任何真实密钥。
