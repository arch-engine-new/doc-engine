# Task 3 Brief — F-1 点击命中行打开详情

review-tier: full
BASE_SHA: 2cb107f399d7f9e3125b679043979c7bd35028ba
plan: docs/apt/plans/2026-09-19-standard-lib-hit-detail-plan.md
report: .apt/orchestration/task-f1-3-report.md

## Goal

点击命中行打开详情，展示该条 heading + body（表/附件为 caption/单元格文本）。出处五列保留，行内不塞全文。table/annex 的 clause 列仍为 —。未选中详情 closed。只改 standard_lib。`index.vue` ≤300 行。

## 上一 Task

Task 1/2 已把 heading/body 带回 hits 与 prompt。本 Task 只做 Vue 详情 + 源码级断言。

## 步骤（TDD 先红后绿）

- [ ] 只读 MCP：`query_design` page=`standard_lib`；`query_design` scope=`global`；`query_design` component=`DataTable`；`query_design` component=`WorkbenchCard`；`query_arch` path=`frontend/web/component#retrievehitstable`。磁盘 `designs/v0/standard_lib/page.logic.md` 的 `openHitDetail` 是 UI 真源（MCP logicMarkdown 可能落后）。禁止改 page.logic.md。禁止未经 MCP 读 `.ai/`。
- [ ] `designs/v0/standard_lib/test-cases.md` 已由规划步写好，可微调，不得删 T1–T7，不得改 page.logic.md。
- [ ] **先写失败测试** `packages/core-engine/test/standard-lib-hit-detail.test.ts`：`readFileSync` 仓库根 `apps/web/src/views/standard_lib/` 下源码
  - `RetrieveHitsTable.vue` 表头仍含 file_name、页、unit_id、clause_id、路径；**不得**出现正文/heading 的 `<th>`
  - table/annex/`clause_id==null` 仍返回 `—`（保留 `clauseLabel`）
  - 存在行 click / emit 选中（如 `@click` 与 emit）
  - `HitDetailPanel.vue` 存在且展示 heading 与 body（或「无标题」「无正文」）
  - `index.vue` 引用 HitDetailPanel；未选中不强制弹出；`<StepChat` 仍按 packId 挂载
  - `index.vue` 行数 ≤300
  - 先跑 Verify：**必须 RED**（当前无 HitDetailPanel）
- [ ] **最小实现**
  - `RetrieveHitView` 增加可选 heading/body
  - `RetrieveHitsTable`：props 可含 selectedKey；emit `select`；`<tr @click>`；不增正文列；颜色用现有 class
  - 新建 `HitDetailPanel.vue`：一个文件一个组件；`section.card`；选中 hit 展示标题+正文；无选中可 v-if 由父控制
  - `index.vue`：selectedHit ref；search 后可清空选中；把 hits 原样给 StepChat
  - 禁止改其它 8 页、禁止改 StepChat.vue、禁止硬编码新 hex
- [ ] GREEN：Verify 命令全绿
- [ ] 微闭环：refresh_asset 白名单内 vue/types。无新对外 TS 类型名则不 register 新契约（RetrieveHitView 若仅字段演进，可 register_contract name=`RetrieveHitView` 若该名已有则更新）。禁止 audit_arch_changes。
- [ ] git add 仅白名单 commit：`feat(standard-lib): open retrieve hit detail with heading and body`

## Files 白名单

- `apps/web/src/services/types.ts`
- `apps/web/src/views/standard_lib/RetrieveHitsTable.vue`
- `apps/web/src/views/standard_lib/HitDetailPanel.vue`
- `apps/web/src/views/standard_lib/index.vue`
- `packages/core-engine/test/standard-lib-hit-detail.test.ts`
- `designs/v0/standard_lib/test-cases.md`
- `.apt/orchestration/task-f1-3-report.md`

## Verify

```
npx vitest run test/standard-lib-hit-detail.test.ts test/standard-lib-stepchat.test.ts
```

cwd: `packages/core-engine`

对应 Rn：R2 / R3 / R5 / R7

## 编码规范

- 一个文件一个组件；组件 ≤300 行；`index.vue` ≤300
- props 必须有 type
- 注释说为什么（点击才 open；表不得塞全文；table clause_id 显示 —）
- 颜色用 `--apt-*` / 现有 class，禁止新 hex
- 列表 key 不得用 index

## Report

写满 `.apt/orchestration/task-f1-3-report.md`。
