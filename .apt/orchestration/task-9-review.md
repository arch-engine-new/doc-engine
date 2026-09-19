# Task 9 Review — 光栅化 + ingest-worker + HTTP（R7/R9/R24/R28）

review-tier: full
projectType: component（跳过 B2 `designs/v0/*/test-cases.md`；公开 export 注释抽检仍适用）
Plan: `docs/apt/plans/2026-09-15-rag-ingest-metadata-graph-plan.md` Task 9
Spec: `docs/superpowers/specs/2026-09-15-rag-ingest-metadata-graph-design.md`
Brief: `.apt/orchestration/task-9-brief.md` / `.apt/orchestration/task-9-review-brief.md`
Report: `.apt/orchestration/task-9-report.md`
Range: `5f5d8c07d1c333a371dd4f364c2d3a2f8c09a3c3..7d9effaef6dea0817569e1ad3bba3e8486d644cf`
Commit: `7d9effaef6dea0817569e1ad3bba3e8486d644cf` feat(retrieve): page-tick PDF ingest with layout OCR and index_error
Status (implementer): `DONE`

本文件覆盖原 paddleocr 回归 Task 9 评审账本（RAG ingest plan，不是 paddleocr）。

## Spec Compliance

| 检查项 | 结果 | 证据 |
|--------|------|------|
| `tick` 每次 ≤1 页 pending | **YES** | `tick` 只 `find` 第一条 `pending`，再 `tickPending`。`startPdf` 后 `layoutCalls.length===0`；tick1 `page_no=1`，tick2 `page_no=2`。HTTP tick 一次只回第 1 页 |
| 无文字层：单页 PNG → `recognizeLayout` | **YES** | 空页 PDF（无 ToUnicode）走 `renderPdfPagePng` / 注入 raster；`mime="image/png"`，`fileName=….p{n}.png`。M11：`bytes.byteLength < 原 PDF` 且 `mime` 匹配 `/^image\//` |
| 禁止把全书 PDF 交给 OCR | **YES** | OCR 入参是页 PNG，不是 `pdfByRun` 原 bytes。live `renderPageAsImage` 失败抛错，无 PDF 回退。`setPdfPageRaster` 可注入假渲染 |
| 向量/图失败 = `index_error`（不得 ocr_error/ok） | **YES** | `resolvePageText` catch → `ocr_error`；`persistPage` catch → `index_error`。第 2 页 `vector.upsert` 抛错 → `status=index_error`，page1 条款/向量仍在（M8/R9） |
| `POST /api/standards/ingest-pdf` → **202** `{ ingest_run_id }` | **YES** | `json(202, await startPdfIngest)`。单测 `created.status===202` 且有 `ingest_run_id`。不套 `validateUploadInput` |
| Job `MAX_UPLOAD_BYTES` 仍 4MB | **YES** | `MAX_UPLOAD_BYTES = 4 * 1024 * 1024`。`validateUploadInput` 仍闸门。`upload-ocr` `>4MB` 仍拒且不 insert job。`startStandardPdfIngest` 接受 `MAX_UPLOAD_BYTES+1` |
| `/api/standards/edges` 允许 SUPPORTS/PARENT_OF/BELONGS_TO | **YES** | `STANDARD_EDGE_KINDS` 含三者；HTTP 三 kind 均 200 |
| 测试可注入 raster；CI 不强制 canvas | **YES** | `setPdfPageRaster(stubPng)` + `startPdf({ raster })`。未改 `package.json` |
| JSON text ingest 仍走 `ingest()` | **YES** | `JobPipeline.ingestStandard` → `library.ingest`；HTTP `/api/standards/ingest` 未改成 worker |
| 公开方法「为什么」注释；函数体 ≤80 | **YES** | 见 Quality |
| 白名单；parent SHA = BASE_SHA | **YES** | parent=`5f5d8c07`。生产文件均在白名单。另含 report。未改 vue / seed / `.ai/` |
| component：跳过 test-cases.md | **YES** | 未查 `designs/v0` |

无 Missing / Misunderstood（相对本 Task brief / plan Task 9 / review-brief）。

