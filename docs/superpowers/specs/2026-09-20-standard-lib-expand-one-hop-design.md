---
title: F-9 标准库检索：语义/精确命中后沿 CITES/SUPERSEDES 扩一跳
date: 2026-09-20
status: approved
risk: low
phase: approved
approvedAt: 2026-09-20T01:20:00.000Z
approvedBy: apt-auto-brainstorm
topic: standard-lib-expand-one-hop
mode: apt-auto-brainstorm
feature: core-engine
pages:
  - standard_lib
parentSpec: docs/superpowers/specs/2026-08-27-slice-6-standard-rag.md
---

# Design Spec: 向量/精确命中后沿引用与替代边扩一跳（F-9 / 2b）

## Goal

配置人员在 `standard_lib` 用**普通语义问句**（不必含「引用/替代」）检索时，只要先命中条款 A，就能在命中表里同时看到 A 的 **CITES / SUPERSEDES 出边一跳邻接 B**。路径列能区分：原命中仍是向量或精确，邻接行是图谱。从而降低图检索门槛——不必先知道何时走图。

验收锚点：PRD A19、`designs/v0/standard_lib/page.logic.md` 的 `expandOneHop`、`designs/v0/standard_lib/test-cases.md` T10–T14。

## 范围

1. **`searchSemantic` / `searchExact` 之后调用 `expandOneHop`**（内部步骤，非独立按钮、非新 HTTP）。
2. **条款命中才扩**：对每个 `retrieve_path` 为 `vector` 或 `exact` 且 `clause_id` 非空的命中，沿 Neo4j/`GraphStore.queryPath` 的 **`CITES` 与 `SUPERSEDES` 出边各扩一跳**。
3. **邻接行**：邻接条款并入 `RetrieveHit[]`，`retrieve_path=graph`，`path` 仅含这一条边；`toHit` 水合 heading/body 与出处，规则同现网。
4. **原命中不变**：原行保留 `vector` / `exact`，禁止改写成 graph。
5. **去重**：同一 `clause_id` 已在结果中则不追加第二行（保留先出现的路径，即原向量/精确）。
6. **0 条款命中不扩图**：语义/精确结果里没有任何条款命中（含纯表命中、空数组）→ 不调用图扩展，结果仍为 0 条款行（表命中原样保留）。
7. **显式 `searchGraph` 不走 expandOneHop**：问句含引用/替代仍走现网 A13 图入口；本片不把它改成默认入口。

## 非目标

- 不问「引用」就全图盲扫 / 无起点遍历。
- 一次扩多跳、对扩展行再递归、`shortestPath` 当扩展器。
- 用聊天补全当 rerank；改 DSL 硬规则。
- 把图扩展当前检索的**唯一**入口；删除或绕过 `searchGraph`。
- 修「第X条引用哪条」正则吞条款号（队列未选 3）。
- 入边扩展（`queryPath` 只给出边；入边需要新图端口或全图扫描，二者均禁止）。
- 沿 `APPLIES_TO` / `REQUIRES` / `PARENT_OF` / `SUPPORTS` 扩展。
- 改预查询意图分类、独立 rerank、向量实现、其它 8 页。

## 现网缺口（查证）

| 点 | 证据 | 缺口 |
|----|------|------|
| 产品真源 | 磁盘 `designs/v0/standard_lib/page.logic.md` 已含 `expandOneHop` / A19；`_pages.md` `approved=yes` | 引擎未实现 |
| MCP 设计缓存 | `query_design(page=standard_lib)` 的 `logicMarkdown` 仍为 refine 前快照（无 expandOneHop） | **以磁盘 page.logic 为准**，不 `report_design_gap` |
| 路由 | `StandardLibrary.searchStandard`：`intent===graph` → `searchGraph`；否则 exact/semantic **直接 return** | 语义/精确后无扩跳 |
| 图端口 | `query_contract GraphStore`：`queryPath(from, kind?)` 已是**出边一跳列表**（Memory 过滤 `edge.from`；Neo4j `MATCH (a)-[r:KIND]->(b)`） | 可复用，禁止改成多跳 walk |
| 命中形状 | `query_contract RetrieveHit`：已有 `retrieve_path` 与 `path?: GraphEdge[]` | 无需新类型 |
| UI | `RetrieveHitsTable.vue` 已用字典渲染路径列 | 引擎返回 graph 行即可显示「图谱」 |
| A13 | `standard-rag.test.ts` 问句「2.1替代了哪条」走 graph intent | 回归：expandOneHop 不得插入 graph intent 分支 |
| A11 | `searchStandard("1.1")` 断言 `hits.length===1` | 共享夹具出边目前是 1.2→1.1、2.1→1.1，对 1.1 **无出边**；A19 须在用例内**另写** 1.1→邻接 出边，禁止改坏共享 seed |

