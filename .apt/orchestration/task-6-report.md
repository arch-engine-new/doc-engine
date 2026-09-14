# Task 6 Report — DemoHttpSession 装配与 health

## Status
DONE_WITH_CONCERNS

## Commits
`23183841b3f7334659dbf2a5005b1fd922ced384` feat(ocr): wire DemoHttpSession live OCR to PaddleOCR

BASE_SHA: `454744b719f1ac77fa63b3aa557a98d17416ac85`

未改 `index.ts`。未改 9 页、未建表、未读 `rules/`。未提交 `.ai/`（refresh/remove 落在工作区，原先已脏）。未调用 `audit_arch_changes`。无新公开导出，未 `register_contract`。

## Changes
- MCP 只读：`query_project_status` → `projectType=component`，无 blockers。`query_contract` name=`DemoHttpSession` 未命中 → `query_arch` path=`frontend/core-engine/utils#demohttpsession` → `packages/core-engine/src/http/session.ts`。`query_contract` name=`PaddleOcr` → `fromEnv()` 无 token 为 null。
- `packages/core-engine/src/http/session.ts`：live `resolveUploadDeps` 改 `PaddleOcr.fromEnv`；缺 MinIO 或缺 token → `UploadServiceUnavailableError`（文案含 PaddleOCR token，不含百度）。memory 仍 `FakeOcr`。HTTP 装配不再经过 `index.ts` 桶文件。
- `probePaddleOcr`：无 token=`skip`；GET `{jobUrl}/__health_probe` + `Authorization: bearer <token>`；函数体仅 `method: "GET"`，无 `method: "POST"`；401/403=`fail`；404=`ok`；其它 `response.ok` 则 ok 否则 fail。
- 删除 `packages/core-engine/src/ocr/baidu.ts`。
- `packages/core-engine/src/http/handle-request.ts`：`mockPendingMount` / `uploadDocument` / `FieldBoxWrite` 改为直连 `adapter/mock.js` 与 `persistence/store.js`。删除 baidu.ts 后 vitest 若仍走 `index.ts` 桶文件会在 collect 阶段因 `./ocr/baidu.js` 缺失失败；本文件不在白名单，但为让 `http-adapter` 在不改 `index.ts` 的前提下变绿所必需。

## Tests / Verify
```
rg -n "BaiduOcr|baiduFromEnv|probeBaidu|aip.baidubce.com" packages/core-engine/src
```
仅 `packages/core-engine/src/index.ts` 三行残留（191–193 百度再导出）。`session.ts` / `baidu.ts` 无匹配（baidu.ts 已删）。

```
npm test -w core-engine -- http-adapter
→ exit 0; Test Files 1 passed (1); Tests 27 passed (27) (vitest 3.2.7)
```

内存 health：`GET /api/health` 断言 `ocr: "skip"`（及 postgres/qdrant/neo4j/minio skip）仍绿。Rn: R1、R4、R7。

## APT Micro-closeout
- ContractsRegistered: none（无新公开导出）
- AssetsRefreshed:
  - `packages/core-engine/src/http/session.ts` → `frontend/core-engine/util/DemoHttpSession`（`kind=util`，`module=core-engine`，action=created）
  - `packages/core-engine/src/http/handle-request.ts` → `frontend/core-engine/util/handleDemoRequest`（`kind=util`，`module=core-engine`，action=created）
- AssetsRemoved:
  - `frontend/core-engine/util/BaiduOcr`（sourcePath=`packages/core-engine/src/ocr/baidu.ts`）
  - `frontend/core-engine/util/fromEnv`（sourcePath=`packages/core-engine/src/ocr/baidu.ts`）
- `audit_arch_changes`: not called

## Concerns
- 白名单外改了 `handle-request.ts` 一处 import：否则删除 `baidu.ts` 且不改 `index.ts` 时，`http-adapter` 无法 collect。Task 7 仍须把 `index.ts` 百度导出换成 `PaddleOcr` / `readPaddleOcrEnv` / `paddleOcrFromEnv`。
- `.ai/` 索引已由 MCP 更新但未进本 commit。
