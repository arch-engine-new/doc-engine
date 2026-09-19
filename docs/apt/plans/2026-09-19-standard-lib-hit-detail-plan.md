---
status: approved
feature: F-1 standard_lib hit detail heading+body
slice: F-1
---

# F-1 检索命中详情（标题+正文） Implementation Plan

> **Spec:** `docs/superpowers/specs/2026-09-19-standard-lib-hit-detail-design.md`
> **Command:** `/plan-from-spec`
> **Status:** approved

**Goal:** 配置人员检索命中后能打开详情阅读账本 heading + body，出处列仍在，本步对话能引用正文。

**Architecture:** 不改预查询/向量/rerank/图路由。在已有 `toHit` / `toUnitHit` 把 `ClauseRow.heading/body` 与 `LayoutUnitRow.heading/body_markdown` 抄进 `RetrieveHit` 可选字段；Vue 点击行打开详情面板（表格不塞全文）；`parseRetrieveHits` + `formatRetrieveHitsForPrompt` 把正文带进本步对话（prompt 单条 body 截断 800 字）。

> 全自动自答（`/apt-goal --continue` programMode）。相位机曾报 `nextAction=none/loopDone`（把 auto_approved spec 当成整环结束）及 `specRisk=high`（与 spec `risk: low` 不符）——程序模式以 `playbook-state.json` 切片为准，本批无 ACCEPT-BATCH。

---

## Part 1 — 技术方案（APT 寻址）

### 1.1 范围与约束

**做：** 命中带回 heading/body；命中行打开详情；对话引用正文；出处五列保留；table/annex 的 `clause_id` 仍为 null / UI `—`。

**不做：** 改检索算法；Prompt 编造正文；全文塞进每一行表；table/annex `unit_id` 写入 `clause_id`；改其它 8 页；新开详情 HTTP。

**Profile：** `.apt/role.md` `projectType: component`（跳过 B2 test-cases Gate），但 `typeHealth.suggested=business` 且本片含 UI。不改写 projectType；仍做设计寻址与 Vue Task（与 B-3 同口径）。test-cases 规划写入 `designs/v0/standard_lib/test-cases.md`（切片 done-when）。

### 1.2 设计寻址

| 项 | MCP 结果 | 约束摘要 |
|----|----------|----------|
| global | `query_design scope=global` | apt-skyline-clean；Vue；tokens `--apt-*`；禁止页面硬编码新 hex；禁止预置公路/水利/房建包 |
| page `standard_lib` | `query_design page=standard_lib` approved | MCP `logicMarkdown` **落后于磁盘** `designs/v0/standard_lib/page.logic.md`（已含 `openHitDetail` / A18）。**以磁盘 page.logic 为准**。gaps=`no-implementation-ref`（无 page.tsx，Vue 已有）不 `report_design_gap` |
| DataTable | `query_design component=DataTable` | 工作台表；现网 `RetrieveHitsTable` 已是 native `<table>`，保持五列出处 |
| WorkbenchCard | `query_design component=WorkbenchCard` | 详情用 `section.card`；颜色走 tokens |
| StepChatPanel | `query_design component=StepChatPanel` | 不改 StepChat.vue；hits 带正文即可 |

### 1.3 依赖寻址表

| 依赖 | 来源 | 引用 | 摘要 |
|------|------|------|------|
| RetrieveHit | contract | `packages/core-engine/src/retrieve/ports.ts` | 出处齐全，无 heading/body |
| ChunkKind | contract | 同上 | clause/table/annex；表不得占用 clause_id |
| ClauseRow | contract | `docs/schema/generated/core-engine-rows.ts` | heading / body 已在账本 |
| LayoutUnitRow | contract | 同上 | heading / body_markdown |
| StandardLibrary | contract | `packages/core-engine/src/retrieve/library.ts` | `toHit`/`toUnitHit` 未抄正文 |
| SearchStandardInput | contract | 同上 | packId + query；不改算法 |
| JobContextSnapshot | contract | `packages/core-engine/src/agent/context.ts` | `formatRetrieveHitsForPrompt` 只拼 id |
| DemoHttpAdapter | contract | `packages/core-engine/src/http/handle-request.ts` | `parseRetrieveHits` 丢 heading/body |
| RetrieveHitsTable | arch `query_arch frontend/web/component#retrievehitstable` | `apps/web/src/views/standard_lib/RetrieveHitsTable.vue` | 五行出处，无 click |
| formatRetrieveHitsForPrompt | arch `query_arch frontend/core-engine/util#formatretrievehitsforprompt` | `packages/core-engine/src/agent/context.ts` | 对话拼装 |
| StandardLib | search_arch | `apps/web/src/views/standard_lib/index.vue` | 接线详情；≤300 行须拆面板 |

无 `report_missing`。无建表（§0.6 跳过）。

### 1.4 拟改动模块与文件

| 文件/模块 | 变更类型 | 说明 |
|-----------|----------|------|
| `packages/core-engine/src/retrieve/ports.ts` | modify | 可选 `heading?` / `body?` |
| `packages/core-engine/src/retrieve/library.ts` | modify | toHit/toUnitHit 水合 |
| `packages/core-engine/src/agent/context.ts` | modify | prompt 含标题+截断正文 |
| `packages/core-engine/src/http/handle-request.ts` | modify | parse 透传 |
| `apps/web/src/services/types.ts` | modify | RetrieveHitView 对齐 |
| `apps/web/src/views/standard_lib/RetrieveHitsTable.vue` | modify | 行 click，不增正文列 |
| `apps/web/src/views/standard_lib/HitDetailPanel.vue` | new | 详情 |
| `apps/web/src/views/standard_lib/index.vue` | modify | 选中态；≤300 行 |
| `packages/core-engine/test/standard-rag.test.ts` | modify | T1/T2 |
| `packages/core-engine/test/standard-lib-stepchat.test.ts` | modify | T3/T4/T6 |
| `packages/core-engine/test/standard-lib-hit-detail.test.ts` | new | T5 源码断言 |
| `designs/v0/standard_lib/test-cases.md` | new | B1.5 规划 |

