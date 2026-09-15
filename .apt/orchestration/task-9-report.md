# Task 9 Report — 光栅化 + ingest-worker + HTTP（R7/R9/R24/R28）

## Status
DONE

## Commits
（填入本 feat commit SHA）

BASE_SHA: `5f5d8c07d1c333a371dd4f364c2d3a2f8c09a3c3`

未读 `.ai/`。未调用 `audit_arch_changes`。未提交 `.ai/`。未改 vue。未公路 seed。未发明 Paddle DELETE。Job `MAX_UPLOAD_BYTES` 仍为 4MB。ingest-pdf 不套 4MB。未 push。

## Changes
- MCP 只读：`query_project_status` → `projectType=component`，无 blockers。`query_contract` name=`DemoHttpAdapter`；`query_contract` name=`JobPipeline`。
- `packages/core-engine/src/ocr/pdf-raster.ts`：
  - `renderPdfPagePng(bytes, pageNo)` 1-based；优先 `unpdf.renderPageAsImage`。
  - `setPdfPageRaster` 注入假渲染；CI 不装 `@napi-rs/canvas`。失败抛错，不回退整本 PDF 给 OCR。
- `packages/core-engine/src/retrieve/ingest-worker.ts`：
  - `startPdf`：`insertStandardDoc` + version + `insertIngestRun(page_count)`，只登记 pending 页；bytes 留 worker 内存 Map。
  - `tick`：每次 ≤1 页 pending。有文字层用 `extractPdfUnicodePages`；否则单页 PNG → `recognizeLayout`（mime=`image/png`）。随后 `splitLayoutUnits` 写条款/表/向量，`page_start=page_end=page_no`。OCR/光栅失败 → `ocr_error`；向量/图失败 → `index_error`。
  - JSON text ingest 仍走 `StandardLibrary.ingest()`。
- `packages/core-engine/src/pipeline/job-pipeline.ts`：包装 `startStandardPdfIngest` / `tickStandardIngest`；ocr 缺省 `FakeOcr`；live `PaddleOcr.fromEnv()`。未改 Job 4MB 闸门。
- `packages/core-engine/src/http/handle-request.ts`：
  - `POST /api/standards/ingest-pdf` → **202** `{ ingest_run_id }`（不套 4MB）。
  - `POST /api/standards/ingest-runs/:id/tick` 处理 ≤1 页。
  - `/api/standards/edges` kind 允许 SUPPORTS/PARENT_OF/BELONGS_TO。
- 单测 `ingest-pdf.test.ts`：≥2 页空文字层 PDF；注入 raster + SpyOcr；第 2 页向量 upsert 抛错 → page2=`index_error`，page1 向量仍在（M8/R9）；OCR 入参 size < 原 PDF 且 mime 为 image（M11）。

## Tests / Verify
```
npx vitest run packages/core-engine/test/ingest-pdf.test.ts packages/core-engine/test/upload-ocr.test.ts
→ exit 0; Test Files 2 passed (2); Tests 11 passed (11) (vitest 3.2.7)
  ingest-pdf.test.ts 4 passed
  upload-ocr.test.ts 7 passed（>4MB 仍拒）
```

Rn: R7、R9、R24、R28。

## APT Micro-closeout
- ContractsRegistered:
  - `StandardIngestWorker` → `packages/core-engine/src/retrieve/ingest-worker.ts`
  - `renderPdfPagePng` → `packages/core-engine/src/ocr/pdf-raster.ts`
- AssetsRefreshed:
  - `packages/core-engine/src/retrieve/ingest-worker.ts` → `frontend/core-engine/util/StandardIngestWorker`（`kind=util`，`module=core-engine`，action=created）
  - `packages/core-engine/src/ocr/pdf-raster.ts` → `frontend/core-engine/util/renderPdfPagePng`（`kind=util`，`module=core-engine`，action=created）
  - `packages/core-engine/src/http/handle-request.ts` → `frontend/core-engine/util/DemoHttpAdapter`（`kind=util`，`module=core-engine`，action=created）
  - `packages/core-engine/src/pipeline/job-pipeline.ts` → `frontend/core-engine/util/job-pipeline`（`kind=util`，`module=core-engine`，action=created；带 `name=JobPipeline` 的首次 refresh 因 arch 文件锁失败，无 name 重试成功）
- `audit_arch_changes`: not called

## Concerns
- Live 光栅：`renderPdfPagePng` 未注入时走 `unpdf.renderPageAsImage` + 动态 `import("@napi-rs/canvas")`。本仓库未把 canvas 写入 `package.json`（测试不强制）。启用 live：在 `packages/core-engine` 安装可选依赖 `@napi-rs/canvas`（unpdf optional peer），不要把原 PDF bytes 交给 Paddle。
- PDF bytes 本片只在 worker 内存 Map；进程重启后 tick 会因缺 bytes 记 `ocr_error`。MinIO 落盘留给后续。
- HTTP memory 会话 ingest-pdf 默认 `FakeOcr`；`openLiveFromEnv` 才接 `PaddleOcr.fromEnv()`。扫描件无 token 时 live 仍可能落到 FakeOcr（与 Job memory 缺省一致）；真扫 PDF 应配置 Paddle。
- `job-pipeline.ts` 在 BASE 上另有未提交的 doc-type 辅助方法；本 commit 纳入该工作副本以便 HTTP reset / 本片包装方法同文件。
- `.ai/` 索引已由 MCP 更新但未进本 commit。
