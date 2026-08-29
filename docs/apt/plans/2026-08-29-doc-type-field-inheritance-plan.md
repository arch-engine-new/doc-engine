# DocType 与字段继承 Implementation Plan

> **Spec:** `docs/superpowers/specs/2026-08-29-doc-type-field-inheritance-design.md`
> **Command:** `/plan-from-spec`
> **Status:** approved
> **projectType:** component

**Goal:** 在冻结 9 页内引入 DocType + FieldDef 字段继承，抽取按「类型基字段 ∪ 模板扩展框」合并投影。

**Architecture:** 新增 `t_doc_type` / `t_field_def`，`t_template` 增 `doc_type_id`，`t_job` 增 `doc_type_id`；核心纯函数 `resolveEffectiveBoxes` 供 `JobPipeline` 与 HTTP 共用；三页前端增强配置与上传选型。

---

## Part 1 — 技术方案（APT 寻址）

### 1.1 范围与约束

**在范围：**

- DocType 树（父子可选）、FieldDef（无坐标）、Template 绑定类型、FieldBox 扩展/覆盖
- `resolveEffectiveBoxes` + `extractByTemplate` / `extractOcrByTemplate` 改用合并框
- DocType / FieldDef HTTP API；`GET /api/templates/:id/effective-boxes`
- `project_home` / `template_annotate` / `job_upload` 增强
- 演示种子迁移；`page.logic.md` 同步

**非目标：** 自动分类、坐标继承、新页面、跨页续表。

**约束：** 不预置公路/水利/房建；PG + SQLite 双 store 同步；`LedgerConflictError` → 409。

### 1.2 设计寻址

N/A（`projectType: component` Profile 跳过 `query_design` 门禁；前端按既有 `apps/web` 样式与 v0 原型实现）。

### 1.3 依赖寻址表

| 依赖 | 来源 | 引用 | 摘要 |
|------|------|------|------|
| `SpecPackRow` | contract | `docs/schema/generated/core-engine-rows.ts` | 规范包空壳；DocType 挂 `pack_id` |
| `TemplateRow` | contract | 同上 | 需增 `doc_type_id` 列 |
| `FieldBoxRow` | contract | 同上 | 模板级坐标框；upsert by template+key |
| `JobRow` | contract | 同上 | 需增 `doc_type_id` 列 |
| `extractByTemplate` | contract | `packages/core-engine/src/extract/field-box.ts` | fixture 投影；入参改为 effective boxes |
| `extractOcrByTemplate` | arch | `packages/core-engine/src/extract/ocr-fields.ts` | OCR 硬解析；入参改为 effective boxes |
| `JobPipeline` | contract | `packages/core-engine/src/pipeline/job-pipeline.ts` | `projectExtractionFields` / `projectOcrExtractionFields` 改调 merge |
| `CoreEngineStore` / `SqliteLedger` / `PostgresLedger` | arch | `packages/core-engine/src/persistence/*.ts` | 新表 CRUD + 迁移 |
| `handle-request` | arch | `packages/core-engine/src/http/handle-request.ts` | 新路由 + upload 校验 |
| `seed.ts` | arch | `packages/core-engine/src/pipeline/seed.ts` | 演示 DocType 树 + 模板归属 |
| `resolveEffectiveBoxes` | **新建** | `packages/core-engine/src/extract/effective-boxes.ts` | spec SSOT 合并逻辑 |

### 1.4 表设计草案（§0.6）

#### 表 `t_doc_type`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | 审计主键 |
| doc_type_id | VARCHAR(64) UK | 对外标识 |
| pack_id | VARCHAR(64) IDX | 所属规范包 |
| parent_doc_type_id | VARCHAR(64) NULL IDX | 父类型（可空） |
| name | VARCHAR(128) | 类型名 |
| created_at / updated_at / creator / updater / deleted | 审计列 | 标准公共字段 |

#### 表 `t_field_def`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | |
| doc_type_id | VARCHAR(64) IDX | 所属类型 |
| field_key | VARCHAR(64) | 字段名 |
| value_type | VARCHAR(32) | string/date/… |
| required | TINYINT(1) | 可选，默认 0 |
| created_at … deleted | 审计列 | |
| UK | (doc_type_id, field_key) | 同类型 key 唯一 |

#### 变更 `t_template`

