# Task F-1-3 Review — 点击命中行打开详情

review-tier: full
projectType: component（跳过 B2 `designs/v0/*/test-cases.md` Gate；本片为页面类 Task，抽检数据防御；公开方法注释抽检仍做）
Plan: `docs/apt/plans/2026-09-19-standard-lib-hit-detail-plan.md` Task 3
Spec: `docs/superpowers/specs/2026-09-19-standard-lib-hit-detail-design.md`（Rn：R2 / R3 / R5 / R7）
Brief: `.apt/orchestration/task-f1-3-brief.md` / `.apt/orchestration/task-f1-3-review-brief.md`
Report: `.apt/orchestration/task-f1-3-report.md`（以 commit 内版本为准）
HEAD: `fa80d3221c23858bf79a55c77f948d54d8a60f4c`
Parent / BASE_SHA: `2cb107f399d7f9e3125b679043979c7bd35028ba`
Status (implementer): `DONE_WITH_CONCERNS`
Verify（implementer 已报；审查方未重跑）: TDD RED `Test Files 1 failed` / `Tests 3 failed | 3 passed (6)` → GREEN `Test Files 2 passed (2)` / `Tests 17 passed (17)`

审查范围：只审 `git show fa80d32`。工作区其它未提交文件不计入本 Task。审查方只读：未改代码、未 commit、未重跑 vitest。

MCP（审查方只读复查）：`query_contract RetrieveHitView` 已含可选 `heading?` / `body?`，`tsFilePath=apps/web/src/services/types.ts`。`query_design scope=global` 为 apt-skyline-clean / `--apt-*` / 禁止页面新 hex；DataTable=`table`；WorkbenchCard=`section.card`。`query_design page=standard_lib` 的 logicMarkdown 仍无 `openHitDetail`（落后于磁盘）。`query_arch frontend/web/component#retrievehitstable` Updated 仍为 `2026-09-15`，「props / events 暂无」、无 click。`query_arch frontend/apps/component#HitDetailPanel` / `#RetrieveHitsTable` / `#index` 与 `frontend/apps/util#types` 为本次 `refresh_asset` 新建/更新条目（Updated `2026-09-19T06:23Z`）。`query_arch frontend/web/component#HitDetailPanel` Path not found。

### Spec Compliance
- ✅ Spec compliant

相对 plan Task 3、brief（点击行打开详情；出处五列；table/annex `clauseLabel` 仍 `—`；未选中 closed；`index.vue` ≤300；只改 standard_lib）与 R2/R3/R5/R7：**无 Missing / Extra（白名单外）/ Misunderstood**。

| 检查项 | 结果 | 证据 |
|--------|------|------|
| T5 / R3：表头五列仍在，无全文 `<th>` | **YES** | `file_name` / 页 / `unit_id` / `clause_id` / 路径；模板注释禁止 body 列。单测 `not.toMatch(/<th>.*(正文\|heading\|body\|全文)/i)` |
| R2：点击行打开详情，展示 heading + body | **YES** | `<tr @click="emit('select', hit)">`；`HitDetailPanel` `section.card` 渲染 heading/body；`index` `@select="selectedHit = $event"` + `v-if="selectedHit"` |
| R2：未选中详情 closed，不自动弹出第一行 | **YES** | 无默认选中；`search()` 置 `selectedHit = null` 并注释「only a row click opens it」 |
| 空 heading/body →「无标题」/「无正文」，不编造 | **YES** | `headingText` / `bodyText`：空串/假值走文案；详情展示账本全文（非 prompt 800 截断） |
| R5：table/annex/`clause_id==null` 仍 `—` | **YES** | 既有 `clauseLabel` 未改；单测仍匹配 `chunk_kind === "table"\|"annex"`、`clause_id == null`、`return "—"` |
| R7：只改 standard_lib；不改 StepChat.vue / 其它 8 页 / page.logic.md | **YES** | commit 七文件均在白名单。未改 `StepChat.vue`、检索算法、goal.md |
| `<StepChat` 仍按 packId 挂载；hits 原样交给对话 | **YES** | `v-if="packId"` + `:pack-id="packId"` + `:hits="hits"` |
| `index.vue` ≤300 | **YES** | 内容 299 行（`split(/\r?\n/)` 含末尾空行 = 300）。`HitDetailPanel.vue` 25 行，一文件一组件 |
| 颜色用现有 class / `--apt-*`，无新 hex | **YES** | `card` / `clickable` / `is-selected`（`--apt-surface` 在既有 `global.css`）。commit 无新 hex |
| 列表 key 非 index；props 有 type | **YES** | `:key="hitKey(hit)"`；`defineProps<{ hit: RetrieveHitView }>` / `selectedKey?: string \| null` |
| 先红后绿 | **YES** | RED：无 `@click`、无 `HitDetailPanel.vue`、index 无面板。五列与 `clauseLabel` 当时已绿。GREEN：17/17（含 stepchat 回归） |
| `register_contract RetrieveHitView` | **YES** | 字段演进；MCP 已能查到 heading/body |
| 公开 export 注释（为什么） | **YES** | 见 Quality |
| component：跳过 test-cases Gate | **YES** | 未按 B2 要求把 `test-cases.md` T1–T9 逐条绑自动化。源码测覆盖 R2/R3/R5（下表） |
| 页面类：数据防御抽检 | **YES** | 见 Quality。无新增裸 `as Type` 当 decode |

