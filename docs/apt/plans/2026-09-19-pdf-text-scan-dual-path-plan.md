---
status: approved
slice: F-8
chain: full
---

# F-8 PDF 文字层与扫描双路径

**Status:** approved（`/apt-goal` 全自动自答）
**Spec:** `docs/superpowers/specs/2026-09-19-pdf-text-scan-dual-path-design.md`

**Goal:** 打通规范 PDF 文字层与扫描页双路径（全自动自答，未经用户确认）

**验收标准:** 队列 F-8 四条；live 禁止 FakeOcr；小夹具。

## Part 1

实现已在 `ingest-worker.ts` `resolvePageText`。本片以测试锁住分流 + 混排夹具；若 live HTTP ingest 仍 FakeOcr 则接线 `requireLiveOcr`。禁止 259 页 OCR。

## Part 2

### Task 1 红灯

新增 `packages/core-engine/test/ingest-pdf-dual-path.test.ts`（期望 FAIL 若缺混排/文字层 ingest 用例）：

1. 文字层 PDF（`examples/` 最小 PDF 或合成 Han 页）tick 一页：SpyOcr.layoutCalls.length===0；search 能命中
2. 空白页 emptyPagesPdf：layoutCalls≥1 且 mime image/png
3. 混排 2 页 PDF：第 1 页 layoutCalls 不增加、第 2 页增加；两页 status ok；检索两路
4. 单次 tick page_no 只变一页
5. `requireLiveOcr` 返回非 FakeOcr（F-5 已绿，作回归）

禁止改实现。

**Files:** `packages/core-engine/test/ingest-pdf-dual-path.test.ts`

**Verify:** `npx vitest run test/ingest-pdf-dual-path.test.ts` 期望 FAIL（若 1–3 已全绿则允许 DONE_WITH_CONCERNS 并在 report 说明实现已存在，Task 2 只补缺口）

### Task 2 绿灯

补混排夹具生成与任何分流 bug。live ingest 默认 OCR 不得 FakeOcr。不新增全书 API。

**Files:** ingest-worker.ts（仅当测试证明 bug）、dual-path 测试、必要时 pdf fixture helper

**Verify:** 同上期望 PASS + `npx vitest run test/ingest-pdf.test.ts test/live-no-fake-ocr.test.ts`
