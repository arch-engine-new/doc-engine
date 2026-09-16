# verify-fix: design-audit-logic-sync

> **Source verify:** `.apt/verify/latest.md`
> **Source plan:** `docs/apt/plans/2026-09-15-rag-ingest-metadata-graph-plan.md`
> **Overall:** FAIL
> **Status:** approved
> **Command:** `$apt-plan-from-verify`
> **implementation dims:** 设计 audit、logic 同步

## Part 1 — 背景与范围

### 分流

- `classify-verify-failures` → `recommended=plan-from-verify`
- `implementation`: 设计 audit、logic 同步
- `closeout`: 空（架构 audit / 契约登记均为 PASS）→ **不要**把 closeout 塞进本 plan
- RAG 切片 12/12 Review Gate 与 Plan 对照 / 测试/构建 / Harness 均为 PASS，**禁止**重做 Task 1–12

### Failures 摘要（实现类）

| ID | 维度 | 问题 | 根因 |
|----|------|------|------|
| F1 | 设计 audit | `audit_design_changes` stale：`designs/v0` mtime 新于 `syncedAt=2026-08-30T06:30:47.308Z` | 磁盘 `designs/v0/standard_lib/page.logic.md` 已含 tick / file_name / unit_id；`query_design(page=standard_lib)` 仍返回旧 logicMarkdown（无 tick 列） |
| F2 | logic 同步 | `check-logic-sync --base 4d42e0d9` C2：`pending_review` / `project_home` / `template_annotate` | 三页 `designs/v0/<id>/index.html`（及 `page.manifest.json`）为**未跟踪**文件；同区间 `page.logic.md` 未变。本切片 `--files` 仅 standard_lib → PASS |

**顺序约束：** 必须先做 F2（原型与 logic 对齐）再做 F1（`design-sync`）。否则会把「简陋未跟踪 html + 已批准旧配对」写进 `.ai/design/`。

### 非目标

- 不回滚 / 不重写 RAG ingest、payload 闸门、图边、tick worker、Job 4MB
- 不手改 `page.logic.md` 凑 C2（必须走 `$apt-create --refine` 或 `reconcile_page_logic`）
- 不把 `no-implementation-ref` 当本轮 FAIL（audit 为 warn，verify 未据此 Overall FAIL）
- 不改 core-engine 生产实现，除非 refine 后出现 C1（view 与新 logic 不一致）——当前 FAIL 只有 C2
- 本文件只规划，不写生产代码

### 依赖寻址

| 依赖 | 来源 | 路径 / 结果 |
|------|------|-------------|
| `query_design(standard_lib)` | design | 旧 logicMarkdown（无 `tick` / 出处列）；磁盘 logic 已更新；`_pages.md` `approved=no` |
| `query_design(pending_review)` | design | 已含 `listSignatureTasks` / `confirmSignatureTask`；html 仅「确认并开 Receipt」 |
| `query_design(project_home)` | design | 已含缺表 / 生成检验批；html 仅「新建项目/规范包」表 |
| `query_design(template_annotate)` | design | 已含 excel-mappings / 继承基字段；html 仅「保存 3 个框」 |
| `audit_design_changes` | MCP 只读 | `ok:false`；`stale[0].syncedAt=2026-08-30`；blockingGaps 全是 `no-implementation-ref`（本 plan 不修） |
| `StandardLibrary` | contract | `packages/core-engine/src/retrieve/library.ts`（本 plan **只读**，禁止改） |
| `ReviewDesk` | contract + `query_arch` `frontend/core-engine/util#reviewdesk` | `packages/core-engine/src/pipeline/review.ts` |
| StandardLib 视图 | `search_arch` | `apps/web/src/views/standard_lib/index.vue`（及 `PdfTickPanel.vue` / `RetrieveHitsTable.vue`） |
| pending_review 视图 | `search_arch` | `WordingReviewPanel` / `SignatureReviewPanel` / `SignatureConfirmDialog` |
| project_home 视图 | `search_arch` | `ProjectPackTable` / `ProjectHomeDialogs`（`DocumentGapsPanel.vue` 同目录） |
| template_annotate 视图 | `search_arch` | `InheritedFieldsPanel`（`ExcelCellMappingPanel.vue` 同目录） |
| C2 判定 | APT 脚本 | `$APT_HOME/scripts/check-logic-sync.cjs`（仓库内无副本）；锚点 `.apt/orchestration/progress.md` `BASE_SHA_initial=4d42e0d9` |
| `VerifyResult` | contract | **未登记**；Overall 语义以 classify 脚本为准，不阻塞本修复 |