### 1.5 风险与未决项

- 夹具 `RetrieveHit` 字面量：字段可选，不补也能编译；断言必须显式查 heading/body。
- `index.vue` 近 300 行：详情必须拆 `HitDetailPanel.vue`。
- 不改 `prequery.ts` / `rerank.ts` / 向量实现。
- MCP `loopDone=true` 是相位机误判，忽略。

### 1.6 需求锁定对照

| Rn | 优先级 | 覆盖 Task | 备注 |
|----|--------|-----------|------|
| R1 | must | Task 1 | searchStandard 带回账本文本 |
| R2 | must | Task 3 | 点击打开详情 |
| R3 | must | Task 3 | 出处五列、无全文 th |
| R4 | must | Task 2 | prompt 含 heading+body |
| R5 | must | Task 1 + Task 3 | table clause_id null / UI — |
| R6 | must | Task 1 | 不改算法；空 body 不编造 |
| R7 | must | 全 Task 白名单 | 只 standard_lib |
| R8 | nice | Task 2 | prompt 截断 800 |

must 全覆盖。

---

## Part 2 — 可执行任务清单

### Task 1: 命中水合 heading/body（R1/R5/R6）

- [ ] 只读 MCP：`query_contract` name=`RetrieveHit`；`query_contract` name=`ClauseRow`；`query_contract` name=`LayoutUnitRow`；`query_contract` name=`StandardLibrary`
  - **MCP:** 同上
  - **Files:** （只读）
- [ ] TDD：在 `standard-rag.test.ts` 现有 `searchStandard("1.1")` 用例断言 `heading` 含「1.1 事假须提前申请」、`body` 含「须在休假前」；表命中用例断言 `clause_id===null` 且 heading/body 来自 layout unit（非条款号）
  - **Files:** `packages/core-engine/test/standard-rag.test.ts`
- [ ] 最小实现：`RetrieveHit` 增加可选 `heading?: string \| null`、`body?: string \| null`；`toHit` 抄 clause；`toUnitHit` 抄 `unit.heading` / `unit.body_markdown`。禁止改 prequery/rerank/search 路由。
  - **Files:** `packages/core-engine/src/retrieve/ports.ts`, `packages/core-engine/src/retrieve/library.ts`
  - **Verify:** `npx vitest run test/standard-rag.test.ts`（cwd `packages/core-engine`）——对应 R1/R5/R6
  - **Contracts:** `RetrieveHit`（字段演进，`register_contract`）

### Task 2: 本步对话引用正文（R4/R8）

- [ ] 只读 MCP：`query_contract` name=`JobContextSnapshot`；`query_arch` path=`frontend/core-engine/util#formatretrievehitsforprompt`；`query_contract` name=`DemoHttpAdapter`
  - **MCP:** 同上
- [ ] TDD：`formatRetrieveHitsForPrompt` 含 heading 与 body 片段（不只 `clause_id=`）；空列表仍「未命中」；HTTP `parseRetrieveHits` 往返保留 heading/body；超长 body prompt 含 `…` 且长度受控
  - **Files:** `packages/core-engine/test/standard-lib-stepchat.test.ts`
- [ ] 实现：`formatRetrieveHitsForPrompt` 拼 heading + body（单条 body 最多 800 字符，超出加 `…`）；`parseRetrieveHits` 透传字符串 heading/body。禁止改 StepChat.vue。
  - **Files:** `packages/core-engine/src/agent/context.ts`, `packages/core-engine/src/http/handle-request.ts`
  - **Verify:** `npx vitest run test/standard-lib-stepchat.test.ts`（cwd `packages/core-engine`）——对应 R4/R8
  - **Contracts:** `JobContextSnapshot` 若未改导出形状则不重复登记

### Task 3: 点击命中行打开详情（R2/R3/R5/R7）

- [ ] 只读 MCP：`query_design` page=`standard_lib`；`query_design` scope=`global`；`query_design` component=`DataTable`；`query_design` component=`WorkbenchCard`；`query_arch` path=`frontend/web/component#retrievehitstable`
  - **MCP:** 同上
- [ ] 写入 `designs/v0/standard_lib/test-cases.md`（本 plan 规划表，不得改 `page.logic.md`）
  - **Files:** `designs/v0/standard_lib/test-cases.md`
- [ ] TDD：新测读 Vue 源，断言表头五列仍在、无全文 `<th>`、存在 `HitDetailPanel`、`openHitDetail` 或选中态、`clauseLabel` 对 table/annex 仍 `—`
  - **Files:** `packages/core-engine/test/standard-lib-hit-detail.test.ts`
- [ ] UI：`RetrieveHitView` 加 heading/body；表行 click emit；`HitDetailPanel` 展示选中命中；未选中 closed；`index.vue` ≤300 行。颜色用 `--apt-*`。
  - **Files:** `apps/web/src/services/types.ts`, `apps/web/src/views/standard_lib/RetrieveHitsTable.vue`, `apps/web/src/views/standard_lib/HitDetailPanel.vue`, `apps/web/src/views/standard_lib/index.vue`
  - **Verify:** `npx vitest run test/standard-lib-hit-detail.test.ts test/standard-lib-stepchat.test.ts`（cwd `packages/core-engine`）——对应 R2/R3/R5/R7

子 Agent 每 Task 自动 commit。禁止 `audit_arch_changes`（留给 PB-5）。
