# Task 4 Report — project_home + template_annotate DocType 前端

## Status
DONE

## What was implemented

### `apps/web/src/services/types.ts`
- 新增 `DocTypeView`、`FieldDefView`、`EffectiveFieldBoxView`
- `TemplateView` 增加 `doc_type_id`

### `apps/web/src/views/project_home/index.vue`
- 规范包行可展开（▶/▼），展开后加载 `GET /api/packs/:packId/doc-types`
- DocType 表：名称、父类型、模板数（由 pack.templates 按 doc_type_id 统计）
- 操作（dialog-panel 风格，非 prompt）：
  - **新建文档类型** — `POST /api/doc-types`（可选父类型）
  - **编辑基字段** — `GET/PUT /api/doc-types/:id/field-defs`（表格增删行）
  - **新建模板** — `POST /api/templates`（带 docTypeId）
  - **标注** — 跳转 `/templates/:id/annotate`（需已有模板）
- 保留原有项目/规范包 CRUD 与重命名/删除 dialog

### `apps/web/src/views/template_annotate/index.vue`
- 顶栏显示 DocType 路径面包屑（沿 parent 链拼接）
- 左侧只读「继承基字段」列表（来自 `GET effective-boxes`，`inherited=true`）
- 画布仅编辑模板扩展框（`GET/PUT /api/templates/:id/boxes`）；继承框以灰色只读 overlay 展示（有坐标时）
- `page_image_uri` 存在时作 canvas 背景；否则沿用 global.css 棋盘格（AC-4）

## Verify output

```
npx tsc -p apps/web --noEmit
```

| Result | Detail |
|--------|--------|
| tsc | exit 0 |

## Files changed
- `apps/web/src/services/types.ts`
- `apps/web/src/views/project_home/index.vue`
- `apps/web/src/views/template_annotate/index.vue`

## Out of scope
- `job_upload` 未改动（Task 5）

## Concerns
None.
