# Excel 缺表补全（Gap Fill）Implementation Plan

> **Spec:** `docs/superpowers/specs/2026-08-29-excel-gap-fill-design.md`
> **Command:** `/plan-from-spec`
> **Status:** approved
> **ApprovedAt:** 2026-08-29T14:19:00.000Z
> **ApprovedBy:** user
> **projectType:** component

**Goal:** 在冻结 9 页内增加 Excel 出表链路：点格绑字段 → 规则填数 → 生成 `.xlsx` → mock 上传中台 → `pending_review` 待签 → Receipt；P1 增缺表扫描。

**Architecture:** `Template.layout_kind` 分支 `raster|excel`；新表 `t_excel_cell_mapping`、`t_field_fill_rule`、`t_document_artifact`、`t_signature_task`；`ExcelFillService`（exceljs）+ 扩展 `adapter/mock` upload；与现有 OCR 认表并存。演示夹具：`docs/fixtures/excel/concrete-inspection-batch-gb50204-template.xlsx`。

---

## Part 1 — 技术方案（APT 寻址）

### 1.1 范围与约束

**P0 在范围：**

- Template Excel 模式：`layout_kind`、`excel_template_uri`、`excel_sheet_name`
- `ExcelCellMapping` CRUD + `template_annotate` 点格 UI
- `FieldFillRule` + `ExcelFillService` 确定性填数
- `DocumentArtifact` 生成 + mock `adapter/documents/upload`
- `SignatureTask` + `pending_review` 待签 Tab
- `project_home` 手动「生成并上传」
- 混凝土夹具 end-to-end；`trace_id` 审计事件

**P1 在范围（同 plan，Task 8）：**

- `CompletenessRule` + `GET document-gaps` + `project_home` 缺表列表

**P2 Agent（本 plan 不排 Task，spec 已标 P2）：**

- `scan_document_gaps` / `propose_document_fill`

**非目标：** 真实资料云、预置房建包、在线表单、Agent 代签、第 10 页。

**约束：** 无 `receipt_id` 不算 uploaded；PG + SQLite 双 store；`component` Profile 跳过 `query_design` 门禁。

### 1.2 设计寻址

N/A（`projectType: component`；UI 按既有 `apps/web` + `designs/v0` page.logic 实现）。

### 1.3 依赖寻址表

| 依赖 | 来源 | 引用 | 摘要 |
|------|------|------|------|
| `TemplateRow` | contract | `docs/schema/generated/core-engine-rows.ts` | 扩展 `layout_kind`, `excel_template_uri`, `excel_sheet_name` |
| `DocTypeRow` / `FieldDefRow` | contract | 同上 | Excel 映射复用 `field_key` |
| `ProposalRow` | contract | 同上 | P0 扩展 `proposal_kind`（可选列，P2 用） |
| `ReceiptRow` | contract | 同上 | 签字确认产出 Receipt；`payload_json` 存 artifact/task |
| `ProjectRow` | contract | 同上 | `project_field` 填数来源 |
| `commitAdapterWrite` / `mockPendingMount` | arch | `packages/core-engine/src/adapter/mock.ts` | 扩展 `uploadDocument` mock |
| `BlobStore` / `MemoryBlobStore` | arch | `packages/core-engine/src/blob/port.ts`, `memory.ts` | 存模板与生成 xlsx |
| `JobPipeline` | arch | `packages/core-engine/src/pipeline/job-pipeline.ts` | 参考 review/audit 模式；新增 `DocumentPipeline` 或同级服务 |
| `handle-request` | arch | `packages/core-engine/src/http/handle-request.ts` | 新 REST 路由 |
| `resolveEffectiveBoxes` | contract | `packages/core-engine/src/extract/effective-boxes.ts` | 模式参考；新建 `resolveEffectiveExcelMappings` |
| `ExcelFillService` | **新建** | `packages/core-engine/src/excel/fill-service.ts` | exceljs 读模板写 cell |
| `adapter-openapi.yaml` | arch | `docs/schema/generated/adapter-openapi.yaml` | 扩展 upload 路径 |
| 演示夹具 | fixture | `docs/fixtures/excel/*` | AC-3 SSOT |

### 1.4 表设计草案（§0.6）

#### 变更 `t_template`

| 字段 | 类型 | 说明 |
|------|------|------|
| layout_kind | VARCHAR(16) NOT NULL DEFAULT 'raster' | `raster` \| `excel` |
| excel_template_uri | VARCHAR(512) NULL | Blob URI |
| excel_sheet_name | VARCHAR(128) NULL | 默认业务 sheet 名 |

