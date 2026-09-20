---
status: approved
feature: F-9 standard_lib expandOneHop CITES/SUPERSEDES
slice: F-9
---

# F-9 标准库检索扩一跳 Implementation Plan

> **Spec:** `docs/superpowers/specs/2026-09-20-standard-lib-expand-one-hop-design.md`
> **Command:** `/plan-from-spec`
> **Status:** approved

**Goal:** 语义/精确条款命中后沿 CITES/SUPERSEDES 出边扩一跳；原命中路径不变；0 条款命中不扩图；同一 clause_id 不重复；禁止多跳与全图盲扫。

**Architecture:** 不改 GraphStore / RetrieveHit 形状。`searchStandard` 在 exact/semantic 之后调用 private `expandOneHop`：对原条款命中分别 `queryPath(id,"CITES")` 与 `queryPath(id,"SUPERSEDES")`（已是出边一跳），邻接 `toHit(...,"graph")` 且 `path=[该边]`，追加在原 hits 后。graph intent 仍只走 `searchGraph`。A19 出边在测试用例内自备，不改共享 seedPack。

> 全自动自答（`/apt-goal --continue` programMode）。相位机 `nextAction=pm_spec` 为旧批残留——以 `playbook-state.json` 切片为准。本批无 ACCEPT-BATCH。

---

## Part 1 — 技术方案（APT 寻址）

### 1.1 范围与约束

**做：** exact/semantic 条款命中后出边一跳；邻接 `retrieve_path=graph`；原 vector/exact 不变；去重；0 条款命中短路；精确查同样扩。

**不做：** 全图盲扫；多跳/递归；chat-as-rerank；改 DSL；把图当唯一入口；修引用正则；入边扩展；APPLIES_TO/REQUIRES/PARENT_OF/SUPPORTS；改预查询意图规则；改其它 8 页。

**Profile：** `.apt/role.md` `projectType: component`（跳过 B2 test-cases Gate），`typeHealth.suggested=business`。本片 **无新 UI**（路径列已存在）。test-cases 已含 T10–T14，Task 2 只核对、不改 `page.logic.md`。

### 1.2 设计寻址

| 项 | MCP 结果 | 约束摘要 |
|----|----------|----------|
| global | `query_design scope=global` | apt-skyline-clean；本片无新色值/组件 |
| page `standard_lib` | `query_design page=standard_lib` approved | MCP `logicMarkdown` **落后于磁盘**（磁盘已含 `expandOneHop` / A19）。**以磁盘为准**。gaps=`no-implementation-ref` 不 `report_design_gap` |
| UI | `RetrieveHitsTable` 已渲染 `retrieve_path` | **不改 Vue** |

无建表（§0.6 跳过）。

### 1.3 依赖寻址表

| 依赖 | 来源 | 引用 | 摘要 |
|------|------|------|------|
| RetrieveHit | contract | `packages/core-engine/src/retrieve/ports.ts` | 已有 `retrieve_path` / `path?: GraphEdge[]`，不扩字段 |
| GraphStore | contract | 同上 | `queryPath(from, kind?)` 出边一跳 |
| GraphEdge / EdgeKind | contract | 同上 | CITES / SUPERSEDES |
| StandardLibrary | contract + arch | `packages/core-engine/src/retrieve/library.ts`；`query_arch frontend/core-engine/util#standardlibrary` | `searchStandard` 在 exact/semantic 后无挂钩 |
| SearchStandardInput | contract | `packages/core-engine/src/retrieve/library.ts` | packId + query；不改入参 |
| MemoryGraphStore | arch | `query_arch frontend/core-engine/util#memorygraphstore` → `packages/core-engine/src/retrieve/memory-graph.ts` | 测试图端口；`queryPath` 过滤 `edge.from` |
| FakePrequery | contract | `packages/core-engine/src/retrieve/prequery.ts` | 测试映射；不改意图规则 |
| DemoHttpAdapter | contract | `packages/core-engine/src/http/handle-request.ts` | `POST /api/standards/search` 已转 `searchStandard`，透传即可 |

无 `report_missing`。

### 1.4 拟改动模块与文件

| 文件/模块 | 变更类型 | 说明 |
|-----------|----------|------|
| `packages/core-engine/src/retrieve/library.ts` | modify | exact/semantic 后 `expandOneHop` |
| `packages/core-engine/test/standard-rag.test.ts` | modify | A19 T10–T13 + 精确扩跳；FakePrequery 加「事假」「不存在」；**不改**共享 seed 出边 |
| `designs/v0/standard_lib/test-cases.md` | none/verify | 已含 T10–T14；禁止改 page.logic.md |

