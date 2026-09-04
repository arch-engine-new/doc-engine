# verify-fix: excel-gap-fill-gates

> **Source verify:** `.apt/verify/latest.md`
> **Source plan:** `docs/apt/plans/2026-08-29-excel-gap-fill-plan.md`
> **Overall:** FAIL
> **Status:** approved
> **ApprovedAt:** 2026-08-30T14:28:00.000Z
> **ApprovedBy:** user
> **Command:** `$apt-plan-from-verify`
> **implementation dims:** 设计 audit、代码质量、外部 Harness（SKIP）

## Part 1 — 背景与范围

### 分流

- `classify-verify-failures` → `recommended=plan-from-verify`
- **closeout 项（架构 audit / 契约登记）不在本 plan**；上一轮 `/finish-feature` 已完成 `refresh_asset` + `start_init`（anchor=`dd15e5b`），重跑 `/verify` 后 F1/F3 预期 PASS
- **外部 Harness**：verify 报告为 SKIP（`harnessMissed` 但无套件 URL）；本 plan 不排 Harness Task

### Failures 摘要（实现类）

| ID | 维度 | 问题 | 根因 |
|----|------|------|------|
| F2 | 设计 audit | `stale`；`blockingPageGaps` 含 `no-implementation-ref` | Task 9 更新 `designs/v0/{project_home,template_annotate,pending_review}/page.logic.md` 后未 `design-sync` |
| F4 | 代码质量 | `mediumCount=5`（≥5 门槛 FAIL） | `pending_review/index.vue` 406 行超 300；`useProjectHome.ts` `load()` 复杂逻辑缺注释；verify 时点名的 `ExcelCellMappingPanel` props / `http.ts` 注释**可能已在后续提交修复**，以重跑 `check_code_quality` 为准 |

### 非目标

- 不改 Excel 出表业务语义或 API 行为（Plan 9/9 + 测试已绿）
- 不重复 closeout（`refresh_asset` / `register_contract` 留给 `/finish-feature`，已完成）
- 不新增路由页或 P2 Agent Tools

### 依赖寻址

| 依赖 | 来源 | 路径 |
|------|------|------|
| `DocumentPipeline` | contract | `packages/core-engine/src/pipeline/document-pipeline.ts` |
| `uploadDocument` | contract | `packages/core-engine/src/adapter/mock.ts` |
| `fetchPendingSignatures` / `confirmSignatureTask` | arch | `apps/web/src/services/http.ts` |
| page.logic SSOT | design | `designs/v0/{project_home,template_annotate,pending_review}/page.logic.md` |
| 实现参考 | arch | `apps/web/src/views/pending_review/index.vue` 等 |

---

## Part 2 — Tasks

### Task 1: 设计索引同步（F2）

- [x] 对三页执行 `design-sync`（项目根终端命令或等价 MCP 流程），使 `.ai/design` 与 `designs/v0/**/page.logic.md` 对齐
  - **Pages:** `project_home`、`template_annotate`、`pending_review`
  - **MCP:** `audit_design_changes`（before/after）；`query_design(page:)` 抽检三页 `logicMarkdown` 含 Excel 出表 / 待签 Tab 操作
  - **Verify:** `audit_design_changes` → `stale` 为空；`blockingPageGaps` 不再含上述页的 `no-implementation-ref`

### Task 2: 代码质量 remediation（F4）

- [x] 拆分 `apps/web/src/views/pending_review/index.vue`（当前 ~406 行）≤300 行
  - **建议提取:**
    - `WordingReviewPanel.vue` — 措辞待审表格 + 编辑/确认区（原 `activeTab === 'wording'` 块）
    - `SignatureReviewPanel.vue` — 资料待签卡片列表 + 空态
    - `SignatureConfirmDialog.vue` — 签字确认弹窗（`confirmTarget` / `signerName` / `submitSignatureConfirm`）
  - **可选:** `usePendingReview.ts` composable 承载 `loadProposals` / `loadSignatures` / `switchTab` 等逻辑，主 `index.vue` 仅编排 Tab
  - **Files:** `apps/web/src/views/pending_review/**`
- [x] 为 `apps/web/src/views/project_home/useProjectHome.ts` 中 `load()` 添加简要 JSDoc（说明级联加载 projects → packs → docTypes → documentGaps 的顺序与选中项保持）
  - **Files:** `apps/web/src/views/project_home/useProjectHome.ts`
- [x] 若 `check_code_quality` 仍报 `ExcelCellMappingPanel` props 或 `http.ts` 注释：按报告逐项补齐（当前源码已含 typed props 与 `fetchPendingSignatures`/`confirmSignatureTask` 注释，可能无需改动）
  - **Verify:** MCP `check_code_quality` 或 `node ~/.apt/scripts/check-code-quality.cjs <projectRoot>` → `highCount=0` 且 `mediumCount < 5`；`npx tsc -p apps/web --noEmit` 通过

### Task 3: 回归与再验收

- [x] 全量测试无回归
  - **Verify:** `npm test -w core-engine`（97+ passed）
- [ ] 重新跑 `/verify`（对照 `docs/apt/plans/2026-08-29-excel-gap-fill-plan.md`）
  - **期望:** Overall PASS；若仅剩 closeout 残留 → 再跑 `/finish-feature`
