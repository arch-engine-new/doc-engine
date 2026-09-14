# Task 5 Report — 接入 JobPipeline

## Status
DONE

## Commits
`256c1ed49d0e6404d92b2ddc513cb9eb7f6a9ee8` feat(ocr): gate PDF uploads on Unicode text layer

BASE_SHA: `4301774aeff616579f12962e678bdae19ff64982`

未改 9 页、未建表、未读 `rules/`。未提交 `.ai/`（refresh 落在工作区，原先已脏）。未调用 `audit_arch_changes`。无新公开导出，未 `register_contract`。

## Changes
- MCP 只读：`query_project_status` → `projectType=component`，无 blockers。`query_contract` name=`JobPipeline` → `packages/core-engine/src/pipeline/job-pipeline.ts`。
- `packages/core-engine/src/pipeline/job-pipeline.ts`：删除 latin1 括号 `extractPdfTextLayer`。`recognizeUploadText` 对 PDF 先 `await extractPdfUnicodeText`，再 `hasUsablePdfTextLayer(decoded)`；达标 → `{text, vendor:"pdf-text"}`，否则 `ocr.recognize`。JPEG/PNG 仍走 `ocr.recognize`。OCR/解码失败路径仍 `ocr_error`。
- `packages/core-engine/test/upload-ocr.test.ts`：无文本层 PDF + SpyOcr 断言 `recognize` 被调用；`examples/` 最小真实 PDF + FakeOcr 断言不调用 `recognize`、汉字 ≥ 8、`ocr_vendor=pdf-text`。既有 JPEG/PNG 校验与失败审计保持绿。

## Tests / Verify
```
npm test -w core-engine -- upload-ocr
→ exit 0; Test Files 1 passed (1); Tests 7 passed (7) (vitest 3.2.7, 464ms)
```

覆盖：原 5 条 upload-ocr（JPEG 抽字段 / 非法 MIME / >4MB / 无 retrieve hit / OCR 失败 `ocr_error`）+ 空页 PDF spy `recognize` 调用 1 次 + examples 真实 PDF 不调用 OCR。Rn: R5、R8。

## APT Micro-closeout
- ContractsRegistered: none（无新公开导出）
- AssetsRefreshed:
  - `packages/core-engine/src/pipeline/job-pipeline.ts` → `frontend/core-engine/component/JobPipeline`（`kind=component`，`module=core-engine`，action=created）
- AssetsRemoved: none
- `audit_arch_changes`: not called

## Concerns
无。生产路径已无 `toString("latin1")` / 括号正则抽字。`.ai/` 索引已由 MCP 更新但未进本 commit。