`query_ontology(topic=retrieve standard library graph CITES SUPERSEDES)`：命中 `StandardLibrary`、`MemoryGraphStore`、`Neo4jGraphStore`、`RetrieveHitsTable`、`createSearchClauseToolHandler`。复用这些资产，不新造检索栈。

## 方案（≥2 机制类）

### 方案 A — 召回后出边一跳并入命中表（推荐）

机制类：**行为证据**（`searchStandard` 跑出来的 hits 含邻接行 + 路径字段可断言）。

在 `searchStandard` 的 exact/semantic 分支末尾：

```
hits = searchExact | searchSemantic
hits = expandOneHop(hits)   // 仅条款 vector/exact；CITES 与 SUPERSEDES 各 queryPath 一次
```

`expandOneHop`：

1. 收集原结果中非空 `clause_id` 集合 `seen`。
2. 若条款命中数为 0 → 原样返回。
3. 对每个原条款命中：`queryPath(id,"CITES")` 与 `queryPath(id,"SUPERSEDES")`；只处理返回的边（已是一跳）；**禁止**对 `edge.to` 再 `queryPath`。
4. `getClause(to)` 缺失或版本不在本次 exact/semantic 所用 `versionIds` 内 → 跳过（不发明条款）。
5. `to` 已在 `seen` → 跳过；否则 `seen.add`，`toHit(clause,"graph")` 且 `path=[该边]`，**追加**在原 hits 之后。

**Trade-offs**：多命中时邻接行变多；用户可见「没问引用也见图」。  
**隐藏成本**：A19 用例须自备出边，避免改共享 seed 导致 A11 `length===1` 失败。  
**失败模式**：误对 graph intent 再扩 → A13 多行；误递归 → 整图倒进表。用「只扩原 vector/exact 行 + 禁止递归」钉死。  
**依赖前提**：`GraphStore.queryPath` 已是出边一跳（查证：memory-graph / neo4j 实现）。

### 方案 B — 只加静态门禁 / 注释（否决）

机制类：**静态闸门**。grep `expandOneHop` 或改 page.logic 注释，检索行为不变。  
**失败模式**：绿灯 ≠ 不问引用也能见图邻接（镜 2 形状≠行为）。不选。

### 方案 C — 预查询一律改 graph / 聊天 rerank 邻接（否决）

机制类：**流程重组**。把无引用词的问句改成 `searchGraph`，或让 LLM 挑邻接。  
**隐藏成本**：破坏 A12 语义主路径；队列明确禁止 chat-as-rerank、禁止把图当唯一入口。  
**失败模式**：0 向量命中仍可能盲走图；路径列分不清向量 vs 图谱。  
**为何最贵的真机制不是默认**：全图/多跳/LLM 重排更「智能」但违反冻结边界。方案 A 只改变「已有命中之后多一行邻接」，证据档位正好是 A19。

### 最强反方 → 推荐项回应

攻击：出边一跳会漏掉「被 A 引用」的入边邻接，T10「1.1 有 CITES 邻接 1.2」若夹具是 1.2→1.1 则会假绿或假红。  
回应：产品「邻接」在本片**操作化为出边**（与现网 `queryPath` 同构）。T10/A19 **必须 seed `1.1 -[:CITES]-> 1.2`**，不得依赖共享夹具的入边。入边扩展要么全图扫描要么新端口，二者都在非目标。攻击指出测试夹具风险，不推翻出边一跳；用夹具纪律化解。

### 为什么最贵的真机制不是默认

最贵 = 双向 BFS / 多跳 / 把默认入口改成图。用户选定的是 2b「命中后再扩一跳」，不是「检索=图」。方案 A 直接改变命中表内容，且复用已有 `queryPath`。

## 设计

### Architecture

```
prequery.rewrite
  ├─ intent=graph  → searchGraph          （A13，不 expand）
  └─ exact|semantic → searchExact|searchSemantic
                         └─ expandOneHop（仅条款命中；CITES+SUPERSEDES 出边一跳）
                                └─ RetrieveHit[]（原路径不变；邻接 retrieve_path=graph）
```

不改 `GraphStore` 形状。不改 `RetrieveHit` 字段。不改 Vue 表结构。HTTP `POST /api/standards/search` 已转 `searchStandard`，邻接行自动下发。

### Components

| 组件 | 职责 |
|------|------|
| `StandardLibrary.searchStandard` | exact/semantic 后调用 `expandOneHop`；graph 分支不动 |
| `expandOneHop`（private） | 出边一跳、去重、0 条款命中短路 |
| `GraphStore.queryPath` | **复用**；禁止改语义为多跳 |
| `toHit` | 邻接行同样带 heading/body/出处 |
| `RetrieveHitsTable` | **不改**；路径列已能显示图谱 |
| `FakePrequery` / 生产预查询 | **不改**意图规则 |