- 新增 `doc_type_id VARCHAR(64) NOT NULL`（迁移：现有行挂默认 DocType）
- 索引 `idx_t_template_doc_type_id`

#### 变更 `t_job`

- 新增 `doc_type_id VARCHAR(64) NULL`（上传必填后写非空）
- 索引 `idx_t_job_doc_type_id`

### 1.5 拟改动模块与文件

| 文件/模块 | 变更 | 说明 |
|-----------|------|------|
| `docs/schema/core-engine-schema.md` | 修改 | 文档补两表 + 列变更 |
| `docs/schema/generated/core-engine-migration.sql` | 修改 | PG DDL 增量 |
| `docs/schema/generated/core-engine-rows.ts` | 修改 | `DocTypeRow` / `FieldDefRow` + 列扩展 |
| `packages/core-engine/src/persistence/sqlite-slice1.sql` | 修改 | SQLite 同构 |
| `packages/core-engine/src/persistence/migrate.ts` | 修改 | 表清单 / 列迁移 |
| `packages/core-engine/src/persistence/store.ts` | 修改 | DocType/FieldDef CRUD |
| `packages/core-engine/src/persistence/ledger.ts` | 修改 | 门面方法 |
| `packages/core-engine/src/persistence/pg-store.ts` | 修改 | PG 实现 |
| `packages/core-engine/src/extract/effective-boxes.ts` | **新建** | merge 纯函数 |
| `packages/core-engine/src/pipeline/job-pipeline.ts` | 修改 | 抽取路径 + DocType API |
| `packages/core-engine/src/pipeline/seed.ts` | 修改 | 演示数据 |
| `packages/core-engine/src/http/handle-request.ts` | 修改 | REST 路由 |
| `packages/core-engine/test/*.test.ts` | 修改/新建 | merge + HTTP |
| `apps/web/src/views/project_home/index.vue` | 修改 | DocType 列表/基字段 |
| `apps/web/src/views/template_annotate/index.vue` | 修改 | 分区 + 底图 |
| `apps/web/src/views/job_upload/index.vue` | 修改 | 类型下拉 |
| `designs/v0/*/page.logic.md` | 修改 | 三页 logic 同步 |

### 1.6 风险与未决项

| 风险 | 缓解 |
|------|------|
| 迁移破坏既有 template/job | 种子脚本创建默认 DocType 并 backfill |
| 父子 key 冲突 | PUT field-defs 校验；409 |
| 组件 Profile 与多页 UI | 仍按 spec 改 `apps/web` 三页，不新增路由 |
| high 改动面 | 6 Task 切片；每 Task 单测门禁 |

**需回填 spec（可选）：** `OpenUploadJobInput` 增 `doc_type_id` 字段名与 HTTP body 对齐。

### 1.7 需求锁定对照

| Rn | 优先级 | 覆盖 Task | 备注 |
|----|--------|-----------|------|
| R1 | must | Task 1, 2, 4 | DocType CRUD + UI 列表 |
| R2 | must | Task 1, 2 | FieldDef + FieldBox 分工 |
| R3 | must | Task 1, 2, 5 | merge + 抽取 + 上传 |
| R4 | must | Task 4 | template_annotate 分区/底图 |
| R5 | must | Task 5 | job_upload 必选类型 |
| R6 | must | Task 4 | project_home 管理入口 |
| R7 | must | 全 Task | 无新路由页 |
| R8 | nice | — | 不做 |

---

## Part 2 — 可执行任务清单

> 每步 2–5 分钟粒度；由 `/implement-plan` 按 Task 串行派发。

### Task 1: Schema + 类型行 + resolveEffectiveBoxes

- [ ] 在 `core-engine-schema.md` 与 `core-engine-migration.sql` 增加 `t_doc_type`、`t_field_def`；`t_template.doc_type_id`、`t_job.doc_type_id`
  - **MCP:** `query_contract` name=`TemplateRow` / `JobRow`
  - **Files:** `docs/schema/core-engine-schema.md`, `docs/schema/generated/core-engine-migration.sql`, `docs/schema/generated/core-engine-rows.ts`, `packages/core-engine/src/persistence/sqlite-slice1.sql`, `packages/core-engine/src/types.ts`
- [ ] 实现 `resolveEffectiveBoxes(docTypeId, templateId, store)`：祖先链 FieldDef ∪ Template FieldBox；box 优先
  - **MCP:** `query_contract` name=`extractByTemplate`
  - **Files:** `packages/core-engine/src/extract/effective-boxes.ts`
