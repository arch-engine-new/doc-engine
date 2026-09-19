# Task 6 Review — 预查询 + 检索不丢表 + 跨 pack 图

review-tier: full
projectType: component（跳过 B2 `designs/v0/*/test-cases.md`；公开 export 注释抽检仍适用）
Plan: `docs/apt/plans/2026-09-15-rag-ingest-metadata-graph-plan.md` Task 6
Spec: `docs/superpowers/specs/2026-09-15-rag-ingest-metadata-graph-design.md`
Brief: `.apt/orchestration/task-6-brief.md` / `.apt/orchestration/task-6-review-brief.md`
Report: `.apt/orchestration/task-6-report.md`
Range: `f594629f36268bb9465331d784e9ee7d5aae194e..1c5411118b18d28244ce41df5577709269e5ceae`
Commit: `1c5411118b18d28244ce41df5577709269e5ceae` feat(retrieve): keep table hits in search and scope graph to project versions
Status (implementer): `DONE`

本文件覆盖原 paddleocr Task 6 评审账本（RAG ingest plan，不是 paddleocr）。

## Spec Compliance

| 检查项 | 结果 | 证据 |
|--------|------|------|
| `inferIntent` 先匹配 `表`/`附表`/`见表` → `semantic`，不得 exact | **YES** | `TABLE_RE` 在 `EXACT_RE` 之前。`FakePrequery().rewrite("表 8.5.1-1").intent !== "exact"`；`见表`/`附表` 明确 `semantic`（M12/R20） |
| `searchSemantic` 用 `payload.unit_id`（或 hit.id）→ `getLayoutUnit`，禁止只 `getClause(item.id)` | **YES** | `vectorHitUnitId` → `getLayoutUnit`。条款才 `getClause(unit.clause_id)`。无 `getClause(item.id)` |
| table → tableHits（向量分），不进 RerankCandidate；clause 才 IndependentReranker | **YES** | `classifySemanticNeighbor`：table/annex 走 `toUnitHit`；clause 才进 candidates。`rerankClauseHits` 只 rerank 条款。返回 `[...scoredTables.sort(desc), ...clauseHits]` |
| 表 hit：`clause_id=null`，填 unit_id / file_name / page_* / chunk_kind=table；`supported_clause_ids` 来自 `queryPath(unit_id, "SUPPORTS")` 的 `to` | **YES** | `toUnitHit`；`supportedClauseIds` map `edge.to`。M3：见表首击 table、`clause_id` null、`supported_clause_ids` 含 1.1 与 2.1（≥2）。经 `searchStandard`，不是只查 Neo4j |
| `searchGraph` 用 **project** 级生效版本，不得只用单 pack | **YES** | `resolveProjectEffectiveVersionIds`：当前 pack `project_id` → `listSpecPacks` → 各 pack `resolveEffectiveVersionIds`。exact/semantic 仍用调用方 pack。R29：packA `1.1引用哪条` graph 命中 packB 2.1 |
| `queryPath` 必须带 kind（有 toNo 走 shortestPath；fallback 从 rewritten 解析 SUPERSEDES/CITES） | **YES** | 有 `toClauseNo` → `shortestPath`。空路径 fallback `queryPath(from, inferGraphKind(rewritten))`，默认 CITES。注释写明无 kind 会让 PARENT_OF 偷走 A13。A13 仍绿 |
| 命中含 file_name + 页 + unit_id（M2） | **YES** | M3 表 hit：`file_name=leave.md`，页 1/1，unit_id=表 layout unit。R29 graph hit：`pack-b.md` + 页 + unit_id |
| A11–A14 仍绿 | **YES** | 审查方复跑 `npx vitest run packages/core-engine/test/standard-rag.test.ts` → exit 0；Test Files 1 passed；Tests **13 passed**（vitest 3.2.7，342ms）。含既有 A11–A14 + Task 5 layout + 3 条 Task 6 |
| 公开方法有「为什么」注释；函数体 ≤80 行 | **YES** | 见 Quality。最长新增体：`searchStandard` ~30 行、`searchGraph` ~24 行、`classifySemanticNeighbor` 体 ~20 行、`inferIntent` ~16 行 |
| 白名单；未改 attach 返回数组 / vue / job-pipeline | **YES** | diff 仅 `prequery.ts`（新）、`library.ts`、`standard-rag.test.ts`。`attachStandardFitFinding` 仍 `Promise<FindingRow>` 且 `hits[0]`（Task 7） |
| parent SHA = BASE_SHA | **YES** | `1c54111` 的 parent 即 `f594629` |
| component：跳过 test-cases.md | **YES** | 未查 `designs/v0` |

