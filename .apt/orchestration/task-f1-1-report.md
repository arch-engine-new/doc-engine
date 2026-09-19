## Task F-1-1 Report
**Status:** DONE_WITH_CONCERNS
### Tests
- Command: `npx vitest run test/standard-rag.test.ts`（cwd: `packages/core-engine`）。
- TDD RED（只改测试、未改 ports/library）：`Test Files  1 failed (1)` / `Tests  2 failed | 13 passed (15)`。Duration 9.64s。失败断言：

```
FAIL  test/standard-rag.test.ts > SLICE-6 standard RAG > A11 ingest by heading; attach finding only from retrieve; invented clause_id rejected
AssertionError: the given combination of arguments (undefined and string) is invalid for this assertion.
 ❯ test/standard-rag.test.ts:115:30
     expect(hits[0]?.heading).toContain("1.1 事假须提前申请");

FAIL  test/standard-rag.test.ts > layout ingest SUPPORTS / CITES > search 见表 keeps table hit with SUPPORTS clause ids (M3)
AssertionError: expected undefined to be 'table'
 ❯ test/standard-rag.test.ts:401:31
     expect(tableHit?.heading).toBe(tableUnit?.heading);
```

  `hits[0].heading` / `tableHit.heading` 均为 `undefined`（尚未从账本抄入）。
- TDD GREEN：`RetrieveHit` 增加可选 `heading`/`body`；`toHit` 抄 `clause.heading`/`clause.body`；`toUnitHit` 抄 `unit.heading`/`unit.body_markdown`（table/annex 仍 `clause_id: null`）。`Test Files  1 passed (1)` / `Tests  15 passed (15)`。Duration 6.56s。
### APT Micro-closeout
- ContractsRegistered: `RetrieveHit`（字段演进：可选 heading/body；`tsFilePath=packages/core-engine/src/retrieve/ports.ts`；MCP `register_contract` 返回 Contract updated）。
- AssetsRefreshed: `packages/core-engine/src/retrieve/ports.ts`（MCP `refresh_asset` → `frontend/packages/util/ports` action=created）；`packages/core-engine/src/retrieve/library.ts`（→ `frontend/packages/util/library` action=created）。
- AssetsRemoved: 无
- 禁止 `audit_arch_changes`；未手工改 `.ai/`。
### FilesChanged
- `packages/core-engine/src/retrieve/ports.ts`
- `packages/core-engine/src/retrieve/library.ts`
- `packages/core-engine/test/standard-rag.test.ts`
- `.apt/orchestration/task-f1-1-report.md`
### Commits
- `feat(retrieve): hydrate RetrieveHit heading and body from ledger`（仅白名单 4 文件；待本步 git commit）
### Blockers / Concerns
- 开始前只读 MCP：`query_contract RetrieveHit` 无 heading/body；`ClauseRow` 已有 `heading`/`body`；`LayoutUnitRow` 已有 `heading`/`body_markdown`；`StandardLibrary` 的 `toHit`/`toUnitHit` 当时只抄 provenance。
- `refresh_asset` 新建 `frontend/packages/util/ports` 与 `frontend/packages/util/library`，未覆盖既有 `frontend/core-engine` 条目。禁止 audit，未手工改索引。
- 未改 prequery/rerank/search 路由、其它页面、goal.md。空 body 如实带回，未编造。
