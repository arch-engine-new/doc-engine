# SLICE-4 Pending Review Plan

> spec: `docs/superpowers/specs/2026-08-27-slice-4-pending-review.md`  
> schema: `docs/schema/generated/core-engine-migration.sql`（`t_proposal` / `t_receipt`）  
> 契约：`ProposalRow` / `ReceiptRow` / `ToolRuntime`

## 包

- `packages/core-engine`：待审账本（Proposal / Receipt / checkWording / confirm）。
- `packages/agent-runtime`：仅加 `submit_` 工具禁名单（A8）。**禁止**推倒 runtime、禁止改调度/HITL 既有语义。
- 禁止 Vue / Qdrant / Neo4j。

## 任务

1. **SQLite**  
   `sqlite-slice1.sql` 增加 `t_proposal`、`t_receipt` 及合同索引。`LEDGER_TABLES` 纳入。re-export `ProposalRow` / `ReceiptRow`。

2. **ReviewDesk（中台）**  
   新模块（如 `pipeline/review.ts`）：`checkWording` / `editWording` / `listPending` / `confirmProposal` / `listReceipts`。  
   `JobPipeline` 薄包装。confirm 写 audit `receipt`。checkWording 不写 Receipt。

3. **A8 白名单**  
   `ToolRegistry.register` 与 `ToolRuntime.execute`：若 `name.startsWith("submit_")` 则拒绝。  
   补测：`packages/agent-runtime/test/` 一条 A8。既有 tool-runtime 测试保持绿。  
   `ToolExecutionError.code` 可用既有 `NOT_FOUND`，或新增 `FORBIDDEN`（若新增须更新联合类型与测试）。

4. **对话**  
   `appendChat(step=pending_review)` 后 Receipt 仍空、proposal 仍 pending。

5. **测试**  
   - A6：checkWording → pending；editWording 变文案；confirm 有 receipt_id；未 confirm 无 receipt  
   - A8：submit_* 执行/注册失败  
   - 回归：`npm test -w core-engine` 与 `npm test -w agent-runtime` 皆 PASS  
   - `npx tsc -p packages/core-engine --noEmit` 与 `npx tsc -p packages/agent-runtime --noEmit` PASS  
   PowerShell 不要用 `&&`，命令分开跑。

6. **闭环**  
   `refresh_asset` 用 `module=core-engine` 或 `agent-runtime`，禁止落入 `frontend/packages`。新导出 `register_contract`。

## 完成定义

A6/A8 覆盖；不宣称 connect done、不宣称产品整体 verify 完成。
