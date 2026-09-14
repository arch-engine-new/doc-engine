# Task 3 Report — flattenOcrMarkdown 接硬抽取

## Status
DONE

## Commits
`820d7918360f33b260b2add9e2b9eefdff4685b8` feat(ocr): flatten Paddle VL markdown for parseOcrFields

BASE_SHA: `ace99a4acd092767289325aec9aca1527f0d6804`

未改 `parseOcrFields`。未 add `apps/web/.env`。未提交 `.ai/`（工作区该树原先已脏）。未调用 `audit_arch_changes`。

## Changes
- MCP 只读：`query_project_status` → `projectType=component`，无 blockers。`query_arch` path=`frontend/core-engine/utils#parseocrfields` → `packages/core-engine/src/extract/ocr-fields.ts`；`parseOcrFields(text): Record<string, string>`，硬抽 `编号`/`日期A`/`日期B`，不发明缺失键、不在倒置日期时对调。未读 `.ai/` 猜正则；**未改**该函数。
- `packages/core-engine/src/ocr/pdf-text.ts`（新）：导出 `flattenOcrMarkdown`。去行首 `#` 标题、`*`/`_` 强调、表格 `|`，空白折叠。公开注释说明：VL markdown 包住标签，而 `parseOcrFields` 正则冻结，故在此剥标记。
- `packages/core-engine/src/ocr/paddleocr.ts`：`recognize` 成功路径在返回前调用 `flattenOcrMarkdown`（失败路径不 flatten）。
- `packages/core-engine/test/paddleocr.test.ts`：夹具 `# 表\n**编号：** SH-002\n日期A：2026-08-20\n日期B：2026-08-01` flatten 后 `parseOcrFields` 得到三字段；成功路径 jsonl 同夹具亦抽出三字段。

## Tests / Verify
```
npm test -w core-engine -- paddleocr
→ exit 0; Test Files 1 passed (1); Tests 8 passed (8) (vitest 3.2.7, 35ms)
```

覆盖：原 Task 2 六例仍绿；flatten 夹具 `编号=SH-002`、`日期A=2026-08-20`、`日期B=2026-08-01`；Paddle 成功路径对 VL markdown 调用 flatten 后同样三字段。无真实 aistudio 请求。Rn: R10。

## APT Micro-closeout
- ContractsRegistered: `flattenOcrMarkdown` → `packages/core-engine/src/ocr/pdf-text.ts`（MCP `register_contract`，INDEX 已刷新）
- AssetsRefreshed:
  - `packages/core-engine/src/ocr/pdf-text.ts` → `frontend/core-engine/util/flattenOcrMarkdown`（`kind=util`，`module=core-engine`，action=created）
  - `packages/core-engine/src/ocr/paddleocr.ts` → `frontend/core-engine/util/PaddleOcr`（action=updated）
- AssetsRemoved: none
- `audit_arch_changes`: not called

## Concerns
无。Task 4 将在同一 `pdf-text.ts` 加 Unicode PDF 解码；本 Task 未引入解码依赖。`.ai/` 索引已由 MCP 更新但未进本 commit。
