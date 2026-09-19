---
status: approved
feature: B-3 standard_lib step-chat on load
slice: B-3
---

# B-3 标准库本步对话进页即可见

> 全自动自答，未经用户确认（`/apt-goal --continue` programMode 夜间切片）。

**Goal：** 标准库进页即显示右侧本步对话，不必先检索出命中。不实现 F-1 检索详情，不改 `designs/v0/standard_lib` 产品 logic，不绑 `/api/jobs[0]`。

**验收标准：**

1. 打开 `/packs/:id/standards` 未点检索时，本步对话侧栏可见（模板挂载 `StepChat`，不得用 `chatReady`/`hits.length` 卸载）。
2. 检索 0 条命中后侧栏仍在，不得因 `hits.length===0` 卸载。
3. 仍不绑 `/api/jobs[0]`；线程仍为 `pack:${packId}`。

**漂移注记：** `query_project_status` 返回 `nextAction=accept`（残留 accept 相位）。程序模式以 `playbook-state.json` 切片为准，本批未带 `--accept`，不跑 ACCEPT-BATCH。

## 范围

- 做：解开 `chatReady` 对 `hits.length > 0` 的挂载门；进页即渲染 StepChat；零命中不卸载；复现测试先红后绿。
- 不做：F-1 命中详情 UI；改 `page.logic.md` / refine；恢复绑第一条 Job；真实模型联调。

## 设计寻址

- global tokens：apt-skyline-clean / Vue bindings；StepChatPanel = `aside.step-chat`。
- page `standard_lib`：logic 已有 `openStepChat`。gaps=`no-implementation-ref`（项目全局缺 page.tsx，Vue 已有实现）。本任务是既有绑定 bug，不新增视觉组件，不改 logic。
- component `StepChatPanel`：本步 HITL，不写账本。
- armed：禁止改 `designs/v0/standard_lib`（F-1 待批泊车）。

## 依赖寻址

| 依赖 | 来源 | sourcePath |
|------|------|------------|
| RetrieveHit | contract | `packages/core-engine/src/retrieve/ports.ts` |
| packChatTraceId | search_arch | `packages/core-engine/src/agent/context.ts` |
| StandardLib 视图 | search_arch | `apps/web/src/views/standard_lib/index.vue` |
| StepChat | search_arch | `apps/web/src/components/StepChat.vue` |

`query_contract(StepChat)` 未登记（Vue SFC）；`query_arch` 对 `frontend/web/component#stepchat` 路径未解析（扫描失败资产）。以 `search_arch` 的 `sourcePath` 为准，不 `report_missing`。

## 风险

- B-1 用 `chatReady = hits.length > 0` 避免绑 Job；本片只改挂载条件，禁止把 `loadPack` 改回 `/api/jobs`。
- `openStepChat` logic 文案仍是「检索命中后」——本片按 A15/队列 bug 修 Vue，不改 logic（verify logic-sync 不得手改 page.logic 凑同步）。

## Part 2 Tasks

### Task 1 — 进页即挂载 StepChat，零命中不卸载

- [ ] 先写失败测试：读 `apps/web/src/views/standard_lib/index.vue` 源，断言未检索即可挂载 StepChat；不得 `v-if="chatReady"`；`search()` 不得 `chatReady = hits.length > 0`；无 `/api/jobs`；trace 为 `pack:${packId}`
- [ ] 最小实现：去掉 hits 门控；`packId`/`traceId` 存在即渲染；`search()` 只更新 hits
- [ ] GREEN：Verify 命令全绿；B-1 `standard-lib-stepchat.test.ts` 不退化
- [ ] 微闭环 refresh 改动资产

**MCP：** query_contract `RetrieveHit`；search_arch `StandardLib` `StepChat`
**Files：**
- `apps/web/src/views/standard_lib/index.vue`
- `packages/core-engine/test/standard-lib-stepchat-on-load.test.ts`
- `packages/core-engine/test/standard-lib-stepchat.test.ts`（仅当断言冲突）
**Verify：** `npx vitest run test/standard-lib-stepchat-on-load.test.ts test/standard-lib-stepchat.test.ts`
cwd: `packages/core-engine`
**Contracts：** RetrieveHit（已有则不重复登记）
