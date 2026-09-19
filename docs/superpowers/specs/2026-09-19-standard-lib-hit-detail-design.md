---
title: F-1 检索命中详情：条款标题与正文
date: 2026-09-19
status: approved
risk: low
phase: approved
approvedAt: 2026-09-19T05:40:00.000Z
approvedBy: apt-auto-brainstorm
topic: standard-lib-hit-detail
mode: apt-auto-brainstorm
feature: core-engine
pages:
  - standard_lib
parentSpec: docs/superpowers/specs/2026-08-27-slice-6-standard-rag.md
---

# Design Spec: 检索命中可阅读标题与正文（F-1）

## Goal

配置人员在 `standard_lib` 检索有命中后，必须能读到「查到了什么」：条款 **heading + body**（表/附件为 caption / 单元格可读文本）。出处列（file_name / 页 / unit_id / clause_id / 路径）保持现状。本步对话引用命中时须带正文，不得只回 `clause_id` 并声称看不到原文。

验收锚点：PRD A18、`designs/v0/standard_lib/page.logic.md` 的 `openHitDetail`。

## 范围

1. **命中带回正文**：`searchStandard` 产出的 `RetrieveHit` 带 `heading` + `body`（来自账本，不是 Prompt 编造）。
2. **命中行打开详情**：点击表格行 → 详情面板展示 heading + body；表格行本身仍只列出处，禁止把全文塞进每一行。
3. **本步对话引用正文**：`formatRetrieveHitsForPrompt` 拼 heading + body 片段；HTTP 把 Vue 回传的 hits 解析时不得丢掉这两字段。
4. **出处列与身份规则不变**：table/annex 的 `clause_id` 仍为 `null`（UI 显示 —）；`unit_id` 不写入 `clause_id`。
5. **只改 standard_lib 本页**及相关检索/对话拼装；不改其它 8 页。

## 非目标

- 不改检索算法（预查询 / 向量 / rerank / 图路由保持现状）。
- 不用 LLM Prompt 编造或补全正文。
- 不把全文塞进命中表每一行。
- 不把 table/annex 的 `unit_id` 写入 `clause_id`。
- 不新开独立「按 unit_id 再拉一次详情」HTTP（YAGNI：账本字段已在 `toHit` / `toUnitHit` 路径上）。
- 不改其它 8 页、不新增第 10 页、不替代 DSL 硬规则。

## 现网缺口（查证）

| 点 | 证据 | 缺口 |
|----|------|------|
| 账本已有正文 | `query_contract ClauseRow`：`heading` / `body`；`LayoutUnitRow`：`heading` / `body_markdown` | 检索未带回 |
| 命中形状 | `query_contract RetrieveHit` @ `packages/core-engine/src/retrieve/ports.ts`：出处字段齐全，无 heading/body | 详情无数据 |
| 组装 | `library.ts` `toHit` / `toUnitHit` 只抄 provenance | Clause/LayoutUnit 正文被丢掉 |
| 对话 | `formatRetrieveHitsForPrompt` 只拼 `clause_id`/`unit_id`/`file_name` | LLM 看不到原文 |
| HTTP 回传 | `parseRetrieveHits` 不读 heading/body | Vue 即使带上也会被丢掉 |
| UI | `RetrieveHitsTable.vue` 五行出处列，无 click / 无详情 | `openHitDetail` 未实现 |
| 设计真源 | 磁盘 `designs/v0/standard_lib/page.logic.md` 已含 `openHitDetail` / A18；`_pages.md` `approved=yes` | `query_design(page=standard_lib)` 的 `logicMarkdown` 仍为 refine 前快照，**以磁盘 page.logic 为准** |

`query_ontology(topic=retrieve standard_lib heading body)`：命中 `RetrieveHitsTable`、`StandardLibrary`、`createSearchClauseToolHandler`、`StandardLib`。复用这些资产，不新造检索栈。

## 方案（≥2 机制类）

### 方案 A — 检索命中顺带水合正文 + 点击详情（推荐）

