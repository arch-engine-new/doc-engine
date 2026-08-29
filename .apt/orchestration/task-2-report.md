# Task 2 Report — ExcelFillService + resolveEffectiveExcelMappings

## 状态

**完成** — `npm test -w core-engine -- excel-fill` 通过（4 tests）。

## 变更摘要

### `resolveEffectiveExcelMappings`
- **文件:** `packages/core-engine/src/excel/effective-mappings.ts`
- 合并 `listEffectiveFieldDefs(docTypeId)` 与 `listExcelCellMappings(templateId)`
- 同 `field_key` 时 **ExcelCellMapping 优先**（sheet/cell/value_type/signature_role）
- 附带 `listFieldFillRules` 的 `rule`；def-only 键 `cell=null`，`inherited=true`

### `ExcelFillService`
- **文件:** `packages/core-engine/src/excel/fill-service.ts`
- `fill({ template, sheetName?, mappings, fieldValues, rules? })` → `Buffer`
- `template` 支持 **文件路径** 或 **Buffer**（exceljs）
- 按映射直写 cell；全表扫描替换 `{{fieldKey}}` 占位符
- 填值优先级：**显式 fieldValues > FieldFillRule.default_literal > 留空**

### 单测（AC-3）
- **文件:** `packages/core-engine/test/excel-fill-service.test.ts`
- 夹具：`docs/fixtures/excel/concrete-inspection-batch-gb50204-template.xlsx` + `concrete-inspection-batch-cell-mapping.json`
- 断言：`B4`（project_name）、`E13`（strength_sampling_record）、`C27`（supervisor_engineer_sign）
- 覆盖：路径/Buffer 模板、`resolveEffectiveExcelMappings` 继承合并、store 端到端

### 导出
- `packages/core-engine/src/index.ts` 导出 `resolveEffectiveExcelMappings`、`ExcelFillService` 及相关类型

## 测试

```
npm test -w core-engine -- excel-fill

 ✓ test/excel-fill-service.test.ts (4 tests)

 Test Files  1 passed (1)
      Tests  4 passed (4)
```

## 未做（Task 3+）

- HTTP 路由（excel-mappings / fill-rules / generate / upload）
- `DocumentPipeline`、`adapter/mock` upload
- Seed 演示数据、UI