#### 表 `t_excel_cell_mapping`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | |
| mapping_id | VARCHAR(64) UK | |
| template_id | VARCHAR(64) IDX | |
| sheet_name | VARCHAR(128) | |
| cell | VARCHAR(16) | 如 `B4` |
| field_key | VARCHAR(64) | |
| value_type | VARCHAR(32) | string/text/date/signature |
| signature_role | VARCHAR(64) NULL | foreman / supervisor_engineer 等 |
| created_at … deleted | 审计列 | |
| UK | (template_id, sheet_name, cell) | |

#### 表 `t_field_fill_rule`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | |
| doc_type_id | VARCHAR(64) IDX | |
| field_key | VARCHAR(64) | |
| required | TINYINT(1) | |
| pattern | VARCHAR(256) NULL | 正则 |
| min_num / max_num | DECIMAL NULL | 数值范围 |
| default_generator | VARCHAR(32) NULL | literal/project_field/compliance_sample |
| default_literal | TEXT NULL | |
| created_at … deleted | 审计列 | |
| UK | (doc_type_id, field_key) | |

#### 表 `t_document_artifact`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | |
| artifact_id | VARCHAR(64) UK | |
| project_id | VARCHAR(64) IDX | |
| doc_type_id | VARCHAR(64) IDX | |
| template_id | VARCHAR(64) | |
| file_uri | VARCHAR(512) | 生成 xlsx |
| adapter_document_id | VARCHAR(64) NULL | mock 中台 id |
| status | VARCHAR(32) | generated/uploaded/failed |
| trace_id | VARCHAR(64) IDX | |
| receipt_id | VARCHAR(64) NULL | 上传回执 |
| metadata_json | TEXT NULL | fieldValues 快照 |
| created_at … deleted | 审计列 | |

#### 表 `t_signature_task`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | |
| task_id | VARCHAR(64) UK | |
| artifact_id | VARCHAR(64) IDX | |
| role | VARCHAR(64) | |
| assignee_label | VARCHAR(128) NULL | 展示用 |
| status | VARCHAR(32) | pending/signed/rejected |
| signer_name | VARCHAR(128) NULL | 确认时填写 |
| trace_id | VARCHAR(64) IDX | |
| receipt_id | VARCHAR(64) NULL | 签字回执 |
| created_at … deleted | 审计列 | |

#### 表 `t_completeness_rule`（P1）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT PK | |
| rule_id | VARCHAR(64) UK | |
| pack_id | VARCHAR(64) IDX | |
| doc_type_id | VARCHAR(64) | 应备类型 |
| label | VARCHAR(128) | 展示名 |
| required | TINYINT(1) | |
| created_at … deleted | 审计列 | |

#### 可选变更 `t_proposal`（P2 预留，P0 可不建列）

- `proposal_kind VARCHAR(32) DEFAULT 'wording'`
- `payload_json TEXT NULL`

### 1.5 拟改动模块与文件

| 文件/模块 | 变更 | 说明 |
|-----------|------|------|
| `docs/schema/core-engine-schema.md` | 修改 | 新表 + template 列 |
| `docs/schema/generated/core-engine-migration.sql` | 修改 | PG DDL |
| `docs/schema/generated/core-engine-rows.ts` | 修改 | 新 Row 类型 |
| `docs/schema/generated/adapter-openapi.yaml` | 修改 | upload 契约 |
| `packages/core-engine/package.json` | 修改 | 增 `exceljs` |
| `packages/core-engine/src/excel/*` | **新建** | fill + mapping resolve |
| `packages/core-engine/src/adapter/mock.ts` | 修改 | uploadDocument |
| `packages/core-engine/src/pipeline/document-pipeline.ts` | **新建** | generate/upload/sign |
| `packages/core-engine/src/http/handle-request.ts` | 修改 | REST |
| `packages/core-engine/test/excel-*.test.ts` | **新建** | 夹具单测 |
| `packages/core-engine/test/http-adapter.test.ts` | 修改 | e2e 链路 |
| `apps/web/src/views/template_annotate/*` | 修改 | Excel 点格模式 |
| `apps/web/src/views/pending_review/index.vue` | 修改 | 待签 Tab |
| `apps/web/src/views/project_home/*` | 修改 | 生成入口 + gaps |
| `designs/v0/*/page.logic.md` | 修改 | 三页 logic |
| `packages/core-engine/src/pipeline/seed.ts` | 修改 | 混凝土演示 DocType |