### Data flow

- 扩跳输入 = 本次 exact/semantic 返回的 **原始** hits（不是扩完再扩）。
- 边：仅 `CITES`、`SUPERSEDES`；`path` 长度必须为 1。
- 版本：邻接条款的 `version_id` 必须属于本次 `resolveEffectiveVersionIds(packId)`（与 exact/semantic 同一包生效版，**不用** searchGraph 的项目级跨包版本集）。
- 去重键：`clause_id` 字符串；table/annex 的 `clause_id=null` 不参与扩跳，也不当邻接目标。
- 顺序：原 hits（表命中在前、条款在后，保持现网 semantic 顺序）+ 追加的 graph 行。
- `attachStandardFitFinding` 仍 `hits.find` 条款：原条款行仍在前面，不会误挂邻接为唯一命中。

### Error handling

| 情况 | 行为 |
|------|------|
| 0 条款命中 | 不访问图扩展；空语义 → 空数组 |
| 邻接条款账本缺失 | 跳过该边，不抛、不发明 `clause_id` |
| 邻接版本非本次生效版 | 跳过 |
| `queryPath` 返回多条出边 | 全部作为一跳并入（仍非多跳） |
| graph intent | 不调用 `expandOneHop` |
| 图端口抛错 | 与现网 searchGraph 相同，向上抛；不吞成空邻接伪装成功 |

### Testing（行为证据，非纯形状）

| ID | 行为（通过后世界不同） |
|----|------------------------|
| T10 / A19-hit | FakePrequery 将「事假」映射为 semantic 且 rewritten 能向量命中 1.1；**本用例** `addStandardEdge(1.1→1.2, CITES)`；结果含 1.1 `retrieve_path=vector` **与** 1.2 `retrieve_path=graph` 且 `path=[{from:1.1,to:1.2,kind:CITES}]` |
| T11 / A19-empty | 问句「不存在」（semantic，无向量命中）→ `hits` 不含任何 `retrieve_path=graph` 行（空数组） |
| T12 / A19-dedupe | 1.1 与 1.2 均已在向量结果中，且 1.1 CITES 1.2 → 1.2 仍只有一行且路径仍为 vector |
| T13 / A19-one-hop | 1.1→1.2→2.1 两条 CITES；命中仅 1.1 → 有 1.2 graph，**无** 2.1 |
| T14 | `POST /api/standards/search` 问「事假」返回值同时含 vector 与 graph 路径（可用引擎测覆盖，HTTP 仅为透传） |
| A11/A12/A13 回归 | 共享 seed 不改出边方向；graph intent 仍单行 SUPERSEDES；「1.1」精确命中仍以 exact 为首条 |

禁止只 grep `expandOneHop` 函数名当 A19 主体。

## 追问记录

- 轮次：**2**（第 2 轮无新实质发现，收敛）
- 模式：全自动（`.apt/goal.md` 存在）；S3 均有 MCP/源码查证

### 第 1 轮

| 镜头 | 关键追问 | 结论 / 修订 |
|------|----------|-------------|
| S1 场景 | 谁、何时、问什么能见图邻接？空库？ | 配置人员在 standard_lib 用「事假」这类无引用词问句；先有条款命中才见图。空库/0 命中保持空表。 |
| S2 破坏 | 砍一半保哪半？YAGNI？ | 保「命中后再出边一跳 + 路径可区分」。砍：全图、多跳、chat rerank、改 DSL、改默认入口为图、修引用正则。 |
| S3 可行 | `queryPath` 能否一跳？要不要新契约？ | 能：Memory/Neo4j `queryPath` 已是出边一跳。`RetrieveHit.path` 已有。不新端口。 |
| S4 验收 | 怎样证明不是形状？ | A19 四条：有邻接、0 命中不扩、去重、一跳。运行 `searchStandard` 断言。 |

需求修订 v1→v2：明确 **出边**（非入边）；graph intent 不扩；A19 边在用例内自备。

### 第 2 轮

| 镜头 | 关键追问 | 结论 / 修订 |
|------|----------|-------------|
| S1 | 只有表命中（clause_id=null）扩不扩？ | 不扩。条款命中才是扩跳起点。 |
| S2 | attachFinding 会不会挂到邻接？ | 原 hits 在前；find 条款仍拿到原命中。 |
| S3 | Vue / HTTP 要不要改？ | 表已有路径列；search HTTP 已转 searchStandard。不改 UI 也能验 A19。 |
| S4 | A11 `length===1` 会被扩跳打坏吗？ | 共享 seed 对 1.1 无出边；禁止把 A19 出边写进共享 seedPack。 |

无新实质发现。残留：无。

### 需求修订 delta