- [ ] 单测：父类型 `编号/日期A` + 子类型 `特殊批号` + 模板扩展框 → 3 key（AC-2）
  - **Files:** `packages/core-engine/test/effective-boxes.test.ts`
  - **Verify:** `npm test -w core-engine -- effective-boxes`
  - **Contracts:** `resolveEffectiveBoxes` → `packages/core-engine/src/extract/effective-boxes.ts`

### Task 2: Store + Ledger + Pipeline 抽取接线

- [ ] `CoreEngineStore` / `SqliteLedger` / `PostgresLedger`：DocType CRUD、listFieldDefs、saveFieldDefs、listDocTypesByPack、getDocTypeAncestors
  - **Files:** `packages/core-engine/src/persistence/store.ts`, `ledger.ts`, `pg-store.ts`, `migrate.ts`
- [ ] `JobPipeline`：`projectExtractionFields` / `projectOcrExtractionFields` 改 `resolveEffectiveBoxes`；`openUploadJob` / `runFixtureJob` 接受 `doc_type_id`；`insertJob` 写入列
  - **MCP:** `query_contract` name=`JobPipeline`
  - **Files:** `packages/core-engine/src/pipeline/job-pipeline.ts`
- [ ] `seed.ts`：演示 pack 下父/子 DocType + 模板归属 + 基字段
  - **Files:** `packages/core-engine/src/pipeline/seed.ts`
  - **Verify:** `npm test -w core-engine`（全量回归，AC-5）
  - **Contracts:** `DocTypeRow`, `FieldDefRow` → `docs/schema/generated/core-engine-rows.ts`

### Task 3: HTTP API + http-adapter 测试

- [ ] 路由：`GET/POST/PATCH/DELETE /api/doc-types`；`GET/PUT /api/doc-types/:id/field-defs`；`GET /api/packs/:packId/doc-types`；`GET /api/templates/:id/effective-boxes`；upload body 增 `doc_type_id`
  - **Files:** `packages/core-engine/src/http/handle-request.ts`, `packages/core-engine/src/http/session.ts`
- [ ] 错误映射：无 doc_type 400；删除有子类型/Job 409；pack 不一致 400
  - **Files:** 同上
- [ ] 扩展 `http-adapter.test.ts`：DocType CRUD + effective-boxes 3 key + upload 带 doc_type（AC-2/AC-3）
  - **Verify:** `npm test -w core-engine -- http-adapter`
  - **Contracts:** 新 REST 响应形状在测试中固定

### Task 4: project_home + template_annotate 前端

- [ ] `project_home`：规范包展开 DocType 表（名称、父类型、模板数）；操作：新建类型、编辑基字段（内联/抽屉）、新建模板、跳转标注
  - **Files:** `apps/web/src/views/project_home/index.vue`, `apps/web/src/services/types.ts`
- [ ] `template_annotate`：顶栏 DocType 路径；左侧只读基字段；画布仅扩展框；有 `page_image_uri` 时作底图（AC-4）
  - **Files:** `apps/web/src/views/template_annotate/index.vue`
  - **Verify:** `npx tsc -p apps/web --noEmit`；手动：打开标注页见基字段分区与底图

### Task 5: job_upload 类型选择

- [ ] 上传区 DocType 下拉（按当前 pack）；选中后展示 `template_id`；未选禁止提交（AC-3/R5）
  - **Files:** `apps/web/src/views/job_upload/index.vue`
  - **Verify:** `npx tsc -p apps/web --noEmit`；`npm test -w core-engine -- http-adapter`（upload 用例）

### Task 6: logic 同步 + arch 闭环 + verify

- [ ] 更新 `designs/v0/project_home/page.logic.md`、`template_annotate/page.logic.md`、`job_upload/page.logic.md` 反映 DocType/继承
  - **Files:** 上述三文件
- [ ] `register_contract` 新类型；`audit_arch_changes` → `refresh_asset` / `remove_asset`
  - **MCP:** `register_contract`, `audit_arch_changes`, `refresh_asset`
  - **Files:** 触及的 `packages/core-engine/src/**`
  - **Verify:** `npm test -w core-engine`；`/verify docs/apt/plans/2026-08-29-doc-type-field-inheritance-plan.md`（AC-6）
