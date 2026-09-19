# Task 9 Brief — 光栅化 + ingest-worker + HTTP（R7/R9/R24/R28）

plan: `docs/apt/plans/2026-09-15-rag-ingest-metadata-graph-plan.md`
projectType: component
BASE_SHA: `5f5d8c07d1c333a371dd4f364c2d3a2f8c09a3c3`

## 步骤

- [ ] MCP：`query_contract` name=`DemoHttpAdapter`；`query_contract` name=`JobPipeline`。禁止读 `.ai/`。
- [ ] `ocr/pdf-raster.ts`：`renderPdfPagePng(bytes, pageNo): Promise<Uint8Array>`（1-based）。优先 `unpdf` 的 `renderPageAsImage`。CI **必须可注入**假渲染（测试不强制装 `@napi-rs/canvas`）。失败不得回退「把全书 PDF 交给 Paddle」。
- [ ] `retrieve/ingest-worker.ts`：`StandardIngestWorker`
  - `startPdf({ packId, title, fileName, bytes })`：`insertStandardDoc` + version + `insertIngestRun(page_count)`；**只登记页 pending**，本步不 OCR。bytes 放 worker 内存 Map（本片可不落 MinIO）。
  - `tick(ingestRunId)`：每次 **最多 1 页** pending。
    - 文字层：`extractPdfUnicodePages` 该页，`hasUsablePdfTextLayer` 真 → 用该页文本。
    - 否则：`renderPdfPagePng` 单页 PNG → `ocr.recognizeLayout`（mime=`image/png`，bytes=页图）。**禁止**把原 PDF bytes 传给 OCR。
    - 然后对该页 `splitLayoutUnits` + 写入条款/表/向量（page_start=page_end=page_no）。OCR 失败 → `ocr_error`；向量/图失败 → **`index_error`**（不得记 ocr_error/ok）。
  - JSON text ingest 仍走现有 `ingest()`。
- [ ] `JobPipeline` 包装 `startStandardPdfIngest` / `tickStandardIngest`（持有 worker；ocr 用 pipeline 已有 OcrPort，缺省 FakeOcr）。
- [ ] HTTP：`POST /api/standards/ingest-pdf` multipart `file` + packId + title → **202** `{ ingest_run_id }`。`POST /api/standards/ingest-runs/:id/tick` 处理 ≤1 页，返回该页 status。`/api/standards/edges` kind 允许 SUPPORTS/PARENT_OF/BELONGS_TO。
- [ ] **Job `MAX_UPLOAD_BYTES` 仍 4MB**；ingest-pdf **不要**套这 4MB（标准 PDF 可更大）。
- [ ] 测试 `packages/core-engine/test/ingest-pdf.test.ts`：
  - ≥2 页：注入 raster + FakeOcr/SpyOcr；第 2 页向量 upsert 抛错 → page2=`index_error`，page1 已写入的 layout/vector 仍在（M8/R9）。
  - Spy `recognizeLayout`：入参 size < 原 PDF，mime 为 image（M11）。无文字层夹具才走 OCR。
  - upload-ocr 超 4MB 仍拒（可复用既有测）。

## Files 白名单

- `packages/core-engine/src/ocr/pdf-raster.ts`（新）
- `packages/core-engine/src/retrieve/ingest-worker.ts`（新）
- `packages/core-engine/src/http/handle-request.ts`
- `packages/core-engine/src/pipeline/job-pipeline.ts`
- `packages/core-engine/src/index.ts`（仅必要时导出）
- `packages/core-engine/test/ingest-pdf.test.ts`（新）
- `packages/core-engine/package.json`（仅当确需可选依赖；测试须能在无 canvas 时绿）

不要改 vue。不要公路 seed。不要 Paddle DELETE。

## Verify

```
npx vitest run packages/core-engine/test/ingest-pdf.test.ts packages/core-engine/test/upload-ocr.test.ts
```

## 约束

函数 ≤80 行。公开方法注释写为什么。register_contract StandardIngestWorker / renderPdfPagePng；refresh_asset。禁止 audit_arch_changes。

## Report + commit

`.apt/orchestration/task-9-report.md`
`git commit -m "feat(retrieve): page-tick PDF ingest with layout OCR and index_error"`
