# Task 7 Review — 符合度 N 条 Finding（R6/R19/R27）

review-tier: full
projectType: component（跳过 B2 `designs/v0/*/test-cases.md`；公开 export 注释抽检仍适用）
Plan: `docs/apt/plans/2026-09-15-rag-ingest-metadata-graph-plan.md` Task 7
Spec: `docs/superpowers/specs/2026-09-15-rag-ingest-metadata-graph-design.md`
Brief: `.apt/orchestration/task-7-brief.md` / `.apt/orchestration/task-7-review-brief.md`
Report: `.apt/orchestration/task-7-report.md`
Range: `1c5411118b18d28244ce41df5577709269e5ceae..824e49ec0ab09a7d2601a74db23c2a626206e6bc`
Commit: `824e49ec0ab09a7d2601a74db23c2a626206e6bc` feat(retrieve): expand table hits into multiple grounded findings
Status (implementer): `DONE`

本文件覆盖原 paddleocr Task 7 评审账本（RAG ingest plan，不是 paddleocr）。

## Spec Compliance

| 检查项 | 结果 | 证据 |
|--------|------|------|
| `attachHit` 拒表 id：`chunk_kind=table\|annex` **或** `clause_id` 等于非 clause layout unit；文案含 table/unit | **YES** | `assertClauseHitAttachable`：table/annex 抛 `cannot attach table/annex unit as clause_id: ${unit_id}`；`getLayoutUnit(clause_id)` 且 `chunk_kind≠clause` 同样抛。Finding 只写 `clause.clause_id` |
| `attachStandardFitFinding` → `Promise<FindingRow[]>` | **YES** | `StandardLibrary` 与 `JobPipeline` 包装均返回数组。无 tableHits 则首条 clause hit 包成 `[row]` |
| tableHits 取最高分一张，展开 `supported_clause_ids` ≤20，每条 `detail.source` 同源 | **YES** | `hits.find(chunk_kind===table)`（`searchSemantic` 表已按向量分在前）。`MAX_TABLE_FIT_FINDINGS=20`。`tableFindingSource` 填 unit_id/file_name/page_start/page_end/heading。M13 断言同源 |
| 无 tableHits 用首条 clause；无命中 throw `no retrieve hit` | **YES** | clause 缺失同样 throw。pipeline `tryAttachStandardFit` catch，不编造 clause_id |
| `tryAttachStandardFit` `push(...rows)` | **YES** | `findings.push(...rows)`。包装 `attachStandardFitFinding` 返回数组 |
| Job 4MB 未放宽 | **YES** | `MAX_UPLOAD_BYTES = 4 * 1024 * 1024` 未改；`openUploadJob` 仍闸门。upload-ocr `>4MB` 仍拒且不 insert job |
| A11 改为 `findings[0]` | **YES** | `expect(findings).toHaveLength(1)` 后 `findings[0]`。A12–A14 仍绿 |
| M4：table `unit_id` 调 `attachHit` 必抛 | **YES** | 用 ingest 后真实 table unit，spoof `chunk_kind=clause`，`rejects.toThrow(/table\|unit/i)` |
| M13：ingest GFM 表后「见表」attach，`length>=2`，clause_id 互异且 `getClause` 命中；禁止合成 tableHit | **YES** | `attachStandardFitFinding({ query: "见表" })` 经 search，未手造 tableHit |
| 公开方法有「为什么」注释；函数体 ≤80 行 | **YES** | 见 Quality |
| 白名单；parent SHA = BASE_SHA | **YES** | 3 文件：`library.ts`、`job-pipeline.ts`、`standard-rag.test.ts`。parent=`1c54111` |
| component：跳过 test-cases.md | **YES** | 未查 `designs/v0` |

无 Missing / Extra / Misunderstood（相对本 Task brief / plan Task 7）。表命中但 `supported_clause_ids` 为空返回 `[]`（不编造）属 nit，report 已披露。

## Quality

**公开 export 注释抽检：Approved**

对照 diff，新增/签名变更的公开面均有「为什么」，不是 `// set x`：

- `attachStandardFitFinding`：表命中是 1:N；只写 `hits[0]` 会丢掉已 grounding 的 SUPPORTS 条款。
- `attachHit`：`Finding.clause_id` 必须是 `t_clause`；表/annex unit 是 provenance，不是条款。
- `JobPipeline.attachStandardFitFinding`：展开表支撑行；Job `MAX_UPLOAD_BYTES` 仍 4MB。

TS 方法均有明确 return type；命名 camelCase / PascalCase 符合 `.apt/code-standards.md`。函数体均远小于 80（`attachHit` ~50 行、`attachStandardFitFinding` ~25 行、`tryAttachStandardFit` ~20 行、`attachTableSupportedFindings` ~18 行）。

**白名单 / 密钥：** 本 commit 3 文件均在白名单。未含 `.ai/`、`.env`、token。未改 9 页、未读 `rules/`。工作区 `job-pipeline.ts` 另有未提交 doc-type WIP（report 已披露）；本 SHA 只纳入 `push(...rows)` 与返回数组包装。

**微闭环（工作区，未进本 commit）：** `query_contract` `StandardLibrary` → `library.ts`（attach 拒表 id；返回 `FindingRow[]`，表展开 ≤20）。`query_contract` `FindingRow` → `docs/schema/generated/core-engine-rows.ts`（一行一个 clause_id；表 fit 展开为数组）。`audit_arch_changes` 未调用（brief 禁止）。`.ai/` 未进 commit。

**测试用例：** component → 跳过 `test-cases.md`。M4 用真实 table unit_id，不是 tautology。M13 经 `searchStandard`/`attachStandardFitFinding`，未合成 tableHit。

## Verify

审查方复跑：

```
npx vitest run packages/core-engine/test/standard-rag.test.ts packages/core-engine/test/upload-ocr.test.ts
```

→ exit 0；Test Files **2 passed** (2)；Tests **22 passed** (22)（vitest 3.2.7）。

- `standard-rag.test.ts` 15 passed（含 A11–A14、M4、M13）
- `upload-ocr.test.ts` 7 passed（无 hit 跳过仍绿；`>4MB` 仍拒）

Rn: R6、R19、R27。

## Issues

**blocking：** 无（0）

**nit：**

- 表命中但 `supported_clause_ids` 为空时返回 `[]`，pipeline catch 不触发。brief 要求不编造 clause_id；未要求回落到 clauseHits[0]。report 已披露。
- M4 测 spoof `chunk_kind=clause` + table unit_id（layout unit 闸门）；未另测裸 `chunk_kind=table`。两条路径源码均在。
- M13 查询用「见表」而非表题；brief 允许二者之一。plan 写 VL 表，brief 允许 GFM/VL；本切片用 GFM 夹具，与 Task 5/6 一致。
- 工作区 `job-pipeline.ts` 在 BASE/本 SHA 上另有 doc-type 等未提交改动；审查复跑走工作树，Task 7 断言仍绿。
- `.ai/` 契约/资产更新未进本 commit。

## Assessment

**PASS**