**Extra（非阻塞）：** `job-pipeline.ts` 同文件纳入 BASE 上未提交的 doc-type 辅助（`ensureDemoDocTypes` / `listEffectiveBoxes` / `createTemplate` 不再自动补 `doc_type_id` 等）。report 已披露；Job 4MB 闸门未放宽；`upload-ocr` 仍绿。

## Quality

**公开 export 注释抽检：Approved**

对照 diff，新增/签名变更的公开面均有「为什么」，不是 `// set x`：

- `setPdfPageRaster`：CI 不装 `@napi-rs/canvas`；生产不得依赖此钩子。
- `renderPdfPagePng`：失败抛错，调用方不得把全书 PDF 交给 Paddle。
- `StandardIngestWorker.startPdf`：start 上 OCR 会挡住 202，并让两页 `index_error` 夹具看起来像一次性入库。
- `tick`：OCR/光栅保持 `ocr_error`；向量/图失败是 `index_error`，后页不能抹掉已 ok 页。
- `startStandardPdfIngest`：不得复用 Job `MAX_UPLOAD_BYTES`。
- `tickStandardIngest`：worker 挂在 pipeline 上，HTTP tick 才能看到 start 时的内存 PDF Map。
- `startPdfIngest` / `parseStandardEdgeKind`：ingest-pdf 无 4MB 闸门；layout kind 一等公民。

TS 方法均有明确 return type；命名 camelCase / PascalCase。函数体均 <80（`startPdf` ~35、`tick`/`tickPending` ~12、`resolvePageText` ~20、`upsertClauseLayout` ~49、`renderPdfPagePng` ~9、`startPdfIngest` ~15）。

**白名单 / 密钥：** 本 commit 7 文件：`pdf-raster.ts`、`ingest-worker.ts`、`handle-request.ts`、`job-pipeline.ts`、`index.ts`、`ingest-pdf.test.ts`、`task-9-report.md`。未含 `.ai/`、`.env`、token。未改 vue、未公路 seed、未发明 Paddle DELETE。

**微闭环（工作区，未进本 commit）：** `query_contract` `StandardIngestWorker` → `ingest-worker.ts`（start 只登记 pending；tick ≤1 页；向量失败 `index_error`；JSON 仍 `library.ingest`）。`query_contract` `renderPdfPagePng` → `pdf-raster.ts`（可注入；失败不回退原 PDF）。`search_arch` 命中 `frontend/core-engine/util/StandardIngestWorker`、`frontend/core-engine/util/renderPdfPagePng`。`audit_arch_changes` 未调用（brief 禁止）。`.ai/` 未进 commit。

**测试用例：** component → 跳过 `test-cases.md`。≥2 页空文字层 PDF；注入 raster + SpyOcr；page2 向量抛错 → `index_error`，page1 向量仍在。OCR 入参 size/mime 断言。HTTP 202 + edges 新 kind。Job 4MB 负例仍在 `upload-ocr.test.ts`。

## Verify

审查方复跑：

```
npx vitest run packages/core-engine/test/ingest-pdf.test.ts packages/core-engine/test/upload-ocr.test.ts
```

→ exit 0；Test Files **2 passed** (2)；Tests **11 passed** (11)（vitest 3.2.7）。

- `ingest-pdf.test.ts` 4 passed
- `upload-ocr.test.ts` 7 passed（`>4MB` 仍拒）

Rn: R7、R9、R24、R28。

## Issues

**blocking：** 无（0）

**nit：**

- `job-pipeline.ts` Extra：纳入 doc-type 工作副本（`ensureDemoDocTypes`、template/`runFixtureJob` 绑定简化）。whitelist 内、report 已披露，未放宽 Job 4MB。
- HTTP ingest-pdf 超 4MB 豁免只在 pipeline `startStandardPdfIngest` 测；HTTP 层靠代码审查（`startPdfIngest` 不调 `validateUploadInput`）。
- HTTP tick 断言 status ∈ `{ok,ocr_error,index_error}`，未钉 `ok`（session 默认 FakeOcr）。行为钉在 pipeline SpyOcr 测。
- 有文字层跳过 OCR 的路径在 `resolvePageText` 里，本片夹具按 brief 只用无文字层。
- `.ai/` 契约/资产更新未进本 commit。`query_arch` 精确 path 需 `#standardingestworker`；`search_arch` 可命中。

## Assessment

**PASS**
