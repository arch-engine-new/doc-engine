# Task B-3-1 Review — 进页即挂载 StepChat

review-tier: full
projectType: component（跳过 B2 `designs/v0/*/test-cases.md`）
Plan: `docs/apt/plans/2026-09-17-b3-standard-lib-stepchat-on-load-plan.md` Task 1
Brief: `.apt/orchestration/task-b3-1-brief.md` / `.apt/orchestration/task-b3-1-review-brief.md`
Report: `.apt/orchestration/task-b3-1-report.md`
HEAD: `c01b4e2717a906c8e98f17245ec79d03fd871ca5`（= BASE_SHA；批次禁 commit，未要求 HEAD 前进）
Status (implementer): `DONE`
Verify（implementer 已报；审查方未重跑）: TDD RED 1 failed / 6 passed → GREEN `Test Files  2 passed` / `Tests  7 passed`

对照工作区 vs HEAD：本片 FilesChanged 为 `apps/web/src/views/standard_lib/index.vue`（modified）+ 未跟踪 `packages/core-engine/test/standard-lib-stepchat-on-load.test.ts`。未改 `packages/core-engine/test/standard-lib-stepchat.test.ts`（B-1 未跟踪文件，仅回归）。`StepChat.vue` 仍为 B-1 未跟踪产物，本片未改。工作区另有 tickAll `designs/v0/_pages.md` / `page.logic.md` 脏文件，**不在本 Task FilesChanged**（与 Task 2 Review 同一批脏，内容是 tickAll 循环 tick，不是 StepChat 挂载）。

审查方只读：未改代码、未 commit、未重跑 vitest。MCP：`query_contract RetrieveHit` 命中 `packages/core-engine/src/retrieve/ports.ts`；`search_arch "standard_lib StepChat"` 命中 StepChat / StandardLib；`query_arch frontend/apps/component#standardlib` 可见 refresh 新建条目（Updated `2026-09-17T12:10:22.890Z`）；`query_arch frontend/web/component#StandardLib` Path not found（旧 web 条目仍「扫描失败」）。

### Spec Compliance
- ✅ Spec compliant

相对 plan 验收 1–3 与 Task 1 brief：**无 Missing / Extra（白名单外）/ Misunderstood**。

| 检查项 | 结果 | 证据 |
|--------|------|------|
| 进页未检索即挂载 StepChat；不得 `v-if="chatReady"` | **YES** | 模板 `<StepChat v-if="packId" ...>`；`chatReady` ref / 赋值已删除。`packId` 来自 `route.params.id`，不依赖 `search()` / hits |
| `hits.length===0` 不卸载侧栏 | **YES** | `search()` 只写 `hits.value = result.hits`；无 hits 门控。零命中仍 `v-if="packId"`。`RetrieveHitsTable` 空表文案不影响 StepChat |
| 不绑 `/api/jobs[0]`；trace = `pack:${packId}` | **YES** | `loadPack`：`traceId.value = packId.value ? \`pack:${packId.value}\` : ""`；注释写明永不 `listJobs()[0]`。源码无 `/api/jobs` / `listJobs` |
| 不改 `designs/v0`；不实现 F-1 | **YES** | FilesChanged 无 `designs/v0/**`。检索区仍既有 `RetrieveHitsTable`（file_name / 页 / unit_id / clause_id / 路径），无详情抽屉/选中命中。`:hits="hits"` 是 B-1 对话上下文，不是 F-1 UI |
| 白名单 | **YES** | 业务改动仅 vue + 新 on-load 测试 + report；未改 `StepChat.vue`；B-1 `standard-lib-stepchat.test.ts` 未动 |
| 先红后绿（源码快照测试） | **YES** | RED 摘录仍含 `<StepChat v-if="chatReady" :trace-id="traceId" :pack-id="packId" :hits="hits" step="retrieve" />`（B-1 接线保留、挂载门仍在）。GREEN 去掉门控后 7/7 |
| 测试顶部「为什么」注释 | **YES** | 进页可见 / 零命中不卸载 / 不绑 Job（`/api/jobs[0]` = fixture-reversed.json） |
| 挂载条件 / pack trace 不变量注释 | **YES** | `packId` 计算属性：「Mount StepChat on packId, not hits」；模板注释说明 hits 门会首屏隐藏并在 0 命中卸载 |
| 无新对外类型 / 未 `register_contract` | **YES** | `RetrieveHit` 已有；未新增 TS 导出 |
| 禁止 commit | **YES** | report Commits: none；HEAD 仍 `c01b4e2` |
| component：不查 test-cases.md | **YES** | 未查 |

