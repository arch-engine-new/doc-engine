# Task F9-2 Report — A13/A11 回归与 test-cases 核对（R6 / R7 / R8）

## Status

DONE

## Commits

- `87e3550abe94ec4abd68cd00ee9f81954bf121d7` `docs: note F-9 expandOneHop outgoing-edge fixture in test-cases`
  - files: `designs/v0/standard_lib/test-cases.md`、`packages/core-engine/test/standard-rag.test.ts`
  - parent: `59f206d4249eb1414280c7f524705d947e9efb7f`（F9-1 BASE_SHA）
- 本 Implementer 复核时白名单 working tree **干净**；未再空 commit。本 report 不进 commit。

## 测试摘要

- Command: `npx vitest run test/standard-rag.test.ts`（cwd `packages/core-engine`）
- Result: **20 passed / 0 failed**（`Test Files  1 passed (1)`，Duration 4.65s，exit 0）
- **A11 绿**：未自备 1.1 出边时 `searchStandard("1.1")` 仍 `length===1` 且 `retrieve_path=exact`（共享 seed 仍为 1.2→1.1 CITES、2.1→1.1 SUPERSEDES）
- **A13 绿**：「2.1替代了哪条」仍单行 `graph` SUPERSEDES（`hits.length===1`，`path=[{from:2.1,to:1.1,kind:SUPERSEDES}]`）；graph intent 不走 expandOneHop
- A19 五条仍绿（T10–T13 / 精确扩跳）；未改 `seedPack` 共享出边；未改 `library.ts` / `prequery.ts` / `searchGraph` / Vue / `page.logic.md`
- 无 API key；未写 DASHSCOPE_API_KEY

## MCP（只读）

- `query_project_status`：phase=`done`，`activePlan` 为本片 plan；`typeHealth.declared=component`。未当阻断。
- `query_arch` path=`frontend/core-engine/util#standardlibrary`：命中 `packages/core-engine/src/retrieve/library.ts`。本 Task **未改** library.ts。扫描 signatures 空、Updated 2026-09-19（滞后，不阻断）。
- `query_design` page=`standard_lib`：approved；MCP `logicMarkdown` **落后于磁盘**（无 expandOneHop / A19）。**以磁盘为准**。`gaps=no-implementation-ref` 按 plan **未** `report_design_gap`。
- 禁止 `audit_arch_changes`（留给 PB-5）。无新契约 → 未 `register_contract`。test-cases 非 arch 源码 → 未 `refresh_asset`。

## 核对结果

| 检查项 | 结论 | 证据 |
|--------|------|------|
| test-cases 已含 T10–T14 | YES | T10 不问引用见图邻接；T11 0 命中不扩图；T12 去重；T13 只扩一跳；T14 POST search 同时含 vector+graph |
| T10 夹具 vs 出边纪律 | 已备注 | 表下：「T10 引擎测在用例内 seed `1.1 -[:CITES]-> 1.2` 出边，不改共享 seedPack。」未改 page.logic.md |
| A11 未自备出边仍 exact 单行 | YES | `length===1` + exact 保留；注释：expandOneHop 不得多出 graph 行 |
| A13 仍单行 graph SUPERSEDES | YES | `expect(hits).toHaveLength(1)` + 注释（graph intent 不扩） |
| 未改共享 seedPack | YES | `seedPack` 仍 1.2→1.1 CITES、2.1→1.1 SUPERSEDES |
| 未改禁止文件 | YES | 未改 `page.logic.md`、`prequery.ts`、`searchGraph`、`library.ts`、Vue、密钥 |

## 实现摘要

- 本 Task 无产品代码。expandOneHop 已在 F9-1（`searchStandard` 仅在 exact/semantic 后调用；graph intent 走 `searchGraph` 不扩）。
- `test-cases.md`：确认 T10–T14；补 T10 用例内出边备注（相对 F9-1 HEAD 纳入 T10–T14 行，属本 Task 白名单）。
- `standard-rag.test.ts`：仅补 A11/A13 回归注释与 A13 `length===1`；**未**重复造 A19 轮子；**未**改 seedPack。

## APT Micro-closeout

| 项 | 结果 |
|----|------|
| ContractsRegistered | none（无契约；未改 ports.ts / RetrieveHit / GraphStore） |
| AssetsRefreshed | none（test-cases 通常无 `refresh_asset`；未改已索引源码） |
| AssetsRemoved | none |
| 无架构资产变更 | YES |

## Files

- 改（已在 `87e3550`）：`designs/v0/standard_lib/test-cases.md`、`packages/core-engine/test/standard-rag.test.ts`
- 未改：`library.ts`、`page.logic.md`、`prequery.ts`、`searchGraph`、Vue、`.env` / 密钥

## Concerns

无阻断。已知滞后（不属本 Task 缺口）：
1. MCP `query_design` `logicMarkdown` 落后于磁盘（plan 已声明以磁盘为准）。
2. `query_arch` StandardLibrary 扫描 signatures 空；F9-1 `refresh_asset` 重复 util 条目留给 PB-5。
3. 原型 `index.html` 仍写共享入边 1.2→1.1；本片禁止改 Vue/HTML。
