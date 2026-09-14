# Task 7 Report — 导出、手册、本地 env（不提交密钥）

## Status
DONE

## Commits
`bad3ee041a7261eee395943c2db304727b81da6c` feat(ocr): export PaddleOCR barrel and rewrite live OCR handbook

BASE_SHA: `9c8dfd9ae169fd1d9a3611d5ac119fb1c9f5b65b`

未 `git add` `apps/web/.env`。未提交 `.ai/`（refresh 落在工作区，原先已脏）。未调用 `audit_arch_changes`。`PaddleOcr` / `PaddleOcrEnvConfig` 已登记，未再 `register_contract`。

## Changes
- MCP 只读：`query_project_status` → `projectType=component`，无 blockers。`query_contract` name=`PaddleOcr` / `PaddleOcrEnvConfig` / `OcrPort` 命中。`query_contract` name=`readPaddleOcrEnv` / `paddleOcrFromEnv` 未命中 → `search_arch` + `query_arch` path=`frontend/core-engine/utils#readpaddleocrenv` → `packages/core-engine/src/ocr/env.ts`。未 `report_missing`。
- `packages/core-engine/src/index.ts`：删除全部百度再导出。改为 `PaddleOcr`、`fromEnv as paddleOcrFromEnv`、`readPaddleOcrEnv`、`PaddleOcrEnvConfig`。
- `packages/core-engine/src/ocr/fake.ts`：注释去掉 `BAIDU_*`，改为不读 `PADDLEOCR_*` env。
- `docs/使用手册.md`：live OCR 改为 PaddleOCR AI Studio + `PADDLEOCR_ACCESS_TOKEN`。有文字层 PDF → Unicode 抽字 `vendor=pdf-text`；无文本层扫描 PDF → `OcrPort`。删除百度 AK/SK / `error_code` 17/18 配置指导。health 改为鉴权 GET、不提交任务。
- `apps/web/.env`：写入 `PADDLEOCR_ACCESS_TOKEN`（保留原有库键；另加可选 model/url/timeout 注释）。**未暂存、未提交。** 本报告不含 token 值。

## Tests / Verify
```
git diff --cached -- apps/web/.env
```
空（feat commit 前后均为空）。`git check-ignore` 命中 `.gitignore:7:apps/web/.env`。`.env` 已写入非空 token 行；其它既有键保留。

```
rg -n "BAIDU_OCR|BaiduOcr|aip.baidubce.com" packages/core-engine/src apps/web/.env.example docs/使用手册.md
```
无匹配（rg exit 1，stdout 空）。`packages/core-engine/src/ocr/` 现仅 `env.ts` / `fake.ts` / `paddleocr.ts` / `pdf-text.ts` / `port.ts`。Rn: R1、R2、P9。

## APT Micro-closeout
- ContractsRegistered: none（`PaddleOcr`、`PaddleOcrEnvConfig` 已登记；barrel 别名不另登记）
- AssetsRefreshed:
  - `packages/core-engine/src/ocr/fake.ts` → `frontend/core-engine/util/FakeOcr`（`kind=util`，`module=core-engine`，action=created）
  - `packages/core-engine/src/index.ts` → `frontend/core-engine/util/index`（`kind=util`，`module=core-engine`，action=created）
- AssetsRemoved: none
- `audit_arch_changes`: not called

## Concerns
无。token 未写入本 report / commit message / 手册 / `.env.example`。`.ai/` 索引已由 MCP 更新但未进本 commit。