机制类：**行为证据**（检索返回真实账本文本；UI 打开详情；对话 prompt 含正文）兼轻量字段扩展。

- `toHit(clause)` 抄 `clause.heading` / `clause.body`。
- `toUnitHit(unit)` 抄 `unit.heading` / `unit.body_markdown`（表/附件的可读文本）。
- Vue：行 click → 选中态 + 详情面板。
- `formatRetrieveHitsForPrompt` 输出 heading + 截断 body。

**Trade-offs**：命中 JSON 变大；超长条款会进 prompt。用截断上限缓解。  
**隐藏成本**：既有 `RetrieveHit` 字面量夹具要补字段（可选字段则可编译通过，测试须显式断言）。  
**失败模式**：账本空 body → 详情显示「无正文」，禁止用模型补。  
**依赖前提**：`t_clause` / `t_layout_unit` 已有正文（查证：ClauseRow / LayoutUnitRow）。

### 方案 B — 只加静态门禁 / 类型注释（否决）

机制类：**静态闸门**。给类型加字段或 grep 断言，UI 不点、对话不改。  
**失败模式**：绿灯 ≠ 用户能看见正文（镜 2 形状≠行为）。不选。

### 方案 C — 新详情 HTTP，点击再拉 unit（否决）

机制类：**流程重组**。`GET /api/standards/units/:id` 懒加载；对话仍要二次拉取。  
**隐藏成本**：多一个路由、多一轮失败面、文件数易超过本片预算。  
**失败模式**：用户已检索命中却详情 404。  
**为何最贵真机制不是默认**：懒加载适合「百万字全书」，当前条款 body 已在账本、`toHit` 已持有 `ClauseRow`——再开 HTTP 没有已确认需求（YAGNI）。

### 最强反方 → 推荐项回应

攻击：把正文放进每一次 `RetrieveHit` 会撑爆表格和 LLM 上下文，用户会以为「检索变慢/变蠢」。  
回应：表格**禁止**渲染 body；详情面板按选中行展示；prompt **截断**（见数据流）。不改召回/rerank，故检索相关性不变。攻击后推荐项仍成立。

### 为什么最贵的真机制不是默认

最贵 = 方案 C（独立详情 API + 分页/流式正文）。本片用户原话是「不知道查到了什么」，证据档位是「打开详情能看见账本 heading+body」和「对话能引用」，不是「按需流式加载百万字」。方案 A 直接改变用户可见世界，成本落在已有 `toHit` 路径。

## 设计

### Architecture

不改 `searchSemantic` / `searchExact` / `searchGraph` 路由。只在已有命中装配点注入账本文本：

```
t_clause.heading/body  ──► toHit      ──► RetrieveHit.heading/body
t_layout_unit.heading/body_markdown ──► toUnitHit ──┘
        │
        ├─ POST /api/standards/search JSON
        │     └─ Vue hits → 行 click → 详情面板
        └─ POST /api/chat hits[] → parseRetrieveHits → formatRetrieveHitsForPrompt
```

### Components

| 组件 | 职责 |
|------|------|
| `RetrieveHit` | 已登记类型增加可选 `heading?: string \| null`、`body?: string \| null`（非必填，缺省视为无正文） |
| `StandardLibrary.toHit` / `toUnitHit` | 水合；table/annex 仍 `clause_id=null` |
| `formatRetrieveHitsForPrompt` | 每行含 heading + body 截断；空列表仍为「未命中」 |
| `parseRetrieveHits` | 透传 heading/body，禁止丢字段 |
| `RetrieveHitView` | 与引擎字段对齐 |
| `RetrieveHitsTable` | 行可点；emit 选中；**不增正文列** |
| `HitDetailPanel` | 新建，展示选中命中的 heading+body；空选中 = closed |
| `standard_lib/index.vue` | `openHitDetail` 状态；把 hits 原样交给 StepChat |

`index.vue` 已近 300 行上限：详情 UI **必须**拆到 `HitDetailPanel.vue`，禁止把全文 markup 堆进 index。

### Data flow

