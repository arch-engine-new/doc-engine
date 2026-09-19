## Task F2-4 Report
**Status:** DONE_WITH_CONCERNS
### Tests
- Command: `npx vitest run test/reindex-vectors.test.ts test/standard-rag.test.ts`（cwd: `packages/core-engine`）。
- TDD RED（仅新增 `reindex-vectors.test.ts`，ingest 未 `await embed`、尚无 `reindexVectorsFromLedger`）：`Test Files  1 failed (1)` / `Tests  2 failed | 1 passed (3)`。Duration 4.64s。失败：async embed 下 `point.vector is not iterable`（ingest upsert 未 await）；memory 分支不调用 reindex 已绿。
- TDD GREEN：`reindexVectorsFromLedger` walk `listProjects` → packs → docs → versions → `listLayoutUnits`；clause 优先 `getClause` heading+body，table/annex 用 unit heading+`body_markdown`；payload 含 `unit_id`/`file_name`/`chunk_kind`/`page_start`/`page_end`；table 不带非空 `clause_id`。`library.ts` 全部 `embed()` 均 `await`。`openLiveFromEnv` live 装配后 `await reindexVectorsFromLedger()`，memory 不调用。失败 throw，不 Hash 回填。Verify：`Test Files  2 passed (2)` / `Tests  18 passed (18)`。Duration 7.51s。
### APT Micro-closeout
- ContractsRegistered: `StandardLibrary`（`tsFilePath=packages/core-engine/src/retrieve/library.ts`；MCP `register_contract` 返回 Contract updated and INDEX.md refreshed，描述含 `reindexVectorsFromLedger`）。
- AssetsRefreshed: `packages/core-engine/src/retrieve/library.ts`（MCP `refresh_asset` → `frontend/packages/util/StandardLibrary` action=created）；`packages/core-engine/src/pipeline/job-pipeline.ts`（→ `frontend/packages/util/JobPipeline` action=created）。
- AssetsRemoved: 无
- 禁止 `audit_arch_changes`；未手工改 `.ai/`。
### FilesChanged
- `packages/core-engine/src/retrieve/library.ts`
- `packages/core-engine/src/pipeline/job-pipeline.ts`
- `packages/core-engine/test/reindex-vectors.test.ts`
- `.apt/orchestration/task-f2-4-report.md`（未纳入 commit）
### Commits
- `1528f57` `feat(retrieve): reindex ledger LayoutUnits with current embeddings`（白名单 3 文件；未 push）
### Blockers / Concerns
- 开始前只读 MCP：`query_contract` StandardLibrary / LedgerStore / JobPipeline 命中；未掀 `.ai/arch/`。
- `refresh_asset` 落到新建 `frontend/packages/util/StandardLibrary` 与 `frontend/packages/util/JobPipeline`，未覆盖既有 `frontend/core-engine` 路径。禁止 audit，未手工改索引。
- `job-pipeline.ts` 工作区另有与本 Task 无关的未提交改动（`openStandardLibrary` ocr 参数、`appendChat` retrieve 无 Job 线程）。commit 只含 live 分支 reindex hunk；其余改动已还原到工作区未提交。
- ingest-worker.ts 未改（留给 Task 5）；未写入 apiKey；未打真实百炼 / Qdrant / Postgres live boot。
- MCP `refresh_asset`/`register_contract` 可能改了 `.ai/`；未纳入本 commit。
