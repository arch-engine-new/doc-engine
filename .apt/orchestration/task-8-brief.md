# Task 8 Brief — recognizeLayout 与按页文字层（R8/R17）

plan: `docs/apt/plans/2026-09-15-rag-ingest-metadata-graph-plan.md`
projectType: component
BASE_SHA: `824e49ec0ab09a7d2601a74db23c2a626206e6bc`

## 步骤

- [ ] MCP：`query_contract` name=`PaddleOcr`；`query_contract` name=`flattenOcrMarkdown`。禁止读 `.ai/`。
- [ ] `PaddleOcr.recognizeLayout`：复用 submit/poll/jsonl，**跳过** `flattenOcrMarkdown`；`text` 可含 `\|`。`recognize` 行为不变（仍 flatten）。可抽私有 `runJob` 避免两方法复制粘贴超 80 行。
- [ ] `extractPdfUnicodePages(bytes): Promise<string[]>`：`mergePages: false`（或逐页 API）。标准入库路径禁止 `mergePages:true`。保留现有 `extractPdfUnicodeText`（Job 仍可 mergePages:true）。
- [ ] 单测：recognizeLayout 文本含 `|`；recognize 不含表竖线（同一 VL markdown 夹具）。Job/paddleocr 既有 8 测仍绿。

## Files 白名单

- `packages/core-engine/src/ocr/paddleocr.ts`
- `packages/core-engine/src/ocr/pdf-text.ts`
- `packages/core-engine/test/paddleocr.test.ts`
- `packages/core-engine/test/pdf-text.test.ts`（pages 断言）

不要改 ingest-worker（Task 9）。不要改 Job 4MB。不要发明 Paddle DELETE。

## Verify

```
npx vitest run packages/core-engine/test/paddleocr.test.ts packages/core-engine/test/pdf-text.test.ts
```

## 约束

公开方法注释写为什么。register_contract PaddleOcr / extractPdfUnicodePages；refresh_asset。禁止 audit_arch_changes。

## Report + commit

`.apt/orchestration/task-8-report.md`
`git commit -m "feat(ocr): add recognizeLayout and per-page PDF Unicode extraction"`
