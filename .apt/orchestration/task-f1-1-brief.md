# Task 1 Brief — F-1 命中水合 heading/body

review-tier: full
BASE_SHA: c01b4e2717a906c8e98f17245ec79d03fd871ca5
plan: docs/apt/plans/2026-09-19-standard-lib-hit-detail-plan.md
report: .apt/orchestration/task-f1-1-report.md
spec: docs/superpowers/specs/2026-09-19-standard-lib-hit-detail-design.md

## Goal

`searchStandard` 返回的 `RetrieveHit` 必须带账本 heading + body。条款来自 `ClauseRow`；表/附件来自 `LayoutUnitRow.heading` / `body_markdown`。table/annex 的 `clause_id` 仍为 null。不改检索算法。

## 全自动

`/apt-goal --continue` 切片 F-1 PB-3 Task 1。允许 **仅白名单** `git add` + `git commit`（一条 subject）。禁止 push。禁止改 `.apt/goal.md`、`playbook-state.json`、其它 8 页、`prequery.ts`、`rerank.ts`、向量/图实现。

## Part 1 摘要

不改路由。只在 `toHit` / `toUnitHit` 把账本文本抄进 `RetrieveHit` 可选字段 `heading?` / `body?`。空 body 如实带回，禁止编造。

## 步骤（TDD 先红后绿）

- [ ] 开始前只读 MCP：`query_contract` name=`RetrieveHit`；`query_contract` name=`ClauseRow`；`query_contract` name=`LayoutUnitRow`；`query_contract` name=`StandardLibrary`。禁止未经 MCP 读 `.ai/`。
- [ ] **先写失败测试**（不得先改 ports/library）：`packages/core-engine/test/standard-rag.test.ts`
  - 现有 `searchStandard("1.1")` 用例增加：`hits[0].heading` 含「1.1 事假须提前申请」，`hits[0].body` 含「须在休假前」
  - 现有表命中「见表」用例增加：`tableHit.clause_id === null` 已有则保留；`tableHit.heading` 与对应 `layoutUnits` table 的 heading 一致；`tableHit.body` 含该 unit 的 `body_markdown` 片段（可用 `toContain`）
  - 先跑 Verify：**必须 RED**。把 RED 输出写入 report
- [ ] **最小实现**
  - `RetrieveHit` 增加可选 `heading?: string | null`、`body?: string | null`，注释说明：详情/对话用账本文本，表格行不渲染 body
  - `toHit(clause)` 设 `heading: clause.heading`、`body: clause.body`
  - `toUnitHit(unit)` 设 `heading: unit.heading`、`body: unit.body_markdown`；table/annex 仍 `clause_id: null`
  - 禁止改 searchExact/searchSemantic/searchGraph 的路由条件
- [ ] GREEN：Verify 全绿
- [ ] 微闭环：`register_contract` name=`RetrieveHit`（字段演进）；`refresh_asset` sourcePath 指向白名单内已改的 ports.ts / library.ts。禁止 `audit_arch_changes`。
- [ ] `git add` **仅白名单** 后 commit。subject 示例：`feat(retrieve): hydrate RetrieveHit heading and body from ledger`

## MCP（开始前只读）

- query_contract `RetrieveHit`
- query_contract `ClauseRow`
- query_contract `LayoutUnitRow`
- query_contract `StandardLibrary`
- 禁止未经 MCP 读 `.ai/`

## Files 白名单

- `packages/core-engine/src/retrieve/ports.ts`
- `packages/core-engine/src/retrieve/library.ts`
- `packages/core-engine/test/standard-rag.test.ts`
- `.apt/orchestration/task-f1-1-report.md`

## Verify

```
npx vitest run test/standard-rag.test.ts
```

cwd: `packages/core-engine`

对应 Rn：R1 / R5 / R6

## 编码规范（节选）

- 注释说为什么；`RetrieveHit` 新字段与 `toHit`/`toUnitHit` 必须注释不变量（表不得占用 clause_id；正文来自账本）
- TS 导出函数/方法明确 return type
- 函数体 ≤80 行；不要拆无关重构
- 禁止无意义注释

## Report

写满 `.apt/orchestration/task-f1-1-report.md`：Status、Tests（RED/GREEN）、APT Micro-closeout（ContractsRegistered / AssetsRefreshed / AssetsRemoved）、FilesChanged、Commits、Blockers/Concerns。