- 条款：`heading` = `ClauseRow.heading`（可 null），`body` = `ClauseRow.body`（可空串）。
- 表/附件：`heading` = `LayoutUnitRow.heading`（caption），`body` = `LayoutUnitRow.body_markdown`。
- Prompt 截断：单条 body 最多 **800 字符**，超出加 `…`；禁止把截断误标为「全文」。
- 详情面板：展示完整 body（账本已存多少就显示多少）；不做二次请求。
- 缺字段：详情写「无标题」/「无正文」；对话同样写明无正文。**禁止**用模型生成替代文本。

### Error handling

| 情况 | 行为 |
|------|------|
| 命中 0 | 表空态不变；详情 closed；对话「未命中」 |
| 命中有 id 无 body | 详情可见 heading（若有）+「无正文」 |
| table/annex | clause 列仍 —；详情用 caption/单元格文本 |
| 用户未点行 | 详情 closed，不自动弹出第一行（避免「没点也算打开」的形状伪装） |

### Testing（行为证据，非纯形状）

| ID | 行为（通过后世界不同） |
|----|------------------------|
| T1 | 夹具入库后 `searchStandard("1.1")` 的命中 `heading` 含「1.1 事假须提前申请」，`body` 含「须在休假前」 |
| T2 | 表命中 `clause_id===null`，`heading`/`body` 来自 layout unit，不是条款号 |
| T3 | `formatRetrieveHitsForPrompt([hit])` 含 heading 与 body 片段，不只 `clause_id=` |
| T4 | `parseRetrieveHits` 往返保留 heading/body |
| T5 | 出处五列仍在；详情不在 `<th>` 中增加全文列 |
| T6 | 空 hits 格式化为「未命中」（回归 B-1） |

T5 可用组件/模板断言（列名 + 详情另区）。T1–T4 必须跑引擎/HTTP 行为。浏览器点选作为实现期手工/可选，不把静态 grep 当 A18 主体。

## 追问记录

- 轮次：**2**（第 2 轮无新实质发现，收敛）
- 模式：全自动（`.apt/goal.md` 存在）；S3 均有 MCP/源码查证

### 第 1 轮

| 镜头 | 关键追问 | 结论 / 修订 |
|------|----------|-------------|
| S1 场景 | 谁在什么情况下要看见正文？空库？ | 配置人员在 standard_lib 检索后；点击命中行。空库保持「尚无命中」。 |
| S2 破坏 | 砍一半保哪半？伪需求？ | 保「能读到账本 heading+body」。砍：改算法、Prompt 编正文、行内塞全文。 |
| S3 可行 | 现有组件能否支撑？ | 能：ClauseRow/LayoutUnit 已有正文；缺口只在 toHit 与 UI/prompt。`query_design` 快照落后于磁盘 page.logic，不阻塞。 |
| S4 验收 | 怎样证明？ | A18：详情可见 heading+body；出处列仍在；对话能引用正文。 |

需求修订 v1→v2：明确「点击打开」而非自动展开第一行；表/附件走 layout 文本。

### 第 2 轮

| 镜头 | 关键追问 | 结论 / 修订 |
|------|----------|-------------|
| S1 | 未点击时详情？多命中？ | closed；一次选中一行。 |
| S2 | chat 回传丢字段？ | 必须改 `parseRetrieveHits`，否则 UI 有正文、对话仍只有 id。 |
| S3 | 独立详情 API？ | 否，toHit 已持有 ClauseRow。 |
| S4 | 验收是否形状？ | T1–T4 为运行断言；禁止只 grep 类型字段。 |

无新实质发现。残留：无。

### 需求修订 delta

- v1：命中要有标题正文。
- v2：水合点锁定 `toHit`/`toUnitHit`；对话链路含 parse；详情点击才 open；表走 `body_markdown`。
- v3：无（第 2 轮收敛）。

## 需求锁定表

