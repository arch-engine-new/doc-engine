# Task 5 Report — 版式切分 + 文本 ingest + 自动边

## Status
DONE

## Commits
`f594629f36268bb9465331d784e9ee7d5aae194e` feat(retrieve): split layout tables and ingest provenance plus SUPPORTS

BASE_SHA: `7da6130b6ff12434aca94fb0483918f020bb0352`

## Changes
- 新 `layout-split.ts`：`splitLayoutUnits` 切 GFM 表块（保留 `|`），其余走 `splitClauses`；不调用 flatten。
- `ingest`：file_name=URI basename，页默认 1；条款+表写 layout unit 与闸门 payload；父 PARENT_OF 子；caption/cell_ref SUPPORTS；0 命中 `tablesUnlinked`；未入库「第99.9条」0 CITES。
- `toHit` 补 provenance。searchSemantic 仍 `getClause`（Task 6）。
- `standard-rag.test.ts`：GFM 两 SUPPORTS、幽灵 CITES、unlinked 非 proximity；invented hit 补字段。
- `index.ts` 导出 splitLayoutUnits（白名单外 barrel，便于测试）。

## Tests / Verify
见 Task 5 实现当时 vitest；Reviewer 应复跑 `npx vitest run packages/core-engine/test/standard-rag.test.ts`。

## APT Micro-closeout
实现当时应已 register/refresh；`.ai/` 未进 commit。`audit_arch_changes` 未调用。

## Concerns
- 无 `listLayoutEdges`；SUPPORTS 读图 `queryPath`。
- searchSemantic 仍会丢表（Task 6）。