**源码测试 ↔ R2/R3/R5（component 跳过 Gate 后仍核对）：**

| Rn | 源码断言 | 覆盖 |
|----|----------|------|
| R2 | `@click` + `emit('select')`；`HitDetailPanel` 含 heading/body/「无标题」「无正文」；index `v-if="selectedHit"` | YES |
| R3 | 五列 `<th>`；禁止正文/heading/body/全文表头 | YES |
| R5 | `clauseLabel` 对 table/annex/null 返回 `—` | YES |

Verify 命令另跑 `standard-lib-stepchat.test.ts`，回归 Task 2 的 R4/R8，不把 R4 当成本片缺口。

**Missing：** 无。R1 水合 / R4 prompt / R8 截断属 Task 1/2。本片未新开详情 HTTP，符合 spec 非目标。

**Extra（白名单外）：** 无。七文件 = 白名单（types / RetrieveHitsTable / HitDetailPanel / index / 新测 / test-cases.md / report）。相对 git parent `2cb107f`，`index.vue` **尚无** B-1/B-3 的 pack 线程、`ingestError`、`v-if="packId"` / `:hits`。本 commit 把工作区未入库的 StepChat 挂载与 PDF 中文错误映射 **一并提交**——均在白名单 `index.vue` 内。brief 要求「`<StepChat` 仍按 packId 挂载」且「hits 原样给 StepChat」，pack 挂载是本片验收所需，不构成 spec Extra。`ingestError` / `resolveLivePackId` 回退与 F-1 正交，见 Minor；**未破坏**点击详情 / 五列 / closed 未选中，按 review-brief **不升 Critical**。

**Misunderstood：** 无。详情拆到 `HitDetailPanel`，表不增正文列，点击才 open。未改 `page.logic.md`（brief 禁止）。未把 prompt 截断标成详情全文。未改其它 8 页。

### Strengths
- 最小 UI 切口：类型加可选字段 + 行 click/emit + 独立 `section.card` 面板 + 父级 `selectedHit`。出处列与 `clauseLabel` 未改。
- TDD 证据同构：RED 失败就是「无 @click / 无 HitDetailPanel / index 未接线」；GREEN 后同一批源码断言对照五列、空值文案、`v-if="selectedHit"`。
- 不变量写在「为什么」注释：点击才 open、表不得塞全文、空账本不编造、table `clause_id` 显示 —。
- 设计对齐：磁盘 `openHitDetail`；WorkbenchCard=`section.card`；选中色复用既有 `clickable` / `is-selected`。
- 诚实披露 `DONE_WITH_CONCERNS`：`refresh_asset` 错挂路径写进 report，未隐瞒、未手工改 `.ai/`（brief 禁止 `audit_arch_changes`）。

### Issues
#### Critical (Must Fix)
- 无。

