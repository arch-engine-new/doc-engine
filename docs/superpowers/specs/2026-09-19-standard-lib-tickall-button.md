# standard_lib tickAll 按钮

- Status: draft
- Source: apt-accept RP-13 / C-13
- Risk: low
- Approval: auto_approved

## 背景

`designs/v0/standard_lib/page.logic.md` 要求「处理全部页」= 前端串行循环已有 `tick`，禁止全书一次 OCR。`PdfTickPanel.vue` 只有「处理一页」。

## 需求锁定

- 做：摄入区增加 PrimaryButton「处理全部页」，busy 时禁用；循环 `POST /api/standards/ingest-runs/:id/tick` 直到 `done` 或无 pending；单页 `ocr_error`/`index_error` 不中断其余 pending，已成功页不回滚。
- 不做：不新增全书 OCR 接口；不改 tick 服务端语义。

## 验收

1. 选择 PDF 登记后可见「处理全部页」
2. 点击后请求次数 ≥ 页数，每次 tick ≤1 页
3. 页 tag 显示 pending/ok/ocr_error/index_error
