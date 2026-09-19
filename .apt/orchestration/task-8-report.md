# Task 8 Report — recognizeLayout 与按页文字层（R8/R17）

## Status
DONE

## Commits
`5f5d8c07d1c333a371dd4f364c2d3a2f8c09a3c3` feat(ocr): add recognizeLayout and per-page PDF Unicode extraction

BASE_SHA: `824e49ec0ab09a7d2601a74db23c2a626206e6bc`

未读 `.ai/`。未调用 `audit_arch_changes`。未提交 `.ai/`。未改 ingest-worker / handle-request / Job 4MB。未发明 Paddle DELETE。未恢复 Baidu。未 push。

## Changes
- MCP 只读：`query_project_status` → `projectType=component`，无 blockers。`query_contract` name=`PaddleOcr`；`query_contract` name=`flattenOcrMarkdown`。
- `packages/core-engine/src/ocr/paddleocr.ts`：
  - 抽私有 `runJob`（submit/poll/jsonl）。
  - `recognizeLayout` 返回未拍平 VL markdown（可含 `|`）。
  - `recognize` 仍 `flattenOcrMarkdown`（Job 路径）。
- `packages/core-engine/src/ocr/pdf-text.ts`：
  - 新增 `extractPdfUnicodePages`：`mergePages: false`，返回 `string[]`。
  - `extractPdfUnicodeText` 保持 `mergePages: true`（Job）。
- 单测：同一 VL markdown 夹具（含 GFM 表）；`recognizeLayout` 含 `|`；`recognize` 不含表竖线。`extractPdfUnicodePages` 两页空 PDF 长度为 2。

## Tests / Verify
```
npx vitest run packages/core-engine/test/paddleocr.test.ts packages/core-engine/test/pdf-text.test.ts
→ exit 0; Test Files 2 passed (2); Tests 16 passed (16) (vitest 3.2.7)
  paddleocr.test.ts 9 passed（既有 8 + recognizeLayout）
  pdf-text.test.ts 7 passed（既有 6 + pages）
```

Rn: R8、R17。

## APT Micro-closeout
- ContractsRegistered:
  - `PaddleOcr` → `packages/core-engine/src/ocr/paddleocr.ts`（更新）
  - `extractPdfUnicodePages` → `packages/core-engine/src/ocr/pdf-text.ts`（新建）
- AssetsRefreshed:
  - `packages/core-engine/src/ocr/paddleocr.ts` → `frontend/core-engine/util/PaddleOcr`（`kind=util`，`module=core-engine`，action=updated）
  - `packages/core-engine/src/ocr/pdf-text.ts` → `frontend/core-engine/util/extractPdfUnicodePages`（`kind=util`，`module=core-engine`，action=created）
- `audit_arch_changes`: not called

## Concerns
- `.ai/` 索引已由 MCP 更新但未进本 commit。
- 白名单未改 `upload-ocr.test.ts` 的 `SpyOcr`（仍缺 `recognizeLayout`）；Job 路径不调用 layout，本 Task 不修。
- Task 9 才接线 ingest-worker / pdf-raster。