### 1.5 风险与未决项

- 共享 seed 对 1.1 无出边，A11 `hits.length===1` 可保留；A19 必须在用例内 `addStandardEdge`。
- `expandOneHop` 禁止对邻接再 `queryPath`。
- 不改 `prequery.ts` 意图分类、不改 `searchGraph`、不改 Vue。
- 相位机 pm_spec 忽略。

### 1.6 需求锁定对照

| Rn | 优先级 | 覆盖 Task | 备注 |
|----|--------|-----------|------|
| R1 | must | Task 1 | 事假 → 1.1 vector + 1.2 graph |
| R2 | must | Task 1 | 原行路径不变 |
| R3 | must | Task 1 | 去重 |
| R4 | must | Task 1 | 0 命中无 graph |
| R5 | must | Task 1 | 二跳不出现 |
| R6 | must | Task 2 | A13 回归 |
| R7 | must | Task 1+2 | 不改 prequery/rerank/DSL |
| R8 | must | 全 Task 白名单 | 只 library + 本测 |
| R9 | must | Task 1 | 精确 1.1 自备出边后 exact+graph |
| R10 | nice | Task 1 | graph 行 path.length===1 且有 heading |

must 全覆盖。

---

## Part 2 — 可执行任务清单

### Task 1: expandOneHop 行为（R1–R5 / R9 / R10）

- [ ] 只读 MCP：`query_contract` name=`RetrieveHit`；`query_contract` name=`GraphStore`；`query_contract` name=`StandardLibrary`
  - **MCP:** 同上
  - **Files:** （只读）
- [ ] TDD：在 `standard-rag.test.ts` 增加 A19 用例（本用例自备 `1.1 -[:CITES]-> 1.2`，**禁止**改 `seedPack` 里已有的 1.2→1.1 / 2.1→1.1）：
  - 「事假」semantic → 含 1.1 `vector` 与 1.2 `graph`，且 graph 行 `path` 为单跳 CITES
  - 「不存在」semantic 无命中 → 无 graph 行
  - 1.1 与 1.2 都在向量结果且 1.1 CITES 1.2 → 1.2 仅一行且仍 vector
  - 1.1→1.2→2.1 两条 CITES、仅命中 1.1 → 有 1.2 graph、无 2.1
  - 「1.1」exact + 自备出边 → 首条 exact 1.1，另有 graph 邻接
  - FakePrequery map 增加「事假」「不存在」；「事假」rewritten 须能打到 1.1（可复用 CANON）
  - **Files:** `packages/core-engine/test/standard-rag.test.ts`
- [ ] 最小实现：`searchStandard` 仅在 exact/semantic 分支之后调用 private `expandOneHop`。只扩原 vector/exact 条款命中；CITES 与 SUPERSEDES 各 `queryPath` 一次；邻接 `toHit(clause,"graph")`；`seen` 按 clause_id；0 条款命中 return 原数组；邻接版本必须在本次 pack 生效 versionIds。禁止改 `searchGraph`、prequery、rerank、ports.ts 类型、Vue。
  - **Files:** `packages/core-engine/src/retrieve/library.ts`
  - **Verify:** `npx vitest run test/standard-rag.test.ts`（cwd `packages/core-engine`）——对应 R1–R5 / R9 / R10
  - **Contracts:** 形状未变则不 `register_contract`

### Task 2: A13/A11 回归与 test-cases 核对（R6 / R7 / R8）

- [ ] 只读 MCP：`query_arch` path=`frontend/core-engine/util#standardlibrary`；`query_design` page=`standard_lib`
  - **MCP:** 同上
- [ ] 确认 `designs/v0/standard_lib/test-cases.md` 已含 T10–T14；**禁止**改 `page.logic.md`、`prequery.ts`、`searchGraph`。若 T10 夹具表述与出边纪律冲突，只在测试注释说明「用例内 seed 1.1→1.2」，不要改产品真源。
  - **Files:** `designs/v0/standard_lib/test-cases.md`
- [ ] 回归断言仍绿：A11 `searchStandard("1.1")` 在**未**自备出边时仍 `length===1` 且 exact；A13 「2.1替代了哪条」仍单行 graph SUPERSEDES。
  - **Files:** `packages/core-engine/test/standard-rag.test.ts`
  - **Verify:** `npx vitest run test/standard-rag.test.ts`（cwd `packages/core-engine`）——对应 R6/R7/R8

子 Agent 每 Task 自动 commit。禁止 `audit_arch_changes`（留给 PB-5）。禁止把 DASHSCOPE_API_KEY 写入文件或 commit。
