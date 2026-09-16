# Task 3 Brief — 回归（RAG 不得回退）

plan: `docs/apt/plans/2026-09-15-verify-fix-design-audit-logic-sync-plan.md`
projectType: component
BASE_SHA: `843ab7e`
上一 Task handoff: design-sync 完成；`audit_design_changes.stale=[]`；`query_design(standard_lib)` 已含 tick / file_name / unit_id。

## Part 1 摘要

- 本 Task **只跑回归测试**，证明 C2/design-sync 未破坏 RAG。
- **禁止**改 `packages/core-engine` 实现，除非测试红且能证明是本切片误伤（预期不会）。
- 全量 `/verify` 由主 Agent 在全部 Task Gate 后执行，本 Task **不要**自己跑 `/verify` 写 latest.md。

## 步骤

1. 跑 Verify 命令（必须，写入 report 退出码与摘要）：
   ```
   npx vitest run packages/core-engine/test/standard-rag.test.ts packages/core-engine/test/upload-ocr.test.ts packages/core-engine/test/ingest-pdf.test.ts packages/core-engine/test/paddleocr.test.ts packages/core-engine/test/graph-store.test.ts packages/core-engine/test/vector-payload.test.ts packages/core-engine/test/live-rag-ingest.test.ts
   ```
   期望退出码 0。live 无 DATABASE_URL 允许 skip。
2. 若全绿：不改生产代码。可只提交 report（或 report 写 no-code commit）。
3. 若红：BLOCKED，不要擅自修 RAG 语义；在 report 写失败用例。
4. 微闭环：无契约/无 arch 资产。禁止 `audit_arch_changes`。

## Files 白名单

- `.apt/orchestration/task-3-report.md`

禁止改 packages / apps / designs / `.ai`。

## Commit subject（若有文件）

`test(core-engine): record RAG regression after design-sync`

若无代码且你选择不 commit report，report Commits 写 `(no code)`。

## 编码规范

`.apt/code-standards.md`。本 Task 无业务代码。
