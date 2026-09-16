# Task 2 Brief — design-sync 刷新设计知识（F1）

plan: `docs/apt/plans/2026-09-15-verify-fix-design-audit-logic-sync-plan.md`
projectType: component
BASE_SHA: `eca0561`（Task 1 HEAD）
上一 Task handoff: C2 三页已对齐（commit eca0561）；check-logic-sync failures=[]。必须先有 Task 1 再 sync，避免把简陋 html 写进 `.ai/design/`。

## Part 1 摘要

- F1：`audit_design_changes` stale，`syncedAt=2026-08-30`。磁盘 `standard_lib/page.logic.md` 已有 tick / file_name / unit_id；`query_design` 仍返回旧稿。
- 跑 `design-sync --adapter v0`。禁止手写 `.ai/design/`。
- 不要求清掉 `no-implementation-ref`。
- 不改 RAG / vue / core-engine。

## 步骤

1. 只读 MCP：`query_design` page=`standard_lib`（记录旧 logic 无 tick，作对照）。
2. 在项目根执行（PowerShell）：
   ```
   node C:\Users\weilt\.apt\arch-engine\dist\cli-design-sync.js D:\software\doc-engine --adapter v0
   ```
   允许加 `--incremental`。若 CLI 参数不同，先 `-h` 再跑。**禁止**手写 `.ai/design/` JSON/md。
3. Verify MCP：
   - `audit_design_changes`：`stale` 为空，或 `syncedAt` ≥ 本轮 designs/v0 mtime。
   - `query_design(page=standard_lib)`：`logicMarkdown` 含 `tick`、`file_name`、`unit_id`。
4. 微闭环：无新 TS 契约。design 知识不是 arch asset；report 写「本 Task 无架构资产变更」。禁止 `audit_arch_changes`。
5. `git add` 仅白名单（`.ai/design/` 下由 CLI 改动的文件 + report）。不要 `git add .`。不要把 `.ai/arch/vectors.db` 等无关脏文件塞进 commit。
6. 写 `.apt/orchestration/task-2-report.md` 并 commit。

## Files 白名单

- `.ai/design/**`（仅 design-sync 产出）
- `.apt/orchestration/task-2-report.md`

禁止：`packages/**`、`apps/web/**`、`designs/v0/**`（Task 1 已完成）、手改 `.ai/design/`。

## Commit subject

`chore(design): sync v0 recipes after C2 logic align`

## 编码规范

`.apt/code-standards.md`。本 Task 无业务代码。
