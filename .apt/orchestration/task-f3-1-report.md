## Task F3-1 Report

**Status:** DONE

### Tests
- Command: `npx vitest run test/live-zhipu-prequery.test.ts test/dashscope-embeddings.test.ts test/standard-rag.test.ts`（cwd: `packages/core-engine`）。
- Result: GREEN `Test Files  3 passed (3)` / `Tests  27 passed (27)`。Duration 14.95s。exit 0。
- TDD RED/GREEN:
  - RED（仅新增 `live-zhipu-prequery.test.ts`、未改装配）：`Test Files  1 failed (1)` / `Tests  2 failed | 2 passed (4)`。Duration 5.24s。失败断言：
    - `assembles ZhipuPrequery when LLM config is present` → `expected FakePrequery{ map: {} } to be an instance of ZhipuPrequery`
    - `throws when LLM is unconfigured` → 未 throw，消息为 `expected liveRetrievePorts to throw`（不匹配 `/Unconfigured|LLM|llm\.json/i`）
    - FakePrequery 单测注入与 IndependentReranker embed-only 当时已绿。
  - GREEN：`liveRetrievePorts()` 装配 `new ZhipuPrequery(llm)`；`createLlmProvider()` 得到 `UnconfiguredLlmProvider` / `FakeLlmProvider` 时 throw；`IndependentReranker({ embed })` 不变。`dashscope-embeddings.test.ts` 成功路径补临时 `llm.json`（`apiKey` 字面量 `test-key`）。缺 DASHSCOPE 用例保持。未打真实智谱/DashScope HTTP。

### APT Micro-closeout
- ContractsRegistered: [`ZhipuPrequery` → `packages/core-engine/src/retrieve/prequery.ts`（MCP `register_contract` 返回 registered）; `liveRetrievePorts` description 更新：prequery 为 ZhipuPrequery，缺 LLM throw（MCP `register_contract` 返回 updated）]
- AssetsRefreshed: [`packages/core-engine/src/retrieve/live-ports.ts`（MCP `refresh_asset` → `frontend/packages/util/live-ports` action=created）]
- AssetsRemoved: 无
- 禁止 `audit_arch_changes`；未手工改 `.ai/`。

### FilesChanged
- `packages/core-engine/src/retrieve/live-ports.ts`
- `packages/core-engine/test/live-zhipu-prequery.test.ts`（新建）
- `packages/core-engine/test/dashscope-embeddings.test.ts`
- `.apt/orchestration/task-f3-1-report.md`（未纳入 commit）

### Commits
- `cf22716` wire liveRetrievePorts prequery to ZhipuPrequery

### Blockers / Concerns
- 开始前只读 MCP：`query_contract liveRetrievePorts` 仍为 `prequery: new FakePrequery()`；`FakePrequery` / `UnconfiguredLlmProvider` / `ZhipuLlmProvider` 命中；`query_contract ZhipuPrequery` missing；`query_arch frontend/core-engine/util#zhipuprequery` 已有 ZhipuPrequery 文档。
- `refresh_asset` 落到 `frontend/packages/util/live-ports`（created），未覆盖既有 `frontend/core-engine` 条目。禁止 audit，未手工改索引。
- 缺 LLM 夹具用 `APT_PROJECT_ROOT` 指向空临时目录，避免 `createLlmProvider()` 回落到 arch chat 导致测试非确定。
- Qdrant 客户端在构造 live ports 时对占位 URL 打印 version compatibility 警告；不影响断言。未回显任何真实密钥。
