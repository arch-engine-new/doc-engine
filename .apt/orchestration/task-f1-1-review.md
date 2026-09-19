# Task F-1-1 Review — 命中水合 heading/body

review-tier: full
projectType: component（跳过 B2 `designs/v0/*/test-cases.md`；非页面 Task，跳过数据防御抽检）
Plan: `docs/apt/plans/2026-09-19-standard-lib-hit-detail-plan.md` Task 1
Spec: `docs/superpowers/specs/2026-09-19-standard-lib-hit-detail-design.md`（Rn：R1 / R5 / R6）
Brief: `.apt/orchestration/task-f1-1-brief.md` / `.apt/orchestration/task-f1-1-review-brief.md`
Report: `.apt/orchestration/task-f1-1-report.md`（以 commit 内版本为准）
HEAD: `45a2a731ad99e0cf8421b2f512cff42e972c8127`
Parent / BASE_SHA: `c01b4e2717a906c8e98f17245ec79d03fd871ca5`
Status (implementer): `DONE_WITH_CONCERNS`
Verify（implementer 已报；审查方未重跑）: TDD RED `Tests  2 failed | 13 passed (15)` → GREEN `Test Files  1 passed` / `Tests  15 passed (15)`

审查范围：只审 `git show 45a2a73`。工作区其它未提交文件不计入本 Task。审查方只读：未改代码、未 commit、未重跑 vitest。

MCP（审查方只读复查）：`query_contract RetrieveHit` 已含可选 `heading?` / `body?`，`tsFilePath=packages/core-engine/src/retrieve/ports.ts`；`query_contract ClauseRow` 已有 `heading` / `body`；`LayoutUnitRow` 已有 `heading` / `body_markdown`。`search_arch` 仍命中既有 `frontend/core-engine/util#RetrieveHit` / `#StandardLibrary`。`query_arch frontend/packages/util#ports` 与 `#library` 为本次 `refresh_asset` 新建条目（Updated `2026-09-19T05:51Z`）；既有 `frontend/core-engine/util#RetrieveHit` Updated 仍为 `2026-09-15`，摘要未写 heading/body。

### Spec Compliance
- ✅ Spec compliant

相对 plan Task 1、brief（水合 heading/body；table `clause_id` null；不改检索算法）与 R1/R5/R6：**无 Missing / Extra（白名单外）/ Misunderstood**。

| 检查项 | 结果 | 证据 |
|--------|------|------|
| `RetrieveHit` 可选 `heading?` / `body?` | **YES** | `ports.ts` 新增字段；注释写明详情/对话用账本文本、表格行不渲染 body、空/null 不编造 |
| `toHit` 抄 `clause.heading` / `clause.body` | **YES** | `library.ts` `toHit` 直接赋值；注释「never synthesized」 |
| `toUnitHit` 抄 `unit.heading` / `unit.body_markdown`；table/annex `clause_id` 仍 null | **YES** | 仅加 heading/body；既有 `clause_id: kind === "clause" ? unit.clause_id : null` 未改。表用例 `tableHit?.clause_id).toBeNull()` 保留 |
| 不改检索算法 | **YES** | diff 未动 `searchExact` / `searchSemantic` / `searchGraph` / `prequery.ts` / `rerank.ts`；未改路由条件 |
| T1：`searchStandard("1.1")` heading/body 含夹具原文 | **YES** | 现有 A11 用例加 `toContain("1.1 事假须提前申请")` / `toContain("须在休假前")` |
| T2：表命中 heading/body 来自 layout unit | **YES** | 「见表」用例：`heading` 与 `layoutUnits` table 一致；`body` `toContain(body_markdown)` |
| 空 body 如实带回、禁止编造 | **YES** | 实现为账本字段直抄；`toUnitHit` 注释 empty `body_markdown` as-is。无合成/LLM 补全文 |
| 白名单 / 单 commit / 未 push | **YES** | 4 文件：`ports.ts` / `library.ts` / `standard-rag.test.ts` / `task-f1-1-report.md`。subject=`feat(retrieve): hydrate RetrieveHit heading and body from ledger`。未改其它 8 页、goal.md、playbook-state |
| 先红后绿 | **YES** | RED：`heading` 为 `undefined`，`toContain` 非法参数组合 + `expected undefined to be 'table'`（当时 `tableUnit.heading`）。GREEN：15/15 |
| `register_contract RetrieveHit` | **YES** | report + 审查方 `query_contract` 字段演进一致 |
| 公开 export 注释（为什么） | **YES** | 见 Quality |
| component：不查 test-cases.md | **YES** | 未查 |
| 非页面：跳过数据防御 | **YES** | 未抽检 |