#### Important (Should Fix)
- `refresh_asset` 写入 `frontend/apps/util/types`、`frontend/apps/component/index`（文件名级锚点，与既有 `StandardLib` 重复）、`frontend/apps/component/RetrieveHitsTable`、`frontend/apps/component/HitDetailPanel`。摘要仍是「类型定义 / 视图入口 / 命中表格」，未写 heading/body 或 click。未覆盖既有 `frontend/web/component#retrievehitstable`（Updated 仍为 2026-09-15，无 click）。`frontend/web/component#HitDetailPanel` 不存在。批次禁止 `audit_arch_changes` / 手工改 `.ai/`；留给 PB-5 `finish_feature` closeout，**不阻断本 Task 源码验收**（与 Task 1/2 同口径，非 Critical）。

#### Minor (Nice to Have)
- `index.vue` 相对 parent 一并带入 B-3/`ingestError`/`resolveLivePackId`/`watch(packId)`。F-1 行为完整且未破 300 行上限；使本片 diff 大于「只接线详情」。
- 测试是 `readFileSync` 模板断言（brief 指定；spec T5 允许）。未跑浏览器点选；未断言 `search()` 清空选中（实现有注释）。
- `selected-key` 在 index 内联复制 `hitKey` 公式，未复用表格内函数；当前字符串一致，选中高亮可用。
- `bodyText` 无独立注释（`headingText` 已覆盖「无标题 / 无正文」）。仅空白字符的 heading 会原样显示。
- commit 内 report 的 Commits 行无完整 SHA。同一 commit 带 report 可理解。
- `test-cases.md` T 编号与 spec T1–T6 不完全同构（页内 T2=打开详情，spec T2=表命中水合）。component 跳过 Gate；T1–T7 均在，未删。

### Quality
**公开 export 注释抽检：PASS（Approved）**

本片新增/签名变更的公开面：

- `export interface RetrieveHitView` 可选 `heading?` / `body?`：为何 optional（空/null 详情「无标题」）；body 为何不进命中表、空串不编造。
- `HitDetailPanel`：`headingText` 说明空账本文案、禁止编造；面板用 `section.card` 展示全文。
- `RetrieveHitsTable`：模板注释说明 click 打开详情、出处五列不得加 body `<th>`。既有 `clauseLabel` 仍解释 table/annex 显示 —。
- `search()` 清空选中：注释写明只有行点击才 open。

`headingText` / `bodyText` 有 `string` 返回类型，函数体远小于 80 行。组件单文件、props 有 type。

测试验的是列名、click/emit、面板空值文案与接线，不是只 grep 类型字段名。错误处理：空 heading/body →「无标题」/「无正文」，不编造。

**数据防御抽检（页面类）：PASS**

- 本 diff 的 Vue/types **未新增** `as RetrieveHitView` / `as Type` 假 decode。
- 详情空值在渲染层分支（长度检查），不把 JSON 断言成必有正文。
- `search()` 仍走既有 `http<{ hits: RetrieveHitView[] }>`；`data as T` 在 `http.ts`，**不在本 commit**。本片未扩大假 decode 面，也未把 heading/body 再 cast 一次。
- 未把原始响应直接塞进表体列。

**白名单 / 密钥：** commit 仅七文件。未含 `.ai/`、`.env`、token。未 push。未改 `StepChat.vue`、其它 8 页、`page.logic.md`。

### Assessment
**Approved**

**Reasoning:** 点击命中行打开 `HitDetailPanel`，展示该条 heading + body（空则「无标题」「无正文」）；未选中 closed（R2）。出处五列保留、无全文 `<th>`（R3）；table/annex `clauseLabel` 仍为 —（R5）。只动 standard_lib 白名单（R7）。`index.vue` 299 行。TDD RED/GREEN、公开字段「为什么」注释、`register_contract RetrieveHitView` 与数据防御抽检（无新增裸 `as Type`）合格。`refresh_asset` 错挂 `frontend/apps` 记 Important，按批次规则留 PB-5，不改本片结论。无 Critical。本 Task 为 F-1 末任务：**放行 = PB-3 implement 完成**。
