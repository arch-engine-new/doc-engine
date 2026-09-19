# Task 10 Report — A11–A16 与 Job 回归

## Status
DONE

## Commits
none

BASE_SHA: `7d9effaef6dea0817569e1ad3bba3e8486d644cf`  
HEAD: `7d9effaef6dea0817569e1ad3bba3e8486d644cf`（与 BASE 相同，无本 Task 提交）

未读 `.ai/`。未调用 `audit_arch_changes`。未改 library/pipeline 生产代码。未改测试夹具。未写公路 seed。未 push。Job `MAX_UPLOAD_BYTES` 仍为 4MB。

## Changes
无代码改动。回归全绿，RetrieveHit 新字段夹具无需修补。

MCP 只读：
- `query_project_status` → `projectType=component`，无 blockers。
- `query_contract` name=`JobPipeline` → `packages/core-engine/src/pipeline/job-pipeline.ts`（`MAX_UPLOAD_BYTES = 4 * 1024 * 1024`；`validateUploadInput` 超限抛 `UploadValidationError`；`tryAttachStandardFit` 无命中 skip、不发明 `clause_id`）。
- `query_contract` name=`StandardLibrary` → `packages/core-engine/src/retrieve/library.ts`（`attachHit` 要求 `t_clause` 行；table/annex 不可写入 `Finding.clause_id`；`createSearchClauseToolHandler` 只 search）。

核对（测试断言，非生产改动）：
- A11：ingest 后 `getClause(finding.clause_id)` 命中；伪造 `invented-999` / 「第999条」拒绝。
- A12：两释义同一 `clause_id`（vector）。
- A13：`queryPath` 返回 SUPERSEDES，命中已入库条款。
- A14：revoked/superseded 拒绝 search/attach。
- A15：`appendChat` 在 `standard_lib` / `check_findings` / `audit_trace` 落库。
- A16：对话不消 blocking、不 publish、不发明 `clause_id`、不开 Receipt。
- Job >4MB：`UploadValidationError` 且不 `insertJob`。
- `search_clause`：ingest 后引用真实 `clause_id`；未 ingest 不发明、不 attach Finding。

## Tests / Verify
```
npx vitest run packages/core-engine/test/standard-rag.test.ts packages/core-engine/test/upload-ocr.test.ts packages/core-engine/test/agent-native-graph.test.ts
→ exit 0; Test Files 3 passed (3); Tests 24 passed (24) (vitest 3.2.7)
  standard-rag.test.ts 15 passed
  upload-ocr.test.ts 7 passed（>4MB 仍拒；无 retrieve hit 不发明 clause_id）
  agent-native-graph.test.ts 2 passed（search_clause 不发明条款号）
```

Rn: R6、R10 回归（plan Task 10）。A11–A16 仍绿。

## APT Micro-closeout
- ContractsRegistered: none（无新 TS 类型 / 无生产改动）
- AssetsRefreshed: none
- `audit_arch_changes`: not called（brief 禁止）

## Concerns
- 工作区 `packages/core-engine/src` 另有与本 Task 无关的脏文件（如 `review.ts` modified、若干 untracked agent/extract 文件）。本 Task 未触碰、未纳入提交。
- `.ai/` 未读、未提交。
