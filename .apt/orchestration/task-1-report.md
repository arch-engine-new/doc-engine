# Task 1 Report — Schema + 类型行 + exceljs 依赖

## 变更摘要

### Schema / 类型
- **`t_template`** 扩展三列：`layout_kind`（默认 `raster`）、`excel_template_uri`、`excel_sheet_name`
- **新建五表**（含审计列 + 逻辑删除）：
  - `t_excel_cell_mapping` — Excel 点格映射
  - `t_field_fill_rule` — 字段填数规则
  - `t_document_artifact` — 生成 xlsx 产物
  - `t_signature_task` — 待签任务
  - `t_completeness_rule` — 缺表规则（P1，本 Task 仅建表 + CRUD）
- **`core-engine-rows.ts`** 新增 `ExcelCellMappingRow`、`FieldFillRuleRow`、`DocumentArtifactRow`、`SignatureTaskRow`、`CompletenessRuleRow`；扩展 `TemplateRow`
- **PG + SQLite 双轨同步**：`core-engine-migration.sql`、`sqlite-slice1.sql`、`migrate.ts`（`LEDGER_TABLES` + `ensureExcelGapFillColumns`）、`pg-migrate.ts`（`ensureExcelGapFillColumns`）
- **`core-engine-schema.md`** 文档同步

### Store / Ledger
- **`ledger.ts`**：`LedgerStore` 接口 + `SqliteLedger` 委托实现
- **`store.ts`**（SQLite）：CRUD 骨架，模式对齐 `FieldDef` / `FieldBox`
- **`pg-store.ts`**（Postgres）：同构实现 + row mapper
- **模板读写**：`insertTemplate` 支持 Excel 列；新增 `updateTemplateExcel`
- **导出类型**：`ExcelCellMappingWrite`、`FieldFillRuleWrite`、`CompletenessRuleWrite`

### 依赖
- `packages/core-engine/package.json` 增加 `exceljs@^4.4.0`；根 `package-lock.json` 已更新

## 测试

```
npm test -w core-engine
Exit code: 0
85 passed | 4 skipped (89)
```

## Task 2 跟进项

1. **`ExcelFillService`**（`packages/core-engine/src/excel/fill-service.ts`）— 使用已添加的 `exceljs`
2. **`resolveEffectiveExcelMappings`**（`effective-mappings.ts`）— 复用本 Task 的 `listExcelCellMappings` + `listEffectiveFieldDefs`
3. **HTTP 路由** — `GET/PUT excel-mappings`、`GET/PUT fill-rules`、generate/upload/signatures
4. **`DocumentPipeline`** — 调用 `insertDocumentArtifact` / `updateDocumentArtifact` / `insertSignatureTask`
5. **`adapter/mock.ts`** — `uploadDocument` mock
6. **Seed** — 混凝土夹具 DocType + `layout_kind=excel` 模板 + 映射 JSON
7. **单测** — `test/excel-fill-service.test.ts` 用夹具 xlsx 断言 B4/E13/C27

## 未做（按约束）

- ExcelFillService、HTTP、UI、Pipeline、Seed 变更（Task 2+）
