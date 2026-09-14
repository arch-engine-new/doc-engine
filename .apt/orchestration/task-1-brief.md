# Task 1 Brief — 环境变量与删除百度配置面

plan: `docs/apt/plans/2026-09-14-paddleocr-aistudio-replace-plan.md`
projectType: component
review-tier: light

## 步骤

- [ ] 将 `env.ts` 改为 `readPaddleOcrEnv`：`PADDLEOCR_ACCESS_TOKEN` 空→`null`；可选 `PADDLEOCR_MODEL` 默认 `PaddleOCR-VL-1.6`、`PADDLEOCR_JOB_URL` 默认 `https://paddleocr.aistudio-app.com/api/v2/ocr/jobs`、`PADDLEOCR_POLL_TIMEOUT_MS` 默认 `180000`。删除 `BAIDU_OCR_*` / `parseBaiduOcrApi` / `DEFAULT_BAIDU_OCR_API`。
  - **MCP:** `query_arch` path=`frontend/core-engine/utils#readbaiduocrenv`
- [ ] `.env.example` 替换为 Paddle 键（可空）；删除百度两键。

## Files 白名单（仅可改这些）

- `packages/core-engine/src/ocr/env.ts`
- `apps/web/.env.example`

## Verify

```
rg -n "BAIDU_OCR|BaiduOcr|aip.baidubce.com" packages/core-engine/src/ocr/env.ts apps/web/.env.example
```

须无匹配。Rn: R1、R2。

## 约束

- Token 永不写进代码/注释/错误文案。
- `readPaddleOcrEnv` 两键都空或 token 空 → `null`。token 有值才返回 config。
- 导出类型用 `PaddleOcrEnvConfig`（含 token、model、jobUrl、pollTimeoutMs）。
- **不要**改 `baidu.ts` / `session.ts` / `index.ts`（后续 Task）。它们暂时编译失败是预期，report 里写 `DONE_WITH_CONCERNS` 即可。
- 公开导出须有「为什么」注释（code-standards）。
- 微闭环：新对外类型 `register_contract`；改动的已索引 `env.ts` → `refresh_asset`；删除的百度 env 资产 → `remove_asset`。禁止 `audit_arch_changes`。

## Part 1 摘要

删除百度智能云 OCR env，live 只认 PaddleOCR AI Studio Access Token。CI/FakeOcr 不读这些键。

## 编码规范

见 `.apt/code-standards.md`：camelCase；TS 须有明确 return type；导出函数注释说为什么；禁止无意义注释。

## Report

写满 `.apt/orchestration/task-1-report.md`，含 Status、commits、Verify 输出、APT Micro-closeout（ContractsRegistered / AssetsRefreshed / AssetsRemoved）。然后 `git commit` 本 Task。
