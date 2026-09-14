# Task 2 Report — PaddleOcr 适配器（注入 fetch）

## Status
DONE_WITH_CONCERNS

## Commits
`0c0c9a6db5130b73b79baff8fc0fff3bbdd1c6ab` feat(ocr): add PaddleOcr adapter with injectable fetch

BASE_SHA: `916162069ca898640ad6705701cc4cdd153240bf`

未 add `apps/web/.env`。未改 `baidu.ts` / `session.ts` / `index.ts`。未提交 `.ai/`（工作区该树原先已脏）。

## Changes
- MCP 只读：`query_contract` name=`OcrPort` → `packages/core-engine/src/ocr/port.ts`；`recognize({bytes,mime,fileName})→{text,vendor,raw?}`。未读 `.ai/` 猜类型。
- `packages/core-engine/src/ocr/paddleocr.ts`（新）：`PaddleOcr` 实现 `OcrPort`。
  - 构造器：`PaddleOcrEnvConfig` + 可选 `{ fetch, now, sleep, pollIntervalMs }`。默认真实 `fetch` / `Date.now` / sleep 5s。
  - `Authorization: bearer <token>`；本地 multipart `file` + `model` + `optionalPayload` JSON 字符串（三开关均为 false）。
  - POST 一次 `/ocr/jobs` → 轮询 GET `{jobUrl}/{jobId}` → `state=done` 后 GET `resultUrl.jsonUrl`（jsonl 不带 token）。
  - jsonl 必须走 `line.result.layoutParsingResults[].markdown.text`；缺 `result` 或无 markdown →「PaddleOCR 未返回可抽取文本」，禁止空串当成功。
  - `vendor="paddleocr-vl"`。本 Task 不 flatten（留给 Task 3），成功路径返回原始 markdown。
  - `bytes.byteLength > 50MB` 抛中文体积错，不 POST。
  - HTTP 200 + `code=10010`/`12002` 或 HTTP≠200/429：文案「队列繁忙或限流，请稍后手动重试」；无「远端仍在执行」；不捏造 jobId。
  - 已有 jobId 后超时：文案含 jobId +「请勿立即重复提交」；不 DELETE；失败路径 POST `/ocr/jobs` 恰好 1 次。
  - `PaddleOcr.fromEnv` / `fromEnv`：无 token → `null`。Error 文案不含 token。
- `packages/core-engine/src/ocr/port.ts`：注释 Baidu → Paddle（签名未改）。
- `packages/core-engine/test/paddleocr.test.ts`（新）：mock fetch，jobUrl 为 `paddleocr.test`，URL 含 `aistudio-app.com` 即失败。

## Tests / Verify
```
npm test -w core-engine -- paddleocr
→ exit 0; Test Files 1 passed; Tests 6 passed (vitest 3.2.7, 33ms)
```

覆盖：pending→running→done + `result` 包裹；仅顶层 `layoutParsingResults` 失败；HTTP 200+`code=10010` 含「请稍后手动重试」且不含「远端仍在执行」；超时含 jobId 与「请勿立即重复提交」且 POST 1 次、无 DELETE；`fromEnv` 无 token 为 null；>50MB 中文体积错且 0 次 fetch。Rn: R3、R4、R6、R11。

## APT Micro-closeout
- ContractsRegistered: `PaddleOcr` → `packages/core-engine/src/ocr/paddleocr.ts`
- AssetsRefreshed:
  - `packages/core-engine/src/ocr/paddleocr.ts` → `frontend/core-engine/util/PaddleOcr`（`kind=util`，`module=core-engine`）
  - `packages/core-engine/src/ocr/port.ts` → `frontend/core-engine/util/OcrPort`（注释 Baidu→Paddle）
- AssetsRemoved: none
- `audit_arch_changes`: not called

## Concerns
- `baidu.ts` / `session.ts` / `index.ts` 仍引用已删除的百度 env 导出，本 Task 白名单禁止改它们；Task 6/7 接上前 `tsc` 会红。符合 brief。
- flatten 留给 Task 3：成功路径目前返回原始 markdown，未调用 `flattenOcrMarkdown` / `parseOcrFields`。
- `.ai/` 契约/资产更新未进本 commit（仓库该树原先已有大量未提交变更）。
