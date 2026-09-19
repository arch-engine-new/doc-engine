## Task F4-1 Report

**Status:** DONE

本 Task 设计为 TDD 红灯：只写失败测试，不实现 `HttpReranker`。Verify **expected FAIL**。

### Tests
- Command: `npx vitest run test/http-rerank.test.ts`（cwd: `packages/core-engine`）。
- Result: **expected FAIL** `Test Files  1 failed (1)` / `Tests  no tests`。Duration 13.37s。exit 1。
- TDD RED 证据（未实现 `HttpReranker` / 未改 live-ports）：

```
FAIL  test/http-rerank.test.ts [ test/http-rerank.test.ts ]
Error: Cannot find module '../src/retrieve/http-rerank.js' imported from 'D:/software/doc-engine/packages/core-engine/test/http-rerank.test.ts'
 ❯ test/http-rerank.test.ts:11:1
     11| import { HttpReranker } from "../src/retrieve/http-rerank.js";
```

Caused by: `Failed to load url ../src/retrieve/http-rerank.js ... Does the file exist?`

- 覆盖（待 Task 2 后绿）：
  - T1：默认 POST `compatible-api/v1/reranks`，`model=qwen3-rerank`，`documents` 为候选 text；URL 不含 `compatible-mode` / `chat/completions`、不以 `/embeddings` 结尾
  - T2：mock `results` 按 `relevance_score` 降序，ids 以 index=1 的 `clause_id` 开头
  - T3：空 env 构造 throw `/RERANK_API_KEY|DASHSCOPE_API_KEY/`，消息不含 `test-key`
  - T4：HTTP 500 → `/Rerank HTTP 500/`；非空候选 + 空 `results` throw；源码不得出现 `IndependentReranker`
  - T6：`env.RERANK_URL` 为 `https://rerank.test.invalid/v1/reranks` 时 POST 该 URL，JSON 仍为 `{ model, query, documents }`
  - T8：`IndependentReranker` / `defaultRetrievePorts()` 仍可用；空候选返回 `[]` 且 fetch 次数 = 0
- 夹具 apiKey 字面量只用 `test-key`。mock `fetch`，未打真实网，未写入真实密钥。

### APT Micro-closeout
- ContractsRegistered: 无（本 Task 仅测试文件；登记放后续 Task）
- AssetsRefreshed: 无
- AssetsRemoved: 无
- 禁止 `audit_arch_changes`；未手工改 `.ai/`。

### FilesChanged
- `packages/core-engine/test/http-rerank.test.ts`（新建）
- `.apt/orchestration/task-f4-1-report.md`（未纳入 commit）

### Commits
- `8c8ea79` `test: add failing HttpReranker cases for F-4`（仅白名单测试文件；未 push）

### Blockers / Concerns
- 开始前只读 MCP：`query_contract Reranker` missing（plan 预期，改查 `RetrievePorts`）；`query_contract RetrievePorts` 命中 `interface Reranker { rerank(query, candidates) }`；`query_contract IndependentReranker` 命中余弦+词面实现。`search_arch` `Reranker interface RetrievePorts rerank` 落到 `IndependentReranker` / `rerank.ts`，无 HttpReranker 资产。
- 未实现 `HttpReranker`、未改 `live-ports` / `index.ts`。本 Task Verify 失败是红灯基线，不是回归事故。
- 未回显任何真实密钥。