未 `report_missing`。Vue 组件未单独 `register_contract`，以 `search_arch` 命中为准。

---

## Part 2 — Tasks

### Task 1: 三页 C2 回流（F2）

三页同一 Failure，合并为一 Task。

**硬约束：** 未跟踪的 `index.html` 是早期简陋原型，**现有 `page.logic.md` + vue 才是已批准真相**。禁止用 html 覆盖掉：

- `pending_review`：资料待签 Tab、`GET /api/pending/signatures`、`confirmSignatureTask`
- `project_home`：`listDocumentGaps` / `generateInspectionBatch` / `fillDocumentGap`、DocType 树
- `template_annotate`：`layout_kind=excel` 映射、继承基字段只读

- [ ] 先 `reconcile_page_logic` **dryRun**（`pageIds: ["pending_review","project_home","template_annotate"]`，`strategy: auto_fill`）。阅读 `changeSummary`。
  - 若会删减上列操作 → **丢弃该写入**，改走 `$apt-create --refine`：以当前 logic + vue 为输入，把三页 `index.html` **补齐到 logic**（待签 Tab、缺表面板、Excel 映射面板等），再让 `page.logic.md` 与 html **同区间**变更（可只补「原型已对齐」类条目，不得砍操作表）。
  - 若 dryRun 只补 html 有、logic 无的缺口且不删操作 → `allowApprovedOverwrite: true` 写入（三页 `_pages.md` 现为 `approved=yes`）。
- [ ] **禁止**手改 `page.logic.md` 空 diff 凑闸。
- [ ] 三页 `page.manifest.json` 随 refine/reconcile 重生，不要手填。
- [ ] **Verify:** `node "$APT_HOME/scripts/check-logic-sync.cjs" --root <项目根> --base 4d42e0d9 --json` 对上述三 pageId **无 C2**（exit 0，或 failures 不含这三页）。

### Task 2: design-sync 刷新设计知识（F1）

依赖 Task 1 完成（顺序约束见 Part 1）。

- [ ] 在项目根执行 `design-sync --adapter v0`（APT `arch-engine` bin）。允许 `--incremental`。**禁止**手写 `.ai/design/`。
- [ ] **Verify（MCP）：** `audit_design_changes` 的 `stale` 为空（或 `syncedAt` ≥ 本轮 designs/v0 mtime）。
- [ ] **Verify（MCP）：** `query_design(page=standard_lib)` 的 `logicMarkdown` 含 `tick`、`file_name`、`unit_id`（与磁盘 `designs/v0/standard_lib/page.logic.md` 一致），不再是 8/30 旧稿。
- [ ] 不要求清掉全部 `no-implementation-ref`。

### Task 3: 回归（RAG 不得回退）

- [ ] **Verify:** `npx vitest run packages/core-engine/test/standard-rag.test.ts packages/core-engine/test/upload-ocr.test.ts packages/core-engine/test/ingest-pdf.test.ts packages/core-engine/test/paddleocr.test.ts packages/core-engine/test/graph-store.test.ts packages/core-engine/test/vector-payload.test.ts packages/core-engine/test/live-rag-ingest.test.ts` 退出码 0
- [ ] 重新 `/verify`（对照本 plan + RAG plan）
  - **期望:** 设计 audit PASS；logic 同步对全树不再因这三页 C2 FAIL。若仅剩 closeout → `/finish-feature`。若仍有实现类 FAIL → 再 `$apt-plan-from-verify`。
