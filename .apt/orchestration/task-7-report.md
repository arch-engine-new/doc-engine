# Task 7 Report — 符合度 N 条 Finding（R6/R19/R27）

## Status
DONE

## Commits
`824e49ec0ab09a7d2601a74db23c2a626206e6bc` feat(retrieve): expand table hits into multiple grounded findings

BASE_SHA: `1c5411118b18d28244ce41df5577709269e5ceae`

未读 `.ai/`。未调用 `audit_arch_changes`。未提交 `.ai/`。Job `MAX_UPLOAD_BYTES` 仍为 4MB。未 push。

## Changes
- MCP 只读：`query_project_status` → `projectType=component`，无 blockers。`query_contract` name=`StandardLibrary`；`query_contract` name=`FindingRow`。
- `packages/core-engine/src/retrieve/library.ts`：
  - `attachHit` 在写入前拒 `chunk_kind=table|annex`，以及 `clause_id` 指向非 clause layout unit（`getLayoutUnit` 且 `chunk_kind≠clause`）。文案含 `table`/`unit`。表 id 不会写入 `Finding.clause_id`。
  - `attachStandardFitFinding` → `Promise<FindingRow[]>`：`searchStandard` 后取首张 tableHit（向量分已在前），对 `supported_clause_ids` 构造 clause hit 再 `attachHit`（上限 20），每条 `detail.source` 同源表（unit_id/file_name/page_start/page_end/heading）。无 tableHits 则首条 clause hit 写 1 条。无命中仍 throw `no retrieve hit`。
- `packages/core-engine/src/pipeline/job-pipeline.ts`：`tryAttachStandardFit` 改为 `push(...rows)`；包装方法返回数组。未改 4MB 闸门。
- `packages/core-engine/test/standard-rag.test.ts`：A11 改为 `findings[0]`；M4 用 table `unit_id` 调 `attachHit` 必抛；M13 ingest GFM 表后对「见表」attach，`length>=2`，clause_id 互异且 `getClause` 均命中（经 search，未合成 tableHit）。

## Tests / Verify
```
npx vitest run packages/core-engine/test/standard-rag.test.ts packages/core-engine/test/upload-ocr.test.ts
→ exit 0; Test Files 2 passed (2); Tests 22 passed (22) (vitest 3.2.7)
  standard-rag.test.ts 15 passed（含 M4/M13；A11–A14 仍绿）
  upload-ocr.test.ts 7 passed（无 hit 跳过仍绿；>4MB 仍拒）
```

Rn: R6、R19、R27。

## APT Micro-closeout
- ContractsRegistered:
  - `StandardLibrary` → `packages/core-engine/src/retrieve/library.ts`
  - `FindingRow` → `docs/schema/generated/core-engine-rows.ts`
- AssetsRefreshed:
  - `packages/core-engine/src/retrieve/library.ts` → `frontend/core-engine/util/StandardLibrary`（`kind=util`，`module=core-engine`，action=created）
  - `packages/core-engine/src/pipeline/job-pipeline.ts` → `frontend/core-engine/util/JobPipeline`（`kind=util`，`module=core-engine`，action=created）
- `audit_arch_changes`: not called

## Concerns
- 工作区 `job-pipeline.ts` 在 BASE 上另有未提交的 doc-type 等改动；本 commit 只纳入 Task 7 的 `push(...rows)` 与返回数组包装，其余 WIP 未进本 SHA。
- `.ai/` 索引已由 MCP 更新但未进本 commit。
- 表命中但 `supported_clause_ids` 为空时返回 `[]`（不编造 clause_id），pipeline catch 不触发。
