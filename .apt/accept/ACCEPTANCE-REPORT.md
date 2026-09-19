# ACCEPTANCE-REPORT

**Overall:** FAIL  
**Date:** 2026-09-19  
**Plan/范围:** `$apt-accept` 网上公开《建设工程质量管理条例》入库向量库 + `standard_lib` 全量 RP

## 1. 范围与环境

- baseUrl: `http://localhost:5173`（Vite live）
- 法规：国务院令第279号《建设工程质量管理条例》（2019年第二次修订）
- 来源：https://www.gov.cn/gongbao/content/2019/content_5468867.htm
- 文本：`.apt/accept/sources/construction-quality-management-ordinance.txt`
- pack：`pack_88632d0869d7468c`　生效版：`sver_b2e66c52b1e749bb`
- 入库：82 条条款；Qdrant `clauses` points_count=88，vector_size=1024
- 本批未调用 `/api/demo/reset`（避免清库）
- 探针：facade/asciiHeader/backendHealth pass；reset WARN

## 2. 页面结果表

| pageId | gate | 结果 | 备注 |
|--------|------|------|------|
| standard_lib | exit 1 | FAIL | RP-13 tickAll 无「处理全部页」按钮 |
| 其余 8 页 | deferred | — | 本批只跑标准库入库场景 |

## 3. 全量 RP 覆盖表

| page | rpId | kind | caseId | 状态 |
|------|------|------|--------|------|
| standard_lib | RP-01 | view_load | C-01 | pass |
| standard_lib | RP-02 | upload | C-02 | pass |
| standard_lib | RP-03 | action | C-03 | pass |
| standard_lib | RP-04 | action | C-04 | pass |
| standard_lib | RP-05 | dropdown | C-05 | pass |
| standard_lib | RP-06 | action | C-06 | pass |
| standard_lib | RP-07 | action | C-07 | pass |
| standard_lib | RP-08 | action | C-08 | pass |
| standard_lib | RP-09 | action | C-09 | pass |
| standard_lib | RP-10 | state | C-10 | pass |
| standard_lib | RP-11 | other | C-11 | pass |
| standard_lib | RP-12 | action | C-12 | pass |
| standard_lib | RP-13 | action | C-13 | fail |
| standard_lib | RP-14 | action | C-14 | pass |
| standard_lib | RP-15 | action | C-15 | pass |

## 4. gate 失败 / 未覆盖项

- RP-13 / C-13 NOT_PASS：`PdfTickPanel.vue` 只有「处理一页」，page.logic 要求 PrimaryButton「处理全部页」循环 `tick`。
- 单页 API tick 已绿（C-12）；二次 tick `done=true`，缺的是 UI 循环按钮。

## 5. 环境阻塞

无 probe fail。reset 探针 WARN：本批故意不 reset。

## 6. 未覆盖清单

无 blocked-no-data / blocked-consumed。

## 7. 缺陷与 feature 修复队列

见 `.apt/accept/fix-queue.json`：

- `standard-lib-tickall-button-missing`（low，RP-13）→ 默认 `/feature`
- 既有 `live-empty-jobs-auto-reset-wipes-stores`（high，未本批复验）

## 8. 各页 accept-gate exit 汇总

| pageId | exit |
|--------|------|
| standard_lib | 1 |

## 入库检索抽查（非 RP 表）

| 问句 | 路径 | 首条 |
|------|------|------|
| 第二条 | exact | 第二条 适用范围 |
| 偷工减料 | vector | 第六十四条（罚则） |
| 肢解发包是什么 | vector | 第七十八条（定义） |
| 第六十四条 引用 | graph | 第二十八条（CITES） |
