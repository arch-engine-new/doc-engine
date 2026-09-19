# verify-fix: doc-type-gaps

> **Source verify:** `.apt/verify/latest.md`
> **Source plan:** `docs/apt/plans/2026-08-29-doc-type-field-inheritance-plan.md`
> **Overall:** FAIL
> **Status:** approved
> **Command:** `$apt-plan-from-verify`
> **implementation dims:** Plan 对照、设计 audit、产品对齐、代码质量

## Part 1 — 背景与范围

### 分流

- `classify-verify-failures` → `recommended=plan-from-verify`
- 关闭项（架构 audit / 契约登记）已 PASS，**不在本 plan**；全绿后走 `/finish-feature`

### Failures 摘要

| ID | 问题 | 根因 |
|----|------|------|
| F1 | Task 1 schema 文档缺口 | `core-engine-schema.md` / `core-engine-migration.sql` 未同步 DocType 表与 `doc_type_id` 列 |
| F2 | 设计 audit stale | `.ai/design` 索引落后于 `designs/v0/**/page.logic.md`（含 project_home DocType 操作） |
| F3 | 产品对齐滞后 | `.ai/product` 能力卡未反映三页 DocType 逻辑更新 |
| F4 | 代码质量 medium≥5 | 三页 Vue 超 300 行；`demo-session.ts` 两处复杂函数缺注释 |

### 非目标

- 不改 DocType 业务语义或 API 行为（已实现且测试通过）
- 不处理 closeout-only（`refresh_asset` 等留给 `/finish-feature`）
- 不新增路由页

### 依赖寻址

| 依赖 | 来源 | 路径 |
|------|------|------|
| `DocTypeRow` / `FieldDefRow` | contract | `docs/schema/generated/core-engine-rows.ts` |
| `TemplateRow` / `JobRow` | contract | 同上（含 `doc_type_id`） |
| SQLite DDL 参考 | arch | `packages/core-engine/src/persistence/sqlite-slice1.sql` |
| PG migrate 参考 | arch | `packages/core-engine/src/persistence/pg-migrate.ts` |

---

## Part 2 — Tasks

### Task 1: 补齐 schema 文档与 PG migration（F1）

- [ ] 在 `docs/schema/core-engine-schema.md` 增加 `t_doc_type`、`t_field_def` 表说明；`t_template` 增 `doc_type_id`；`t_job` 增 `doc_type_id`；更新 ER 关系图
  - **MCP:** `query_contract` name=`DocTypeRow` / `FieldDefRow` / `TemplateRow` / `JobRow`
  - **Files:** `docs/schema/core-engine-schema.md`
  - **SSOT:** 列定义与 `sqlite-slice1.sql` / `core-engine-rows.ts` 对齐
- [ ] 在 `docs/schema/generated/core-engine-migration.sql` 增加 `t_doc_type`、`t_field_def` CREATE TABLE；`t_template` 增 `doc_type_id` + 索引；`t_job` 增 `doc_type_id` + 索引
  - **Files:** `docs/schema/generated/core-engine-migration.sql`
  - **Verify:** `rg "t_doc_type|t_field_def|doc_type_id" docs/schema/core-engine-schema.md docs/schema/generated/core-engine-migration.sql` 均有命中

### Task 2: 设计 / 产品索引重扫（F2 + F3）

- [ ] 运行设计同步，使 `query_design(page: project_home|template_annotate|job_upload)` 的 `logicMarkdown` 与 `designs/v0/*/page.logic.md` 一致
  - **MCP:** `audit_design_changes`（before/after）；`query_design` scope=`page` 抽检三页
  - **Terminal:** 项目根 `design-sync` 或等价 MCP 流程（按 AGENTS.md）
  - **Verify:** `audit_design_changes` → `stale` 为空；`query_design(project_home)` 含 DocType 操作
- [ ] 运行产品索引重扫，更新 `.ai/product` 能力卡
  - **MCP:** `start_product_init`（incremental 或 full）
  - **Verify:** `query_product(project_home)` 信号含 `listDocTypes` / `createDocType` 等 excerpt

### Task 3: 代码质量 remediation（F4）

- [ ] 拆分 `apps/web/src/views/project_home/index.vue`（621 行）为子组件，主文件 ≤300 行
  - **建议提取:** `DocTypeTable.vue`（展开表 + 操作）、`FieldDefsEditor.vue`（基字段抽屉）、保留 CRUD 对话框于主文件或 `PackDialogs.vue`
  - **Files:** `apps/web/src/views/project_home/**`
- [ ] 拆分 `apps/web/src/views/template_annotate/index.vue`（334 行）≤300 行
  - **建议提取:** `InheritedFieldsPanel.vue`（左侧只读基字段表）
  - **Files:** `apps/web/src/views/template_annotate/**`
- [ ] 拆分 `apps/web/src/views/job_upload/index.vue`（305 行）≤300 行
  - **建议提取:** `UploadDocTypeForm.vue`（类型下拉 + template 选择 + 上传按钮）
  - **Files:** `apps/web/src/views/job_upload/**`
- [ ] 为 `apps/web/src/services/demo-session.ts` 中 `rememberDemoNav`、`ensureDemoSession` 添加简要注释（说明 demo 导航持久化与 reset 流程）
  - **Files:** `apps/web/src/services/demo-session.ts`
  - **Verify:** `check_code_quality` → `mediumCount < 5`；`npx tsc -p apps/web --noEmit` 通过

### Task 4: 回归与再验收

- [ ] 全量测试无回归
  - **Verify:** `npm test -w core-engine`（85+ passed）
- [ ] 重新跑 `/verify docs/apt/plans/2026-08-29-doc-type-field-inheritance-plan.md`
  - **期望:** Overall PASS 或仅剩 closeout → `/finish-feature`
