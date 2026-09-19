# Task 6 Report — 预查询 + 检索不丢表 + 跨 pack 图

## Status
DONE

## Commits
`1c5411118b18d28244ce41df5577709269e5ceae` feat(retrieve): keep table hits in search and scope graph to project versions

BASE_SHA: `f594629f36268bb9465331d784e9ee7d5aae194e`

未改 `attachStandardFitFinding` 签名（仍返回单条 Finding，Task 7）。未改 vue、job-pipeline。未读 `.ai/`。未调用 `audit_arch_changes`。未提交 `.ai/`。

## Changes
- MCP 只读：`query_project_status` → `projectType=component`，无 blockers。`query_contract` name=`FakePrequery`；`query_contract` name=`RetrieveHit`。
- `packages/core-engine/src/retrieve/prequery.ts`：`inferIntent` **先**匹配 `附表|见表|表` → `intent=semantic`，避免「表 8.5.1-1」被 `EXACT_RE` 收成 exact（R20/M12）。
- `packages/core-engine/src/retrieve/library.ts`：
  - `searchSemantic` 用 `payload.unit_id`（或 hit.id）→ `getLayoutUnit`；table/annex 不进 rerank；clause 才 `IndependentReranker`；返回表在前（向量分高到低）再条款。表 hit `clause_id=null`，`supported_clause_ids` 来自 `queryPath(unit_id, "SUPPORTS")`。
  - `searchGraph` 用 `resolveProjectEffectiveVersionIds`（当前 pack 的 project_id → `listSpecPacks` → 各 pack `resolveEffectiveVersionIds`）。有 `toClauseNo` 走 `shortestPath`；fallback `queryPath` 必带 kind（从 rewritten 解析 SUPERSEDES/CITES/REQUIRES/APPLIES_TO）。
- `packages/core-engine/test/standard-rag.test.ts`：M3 见表 table hit + supported≥2；M12 表号 intent≠exact；R29 packA graph 命中 packB；命中含 file_name/页/unit_id。

## Tests / Verify
```
npx vitest run packages/core-engine/test/standard-rag.test.ts
→ exit 0; Test Files 1 passed (1); Tests 13 passed (13) (vitest 3.2.7)
```

A11–A14 仍绿。Rn: R2、R16、R20、R29。

## APT Micro-closeout
- ContractsRegistered:
  - `FakePrequery` → `packages/core-engine/src/retrieve/prequery.ts`
  - `RetrieveHit` → `packages/core-engine/src/retrieve/ports.ts`
- AssetsRefreshed:
  - `packages/core-engine/src/retrieve/prequery.ts` → `frontend/core-engine/util/FakePrequery`（`kind=util`，`module=core-engine`，action=created）
  - `packages/core-engine/src/retrieve/library.ts` → `frontend/core-engine/util/StandardLibrary`（`kind=util`，`module=core-engine`，action=created）
- `audit_arch_changes`: not called

## Concerns
- `prequery.ts` 在 BASE_SHA 上未跟踪（磁盘有、HEAD 无），本 commit 一并纳入白名单。
- `.ai/` 索引已由 MCP 更新但未进本 commit（工作区该树原先已脏）。
- `attachStandardFitFinding` 仍取 `hits[0]`；表查询若直接 attach 会因 `clause_id=null` 抛错，留给 Task 7。
