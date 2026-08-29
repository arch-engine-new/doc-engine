# Task 9 Report — logic 同步 + arch 闭环准备

## Status
DONE

## Plan
`docs/apt/plans/2026-08-29-excel-gap-fill-plan.md` — Task 9

## Changes

### `designs/v0/project_home/page.logic.md`
- 新增操作：`listDocumentGaps`、`generateInspectionBatch`、`fillDocumentGap`
- 主流程补充缺表扫描（CompletenessRule vs DocumentArtifact）与 Excel 生成上传
- 约束：CompletenessRule 语义、generate 前置条件（excel 模板）
- 依赖扩展：CompletenessRule、DocumentArtifact 及相关 REST API；验收 AC-3/AC-5/AC-8

### `designs/v0/template_annotate/page.logic.md`
- 新增操作：`loadExcelMappings`、`saveExcelMappings`、`uploadExcelTemplate`
- 主流程按 `layout_kind` 分支：`raster` 画布 vs `excel` 映射面板
- 约束：API 分支、映射字段与合并格锚点
- 依赖扩展：ExcelCellMapping、excel-mappings / excel-template API；验收 AC-1/AC-2

### `designs/v0/pending_review/page.logic.md`
- 新增 Tab 与操作：`listSignatureTasks`、`confirmSignatureTask`
- 合并重复「主流程」段落；措辞待审 / 资料待签双 Tab 流程
- 依赖扩展：SignatureTask、DocumentArtifact；验收 AC-5/AC-7

### `packages/core-engine/src/index.ts`
- 导出 Excel gap-fill 相关 row 类型：`CompletenessRuleRow`、`DocTypeRow`、`DocumentArtifactRow`、`ExcelCellMappingRow`、`FieldDefRow`、`FieldFillRuleRow`、`SignatureTaskRow`
- 导出 write 类型：`ExcelCellMappingWrite`、`FieldFillRuleWrite`、`CompletenessRuleWrite`
- 导出 pipeline 类型：`DocumentGap`、`DocumentGapsResult`

## Verify

| Command | Result |
|---------|--------|
| `npm test -w core-engine` | PASS (97 passed, 4 skipped) |

## Commit
`docs: sync page.logic for excel gap-fill (task 9)`

## Deferred (main agent / finish-feature)
- MCP `register_contract` 新类型/服务
- MCP `audit_arch_changes` → `refresh_asset`
- `/verify docs/apt/plans/2026-08-29-excel-gap-fill-plan.md` 全量 AC 对照

## Notes
- raster 回归由全量 core-engine 测试覆盖（R9）
- document-gaps 与 http-adapter excel flow 用例均通过（AC-8、AC-4/5/7 回归）
