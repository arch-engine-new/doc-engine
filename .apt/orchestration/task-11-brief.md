# Task 11 Brief — refine 标准库页 + UI（R2/R25）

plan: `docs/apt/plans/2026-09-15-rag-ingest-metadata-graph-plan.md`
projectType: component
BASE_SHA: `7d9effaef6dea0817569e1ad3bba3e8486d644cf`

## 顺序（硬门禁）

1. **先 MCP**：`query_design` page=`standard_lib`；`query_design` scope=`global`。禁止读 `.ai/` 猜样式。
2. **先改设计、禁止先改 vue**：更新 `designs/v0/standard_lib/page.logic.md`：uploadDoc/PDF、页码列、`chunk_kind`、tableHits、`tables_unlinked`、ingest tick 状态（pending/ok/ocr_error/index_error）、命中 `file_name`+页+`unit_id`、表 `clause_id` 显示为 —。边类型含 SUPPORTS/PARENT_OF/BELONGS_TO。无公路预置。
3. `designs/v0/_pages.md`：**仅** `standard_lib` 行 `approved=no`（重新打开设计闸）。
4. **然后**才改 vue / types。

不要调用 `generate_prd` / `generate_frontend_project`（会覆盖整站原型）。本 plan 已批准 UI 范围，refine 交付物就是 logic + `_pages.md`，不是 Phase 0 停等。

## Vue

- `RetrieveHitView` 增加 `unit_id`、`chunk_kind`、`file_name`、`page_start`、`page_end`、`supported_clause_ids?`；`clause_id: string | null`。
- PDF `<input type="file" accept="application/pdf">` → `POST /api/standards/ingest-pdf`（FormData: file, packId, title）收 202 + ingest_run_id。
- 「处理一页」→ `POST /api/standards/ingest-runs/:id/tick`，用现有 `.tag` 显示页 status（StatusTag 组件若不存在则用 `.tag`，不要新建组件库）。
- 检索表列：file_name、页、unit_id、clause_id（表显示 —）、路径。
- 保留 JSON textarea 夹具入库。
- 颜色只用 `--apt-*`。按钮/卡片沿用本页已有 `.btn` `.card`（仓库无 PrimaryButton/DataTable 组件）。
- 无「公路」「JTG」预置文案。
- 一个文件一个组件；本页 ≤300 行，超则拆子组件仍放 `views/standard_lib/`。

允许改 `apps/web/src/services/http.ts` 增加 ingestPdf/tick 辅助（multipart）。

## Files 白名单

- `designs/v0/standard_lib/page.logic.md`
- `designs/v0/_pages.md`
- `apps/web/src/views/standard_lib/index.vue`
- `apps/web/src/views/standard_lib/*`（仅当拆子组件）
- `apps/web/src/services/types.ts`
- `apps/web/src/services/http.ts`（仅 multipart 辅助）

## Verify

- logic 含 uploadDoc、页码、tick、tableHits、tables_unlinked
- vue 含 file input 与页列
- rg 无公路/JTG 预置
- 若无浏览器：在 report Concerns 写明未做 E2E 点击

## 约束

register_contract RetrieveHit；refresh_asset 改动源。禁止 audit_arch_changes。

## Report + commit

`.apt/orchestration/task-11-report.md`
`git commit -m "feat(web): show provenance and PDF tick ingest on standard library"`
