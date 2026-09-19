# SLICE-4 Pending Review Spec

**Slice:** 审核 the pending proposal for Reviewer  
**Pages:** `pending_review`（本步对话壳）；不实现 Vue（无 design profile）  
**Contracts:** `ProposalRow`, `ReceiptRow` @ `docs/schema/generated/core-engine-rows.ts`；`ToolRuntime` @ `packages/agent-runtime/src/tools/runtime.ts`  
**Reuse:** `packages/core-engine` JobPipeline；`packages/agent-runtime` ToolRegistry/ToolRuntime  
**Out:** Vue SPA、资料云实挂、组卷提交、Qdrant/Neo4j、真实 LLM 必连

## 目标

认知节点 `check_wording` **只写** `t_proposal`（`status=pending`），不写 Receipt。审核人可改措辞；**人确认后中台才写** `t_receipt`。无 `receipt_id` 不算落库。agent-runtime **禁止** `submit_*` Tool（不存在或执行被拒绝）。本步对话不能确认、不能写 Receipt。

## 验收（本片）

| ID | 通过标准 |
|----|----------|
| A6 | `checkWording` 产出 pending Proposal；`editWording` 可改正文；`confirmProposal` 后存在 `receipt_id` 且 proposal=`confirmed`。未确认则无 Receipt。 |
| A8 | `ToolRuntime.execute("submit_volume")` / `submit_*` 被拒绝（`NOT_FOUND` 或 `FORBIDDEN`）；`ToolRegistry.register("submit_foo", …)` 不得成功。 |

回归：A1 / A2 / A3 / A4 / A5 / A9 / A15 仍 PASS。agent-runtime 既有 tool 测试不得因禁名单误伤非 `submit_` 工具。

## 行为

1. SQLite 增表 `t_proposal`、`t_receipt`（字段对齐生成合同）。`types.ts` re-export。
2. `checkWording({ jobId, wording, agentRunId? })`：插入 Proposal `pending`；Job 可标 `pending`；**不得**插 Receipt。可用确定性夹具措辞，本片不强制真实智谱调用。
3. `editWording(proposalId, wording)` 仅改 `wording`，status 仍 pending。
4. `confirmProposal(proposalId)`：中台插入 Receipt（`receipt_id` 非空，`status=accepted`），proposal → `confirmed`。模型/对话声称成功无效。
5. `appendChat({ step: "pending_review" })` 不得 confirm、不得写 Receipt。
6. agent-runtime：工具名匹配 `submit_` 前缀（含 `submit_volume`）禁止注册与执行。允许注册 `check_wording`（可选）；其 handler 只应回调写 Proposal 的端口，不写 Receipt。
7. Audit：confirm 写入 `event_type=receipt`，带 `trace_id`。

## 非目标

Vue connect、mock 资料云 HTTP 全集（SLICE-6 C4）、组卷预览树（SLICE-5）、blocking finding 被对话取消。