无 Missing / Extra / Misunderstood（相对本 Task brief / plan Task 6）。`attachStandardFitFinding` 仍单条 Finding 属 Task 7，report 已披露。

## Quality

**公开 export 注释抽检：Approved**

对照 diff，新增/签名变更的公开面均有「为什么」，不是 `// set x`：

- `FakePrequery`：确定性测试替身；map 覆盖优先，不得当 rerank 分数。
- `FakePrequery.rewrite`：map 赢是为了钉 A12 释义；未映射表题保持 semantic。
- `ZhipuPrequery`：生产 prequery 薄封装，不是 reranker。
- `resolveProjectEffectiveVersionIds`：兄弟 pack 里的 CITES/SUPERSEDES 目标，单 pack versionIds 会丢（R29）。
- `searchStandard`：图检索用项目级生效版本；exact/semantic 仍用调用方 pack。
- `toHit` / `toUnitHit`：缺 provenance 则 citation UI 无法展示；表/annex 必须 `clause_id=null`，避免 attach 把 unit 当条款。
- `inferGraphKind`：无 kind 的 `queryPath` 会让 PARENT_OF 偷走 A13。

TS 方法均有明确 return type；命名 camelCase / PascalCase 符合 `.apt/code-standards.md`。函数体均远小于 80。

**白名单 / 密钥：** 本 commit 3 文件均在白名单。未含 `.ai/`、`.env`、token。未改 vue、job-pipeline、attach 签名。`prequery.ts` 在 BASE_SHA 未跟踪，本 commit 纳入白名单（report 已披露）。

**微闭环（工作区，未进本 commit）：** `query_contract` `FakePrequery` → `prequery.ts`（表题不得被 EXACT_RE 收成 exact）。`query_contract` `RetrieveHit` → `ports.ts`（表/annex `clause_id` null）。`query_arch` `frontend/core-engine/util#fakeprequery` / `#standardlibrary` → Source=`refresh`，路径分别为 `prequery.ts` / `library.ts`。`audit_arch_changes` 未调用（brief 禁止）。`.ai/` 未进 commit。

**测试用例：** component → 跳过 `test-cases.md`。单测用 MemoryGraphStore / MemoryVectorStore + `FakePrequery()`（无 map）。覆盖：ingest GFM 后 `searchStandard("见表")` 走出向量+layout 而非只查 Neo4j；表号 intent≠exact；同 project packA graph 命中 packB。不是 tautology。

## Issues

**blocking：** 无（0）

**nit：**

- `ZhipuPrequery.rewrite` 在 LLM JSON 解析成功后不二次套 `TABLE_RE`；仅失败才 `inferIntent`。本切片 Verify 走 `FakePrequery`，不阻断。
- `classifySemanticNeighbor` 把 annex 与 table 同路径、不进 rerank。brief 只钉 table；合理扩展。
- `rerankClauseHits` 返回 rerank 全序列，不再每 version 只取 top-1。plan 要求混合 hits；A12 仍断言 `[0]`。
- `attachStandardFitFinding` 仍取 `hits[0]`；表查询若直接 attach 会因 `clause_id=null` 抛错（Task 7，report 已披露）。
- `.ai/` 契约/资产更新未进本 commit。`refresh_asset` 摘要偏泛（FakePrequery / StandardLibrary 的 How to use 为「暂无」）。
- plan Task 6 Contracts 另列 `IndependentReranker`；brief 只要求 FakePrequery/RetrieveHit。`IndependentReranker` 契约已在 `rerank.ts`，本切片未改。

## Assessment

**PASS**

Spec ✅（见表→semantic，表号≠exact；`getLayoutUnit` 不丢表；table 不 rerank；表 hit `clause_id=null` 且 SUPPORTS≥2；graph 用 project 级版本；`queryPath` 必带 kind；A11–A14 仍绿）。Quality Approved（公开方法有「为什么」注释；函数体均远小于 80）。Verify 复跑 13 passed。白名单 3 文件，parent=BASE_SHA。无 blocking issues。