### 1.6 风险与未决项

| 风险 | 缓解 |
|------|------|
| high：新表 4+、exceljs、三页 UI | 9 Task 切片；P0 先不排 Agent |
| Excel 浏览器预览难 | P0 用 cell 坐标列表 + 简表网格，不追求 WYSIWYG |
| Receipt 原绑定 job_id | 签字 Receipt `job_id` 可空或挂虚拟 trace job；优先 `payload_json.artifact_id` |
| 合并单元格锚点 | 文档约定：映射左上角 cell；夹具 JSON 已按此 |
| raster 回归 | Task 9 全量 `npm test -w core-engine` |

**需回填 spec（可选）：** `ReceiptRow.job_id` 对 artifact-only 流程是否可空。

### 1.7 需求锁定对照

| Rn | 优先级 | 覆盖 Task | 备注 |
|----|--------|-----------|------|
| R1 | must | Task 1, 4 | layout_kind + 上传模板 |
| R2 | must | Task 2, 5 | 点格映射 UI |
| R3 | must | Task 2, 3 | ExcelFill + generate API |
| R4 | must | Task 3 | mock upload + Receipt |
| R5 | must | Task 3, 6 | 待签 + confirm |
| R6 | must | Task 9 | A8 回归 |
| R7 | must | 全 Task | trace 事件 Task 3 |
| R8 | should | Task 8 | P1 gaps |
| R9 | must | Task 9 | raster 回归 |
| R10 | won't | — | — |
| R11 | won't | — | 夹具非预置包 |

---

## Part 2 — 可执行任务清单

> 由 `/implement-plan` 按 Task 串行派发；P0 = Task 1–7 + 9；P1 = Task 8。

### Task 1: Schema + 类型行 + exceljs 依赖

- [ ] `t_template` 增 `layout_kind`, `excel_template_uri`, `excel_sheet_name`；新建 `t_excel_cell_mapping`, `t_field_fill_rule`, `t_document_artifact`, `t_signature_task`（P1 表 `t_completeness_rule` 可本 Task 一并建表留空 API）
  - **MCP:** `query_contract` name=`TemplateRow`
  - **Files:** `docs/schema/core-engine-schema.md`, `docs/schema/generated/core-engine-migration.sql`, `docs/schema/generated/core-engine-rows.ts`, `packages/core-engine/src/persistence/sqlite-slice1.sql`, `packages/core-engine/src/persistence/migrate.ts`, `packages/core-engine/src/persistence/pg-migrate.ts`
- [ ] `packages/core-engine` 增加 `exceljs` 依赖并 lock
  - **Files:** `packages/core-engine/package.json`, 根 `package-lock.json`
- [ ] Store/Ledger 骨架：excel mapping / fill rule / artifact / signature CRUD 方法签名
  - **Files:** `packages/core-engine/src/persistence/store.ts`, `ledger.ts`, `pg-store.ts`
  - **Verify:** `npm test -w core-engine`（编译通过）
  - **Contracts:** `ExcelCellMappingRow`, `DocumentArtifactRow`, `SignatureTaskRow` → `core-engine-rows.ts`

### Task 2: ExcelFillService + resolveEffectiveExcelMappings

- [ ] 实现 `resolveEffectiveExcelMappings(docTypeId, templateId, store)`：FieldDef ∪ ExcelCellMapping
  - **MCP:** `query_contract` name=`FieldDefRow`
  - **Files:** `packages/core-engine/src/excel/effective-mappings.ts`
- [ ] 实现 `ExcelFillService.fill(templateUri, mappings, fieldValues, rules)`：读 xlsx → 写 cell / 替换 `{{key}}` → 返回 Buffer
  - **Files:** `packages/core-engine/src/excel/fill-service.ts`
- [ ] 单测：用 `docs/fixtures/excel/concrete-inspection-batch-gb50204-template.xlsx` + `concrete-inspection-batch-cell-mapping.json`；断言 `B4`、`E13`、`C27` 等（AC-3）
  - **Files:** `packages/core-engine/test/excel-fill-service.test.ts`
  - **Verify:** `npm test -w core-engine -- excel-fill`（AC-3）

### Task 3: DocumentPipeline + Adapter mock + HTTP generate/upload

- [ ] 扩展 `adapter/mock.ts`：`uploadDocument({ projectId, docTypeId, buffer, metadata, traceId })` → `{ receipt_id, document_id }`；无 receipt 抛错
  - **Files:** `packages/core-engine/src/adapter/mock.ts`, `docs/schema/generated/adapter-openapi.yaml`