**Missing：** 无。plan 三条验收（未检索可见、零命中不卸、pack 线程不绑 Job）均在 vue 落地；brief 五项源码断言均有对应用例。

**Extra（白名单外）：** 无。`index.vue` 相对 HEAD 仍含 Task 2 已审查的 `ingestError`（PDF 光栅中文映射）以及 B-1 的 `:pack-id` / `:hits`；RED 模板已带这两 props，本片只改 `v-if`。工作区 `designs/v0` tickAll 脏文件不属本 Task。

**Misunderstood：** 无。未把 F-1 检索详情、改 `page.logic.md`、或把 `loadPack` 改回 `/api/jobs` 当成本片。挂载条件用 brief 允许的 `v-if="packId"`，不是无条件挂载或改回 hits 门。

### Strengths
- 最小实现：删 `chatReady`、`search()` 只更新 hits、模板改 `v-if="packId"`，保留 B-1 pack 线程与 StepChat 接线。
- TDD 证据与当前工作区同构：RED 行就是 B-1 之后、本片之前的模板；GREEN 断言与现源码一致。未先改 Vue 再补测试。
- 不变量写在「为什么」注释里，而不是复述语法：packId 挂载（空检索仍要 HITL 侧栏）、`pack:` 线程（禁止借第一条 Job）。
- 未越权：F-1 未做、`designs/v0` 未动、`StepChat.vue` 未动、未 commit、未 `audit_arch_changes`。

### Issues
#### Critical (Must Fix)
- 无。

#### Important (Should Fix)
- `refresh_asset` 新建 `frontend/apps/component/StandardLib`（`query_arch` 可见，摘要仍是「标准资产管理」页面入口，未写进页挂载 / pack trace），未覆盖 `search_arch` 里既有 `frontend/web/component/StandardLib`（扫描失败）。`query_arch frontend/web/component#StandardLib` Path not found。批次禁止 `audit_arch_changes` / 手工改 `.ai/`；留给最终 closeout，不阻断本 Task 源码验收。

#### Minor (Nice to Have)
- 快照测试未显式禁止 `v-if="hits.length"` 等其它卸载谓词，只禁 `v-if="chatReady"` 与 `chatReady = hits.length > 0`。当前实现没有其它门，回归风险低。
- 进页瞬间 `traceId` 仍为 `""`，`loadPack` 完成后才写成 `pack:${packId}`。`StepChat`（白名单外）`watch([traceId, packId, …])` 会 `seed()` 重置问候。`canSend` 已是 `traceId \|\| packId`，发送路径可用 packId；侧栏首屏可见符合验收。若用户在 `loadPack` 返回前发出一条消息，watch 可能清掉该条——窗口极短，本片按 brief 不得改 `StepChat.vue`。
- 未在浏览器打开 `/packs/:id/standards`（implementer 已披露）；挂载由源码快照覆盖，符合 brief「readFileSync Vue」测法。
- 新测试非 arch 资产（report：`search_arch` 空），未 refresh；正确。

### Assessment
**Task quality:** Approved
**Reasoning:** 标准库进页即可挂载 StepChat（`v-if="packId"`，无 `chatReady` / hits 卸载）；零命中只更新表格；线程仍为 `pack:${packId}`，未回绑 `/api/jobs[0]`。未实现 F-1、未改 `designs/v0`、未 commit。TDD RED/GREEN 与白名单合格。`refresh_asset` 错挂 `frontend/apps` 记 Important，按批次规则留 closeout，不改本片结论。