| ID | 需求描述 | 来源 | 验收标准（可判定） | 优先级 |
|----|----------|------|--------------------|--------|
| R1 | 检索命中带回账本 heading + body | 用户明示（队列 F-1 / A18） | T1：`searchStandard("1.1")` heading/body 含夹具原文 | must |
| R2 | 点击命中行打开详情，展示 heading + body | 用户明示（page.logic `openHitDetail`） | 选中行后详情区可见该条 heading 与 body；未选中为 closed | must |
| R3 | 出处五列保留，行内不塞全文 | 用户明示 | 表头仍为 file_name / 页 / unit_id / clause_id / 路径；无全文 `<th>` | must |
| R4 | 本步对话能引用命中正文 | 用户明示 | T3：prompt 含 heading 与 body 片段 | must |
| R5 | table/annex 的 clause_id 仍为 — | 用户明示 | T2：`clause_id===null`；UI `clauseLabel` 仍 — | must |
| R6 | 不改检索算法、不编造正文 | 用户明示 | 不改 prequery/rerank/向量实现；空 body 显示「无正文」 | must |
| R7 | 只改 standard_lib，不动其它 8 页 | 用户明示 | 实现白名单不含其它 page views | must |
| R8 | 超长 body 截断仅用于 prompt | 追问确认 | prompt ≤800 字/条；详情仍展示账本全文 | nice |

无「AI 假设未确认」的 must。

## Ontology detection

调用：

- `query_ontology()` 项目快照
- `query_ontology(topic=retrieve standard_lib heading body)`
- `query_contract RetrieveHit` → `packages/core-engine/src/retrieve/ports.ts`
- `query_contract ClauseRow` → `heading` / `body` 已在生成类型
- `query_design scope=global`（Vue + tokens）
- `query_design page=standard_lib`（approved；logicMarkdown 滞后，磁盘为准）

复用决策：

| 资产 | 决策 | 理由 |
|------|------|------|
| `RetrieveHit` | **复用并扩展可选字段** | 已登记；不另造 HitDetail 类型 |
| `StandardLibrary.toHit` / `toUnitHit` | **复用** | 唯一装配点，避免第二套映射 |
| `RetrieveHitsTable` | **复用** | 加 click/emit，不加正文列 |
| `formatRetrieveHitsForPrompt` / `parseRetrieveHits` | **复用并补字段** | B-1 对话通道已存在 |
| `StepChat` | **不改** | 已接收 `hits`；正文随 hits 进来即可 |
| 新详情 HTTP | **不复用/不新增** | YAGNI |
| 其它 8 页 | **不碰** | 范围冻结 |

S3 缺口：无缺失契约需 `report_missing`。设计磁盘已含 `openHitDetail`，不 `report_design_gap`。

## 拟改动文件（≤8）

| 文件 | 变更 |
|------|------|
| `packages/core-engine/src/retrieve/ports.ts` | `RetrieveHit` 可选 heading/body |
| `packages/core-engine/src/retrieve/library.ts` | `toHit` / `toUnitHit` 水合 |
| `packages/core-engine/src/agent/context.ts` | prompt 含标题与截断正文 |
| `packages/core-engine/src/http/handle-request.ts` | `parseRetrieveHits` 透传 |
| `apps/web/src/services/types.ts` | `RetrieveHitView` 对齐 |
| `apps/web/src/views/standard_lib/RetrieveHitsTable.vue` | 行 click / 选中 |
| `apps/web/src/views/standard_lib/HitDetailPanel.vue` | 新建详情 |
| `apps/web/src/views/standard_lib/index.vue` | 接线；保持 ≤300 行 |

测试改现有 `packages/core-engine/test/standard-rag.test.ts` 与 `standard-lib-stepchat.test.ts`，不新开第 9 个实现文件。

实现后 `register_contract RetrieveHit`（字段演进，不是另立类型名）。

## 风险分级

- frontmatter 未标 high。
- 正文未命中 MCP / arch 管线 / 破坏性对外面关键词。
- 拟改动实现文件 = 8，未超过 8。

**risk: low** → `auto_approved`。步骤 5.5 独立红队免派（方案红队强化即为红队档）。
