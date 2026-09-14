# Task 9 Report — 包级回归

## Status
DONE

## Commits
`8c5413ff5b20ef21ec3b18383303ff3061c305d1` fix(ocr): type extractPdfUnicodeText against unpdf mergePages string

BASE_SHA: `e811f6a8f033577a1f0d3282c034743b43f947d5`（开始时即 `HEAD`，Task 8 无新 commit）。

未恢复 `BaiduOcr`。未改 latin1 括号抽字。未提交 `.ai/`（工作区该树原先已脏）。未调用 `audit_arch_changes`。

## Changes
- MCP 只读：`query_project_status` → `projectType=component`，无 blockers。`query_contract` `PaddleOcr` / `OcrPort` 命中。`search_arch` 命中 `flattenOcrMarkdown` / `PaddleOcr` / `JobPipeline` / `getSharedSession`。`query_arch` `frontend/core-engine/util#extractPdfUnicodeText` 命中。未 `report_missing`。
- `packages/core-engine/src/ocr/pdf-text.ts`：`extractText(..., { mergePages: true })` 的 unpdf overload 将 `text` 标为 `string`，原 `result.text.join("\n")` 落在 `never` 上，tsc 失败。改为直接返回 `result.text`。运行时仍走 Unicode 文本层，不回 latin1 括号正则。

## Tests / Verify

| Command | First run | After fix |
|---------|-----------|-----------|
| `npm test -w core-engine` | exit 0；22 files passed / 1 skipped；116 passed / 4 skipped（vitest 3.2.7，15.89s） | exit 0；同口径 116 passed / 4 skipped（16.08s） |
| `npm run typecheck -w core-engine` | **exit 2** | exit 0 |

首次失败摘要：

```
src/ocr/pdf-text.ts(51,72): error TS2339: Property 'join' does not exist on type 'never'.
```

`check_code_quality` PASS（0 issue）。Rn: R4、R8。

## APT Micro-closeout
- ContractsRegistered: none（无新类型；既有 `extractPdfUnicodeText` 签名未变）
- AssetsRefreshed:
  - `packages/core-engine/src/ocr/pdf-text.ts` → `frontend/core-engine/util/extractPdfUnicodeText`（action=updated）
  - 同上 → `frontend/core-engine/util/pdf-text`（action=updated）
- AssetsRemoved: none
- `audit_arch_changes`: not called

## Concerns
无。`.ai/` 索引已由 MCP 更新但未进本 commit。现有 `.apt/orchestration/task-9-report.md` 曾是更早「excel gap-fill」任务残留，本文件已按本 Task 覆盖。
