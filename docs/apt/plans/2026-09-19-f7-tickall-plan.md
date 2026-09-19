---
status: approved
slice: F-7
chain: feature-light
---

# F-7 标准库 tickAll 处理全部页

**Status:** approved（`/apt-goal` 全自动自答，未经用户确认）

**Goal:** 标准库补上「处理全部页」tickAll，禁止只能手点一页（全自动自答，未经用户确认）

**验收标准:**

1. 登记成功后可见 PrimaryButton「处理全部页」，前端串行循环已有 `tick` 直到无 pending
2. 单次 tick 仍 ≤1 页；`ocr_error`/`index_error` 不中断其余 pending、不回滚已 ok 页
3. 不新增全书一次 OCR 接口；`PdfTickPanel` 不再只有「处理一页」

## Part 1

**范围:** `PdfTickPanel` 增加主按钮「处理全部页」（`button.btn`，busy 禁用）。`index.vue` 串行调用已有 `tickStandardIngest` 直至 `done`。抽出 `runTickAll` 纯函数便于测循环。不改服务端 tick 语义。不新增 `/tick-all` API。

**设计：** `query_design` global `PrimaryButton` → `button.btn`；page `standard_lib` 磁盘 `page.logic.md` 已有 tickAll（MCP logicMarkdown 摘要可能旧）。gaps `no-implementation-ref` 为本仓库 v0/Vue 历史缺口，与 F-1 同类，不阻塞本片按钮。禁止新 hex。

**寻址:** PdfTickPanel 现仅 Ghost「处理一页」；`tickPage` 已存在。

## Part 2

### Task 1: 红灯

- [ ] 新增 `packages/core-engine/test/standard-lib-tickall.test.ts`
  1. 读 `PdfTickPanel.vue` 含「处理全部页」且该按钮 `class="btn"`（非仅 ghost）
  2. `runTickAll`：mock tick 3 次后 done，调用次数 3；单次 mock 只推进 1 页
  3. 中间 `ocr_error` 仍继续直到 done
  4. 源码 `http.ts` 无新的全书 OCR path（不得出现 `ingest-all` / `tick-all`）
- [ ] `runTickAll` 从 `apps/web/src/views/standard_lib/tick-all.ts` 导入（尚未存在 → 红灯）
- [ ] 禁止改 Vue 实现

**Files:** `packages/core-engine/test/standard-lib-tickall.test.ts`

**Verify:** `npx vitest run test/standard-lib-tickall.test.ts` cwd core-engine 期望 FAIL

### Task 2: 绿灯

- [ ] 实现 `tick-all.ts` 的 `runTickAll`
- [ ] PdfTickPanel emit `tickAll`；主按钮「处理全部页」
- [ ] index.vue `@tick-all` 循环 `tickStandardIngest`；ocr/index error 不 break
- [ ] 微闭环 refresh PdfTickPanel / index.vue（若索引）
- [ ] Verify PASS；`apps/web` `npm run typecheck` 若可行

**Files:**

- `apps/web/src/views/standard_lib/tick-all.ts`
- `apps/web/src/views/standard_lib/PdfTickPanel.vue`
- `apps/web/src/views/standard_lib/index.vue`
- `packages/core-engine/test/standard-lib-tickall.test.ts`
