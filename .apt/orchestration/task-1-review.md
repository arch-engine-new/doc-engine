# Task 1 Review — 三页 C2 回流（F2）

review-tier: full
projectType: component（跳过 B2 `test-cases.md`；公开方法注释抽检 N/A）
Plan: `docs/apt/plans/2026-09-15-verify-fix-design-audit-logic-sync-plan.md` Task 1
Brief: `.apt/orchestration/task-1-brief.md` / `.apt/orchestration/task-1-review-brief.md`
Report: `.apt/orchestration/task-1-report.md`
Range: `9f584e7987786bd48fa0cdc39addc923739c1410..HEAD`
Commit: `eca0561` `fix(designs): align three C2 prototypes with approved page logic`
Status (implementer): `DONE_WITH_CONCERNS`

## Spec Compliance

- ✅ Spec compliant

对照 brief / plan Task 1：无 Missing / Extra（白名单外）/ Misunderstood。

| 检查项 | 结果 | 证据 |
|--------|------|------|
| 修 C2，不改 RAG / core-engine / vue | **YES** | `git diff --stat` 仅 11 文件，全在白名单；无 `packages/**`、`apps/web/**`、`.ai/**` |
| 禁止用简陋 html 覆盖硬约束操作 | **YES** | 见下「硬约束」；三页 html 已补齐到 logic + vue |
| logic 不得手改凑闸；须 reconcile | **YES** | `.apt/tool-call-log.jsonl` 有 dryRun（一度会砍操作，已丢弃）及 `pending_review` `dryRun:false` 写入；report 称后续用同一 `handleReconcilePageLogic`（thinking disabled）写另两页。磁盘 logic 为 schema L 结构，非空 diff 凑闸 |
| 三页 html 补齐到 logic | **YES** | 待签 Tab / 缺表面板+DocType 树+生成检验批 / 继承基字段+Excel 映射面板均在 html |
| `_pages.md` 仅三页 notes | **YES** | 仅 `project_home` / `template_annotate` / `pending_review` notes；`approved=yes` 未误开闸；`standard_lib` 行未动 |
| Commit subject | **YES** | 与 brief 一致 |
| 未跑完整 `$apt-create` Phase 0 | **YES** | 日志无停等 brief；走 reconcile |
| 禁止 `audit_arch_changes` | **YES** | 本切片 15:17 之后无该调用 |
| component：不查 test-cases.md | **YES** | 未查 |
| 公开方法注释 | **N/A** | 无 export TS |

**硬约束（未砍）：**

- `pending_review`：html 有「资料待签」Tab、`GET /api/pending/signatures`、`confirmSignatureTask` 弹窗；logic 保留 `listSignatureTasks` / `confirmSignatureTask` / `openStepChat`
- `project_home`：html 有缺表清单、`listDocTypes` 树、「生成检验批」「补表」；logic 保留 `listDocumentGaps` / `generateInspectionBatch` / `fillDocumentGap` / `listDocTypes`
- `template_annotate`：html 有继承基字段只读表、`layout_kind=excel` 映射面板；logic 保留 `loadExcelMappings` / `saveExcelMappings` / `uploadExcelTemplate` / `loadEffectiveBoxes`

**Extra（可接受，非白名单越界）：** logic 增补 `saveWording` / `reject` / `cancelSign` / `addFieldDef` / `addExcelMapping` 等，与 html 按钮及既有 vue（保存措辞、添加字段、添加映射）同向；`reject` 在 vue 仅有 rejected 状态展示、无「退回」按钮，但不触发 C1（C1 是 view 变更且 logic 未变）。

**Concerns 裁定：**

1. `project_home` 操作表不再列出 `openStepChat` — **可接受**。不在硬约束「上列操作」内；html 仍引入 `step-chat.js`，vue 仍挂 `StepChat`。`pending_review` / `template_annotate` 均保留该操作。
2. `page.manifest.json` 未随 reconcile 重生 — **可接受**。handler 只写 `page.logic.md`；未手填；原未跟踪文件入仓即解 C2。`generatedAt` 仍为 2026-08-26，description 偏旧，交 Task 2 `design-sync` 以磁盘 logic 为准。

## Strengths

- 先 dryRun、发现会砍待签/缺表/Excel 后丢弃写入，再把 html 补齐到已批准 logic+vue，符合 brief 分支。
- 颜色用 `--apt-*`（`tokens.css` / `global.css`），三页 html 无 `#hex`。
- 微闭环诚实：ContractsRegistered / AssetsRefreshed 均为无；html/logic 非 arch 源。
- Report 主动披露 MCP flash 空 content、`openStepChat`、manifest 未重生，便于审查。

## Quality

**公开方法注释抽检：N/A**（本 Task 无 export TS）

**APT 扩展：** Contracts/Assets 与 diff 一致（无新 TS、无 `refresh_asset`）。`query_design(page=project_home)` 知识库仍为 8/30 旧 logic（含 `openStepChat`），属 F1，由 Task 2 design-sync 处理，本切片禁止写 `.ai/`。

**gstack：** 本 diff 为 `designs/v0` html/md，无 SQL / 生产 LLM 边界 → 跳过。

**数据防御：** 非页面 vue Task → 跳过。

**编码规范：** html 用 class + `--apt-*` 色/圆角；间距为 px（`tokens.css` 无 spacing scale，与其它 v0 页一致）。无无意义注释 / 空 TODO。

**Verify：** 审查方按 brief **未复跑** `check-logic-sync`（主 Agent 会复跑）。report：`node .../check-logic-sync.cjs --root D:\software\doc-engine --base 4d42e0d9f5b9241ab935b3872289b27ce4e5b363 --json` exit 0，`failures: []`，三页无 C2。C1 定义为 view 变更且 logic 未变，本切片未改 vue，预期无 C1。

## Issues

#### Critical (Must Fix)

无。

#### Important (Should Fix)

无。

#### Minor (Nice to Have)

- `project_home` 新 logic 操作表未再列出 `openStepChat`（原型仍引入 `step-chat.js`）。硬约束操作均在。若希望操作表与旧批准稿逐行对齐，可在后续 reconcile 补回一行，不必为本 C2 重开闸。
- 三页 `page.manifest.json` 仍为 2026-08-26 生成稿（`template_annotate` description 仍写「空白表框选 ≥3 字段」）。未手填，符合「不要手填」；Task 2 design-sync 应以 `page.logic.md` 为准，不必为本切片重开。
- `pending_review` logic 增 `reject`（html「退回」），vue 无对应按钮。不构成 check-logic-sync C1；语义上可日后对齐。

## Assessment

**Task quality:** Approved

**Reasoning:** 三页原型已补齐硬约束 UI，logic 经 reconcile 回流且未砍待签/缺表/DocType/Excel 操作；白名单与 commit 合格。`openStepChat` 从表中消失与 manifest 未重生已披露，且不阻断 C2。
