# Task 8 Review — recognizeLayout 与按页文字层（R8/R17）

review-tier: full
projectType: component（跳过 B2 `designs/v0/*/test-cases.md`；公开 export 注释抽检仍适用）
Plan: `docs/apt/plans/2026-09-15-rag-ingest-metadata-graph-plan.md` Task 8
Spec: `docs/superpowers/specs/2026-09-15-rag-ingest-metadata-graph-design.md`
Brief: `.apt/orchestration/task-8-brief.md` / `.apt/orchestration/task-8-review-brief.md`
Report: `.apt/orchestration/task-8-report.md`
Range: `824e49ec0ab09a7d2601a74db23c2a626206e6bc..5f5d8c07d1c333a371dd4f364c2d3a2f8c09a3c3`
Commit: `5f5d8c07d1c333a371dd4f364c2d3a2f8c09a3c3` feat(ocr): add recognizeLayout and per-page PDF Unicode extraction
Status (implementer): `DONE`

## Spec Compliance

| 检查项 | 结果 | 证据 |
|--------|------|------|
| `recognizeLayout` 不 flatten；`text` 可含 `\|` | **YES** | `runJob` 返回原始 jsonl markdown；`recognizeLayout` 原样 `{ text, vendor, raw }`。同一 VL 夹具含 GFM 表；单测 `layout.text.toContain("|")` 且含 `1.1` |
| `recognize` 仍 flatten | **YES** | `recognize` 走 `flattenOcrMarkdown(text)`。既有成功路径仍 `parseOcrFields`；新增 `result.text.not.toContain("|")`；layout 用例对照 `flattened.text.not.toContain("|")` |
| `extractPdfUnicodePages` `mergePages: false` | **YES** | `extractText(pdf, { mergePages: false })`，返回 `string[]`。两页空 PDF `toHaveLength(2)` 且每页 trim 为空 |
| Job `extractPdfUnicodeText` 未改语义 | **YES** | 函数体仍 `mergePages: true`，空输入 `""`。diff 只在其后新增 pages API；`job-pipeline.ts` 仍 import `extractPdfUnicodeText` |
| 单测含 `\|` | **YES** | `VL_MARKDOWN` 夹具含 `\| 条款 \| 内容 \|` / `\| 1.1 \| 填料 \|`；layout 断言含 `\|`，recognize 断言不含表竖线 |
| 抽私有 `runJob`；公开方法「为什么」注释；体 ≤80 | **YES** | 见 Quality |
| 白名单；parent SHA = BASE_SHA | **YES** | 4 文件均在白名单。parent=`824e49ec` |
| 未改 ingest-worker / Job 4MB / 未发明 Paddle DELETE | **YES** | 本 SHA 无 worker / handle-request / `MAX_UPLOAD_BYTES`。源码无 DELETE；layout 测 `calls.some(DELETE)===false` |
| component：跳过 test-cases.md | **YES** | 未查 `designs/v0` |

无 Missing / Extra / Misunderstood（相对本 Task brief / plan Task 8 / review-brief）。`OcrPort.recognizeLayout` 在 BASE 已存在；本片补 `PaddleOcr` 实现，未改 `port.ts`（白名单外，符合）。标准入库接线属 Task 9。

## Quality

**公开 export 注释抽检：Approved**

对照 diff，新增/签名变更的公开面均有「为什么」，不是 `// set x`：

- `recognize`：Job 冻结 `parseOcrFields` 看不见 VL 标题/强调/表竖线；标准入库不得走此方法。
- `recognizeLayout`：保留 VL 表 `\|` 供 `splitLayoutUnits` 恢复 `cell_ref`；此处拍平会丢掉 D2 表。
- `extractPdfUnicodePages`：`mergePages:true` 会抹掉页界，后续光栅+OCR tick 无法对准空页。
- `extractPdfUnicodeText` 注释与 `mergePages:true` 未改。

TS 方法均有明确 return type；命名 camelCase / PascalCase 符合 `.apt/code-standards.md`。函数体均远小于 80（`runJob` ~6 行、`recognize`/`recognizeLayout` ~3 行、`extractPdfUnicodePages` ~13 行）。

**白名单 / 密钥：** 本 commit 4 文件均在白名单。未含 `.ai/`、`.env`、token。未改 ingest-worker / pdf-raster / Job 4MB。未读 `rules/`。

**微闭环（工作区，未进本 commit）：** `query_contract` `PaddleOcr` → `paddleocr.ts`（recognize flatten；recognizeLayout 不拍平；无 DELETE）。`query_contract` `extractPdfUnicodePages` → `pdf-text.ts`（`mergePages:false`；Job 路径仍 `mergePages:true`）。`audit_arch_changes` 未调用（brief 禁止）。`.ai/` 未进 commit。

**测试用例：** component → 跳过 `test-cases.md`。同一 VL markdown 夹具对照 layout vs recognize；两页空 PDF 断言页数未被 merge。

## Verify

审查方复跑：

```
npx vitest run packages/core-engine/test/paddleocr.test.ts packages/core-engine/test/pdf-text.test.ts
```

→ exit 0；Test Files **2 passed** (2)；Tests **16 passed** (16)（vitest 3.2.7）。

- `paddleocr.test.ts` 9 passed（既有 8 + recognizeLayout）
- `pdf-text.test.ts` 7 passed（既有 6 + pages）

Rn: R8、R17。

## Issues

**blocking：** 无（0）

**nit：**

- 白名单未改 `upload-ocr.test.ts` 的 `SpyOcr`（仍缺 `recognizeLayout`）；Job 路径不调用 layout。report 已披露，Task 9 接线前可补。
- `pdf-text.test.ts` 的 `flattenOcrMarkdown` 夹具未带表竖线；`\|` 对照只在 `paddleocr.test.ts`（满足 review-brief）。
- 真实 examples PDF 的 pages 测只断言 `length>=1`；页数不被 merge 由两页空 PDF 覆盖。
- `.ai/` 契约/资产更新未进本 commit。

## Assessment

**PASS**
