# Task 11 Report — refine 标准库页 + UI（R2/R25）

## Status
DONE

## Commits
`08657a3533b6564a00514641ff466d4e73b9c7de` feat(web): show provenance and PDF tick ingest on standard library

BASE_SHA: `7d9effaef6dea0817569e1ad3bba3e8486d644cf`

未读 `.ai/` 猜样式。先 `query_design`（page=`standard_lib`、scope=`global`）再改 logic / `_pages.md`，然后才改 vue。未调用 `generate_prd` / `generate_frontend_project`。未跑完整 apt-create Phase 0。未调用 `audit_arch_changes`。未提交 `.ai/`。未公路/JTG 预置。未 push。未新建 PrimaryButton/DataTable 组件库。

## Changes
MCP 只读：
- `query_project_status` → `projectType=component`，无 blockers。
- `query_design` page=`standard_lib` → route `/packs/:id/standards`；logic 原命中只要 clause_id+span。
- `query_design` scope=`global` → tokens `--apt-*`；Vue 绑定 PrimaryButton→`.btn`、DataTable→native `table`、StatusTag→`.tag`、WorkbenchCard→`.card`。
- `query_contract` name=`RetrieveHit` → `packages/core-engine/src/retrieve/ports.ts`（`clause_id: string | null` + provenance）。

设计（先于 vue）：
- `designs/v0/standard_lib/page.logic.md`：uploadDoc PDF 202、tick 页状态、页码列、`chunk_kind`、tableHits、`tables_unlinked`、命中 file_name+页+unit_id、表 clause_id 显示 —、边含 SUPPORTS/PARENT_OF/BELONGS_TO。
- `designs/v0/_pages.md`：**仅** `standard_lib` `approved=no`。

UI：
- `RetrieveHitView`：`unit_id`、`chunk_kind`、`file_name`、`page_start`、`page_end`、`supported_clause_ids?`；`clause_id: string | null`。
- PDF `<input type="file" accept="application/pdf">` → `POST /api/standards/ingest-pdf`（FormData file/packId/title）收 202 + ingest_run_id。
- 「处理一页」→ `POST /api/standards/ingest-runs/:id/tick`；页 status 用现有 `.tag`（ok/warn/bad）。
- 检索列：file_name、页、unit_id、clause_id（表/附件显示 —）、路径。
- 保留 JSON textarea 夹具入库；颜色只用 `--apt-*`；按钮/卡片沿用 `.btn` `.card` `.tag`。
- 本页拆 `PdfTickPanel.vue` / `RetrieveHitsTable.vue`（均 ≤300 行）。
- `http.ts`：`ingestStandardPdf` / `tickStandardIngest` multipart 辅助。

## Tests / Verify
```
logic 含 uploadDoc、页码、tick、tableHits、tables_unlinked → PASS
vue 含 file input（accept=application/pdf）与 <th>页 → PASS
rg 公路|JTG 于 whitelist 源（logic / vue / types / http）→ 无命中（R10）
```

Rn: R2、R25（M2b UI）。无浏览器，未做 E2E 点击。

## APT Micro-closeout
- ContractsRegistered:
  - `RetrieveHit` → `packages/core-engine/src/retrieve/ports.ts`
- AssetsRefreshed:
  - `apps/web/src/views/standard_lib/index.vue` → `frontend/web/component/StandardLib`（created）
  - `apps/web/src/views/standard_lib/PdfTickPanel.vue` → `frontend/web/component/PdfTickPanel`（created）
  - `apps/web/src/views/standard_lib/RetrieveHitsTable.vue` → `frontend/web/component/RetrieveHitsTable`（created）
  - `apps/web/src/services/http.ts` → `frontend/web/util/http`（created）
  - `apps/web/src/services/types.ts` → `frontend/web/util/RetrieveHitView`（created；kind=util，frontend 不支持 pojo）
- `audit_arch_changes`: not called（brief 禁止）

## Concerns
- 无浏览器工具，未做 E2E 点击（选 PDF / 处理一页 / 检索表列）。
- HTTP `ingest-pdf` 202 只回 `ingest_run_id`，无 page_count；UI 靠逐次 tick 累积页 status，全部完成后下一次 tick 才标 `tickDone`。
- `.ai/` 索引已由 MCP 更新但未进本 commit。
- 工作区另有与本 Task 无关的脏文件（skills、core-engine、job_upload 等）。本 Task 未触碰、未纳入提交。