**Missing：** 无。本片只负责 R1/R5/R6 水合；R2 详情 UI、R4 prompt、R8 截断属后续 Task，未误当作本片缺口。

**Extra（白名单外）：** 无。未改 `formatRetrieveHitsForPrompt` / `parseRetrieveHits` / Vue / `HitDetailPanel`。

**Misunderstood：** 无。水合点锁在 `toHit` / `toUnitHit`，未新开详情 HTTP，未把 `unit_id` 写入 table `clause_id`，未改召回路由。

### Strengths
- 最小实现：类型加可选字段 + 两处装配点直抄账本，未碰检索路由与其它页面。
- TDD 证据同构：RED 失败就是本片新增断言打在 `undefined` 上；GREEN 后同一断言对照入库夹具原文，不是纯类型形状。
- 不变量写在「为什么」注释里：表不得占用 `clause_id`、正文来自账本、空串不填、命中表不渲染 body。
- 诚实披露 `DONE_WITH_CONCERNS`：`refresh_asset` 错挂路径写进 report，未隐瞒、未手工改 `.ai/`（brief 禁止 `audit_arch_changes`）。

### Issues
#### Critical (Must Fix)
- 无。

#### Important (Should Fix)
- `refresh_asset` 新建 `frontend/packages/util/ports` 与 `frontend/packages/util/library`（`query_arch` 可见，摘要仍是「端口文件 / library 工具」，未写 heading/body 水合），未覆盖既有 `frontend/core-engine/util#RetrieveHit` / `#StandardLibrary`（Updated 仍为 2026-09-15）。`register_contract RetrieveHit` 源码路径正确。批次禁止 `audit_arch_changes` / 手工改 `.ai/`；留给 PB-5 `finish_feature` closeout，**不阻断本 Task 源码验收**（与 B-2/B-3 同口径，非 Critical）。

#### Minor (Nice to Have)
- 表 body 断言 `toContain(tableUnit?.body_markdown ?? "")`：若 `body_markdown` 为空串，`toContain("")` 过弱。当前 GFM 表夹具有单元格 markdown，实际仍能验到账本文本。
- 无独立「账本空 body → hit.body === ""」用例。实现是直抄，编造路径不存在；R6 UI「无正文」文案属 Task 3。
- annex 命中未另加断言。brief 指定沿用既有「见表」table 用例；`toUnitHit` 对非 clause 一律 `clause_id: null`。
- commit 内 report 的 Commits 行仍写「待本步 git commit」（无 SHA）。同一 commit 带 report 可理解；工作区后续补 SHA 不计入本 diff。

### Quality
**公开 export 注释抽检：PASS（Approved）**

新增/签名变更的公开面是 `export interface RetrieveHit` 的可选字段（`SearchHit` 仅为未改别名）：

- 接口注释补了 heading/body 用途与「命中表不得渲染 body」。
- `heading?`：为何 optional（旧夹具可编译）、空/null 不编造。
- `body?`：来源（`clause.body` / `body_markdown`）、表行不渲染、空串保留。

`toHit` / `toUnitHit` 为 private，brief 仍要求不变量注释，均已写「never synthesized」/「empty body_markdown as-is」+ 表 `clause_id` null。二者均有 `RetrieveHit` return type；函数体远小于 80 行。

测试验的是 `searchStandard` 命中相对入库账本的行为（条款夹具原文、表 unit 同行），不是只 grep 类型字段。错误处理：空值直抄，无吞错、无编造分支。

**白名单 / 密钥：** commit 仅四文件。未含 `.ai/`、`.env`、token。未 push。

### Assessment
**Approved**

**Reasoning:** `searchStandard` 命中已带账本 heading/body（R1）；table 命中 `clause_id` 仍为 null 且文本来自 `LayoutUnitRow`（R5）；未改 prequery/rerank/向量/图路由，空 body 不编造（R6）。TDD RED/GREEN、白名单四文件、公开字段「为什么」注释与 `register_contract RetrieveHit` 合格。`refresh_asset` 错挂 `frontend/packages/util` 记 Important，按批次规则留 PB-5，不改本片结论。无 Critical。
