# page.logic — 模板标注

## 元信息
- pageId: template_annotate
- feature: core-engine
- title: 模板标注
- route: /templates/:id/annotate
- pageType: canvas

## 操作明细
| 操作 | 触发 | 结果 |
|------|------|------|
| loadTemplate | 进入 | Template（含 doc_type_id、layout_kind、page_image_uri / excel 元数据） |
| loadDocTypePath | 进入 | DocType 面包屑（父/子路径） |
| loadEffectiveBoxes | 进入 | EffectiveFieldBox[]（继承基字段只读） |
| loadBoxes | 进入 | FieldBox[]（模板扩展框，可编辑） |
| drawBox | 框选 | FieldBox draft（仅扩展字段） |
| saveBoxes | 保存 | FieldBox[] |
| loadExcelMappings | `layout_kind=excel` 进入 | `GET /api/templates/:id/excel-mappings` |
| saveExcelMappings | Excel 模式「保存映射」 | `PUT /api/templates/:id/excel-mappings` |
| uploadExcelTemplate | Excel 模式上传 `.xlsx` | `POST /api/templates/:id/excel-template`（multipart） |
| openStepChat | 框选后 / Excel 绑格后 | 可问该框字段含义；保存仍要点按钮 |

## 主流程
1. 顶栏展示 DocType 路径；左侧只读列出继承基字段（来自父/子 FieldDef）。
2. **`layout_kind=raster`（默认）**：画布在有 `page_image_uri` 时作底图；继承框灰色展示，扩展框可拖拽新建；框选扩展字段，记录 page,x,y,w,h,fieldKey,valueType。
3. **`layout_kind=excel`**：切换 Excel 映射面板（sheet 名 + 映射表 + 添加映射）；上传模板 xlsx；映射持久化经 excel-mappings API；侧栏继承 FieldDef 只读供 field_key 下拉。
4. 抽取阶段按 `resolveEffectiveBoxes`（raster）或 `resolveEffectiveExcelMappings`（excel）投影；失败字段为 null，不中断 Job。

## 状态
editing / saved / error

## 约束
- `layout_kind=excel` 时调用 excel-mappings / excel-template API；`layout_kind=raster` 时沿用 FieldBox 画布，不得混用。
- excel-mappings 行含 `cell`, `field_key`, `value_type`, `signature_role?`, `sheet_name?`；合并格以左上角 cell 为锚点。

## 依赖
- 实体：Template, DocType, FieldDef, FieldBox, EffectiveFieldBox, ExcelCellMapping
- API：`GET/PUT excel-mappings`；`POST excel-template`
- 验收：A2、AC-1、AC-2、AC-4
- 非目标：表格线检测、跨页续表、在线表单 layout_kind=form
