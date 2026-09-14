# Task 4 Report — Unicode PDF 文字层（禁止括号乱码）

## Status
DONE

## Commits
`676f51f2d2d5ca1325c2b83ffceb80cd86993b29` feat(ocr): extract Unicode PDF text layer with unpdf

BASE_SHA: `c3b0726f914d427d65ecfe46e6d52b349c181ae8`

未改 `job-pipeline.ts`。未用 latin1 括号正则。未提交 `.ai/`（工作区该树原先已脏）。未调用 `audit_arch_changes`。

## Changes
- MCP 只读：`query_project_status` → `projectType=component`，无 blockers。`search_arch` / `query_arch` 命中既有 `flattenOcrMarkdown`（`frontend/core-engine/util#flattenocrmarkdown`）。`query_contract` name=`extractPdfUnicodeText` / `hasUsablePdfTextLayer` 未命中（本 Task 新增，实现后 register）。
- `packages/core-engine/package.json` + `package-lock.json`：依赖 `unpdf@^1.8.1`。先对 `examples/*.pdf` 探针：6 份均抽出汉字（最小评定表 440 字）。未换 `pdfjs-dist`。
- `packages/core-engine/src/ocr/pdf-text.ts`：导出 `extractPdfUnicodeText` / `hasUsablePdfTextLayer`。解码走 unpdf `getDocumentProxy` + `extractText({ mergePages: true })`。闸门：汉字 ≥ 8，或（`\p{L}` ≥ 40 且汉字 ≥ 1）。解码失败返回 `""`。`flattenOcrMarkdown` 行为不变。公开注释说明禁止 latin1 括号正则的原因。
- `packages/core-engine/test/pdf-text.test.ts`（新）：`fileURLToPath` 解析仓库根 `examples/`；真实 PDF 汉字 ≥ 8；合成无文本层 PDF 闸门 false；0 汉字括号乱码 false。

## Tests / Verify
```
npm test -w core-engine -- pdf-text
→ exit 0; Test Files 1 passed (1); Tests 6 passed (6) (vitest 3.2.7, 269ms)
```

覆盖：flatten 夹具仍抽出 `编号=SH-002` / `日期A=2026-08-20` / `日期B=2026-08-01`；examples 最小 PDF 汉字 440、闸门 true；空页 PDF 抽出 `""`、闸门 false；零汉字括号汤闸门 false。Rn: R5。

## examples 汉字
选用 `K2+074.0芋禾沟大桥右线0#桥台0-1#钻孔灌注桩桩基分项工程质量检验评定表 .pdf`（202192 bytes）：`extractPdfUnicodeText` → chars=854，**汉字=440**，`hasUsablePdfTextLayer=true`。

## APT Micro-closeout
- ContractsRegistered:
  - `extractPdfUnicodeText` → `packages/core-engine/src/ocr/pdf-text.ts`
  - `hasUsablePdfTextLayer` → `packages/core-engine/src/ocr/pdf-text.ts`
- AssetsRefreshed:
  - `packages/core-engine/src/ocr/pdf-text.ts` → `frontend/core-engine/util/pdf-text`（`kind=util`，`module=core-engine`，action=created）
  - 同上 → `frontend/core-engine/util/extractPdfUnicodeText`（action=created）
  - 同上 → `frontend/core-engine/util/hasUsablePdfTextLayer`（action=created）
- AssetsRemoved: none
- `audit_arch_changes`: not called

## Concerns
无。Task 5 再把 `recognizeUploadText` 接到本模块；本 Task 未改 `job-pipeline.ts`。`.ai/` 索引已由 MCP 更新但未进本 commit。
