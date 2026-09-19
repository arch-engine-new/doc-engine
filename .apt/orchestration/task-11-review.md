# Task 11 Review — refine 标准库页 + UI（R2/R25）

review-tier: full
projectType: component（跳过 B2 `designs/v0/*/test-cases.md`）
Plan: `docs/apt/plans/2026-09-15-rag-ingest-metadata-graph-plan.md` Task 11
Spec: `docs/superpowers/specs/2026-09-15-rag-ingest-metadata-graph-design.md`
Brief: `.apt/orchestration/task-11-brief.md` / `.apt/orchestration/task-11-review-brief.md`
Report: `.apt/orchestration/task-11-report.md`
Range: `7d9effaef6dea0817569e1ad3bba3e8486d644cf..08657a3533b6564a00514641ff466d4e73b9c7de`
Commit: `08657a3533b6564a00514641ff466d4e73b9c7de` feat(web): show provenance and PDF tick ingest on standard library
Parent: `7d9effaef6dea0817569e1ad3bba3e8486d644cf`（= BASE_SHA）
Status (implementer): `DONE`

## Spec Compliance

| 检查项 | 结果 | 证据 |
|--------|------|------|
| 先 `query_design`（page=`standard_lib` + scope=`global`） | **YES** | `.apt/tool-call-log.jsonl` `2026-09-15T09:30:27Z` 两条 `query_design` 均 ok；同时 `query_project_status` / `query_contract RetrieveHit`。vue `refresh_asset` 在 `09:38`，晚于 design 查询 |
| 先 logic / `_pages.md`，再 vue | **YES** | 同 SHA 含设计 + vue；BASE 无 `standard_lib` vue/logic/`_pages.md`，不存在「先交 vue、后补 refine」。MCP 顺序：design query → 约 8min 后才 `refresh_asset` vue。未调 `generate_prd` / `generate_frontend_project` |
| `_pages.md` **仅** `standard_lib` `approved=no` | **YES** | 该页 notes 写 PDF tick + provenance，`approved=no`。其余 8 页 `approved=yes` |
| logic：uploadDoc/PDF、页码列、tick、`chunk_kind`、tableHits、`tables_unlinked` | **YES** | `page.logic.md` 操作表含 uploadDoc（`accept=application/pdf` → ingest-pdf 202）、tick（pending/ok/ocr_error/index_error）、ingestClauses/`tables_unlinked`、searchSemantic `tableHits`；检索列 file_name/页/unit_id/clause_id — |
| 边类型含 SUPPORTS/PARENT_OF/BELONGS_TO | **YES** | logic `indexGraph`：人工四类 + 自动 PARENT_OF / BELONGS_TO / SUPPORTS |
| PDF `<input type="file" accept="application/pdf">` → ingest-pdf 202 | **YES** | `PdfTickPanel.vue` 该 input；`ingestStandardPdf` FormData `file`/`packId`/`title` POST `/api/standards/ingest-pdf`；`res.ok` 含 202 |
| 「处理一页」tick + `.tag` 页 status | **YES** | 按钮 `emit('tick')` → `POST /api/standards/ingest-runs/:id/tick`；页 status 用现有 `.tag`（ok/warn/bad），未新建 StatusTag |
| 检索表：file_name、页、unit_id、clause_id（表 —）、路径 | **YES** | `RetrieveHitsTable.vue` `<th>页</th>`；`clauseLabel` 在 table/annex/`clause_id==null` 返回 `—` |
| `RetrieveHitView` provenance + `clause_id: string \| null` | **YES** | `types.ts`：`unit_id`/`chunk_kind`/`file_name`/`page_start`/`page_end`/`supported_clause_ids?` |
| JSON textarea 夹具保留 | **YES** | `index.vue` `LEAVE_TEXT` + `<textarea>` + `POST /api/standards/ingest` |
| 颜色只用 `--apt-*`；`.btn` `.card` `.tag` | **YES** | 三 vue 无 `<style>`、无 hex/rgb；沿用 `global.css` 的 `.btn` `.card` `.tag`（均 `var(--apt-*)`）。无 PrimaryButton/DataTable 新组件 |
| 无公路 / JTG 预置 | **YES** | `git grep` 白名单 7 文件零命中。夹具为请假说明，非行业规范包 |
| 白名单；一行一组件；本页 ≤300 | **YES** | 7 文件均在白名单。`index.vue` 265 行；拆 `PdfTickPanel` 51 / `RetrieveHitsTable` 55 |
| `register_contract RetrieveHit`；`refresh_asset`；禁 `audit_arch_changes` | **YES** | log `09:38:48` register；随后 refresh 五个源。当日无 `audit_arch_changes`（上次 09-14） |
| component：跳过 test-cases.md | **YES** | 未查 `designs/v0/*/test-cases.md` |

无 Missing / Extra / Misunderstood（相对本 Task brief / plan Task 11 / review-brief）。http.ts 仅增 `ingestStandardPdf` / `tickStandardIngest`。

## Quality

**公开 export 注释抽检：Approved**

- `RetrieveHitView`：表/附件 `clause_id` 保持 null，避免把 `unit_id` 塞进条款列。
- `ingestStandardPdf`：202 只登记 pending；不设 JSON Content-Type，以便 multipart boundary。
- `tickStandardIngest`：一次 ≤1 pending 页。
- `PdfTickPanel.tagClass` / `RetrieveHitsTable.clauseLabel`：说明 `.tag` 映射与表不得显示条款号。

TS 均有 return type；命名 camelCase / PascalCase。函数体均 <80。

**白名单 / 密钥：** 本 commit 7 文件。未含 `.ai/`、`.env`、token。未 push。

## Verify

审查方静态核对（无浏览器，未做 E2E 点击；与 report Concerns 一致）：

```
logic 含 uploadDoc、页码、tick、tableHits、tables_unlinked → PASS
vue 含 file input（accept=application/pdf）与 <th>页 → PASS
rg 公路|JTG 于 whitelist 源 → 无命中（R10）
```

Rn: R2、R25（M2b UI）。

## Issues

**blocking：** 无（0）

**nit：**

- 设计与 vue 同一 commit，git 无法单独打点 logic 早于 vue 的文件写时刻；MCP `query_design`（09:30Z）早于 vue `refresh_asset`（09:38Z），且 BASE 无先交的 vue，门禁视为满足。
- `ingestStandardPdf` 用 `res.ok`（含 202）而非显式断言 status===202。
- HTTP 202 无 page_count，UI 靠累积 tick（report 已披露）。
- 无浏览器 E2E（选 PDF / 处理一页 / 检索表列）。
- `.ai/` 索引 MCP 已更新但未进本 commit（brief 允许）。

## Assessment

**PASS**