- v1：语义命中后扩 CITES/SUPERSEDES。
- v2：锁定出边一跳、graph 分支不扩、0 条款命中短路、A19 自备出边。
- v3：无（第 2 轮收敛）。

## 需求锁定表

| ID | 需求描述 | 来源 | 验收标准（可判定） | 优先级 |
|----|----------|------|--------------------|--------|
| R1 | 无「引用/替代」词的语义检索，条款命中后出现 CITES/SUPERSEDES 出边邻接，路径为图谱 | 用户明示（队列 F-9 / A19 / T10） | `searchStandard("事假")` 含 1.1 vector 与 1.2 graph | must |
| R2 | 原向量/精确命中路径不变 | 用户明示 | 原行 `retrieve_path` 仍为 vector 或 exact | must |
| R3 | 同一 clause_id 不重复两行 | 用户明示 / T12 | 邻接已在召回中时该 id 仅一行 | must |
| R4 | 0 条款命中不出现图扩展行 | 用户明示 / T11 | 「不存在」结果无 graph 行 | must |
| R5 | 单次只扩一跳，不倒入二跳以外条款 | 用户明示 / T13 | 1.1→1.2→2.1 时结果无 2.1 | must |
| R6 | 不把图当唯一入口；显式引用/替代仍走 searchGraph | 用户明示 | A13 回归：intent=graph 行为不变 | must |
| R7 | 禁止全图盲扫、多跳、chat-as-rerank、改 DSL、改引用正则 | 用户明示 | 不改 prequery 意图规则 / rerank / interpreter；expand 不递归 | must |
| R8 | 只改 standard_lib 检索装配，不动其它 8 页 | 用户明示 | 实现白名单不含其它 page views | must |
| R9 | 精确查有条款命中同样 expandOneHop | 追问确认（page.logic searchExact） | `searchStandard("1.1")` 在用例自备 1.1 出边后含 exact+graph | must |
| R10 | 邻接行带 path 边与账本文本 | 追问确认 | graph 行 `path.length===1` 且 heading/body 来自邻接条款 | nice |

无「AI 假设未确认」的 must。

## Ontology detection

调用：

- `query_ontology()` 项目快照（phase 曾为 accepting/pm_spec，属旧批残留；本片以 playbook-state 为准）
- `query_ontology(topic=retrieve standard library graph CITES SUPERSEDES)`
- `query_contract RetrieveHit` / `GraphStore` → `packages/core-engine/src/retrieve/ports.ts`
- `query_contract StandardLibrary` → `packages/core-engine/src/retrieve/library.ts`
- `query_design scope=global`（apt-skyline-clean；本片无新 UI）
- `query_design page=standard_lib`（approved；logicMarkdown 滞后，磁盘为准）

复用决策：

| 资产 | 决策 | 理由 |
|------|------|------|
| `GraphStore.queryPath` | **复用、不改语义** | 已是出边一跳 |
| `RetrieveHit.retrieve_path` / `path` | **复用、不扩字段** | 已够区分向量/图谱 |
| `StandardLibrary.searchStandard` | **复用并在 exact/semantic 后挂钩** | 唯一检索入口 |
| `searchGraph` | **复用、本片不改** | A13 显式入口 |
| `RetrieveHitsTable` | **不改** | 路径列已存在 |
| 新 GraphStore 入边 API | **不新增** | 非目标 |
| 其它 8 页 | **不碰** | 范围冻结 |

S3 缺口：无缺失契约需 `report_missing`。磁盘 page.logic 已冻结 expandOneHop，不 `report_design_gap`。

## 拟改动文件（≤8）

| 文件 | 变更 |
|------|------|
| `packages/core-engine/src/retrieve/library.ts` | `searchStandard` exact/semantic 后 `expandOneHop` |
| `packages/core-engine/test/standard-rag.test.ts` | A19 行为测 + FakePrequery 映射；不改坏共享 seed 出边 |
| `packages/core-engine/test/standard-lib-expand-one-hop.test.ts` | 可选：若 A11 文件过长则把 A19 放到此文件，仍计测试而非第 3 个实现文件 |

HTTP 透传已存在，不强制改 `handle-request.ts`。Vue 不改。`designs/v0/standard_lib/test-cases.md` 已含 T10–T14，规划期核对，不改 `page.logic.md`。

不新增对外类型名，无需新契约登记（`RetrieveHit` / `GraphStore` 形状不变）。若实现未改 ports.ts 导出则 `register_contract` 跳过。

## 风险分级

- frontmatter 未标 high。
- 正文未命中 MCP / arch 管线 / 破坏性对外面关键词。
- 拟改动实现文件 ≤ 2（library + 测试），未超过 8。

**risk: low** → `auto_approved`。步骤 5.5 独立红队免派（方案红队强化即为红队档）。
