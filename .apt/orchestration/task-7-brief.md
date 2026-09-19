# Task 7 Brief — 符合度 N 条 Finding（R6/R19/R27）

plan: `docs/apt/plans/2026-09-15-rag-ingest-metadata-graph-plan.md`
projectType: component
BASE_SHA: `1c5411118b18d28244ce41df5577709269e5ceae`

## 步骤

- [ ] MCP：`query_contract` name=`StandardLibrary`；`query_contract` name=`FindingRow`。禁止读 `.ai/`。
- [ ] `attachHit`：`chunk_kind=table|annex` **或** `clause_id` 等于某 table `unit_id`（getLayoutUnit 且 chunk_kind≠clause）必抛，文案含 table/unit（M4）。不得把表 id 写入 `Finding.clause_id`。
- [ ] `attachStandardFitFinding` → `Promise<FindingRow[]>`：
  - `searchStandard` 后若存在 tableHits（chunk_kind=table），取**向量分最高**的一张（hits 里表已按分在前，取首张 table 即可）。
  - 对该表 `supported_clause_ids` 逐条构造 **clause** hit 再 `attachHit`（上限 20）。每条 `detail` 含同一 `source`（该表 unit_id/file_name/page_start/page_end/heading）。
  - 无 tableHits 则用首条 clause hit 写 1 条。无命中仍 throw `no retrieve hit`（pipeline catch，不编造）。
- [ ] `JobPipeline.tryAttachStandardFit`：`push(...rows)`。`attachStandardFitFinding` 包装返回数组。Job **4MB 不放宽**。
- [ ] 更新 `standard-rag.test.ts`：A11 单条改为 `findings[0]`；M4 用 table unit_id 调 attachHit 必抛；M13 ingest GFM/VL 表后对「见表」或表题 attach，`length>=2`，clause_id 互异且 `getClause` 均命中。禁止测试里合成 tableHit 绕过 search。

## Files 白名单

- `packages/core-engine/src/retrieve/library.ts`
- `packages/core-engine/src/pipeline/job-pipeline.ts`
- `packages/core-engine/test/standard-rag.test.ts`

## Verify

```
npx vitest run packages/core-engine/test/standard-rag.test.ts packages/core-engine/test/upload-ocr.test.ts
```

A11–A14、upload-ocr 无 hit 跳过仍绿；M4/M13 新断言。MAX_UPLOAD_BYTES 仍 4MB。

## 约束

函数 ≤80 行。公开方法注释写为什么。register_contract FindingRow / StandardLibrary；refresh_asset。禁止 audit_arch_changes。只 commit 白名单。

## Report + commit

`.apt/orchestration/task-7-report.md`
`git commit -m "feat(retrieve): expand table hits into multiple grounded findings"`