- [ ] 新建 `DocumentPipeline`：`generateArtifact`, `uploadArtifact`, `createSignatureTasks`, `confirmSignatureTask`；写 audit `document_generated` / `document_uploaded` / `signature_confirmed`
  - **Files:** `packages/core-engine/src/pipeline/document-pipeline.ts`
- [ ] HTTP：`POST /api/templates/:id/excel-template`（multipart）；`GET/PUT /api/templates/:id/excel-mappings`；`GET/PUT /api/doc-types/:id/fill-rules`；`POST /api/projects/:id/documents/generate`；`POST /api/projects/:id/documents/:artifactId/upload`；`GET /api/pending/signatures`；`POST /api/signature-tasks/:id/confirm`
  - **Files:** `packages/core-engine/src/http/handle-request.ts`, `session.ts`
- [ ] 集成测：generate → upload mock → list signatures → confirm → Receipt 存在（AC-4, AC-5, AC-7）
  - **Files:** `packages/core-engine/test/http-adapter.test.ts`
  - **Verify:** `npm test -w core-engine -- http-adapter`（AC-4, AC-5, AC-7）

### Task 4: Seed 演示数据（混凝土检验批）

- [ ] `seed.ts`：创建 DocType「混凝土检验批」、`layout_kind=excel` 模板、导入夹具 xlsx 到 blob、写入 `concrete-inspection-batch-cell-mapping.json` 映射与基础 fill rules
  - **Files:** `packages/core-engine/src/pipeline/seed.ts`
  - **Verify:** 开发模式启动后 `GET /api/templates/:id/excel-mappings` 返回 ≥20 字段（AC-1）

### Task 5: template_annotate — Excel 点格模式

- [ ] `layout_kind=excel` 时切换 UI：展示 sheet 名 + 映射表；点击「添加映射」输入 cell 地址或简表点选；侧栏继承 FieldDef 只读
  - **Files:** `apps/web/src/views/template_annotate/index.vue`, 新建 `ExcelCellMappingPanel.vue`, `apps/web/src/services/types.ts`, `apps/web/src/services/http.ts`
  - **Verify:** `npx tsc -p apps/web --noEmit`；手动：打开种子模板绑 `B4=project_name` 保存后刷新仍在（AC-2）

### Task 6: pending_review — 资料待签 Tab

- [ ] 顶栏 Tab：`措辞待审` / `资料待签`；待签卡片：项目、DocType、角色、下载链接；确认弹窗填 `signerName` → `POST /api/signature-tasks/:id/confirm`
  - **Files:** `apps/web/src/views/pending_review/index.vue`
  - **Verify:** `npx tsc -p apps/web --noEmit`；配合 Task 3 集成测或手动走通签字（AC-5）

### Task 7: project_home — 生成并上传入口

- [ ] 项目/规范包区：选 DocType →「生成检验批」→ 调 generate + upload；展示 artifact 状态与 trace 链接
  - **Files:** `apps/web/src/views/project_home/index.vue`, `useProjectHome.ts`
  - **Verify:** `npx tsc -p apps/web --noEmit`；手动端到端：生成 → 待签出现（AC-3, AC-5）

### Task 8: P1 — 缺表扫描 + CompletenessRule

- [ ] `CompletenessRule` CRUD；`GET /api/projects/:id/document-gaps`：对比 rules 与已有 artifacts；mock adapter `gap-scan` 可选
  - **Files:** `packages/core-engine/src/pipeline/document-pipeline.ts`, `handle-request.ts`, `project_home` UI
- [ ] `project_home` 展示缺表列表 +「补表」按钮跳转生成（AC-8）
  - **Verify:** `npm test -w core-engine -- document-gaps` 或 http-adapter 新用例（AC-8）

### Task 9: logic 同步 + arch 闭环 + verify

- [ ] 更新 `designs/v0/project_home/page.logic.md`、`template_annotate/page.logic.md`、`pending_review/page.logic.md`（Excel 映射、生成、待签）
  - **Files:** 上述三文件
- [ ] `register_contract` 新类型/服务；`audit_arch_changes` → `refresh_asset`
  - **MCP:** `register_contract`, `audit_arch_changes`, `refresh_asset`
- [ ] 全量回归：`npm test -w core-engine`（AC-9）；`/verify docs/apt/plans/2026-08-29-excel-gap-fill-plan.md`
  - **Verify:** AC-1～AC-9 对照 spec
