# Task 4 Report — 图端口与字典（R5/R22）

## Status
DONE

## Commits
`7da6130b6ff12434aca94fb0483918f020bb0352` feat(retrieve): upsert graph nodes by label and keep SUPERSEDES paths clean

BASE_SHA: `6cb0bd8b7756382748ee88ca3c6d9de391b85520`

未改 `ports.ts` / `library.ts` / `handle-request.ts`。未读 `.ai/`。未调用 `audit_arch_changes`。只 commit 白名单 5 文件。未 push。

## Changes
- MCP 只读：`query_arch` path=`frontend/core-engine/util#neo4jgraphstore` 命中 `packages/core-engine/src/retrieve/neo4j.ts`。`query_contract` name=`GraphStore` / `EdgeKind` 命中 `ports.ts`（`upsertNode`、PARENT_OF|BELONGS_TO|SUPPORTS 已由 Task 1 冻结）。
- `packages/core-engine/src/retrieve/neo4j.ts` + `memory-graph.ts`：`upsertNode(label, id, props)` 仅允许 `Clause`|`LayoutUnit`（其它 throw）；`upsertClause` 委托 `upsertNode("Clause", …)`。`upsertEdge` 按 kind 选端点 label MERGE（SUPPORTS：LayoutUnit→Clause；PARENT_OF 未建点则两端 Clause；BELONGS_TO 未建点则 LayoutUnit→Clause；CITES/SUPERSEDES/APPLIES_TO/REQUIRES 两端 Clause）。已 upsert 的 LayoutUnit 不会被 MERGE 成 `:Clause`。Cypher label/kind 只走 allowlist 插值。
- `queryPath(from, kind?)`：匹配 Clause|LayoutUnit（不再只 `:Clause`）。传入 kind 只返回该 kind；未传 kind 排除 PARENT_OF。
- `dicts.ts` `standard_edge_kind` 增加 SUPPORTS / PARENT_OF / BELONGS_TO。
- `session.ts` demo reset：既有 `MATCH (c:Clause) DETACH DELETE c` 外增加 `MATCH (n:LayoutUnit) DETACH DELETE n`。
- `packages/core-engine/test/graph-store.test.ts`（新）：PARENT_OF 两端 Clause；先 SUPERSEDES 再 PARENT_OF 末跳后 `queryPath(kind=SUPERSEDES)` 不含 PARENT_OF；SUPPORTS 先 upsertNode LayoutUnit 后 from 仍是 LayoutUnit。

## Tests / Verify
```
npx vitest run packages/core-engine/test/graph-store.test.ts
→ exit 0; Test Files 1 passed (1); Tests 4 passed (4) (vitest 3.2.7, 1.23s)
```

覆盖：PARENT_OF 默认两端 Clause；A13 夹具 `queryPath("2.1", "SUPERSEDES")` 只有 SUPERSEDES、无 PARENT_OF；未传 kind 也排除 PARENT_OF；SUPPORTS from=`LayoutUnit`；非法 label throw。Rn: R5/R22。

## APT Micro-closeout
- ContractsRegistered:
  - `GraphStore` → `packages/core-engine/src/retrieve/ports.ts`
  - `EdgeKind` → `packages/core-engine/src/retrieve/ports.ts`
- AssetsRefreshed:
  - `packages/core-engine/src/retrieve/neo4j.ts` → `frontend/core-engine/util/Neo4jGraphStore`（`kind=util`，`module=core-engine`，action=created）
  - `packages/core-engine/src/retrieve/memory-graph.ts` → `frontend/core-engine/util/MemoryGraphStore`（action=created）
  - `packages/core-engine/src/http/dicts.ts` → `frontend/core-engine/util/DEMO_DICTS`（action=created）
  - `packages/core-engine/src/http/session.ts` → `frontend/core-engine/util/DemoHttpSession`（action=updated）
- AssetsRemoved: none
- `audit_arch_changes`: not called

## Concerns
无。`searchGraph` 传 kind 留给 Task 6（未改 `library.ts`）。`.ai/` 索引由 MCP 更新但未进本 commit。
