# Task 6 Brief — 预查询 + 检索不丢表 + 跨 pack 图（R2/R16/R20/R29）

plan: `docs/apt/plans/2026-09-15-rag-ingest-metadata-graph-plan.md`
projectType: component
review-tier: full
BASE_SHA: `f594629f36268bb9465331d784e9ee7d5aae194e`

## 步骤

- [ ] MCP：`query_contract` name=`FakePrequery`；`query_contract` name=`RetrieveHit`。禁止读 `.ai/`。
- [ ] `inferIntent`：**先**匹配 `表` / `附表` / `见表` → `intent=semantic`，不得 exact。否则「表 8.5.1-1」会被 `EXACT_RE` 收成 `8.5.1`（R20/M12）。
- [ ] `searchSemantic`：
  - 用 `payload.unit_id`（或 hit.id）→ `getLayoutUnit`；禁止只 `getClause(item.id)` 把表丢掉。
  - table → tableHits（按向量分），不进 RerankCandidate。`supported_clause_ids` 来自 `graph.queryPath(unit_id, "SUPPORTS")` 的 `to`。
  - clause → clauseHits + IndependentReranker。
  - 返回表在前（向量分高到低）再条款。
  - 表 hit：`clause_id=null`，填 unit_id/file_name/page_*/chunk_kind=table。
- [ ] `searchGraph`：用 **project** 级生效版本（当前 pack 的 project_id → listSpecPacks → 各 pack listEffectiveStandardVersions），不得只用单 pack versionIds 丢掉跨 pack 目标（R29）。`queryPath` 必须带 kind（有 toNo 走 shortestPath；fallback 从 rewritten 解析 SUPERSEDES/CITES，禁止无 kind）。
- [ ] A11–A14 仍绿。

## Files 白名单

- `packages/core-engine/src/retrieve/prequery.ts`
- `packages/core-engine/src/retrieve/library.ts`
- `packages/core-engine/test/standard-rag.test.ts`
- `packages/core-engine/test/prequery.test.ts`（可选）

不要改 attach 返回数组（Task 7）、vue、job-pipeline。

## Verify

```
npx vitest run packages/core-engine/test/standard-rag.test.ts
```

1. ingest GFM 表后 search「见表」→ chunk_kind=table 且 supported_clause_ids≥2（M3）。禁止只查 Neo4j。
2. FakePrequery().rewrite("表 8.5.1-1").intent !== "exact"（M12/R20）。
3. 同 project packA graph 命中 packB 条款（R29）。
4. 命中含 file_name + 页 + unit_id（M2）。
5. 既有 A11–A14 仍绿。

## 约束

函数 ≤80 行。公开方法注释写为什么。register_contract FakePrequery/RetrieveHit；refresh_asset。禁止 audit_arch_changes。只 commit 白名单。

## Report + commit

`.apt/orchestration/task-6-report.md`
`git commit -m "feat(retrieve): keep table hits in search and scope graph to project versions"`
