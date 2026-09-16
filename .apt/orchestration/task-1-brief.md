# Task 1 Brief — 三页 C2 回流（F2）

plan: `docs/apt/plans/2026-09-15-verify-fix-design-audit-logic-sync-plan.md`
projectType: component
BASE_SHA: `9f584e7987786bd48fa0cdc39addc923739c1410`
logic-sync 锚点: `4d42e0d9f5b9241ab935b3872289b27ce4e5b363`（plan `BASE_SHA_initial`）
APT_HOME: `C:\Users\weilt\.apt`

## Part 1 摘要

- 本切片修 verify FAIL：logic 同步 C2，不是 RAG 回归。禁止改 `packages/core-engine/**`。
- 三页未跟踪 `index.html` 是早期简陋原型；**已批准 `page.logic.md` + vue 才是真相**。
- 禁止用 html 覆盖：`pending_review` 待签 Tab / signatures API；`project_home` 缺表 / 生成检验批 / DocType 树；`template_annotate` excel 映射 / 继承基字段。
- 禁止手改 `page.logic.md` 空 diff 凑闸。必须 `reconcile_page_logic` 或 `$apt-create --refine` 产出 logic。
- **不要**跑完整 `$apt-create` Phase 0（会停等「确认 brief」）。本 Task 已在 approved plan 内。

## 步骤

1. 只读 MCP：`query_design` page=`pending_review` / `project_home` / `template_annotate`。对照磁盘 logic 与 vue（只读 vue，默认不改）。
2. `reconcile_page_logic` **dryRun**：`projectRoot=D:/software/doc-engine`，`pageIds=["pending_review","project_home","template_annotate"]`，`strategy=auto_fill`。读 `changeSummary`。
3. 分支：
   - 会删减上列操作 → **丢弃写入**。把三页 `index.html` **补齐到当前 logic + vue**（待签 Tab、缺表面板、Excel 映射面板等）。然后再 `reconcile_page_logic`（可带 `oldLogicMarkdown`=当前 logic）让 `page.logic.md` 与 html **同区间**变更；`allowApprovedOverwrite: true`（`_pages.md` 这三页现为 `approved=yes`）。
   - dryRun 只补缺口且不删操作 → `allowApprovedOverwrite: true` 写入。
4. `page.manifest.json` 随 reconcile/refine 重生，不要手填。
5. 可改 `_pages.md` 仅这三页的 notes/approved（若 refine 要求重开闸）；不要动 `standard_lib` 行以外的其它页，除非工具自动改。
6. **Verify**（必须跑）：
   ```
   node C:\Users\weilt\.apt\scripts\check-logic-sync.cjs --root D:\software\doc-engine --base 4d42e0d9f5b9241ab935b3872289b27ce4e5b363 --json
   ```
   对 `pending_review` / `project_home` / `template_annotate` **无 C2**。
7. 微闭环：无新 TS 契约则 ContractsRegistered 写无。html/logic 一般不 `refresh_asset`（非 arch 源）；report 写明「本 Task 无架构资产变更」除非改了已索引路径。
8. **git add 仅白名单文件**（工作区很脏）。一条 commit。
9. 写 `.apt/orchestration/task-1-report.md`。

## Files 白名单

- `designs/v0/pending_review/index.html`
- `designs/v0/pending_review/page.logic.md`
- `designs/v0/pending_review/page.manifest.json`
- `designs/v0/project_home/index.html`
- `designs/v0/project_home/page.logic.md`
- `designs/v0/project_home/page.manifest.json`
- `designs/v0/template_annotate/index.html`
- `designs/v0/template_annotate/page.logic.md`
- `designs/v0/template_annotate/page.manifest.json`
- `designs/v0/_pages.md`（仅三页行）
- `.apt/orchestration/task-1-report.md`

禁止改：`packages/**`、`apps/web/**`（除非 refine 后出现 C1；本 Task 预期无 C1）、`.ai/**`（那是 Task 2 design-sync）。

## MCP

- `query_design`（page）
- `reconcile_page_logic`（dryRun 再写入）
- 缺依赖 → `report_missing` 停
- 禁止 `audit_arch_changes`

## Commit subject

`fix(designs): align three C2 prototypes with approved page logic`

## 编码规范（必须遵守）

完整文件：`.apt/code-standards.md`

- 注释说为什么；禁止无意义注释 / 空 TODO。本 Task 若无新 export 公开方法，注释抽检 N/A。
- 颜色/间距只用 `--apt-*` tokens；禁止硬编码 `#hex`（html 内联 style 尽量用 class）。
- 不改 core-engine / vue，除非 brief 明确放开。
