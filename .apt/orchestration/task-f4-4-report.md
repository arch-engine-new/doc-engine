## Task F4-4 Report

**Status:** DONE

回归确认：不改 `IndependentReranker` 算法、不改 `library.ts` 路由 / `rerankClauseHits` / tableHits 旁路、不改 `Reranker` 签名。`defaultRetrievePorts()` 仍默认 `IndependentReranker`。A12 / `rerank.test.ts` / `http-rerank.test.ts` 仍绿。测试注释与 live 事实无冲突，**未改任何源码或测试文件**，**未空 commit**。

### Tests
- Command: `npx vitest run test/rerank.test.ts test/standard-rag.test.ts test/http-rerank.test.ts`（cwd: `packages/core-engine`）。
- Result: **PASS** `Test Files  3 passed (3)` / `Tests  26 passed (26)`。Duration 4.47s。exit 0。
- GREEN 证据：

```
✓ test/rerank.test.ts (3 tests) 9ms
✓ test/http-rerank.test.ts (8 tests) 35ms
✓ test/standard-rag.test.ts (15 tests) 437ms

Test Files  3 passed (3)
     Tests  26 passed (26)
```

- 覆盖（对应 R6/R9 / T7/T8）：
  - T7：`rerank.test.ts` 注入 `llm` spy（`complete` 抛错）时 `expect(complete).not.toHaveBeenCalled()`；自然语言候选排序仍以 `v:1.1` 为首
  - T7 / A12：`standard-rag.test.ts`「two paraphrases hit the same clause_id via prequery + vector + independent rerank」仍绿；两条释义命中同一 `clause_id`（`…:1.1`），`retrieve_path=vector`
  - T8：`http-rerank.test.ts` `defaultRetrievePorts().rerank` 为 `IndependentReranker`；`new IndependentReranker().rerank(...)` 仍可用；空候选 `HttpReranker.rerank(q, [])` 返回 `[]` 且 fetch 次数 = 0
  - R9：未改 Vue / `library.ts` 路由 / `Reranker` 签名
- 白名单测试文案检查：
  - `rerank.test.ts` 顶部注释「IndependentReranker must not call chat complete」描述的是 CI 余弦类实现，与 live 已换 `HttpReranker` **不冲突**（文件内无 `liveRetrievePorts` / 「共用 embed」表述）
  - `standard-rag.test.ts` A12 标题「independent rerank」指测试管线显式注入的 `new IndependentReranker()`，不是 live 装配；无 live 共用 embed 绿条
  - 因此 **未改测试文案、未改断言语义**
- 夹具/mock：本 Task 未新增密钥字面量。`http-rerank.test.ts` 夹具仍只用 `test-key`。未打真实网，未写入真实密钥。

### Implementation
- **无强制改文件。** 相对 `BASE_SHA=b0fec81`：
  - `git diff b0fec81 -- packages/core-engine/src/retrieve/rerank.ts packages/core-engine/src/retrieve/library.ts packages/core-engine/src/retrieve/ports.ts packages/core-engine/test/rerank.test.ts packages/core-engine/test/standard-rag.test.ts packages/core-engine/test/http-rerank.test.ts` 为空
  - `HEAD=b0fec81`（`feat(retrieve): assemble liveRetrievePorts with HttpReranker`）
- 只读确认：
  - `packages/core-engine/src/retrieve/rerank.ts`：仍是余弦 + `lexicalScore`；`void options?.llm`；`implements Reranker`；禁止 `complete()`
  - `packages/core-engine/src/retrieve/library.ts`：`defaultRetrievePorts` 仍 `rerank: partial?.rerank ?? new IndependentReranker()`；`rerankClauseHits` 仍 `await this.ports.rerank.rerank(...)`；table/annex 仍不进 candidates
  - `packages/core-engine/src/retrieve/ports.ts`：`interface Reranker { rerank(query, candidates): Promise<string[]> | string[] }` 未改
  - `packages/core-engine/src/retrieve/live-ports.ts`（只读，非本 Task 改动）：F4-3 已装配 `rerank: new HttpReranker()`，本 Task 未再改
- 编码规范：无新增/改签名公开方法，注释抽检 N/A

### APT Micro-closeout
- ContractsRegistered: 无（本 Task 无源码变更；`HttpReranker` 登记留给 Task 5）
- AssetsRefreshed: 无（未改 `rerank.ts` / `library.ts` / `http-rerank.ts` / `live-ports.ts`）
- AssetsRemoved: 无
- 禁止 `audit_arch_changes`；未手工改 `.ai/`

### FilesChanged
- 无源码 / 测试改动
- `.apt/orchestration/task-f4-4-report.md`（本 report，未纳入 commit）

### Commits
- **none**（无需改文件，禁止空 commit）
- 基线仍为 F4-3 Approved `b0fec81` `feat(retrieve): assemble liveRetrievePorts with HttpReranker`

### Blockers / Concerns
- 开始前只读 MCP：
  - `query_project_status` phase=done / loopDone=true（相位机误判，按切片 F-4 继续）；`projectType=component`
  - `query_contract` name=`IndependentReranker` 命中 `packages/core-engine/src/retrieve/rerank.ts`：余弦 + lexical；`void options?.llm`；禁止 `complete()`
  - `query_contract` name=`StandardLibrary` 命中 `packages/core-engine/src/retrieve/library.ts`：`rerankClauseHits` 已 await `ports.rerank`；table/annex 不进 candidates；`defaultRetrievePorts` 默认 `new IndependentReranker()`
  - `query_arch` path=`frontend/core-engine/util#defaultretrieveports` 命中 `library.ts` 的 `defaultRetrievePorts`（扫描摘要偏 ingest/clause_id，源码仍是默认 IndependentReranker）
- 未改 `rerank.ts` / `library.ts` / Vue / live-ports / http-rerank。未捎带工作区脏文件。
- live 精排已是 `HttpReranker`（F4-3）；CI / `defaultRetrievePorts` / A12 仍走 `IndependentReranker`，二者并存符合 R6。
- 未回显任何真实密钥。
