# Task F9-2 Brief — A13/A11 回归与 test-cases 核对（R6 / R7 / R8）

- **Plan:** `docs/apt/plans/2026-09-20-standard-lib-expand-one-hop-plan.md` Task 2
- **Report:** `.apt/orchestration/task-f9-2-report.md`
- **review-tier:** light
- **BASE_SHA:** `59f206d4249eb1414280c7f524705d947e9efb7f`
- **上一 Task：** F9-1 DONE_WITH_CONCERNS，review PASS。expandOneHop 已在 library.ts。concerns 不阻断。

## Files 白名单

- `designs/v0/standard_lib/test-cases.md`
- `packages/core-engine/test/standard-rag.test.ts`（仅当回归断言缺失时补注释/断言；禁止改 seedPack 共享出边）

禁止改：`page.logic.md`、`prequery.ts`、`searchGraph`、`library.ts`、Vue、密钥。

## MCP

- `query_arch` path=`frontend/core-engine/util#standardlibrary`
- `query_design` page=`standard_lib`

无 MCP 则读磁盘 page.logic / test-cases；MCP logicMarkdown 滞后，以磁盘为准。

## 步骤

1. 确认 `designs/v0/standard_lib/test-cases.md` 已含 T10–T14。若 T10 夹具表述与「用例内 seed 1.1→1.2 出边」冲突，只在 test-cases **测试注释/备注列** 说明，不要改产品真源 page.logic.md。
2. 回归：A11 `searchStandard("1.1")` 在未自备出边时仍 length===1 且 exact；A13 「2.1替代了哪条」仍单行 graph SUPERSEDES。现有测试若已覆盖则不要重复造轮子。
3. Verify 绿后：test-cases 非 arch 源码则 report 写「无架构资产变更」；不必 register_contract。
4. 若文件无实质变更：仍写 report，Status 可为 DONE；无 diff 则不要空 commit。有实质变更才 git commit。

## Verify

`npx vitest run test/standard-rag.test.ts`（cwd `packages/core-engine`）

commit 建议（仅有变更时）：`docs: note F-9 expandOneHop outgoing-edge fixture in test-cases`
