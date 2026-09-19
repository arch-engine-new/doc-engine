## Task B-3-1 Report
**Status:** DONE
### Tests
- Command: `npx vitest run test/standard-lib-stepchat-on-load.test.ts test/standard-lib-stepchat.test.ts`（cwd: `packages/core-engine`）。
- TDD RED（先写测试、未改 Vue）：`Test Files  1 failed | 1 passed (2)` / `Tests  1 failed | 6 passed (7)`。失败断言：

```
FAIL  test/standard-lib-stepchat-on-load.test.ts > standard_lib StepChat on load > mounts StepChat without a chatReady / hits.length gate
AssertionError: expected '<template>\n  <div class="wrap">\n   …' not to contain 'v-if="chatReady"'
   <StepChat v-if="chatReady" :trace-id="traceId" :pack-id="packId" :hits="hits" step="retrieve" />
 ❯ test/standard-lib-stepchat-on-load.test.ts:24:26
     expect(template).not.toContain('v-if="chatReady"');
```

  同文件第二用例（无 `/api/jobs`、含 `pack:${packId`）已绿；`standard-lib-stepchat.test.ts` 5 例已绿。
- TDD GREEN：去掉 `chatReady` 与 `hits.length` 挂载门后，`Test Files  2 passed (2)` / `Tests  7 passed (7)`。Duration 5.66s。
### APT Micro-closeout
- ContractsRegistered: none（`RetrieveHit` 已有；无新对外 TS 类型；未 `register_contract`）
- AssetsRefreshed: `apps/web/src/views/standard_lib/index.vue`（MCP `refresh_asset` sourcePath 必填；返回 `frontend/apps/component/StandardLib` action=created）。测试文件 `packages/core-engine/test/standard-lib-stepchat-on-load.test.ts` / `standard-lib-stepchat.test.ts` 无架构资产（`search_arch` 空），未 refresh。
- AssetsRemoved: 无
- 禁止 `audit_arch_changes`；未手工改 `.ai/`。
### FilesChanged
- `apps/web/src/views/standard_lib/index.vue`
- `packages/core-engine/test/standard-lib-stepchat-on-load.test.ts`
- `.apt/orchestration/task-b3-1-report.md`
### Commits
- none（brief 禁止 commit）
### Blockers / Concerns
- 开始前 MCP：`query_contract RetrieveHit` 命中 `packages/core-engine/src/retrieve/ports.ts`；`search_arch "standard_lib StepChat"` 命中 StepChat / StandardLib（web 条目 summary=扫描失败，以 sourcePath 为准）。
- `refresh_asset` 新建 `frontend/apps/component/StandardLib`，未覆盖既有 `frontend/web/component/StandardLib`。禁止 audit，未手工改索引。
- 未实现 F-1 检索命中详情；未绑 `/api/jobs[0]` / `listJobs`；未改 `StepChat.vue` / `designs/v0/**`。
- 无本任务浏览器工具；挂载行为由源码快照测试覆盖（`v-if="packId"`，`search()` 只写 `hits`）。
