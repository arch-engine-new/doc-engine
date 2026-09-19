# Task 1 Brief — B-3 进页即挂载 StepChat

review-tier: full
BASE_SHA: c01b4e2717a906c8e98f17245ec79d03fd871ca5
plan: docs/apt/plans/2026-09-17-b3-standard-lib-stepchat-on-load-plan.md
report: .apt/orchestration/task-b3-1-report.md

## Goal

标准库进页未检索即渲染右侧 StepChat；`hits.length===0` 不卸载侧栏；仍不绑 `/api/jobs[0]`；trace 为 `pack:${packId}`。

## 全自动

`/apt-goal --continue` 切片 B-3 PB-1。**禁止 commit**（批次执行体要求）。禁止改 `designs/v0/**`。禁止实现 F-1 检索详情。禁止把 `loadPack` 改回绑 `/api/jobs`。

## 复现（当前红）

`apps/web/src/views/standard_lib/index.vue`：
- `chatReady` 初值 `false`
- `search()` 仅在 `result.hits.length > 0` 时置 `chatReady = true`
- 模板 `<StepChat v-if="chatReady" ...>`，未检索或 0 命中时卸载整个侧栏

## 步骤（TDD 先红后绿）

- [ ] **先写失败测试**（不得先改 Vue）：`packages/core-engine/test/standard-lib-stepchat-on-load.test.ts`
  - `readFileSync` 仓库根下 `apps/web/src/views/standard_lib/index.vue`
  - 模板含 `<StepChat` 且 **不得** 出现 `v-if="chatReady"`
  - 源码 **不得** 含 `chatReady.value = result.hits.length > 0` 或等价 `hits.length > 0` 赋给 chatReady
  - 源码 **不得** 请求 `/api/jobs`
  - 源码含 ``pack:${packId`` 或 `` `pack:${packId.value}` ``（pack 级 trace）
  - 先跑 Verify：**必须 RED**（当前有 `v-if="chatReady"`）。把 RED 输出写入 report
- [ ] **最小实现**：去掉 hits 门控。`packId` 或已有 `traceId` 即可挂载 StepChat（可用 `v-if="packId"`）。`search()` 只写 `hits`，不要用 hits.length 卸载组件。保留 `loadPack` 的 `pack:${packId}`，禁止 listJobs/[0]。
- [ ] GREEN：再跑 Verify 全绿；另跑 `npx vitest run test/standard-lib-stepchat.test.ts` 不退化
- [ ] 新增测试文件顶部注释说明为什么（进页可见 / 零命中不卸载 / 不绑 Job）
- [ ] 微闭环：对白名单内已索引 modified 调 MCP `refresh_asset`（`apps/web/src/views/standard_lib/index.vue`）；新测试非 arch 资产则 report 写「测试文件无架构资产」；无新对外类型不 `register_contract`。**禁止** `audit_arch_changes`。写 report。

## MCP（开始前只读）

- query_contract `RetrieveHit`
- search_arch `standard_lib StepChat`
- 禁止未经 MCP 读 `.ai/`

## Files 白名单

- `apps/web/src/views/standard_lib/index.vue`
- `packages/core-engine/test/standard-lib-stepchat-on-load.test.ts`
- `packages/core-engine/test/standard-lib-stepchat.test.ts`（仅当断言冲突，尽量不改）

## Verify

```
npx vitest run test/standard-lib-stepchat-on-load.test.ts test/standard-lib-stepchat.test.ts
```

cwd: `packages/core-engine`

## 禁止

- git commit / push
- 改 `designs/v0/**`、`.apt/goal.md`、`playbook-state.json`
- 实现检索命中详情（F-1）
- 绑 `/api/jobs[0]` 或 `listJobs`
- 改 StepChat.vue 除非白名单外必须——默认不要改
- `audit_arch_changes`

## 编码规范（节选）

- 注释说为什么；关键逻辑（挂载条件 / pack trace 不变量）必须注释
- 不要无意义注释
- 函数 return type 明确（测试文件除外）

## Report

写满 `.apt/orchestration/task-b3-1-report.md`：Status、Tests（含 RED/GREEN 证据）、APT Micro-closeout、FilesChanged、Commits（写 none）、Blockers/Concerns。
