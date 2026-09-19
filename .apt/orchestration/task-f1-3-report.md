## Task F-1-3 Report
**Status:** DONE_WITH_CONCERNS
### Tests
- Command: `npx vitest run test/standard-lib-hit-detail.test.ts test/standard-lib-stepchat.test.ts`（cwd: `packages/core-engine`）。
- TDD RED（只加 `standard-lib-hit-detail.test.ts`、未改 Vue）：`Test Files  1 failed (1)` / `Tests  3 failed | 3 passed (6)`。Duration 1.43s。五列出处与 `clauseLabel` 已绿。失败断言：

```
FAIL  row click emits select
AssertionError: expected table source to match /@click/

FAIL  HitDetailPanel exists and shows heading and body with empty fallbacks
AssertionError: expected false to be true  (HitDetailPanel.vue missing)

FAIL  index wires HitDetailPanel closed until a row is selected
AssertionError: expected index.vue to contain 'HitDetailPanel'
```

- TDD GREEN：行 `@click` emit `select`；`HitDetailPanel` 用 `section.card` 展示 heading/body（空则「无标题」「无正文」）；`index.vue` `v-if="selectedHit"` 未选中 closed，检索后清空选中；`<StepChat` 仍按 packId 挂载。出处五列不变、无全文 `<th>`。`index.vue` 300 行。`Test Files  2 passed (2)` / `Tests  17 passed (17)`。Duration 6.59s。
### APT Micro-closeout
- ContractsRegistered: `RetrieveHitView`（字段演进：可选 heading/body；`tsFilePath=apps/web/src/services/types.ts`；MCP `register_contract` 返回 Contract registered）。`query_contract RetrieveHitView` 开始前未命中。
- AssetsRefreshed: `apps/web/src/services/types.ts`（MCP `refresh_asset` → `frontend/apps/util/types` action=created）；`apps/web/src/views/standard_lib/index.vue`（→ `frontend/apps/component/index` action=updated）；`apps/web/src/views/standard_lib/RetrieveHitsTable.vue`（→ `frontend/apps/component/RetrieveHitsTable` action=created）；`apps/web/src/views/standard_lib/HitDetailPanel.vue`（→ `frontend/apps/component/HitDetailPanel` action=created）。
- AssetsRemoved: 无
- 禁止 `audit_arch_changes`；未手工改 `.ai/`。
### FilesChanged
- `apps/web/src/services/types.ts`
- `apps/web/src/views/standard_lib/RetrieveHitsTable.vue`
- `apps/web/src/views/standard_lib/HitDetailPanel.vue`
- `apps/web/src/views/standard_lib/index.vue`
- `packages/core-engine/test/standard-lib-hit-detail.test.ts`
- `designs/v0/standard_lib/test-cases.md`
- `.apt/orchestration/task-f1-3-report.md`
### Commits
- `feat(standard-lib): open retrieve hit detail with heading and body`（仅白名单；未 push）
### Blockers / Concerns
- 开始前只读 MCP：`query_design page=standard_lib` 的 logicMarkdown 仍落后于磁盘（无 `openHitDetail`）；`query_design scope=global` 为 apt-skyline-clean / `--apt-*` / 禁止新 hex；DataTable=`table`；WorkbenchCard=`section.card`；`query_arch frontend/web/component#retrievehitstable` 当时无 click。UI 以磁盘 `page.logic.md` 的 `openHitDetail` 为准，未改该文件。
- `refresh_asset` 写入 `frontend/apps/...`，未覆盖既有 `frontend/web` 条目（同 Task 1/2）。`register_contract` 可能改了 `.ai/` INDEX，未纳入本 commit。禁止 audit，未手工改索引。
- 未改其它 8 页、StepChat.vue、goal.md、检索算法、page.logic.md。颜色只用现有 `card` / `clickable` / `is-selected`（`--apt-surface`）。
