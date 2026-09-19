## Task F4-2 Report

**Status:** DONE

本 Task 最小实现 `HttpReranker implements Reranker`，使 F4-1 红灯测试变绿。未改 `live-ports.ts`。未打真实网。夹具/Error 不含真实密钥。

### Tests
- Command: `npx vitest run test/http-rerank.test.ts`（cwd: `packages/core-engine`）。
- Result: **PASS** `Test Files  1 passed (1)` / `Tests  8 passed (8)`。Duration 7.90s。exit 0。
- TDD GREEN 证据（实现 `HttpReranker` / 未改 live-ports）：

```
✓ test/http-rerank.test.ts (8 tests) 53ms

Test Files  1 passed (1)
     Tests  8 passed (8)
```

- 覆盖（对应 R2/R3/R4/R5/R8 / T1–T4/T6/T8）：
  - T1：默认 POST `https://dashscope.aliyuncs.com/compatible-api/v1/reranks`，`model=qwen3-rerank`，`documents` 为候选 text；不传 `top_n`；URL 不含 `compatible-mode` / `chat/completions`、不以 `/embeddings` 结尾；`Authorization: Bearer test-key`
  - T2：mock `results` 按 `relevance_score` 降序，ids = `["clause-b", "clause-a"]`
  - T3：空 env 构造 throw `RERANK_API_KEY or DASHSCOPE_API_KEY is required`，消息匹配 `/RERANK_API_KEY|DASHSCOPE_API_KEY/`，不含 `test-key`
  - T4：HTTP 500 → `/Rerank HTTP 500/`；非空候选 + 空 `results` throw；源码不得出现 `IndependentReranker`
  - T6：`env.RERANK_URL` 为 `https://rerank.test.invalid/v1/reranks` 时 POST 该 URL，JSON 仍为 `{ model, query, documents }`
  - T8：空候选返回 `[]` 且 fetch 次数 = 0；`IndependentReranker` / `defaultRetrievePorts()` 仍可用
- 未改 `http-rerank.test.ts`（验收断言全部保留）。夹具 apiKey 字面量只用 `test-key`。mock `fetch`，未打真实网，未写入真实密钥。Error 只含变量名与 HTTP status。

### Implementation
- 新增 `packages/core-engine/src/retrieve/http-rerank.ts`：
  - 构造密钥：`(options.apiKey ?? env.RERANK_API_KEY ?? env.DASHSCOPE_API_KEY)?.trim()`；空则 throw（消息含变量名、不含密钥值）
  - URL：`options.url ?? env.RERANK_URL ??` 默认 `compatible-api/v1/reranks`（**禁止**复用 `DASHSCOPE_DEFAULT_BASE_URL` / `compatible-mode`）
  - 模型：`options.model ?? env.RERANK_MODEL ?? "qwen3-rerank"`
  - 空候选不发网；POST `{ model, query, documents }`，不要 `top_n`
  - 解析 `body.results ?? body.output?.results`，分数 `relevance_score ?? score`；按分数降序输出 `clause_id`；缺席下标按原相对顺序追加
  - 非 2xx → `Rerank HTTP <status>`；候选非空但 results 空/非数组 → throw；index 越界忽略，有效项 0 → throw
  - **不得** import `HashEmbeddings` / `DashScopeEmbeddings` / `IndependentReranker`；**不得**调用 `embed()` / `complete()`；**不得**本地算余弦
- `packages/core-engine/src/index.ts` re-export `HttpReranker`
- 编码规范：导出类/方法有「为什么」注释；函数 ≤80 行；明确 return type

### APT Micro-closeout
- ContractsRegistered: 无（brief 允许留给 Task 5：`register_contract` name=`HttpReranker`，`tsFilePath=packages/core-engine/src/retrieve/http-rerank.ts`）
- AssetsRefreshed: 无（同样留给 Task 5 `refresh_asset`）
- AssetsRemoved: 无
- 禁止 `audit_arch_changes`；未手工改 `.ai/`。

### FilesChanged
- `packages/core-engine/src/retrieve/http-rerank.ts`（新建）
- `packages/core-engine/src/index.ts`（re-export）
- `.apt/orchestration/task-f4-2-report.md`（未纳入 commit）

### Commits
- `cb785c5` `feat(retrieve): add HttpReranker for independent HTTP rerank`（白名单 2 文件；未改测试；未 push）
- 基于 F4-1 RED `8c8ea79` `test: add failing HttpReranker cases for F-4`

### Blockers / Concerns
- 开始前只读 MCP：`query_project_status` phase=done / loopDone=true（相位机误判，按切片 F-4 继续）。`query_contract DashScopeEmbeddings` 命中 fetch/env 注入样板，默认 base 是 `compatible-mode/v1`（**未复用**去拼 `/reranks`）。`query_contract ChatComplete` 在 `ports.ts`：`complete({ prompt })` — HttpReranker 未调用。`query_contract RetrievePorts` 含 `interface Reranker { rerank(query, candidates) }`，未改签名。
- 未改 `live-ports.ts` / `rerank.ts` / `library.ts` / Vue。live 装配仍是 Task 3。
- T4 源码 grep `IndependentReranker`：实现文件不含该类名（注释也避开）。
- 未回显任何真实密钥。
