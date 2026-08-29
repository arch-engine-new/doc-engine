# Task 5 Report — template_annotate Excel cell mapping UI

## Status
**Completed**

## Summary
When `Template.layout_kind === "excel"`, `template_annotate` now shows an Excel mapping panel instead of the raster canvas. Raster mode is unchanged. Mappings persist via `PUT /api/templates/:id/excel-mappings`; template upload via `POST /api/templates/:id/excel-template`.

## Changes

### `apps/web/src/services/types.ts`
- Extended `TemplateView` with `layout_kind`, `excel_template_uri`, `excel_sheet_name`
- Added `ExcelCellMappingWrite` and `ExcelCellMappingView`

### `apps/web/src/services/http.ts`
- `uploadExcelTemplate()` — multipart POST excel template
- `fetchExcelMappings()` / `saveExcelMappings()` — GET/PUT helpers

### `apps/web/src/views/template_annotate/ExcelCellMappingPanel.vue` (new)
- Displays sheet name and mapping table (`cell`, `field_key`, `value_type`, `signature_role`, `sheet_name`)
- Add-mapping form: cell address + `field_key` dropdown from inherited FieldDefs
- Upload `.xlsx` with optional sheet name override
- Save / delete row actions

### `apps/web/src/views/template_annotate/index.vue`
- `isExcelMode` branches UI: `ExcelCellMappingPanel` vs existing raster canvas + box table
- `InheritedFieldsPanel` shared in both modes

## Verify
```bash
npx tsc -p apps/web --noEmit   # exit 0
```

## Acceptance
| Criterion | Result |
|-----------|--------|
| `layout_kind=excel` → Excel UI | Sheet meta + mapping table + add form |
| `layout_kind=raster` unchanged | Canvas drag/drop + box table preserved |
| PUT excel-mappings | `saveExcelMappings` on「保存映射」 |
| POST excel-template | File input multipart upload |
| Inherited FieldDef dropdown | Options from `effective-boxes` inherited rows |

## Notes
- Tasks 6–9 intentionally out of scope
- Manual AC-2: open seed excel template, bind `B4=project_name`, save, refresh — mappings should persist via API
