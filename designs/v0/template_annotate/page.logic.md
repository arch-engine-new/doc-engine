# 模板标注

## 操作明细

| 操作 | 触发 | 结果 | 确认 | 角色 |
|------|------|------|------|------|
| loadTemplate | 进入页 / 加载数据 | 加载 Template（含 doc_type_id、layout_kind、page_image_uri / excel 元数据） | 无 | 全部登录用户 |
| loadDocTypePath | 进入页 | 加载 DocType 面包屑（父/子类型路径，如 默认类型 / 检验批） | 无 | 全部登录用户 |
| loadEffectiveBoxes | 进入页 | 加载 EffectiveFieldBox[]（继承基字段，左侧只读表格） | 无 | 全部登录用户 |
| loadBoxes | 进入页 | 加载 FieldBox[]（模板扩展框，可编辑） | 无 | 全部登录用户 |
| drawBox | 画布框选/拖拽 | 生成 FieldBox 草稿（仅扩展字段；继承框灰色只读） | 无 | 全部登录用户 |
| saveBoxes | 点击「保存扩展框」 | 保存 FieldBox[]（page,x,y,w,h,field_key,value_type），成功后显示「已保存 N 个扩展框」 | 无 | 全部登录用户 |
| loadExcelMappings | `layout_kind=excel` 进入页 | 加载 Excel 映射列表（GET /api/templates/:id/excel-mappings） | 无 | 全部登录用户 |
| addExcelMapping | 点击「添加映射」 | 以 cell + field_key 新增一条映射草稿行 | 无 | 全部登录用户 |
| saveExcelMappings | 点击「保存映射」 | 持久化映射（PUT /api/templates/:id/excel-mappings），成功后显示「已保存 N 条映射」 | 无 | 全部登录用户 |
| uploadExcelTemplate | 选择 `.xlsx` 文件并上传 | 上传 Excel 模板（POST /api/templates/:id/excel-template，multipart） | 无 | 全部登录用户 |
| openStepChat | 框选后 / Excel 绑格后 | 可询问该框字段含义；保存仍需点击按钮 | 无 | 全部登录用户 |

## 主流程

1. 进入页：加载 Template、DocType 路径、继承基字段（loadEffectiveBoxes）与扩展框。
2. **raster 模式（默认）**：左侧只读展示继承基字段；画布以 page_image_uri 为底图，继承框灰色展示，用户框选扩展字段并填写 field_key / value_type，点击「保存扩展框」持久化。
3. **excel 模式**：切换至 Excel 映射面板；上传 `.xlsx` 模板（可选 sheet 名），输入 cell 并从 field_key 下拉选择字段，「添加映射」后「保存映射」持久化。
4. 保存成功后提示「已保存 N 个扩展框 / N 条映射」，停留在本页继续标注；抽取阶段按 resolveEffectiveBoxes（raster）或 resolveEffectiveExcelMappings（excel）投影。

## 状态

- `loading`：进入页时加载模板/基字段/映射的 Skeleton。
- `empty`：无扩展框或无映射时，画布/映射表展示 EmptyState（非权限问题）。
- `forbidden`：无该模板标注权限时展示无权限提示（与 empty 区分）。
- `error`：加载或保存失败时 Alert + 重试。
- `success`：保存成功显示「已保存 N 个扩展框 / N 条映射」标签。

## 字段与列

| name | 类型 | 必填 | 展示 | 语义组件（可选） |
|------|------|------|------|------------------|
| field_key | string | yes | 表单 \| 表格列 | FormField \| DataTable 列 |
| value_type | enum | yes | 表单 \| 表格列 | FormField \| DataTable 列 |
| page | number | yes | 表格列 | DataTable 列 |
| x | number | yes | 表格列 | DataTable 列 |
| y | number | yes | 表格列 | DataTable 列 |
| w | number | yes | 表格列 | DataTable 列 |
| h | number | yes | 表格列 | DataTable 列 |
| cell | string | yes（excel 模式） | 表单 \| 表格列 | FormField \| DataTable 列 |
| signature_role | string | no | 表格列 | DataTable 列 |
| sheet_name | string | no | 表单 \| 表格列 | FormField \| DataTable 列 |
| excel_file | file | yes（上传时） | 表单 | FormField（.xlsx） |
| doc_type_path | string | no | 只读 | 面包屑 |

## 查询参数

| 参数名 | 含义 | 默认值 |
|--------|------|--------|
| 无 | 本页无筛选/分页参数（route 为 /templates/:id/annotate） | — |

## 选项数据源

| 字段 | 控件 | 来源 | 意向 API 或字典 type | value | label | 父字段(级联) | 加载时机 |
|------|------|------|----------------------|-------|-------|--------------|----------|
| field_key（excel 映射） | Select | MOCK→API | listEffectiveFields | field_key | field_key (value_type) | 无 | mount |

## 校验

| 规则 | 范围 | 说明 |
|------|------|------|
| required | field_key / value_type / cell | 扩展框与映射必填字段不能为空 |
| pattern | cell | Excel 单元格格式（如 B4），合并格以左上角 cell 为锚点 |
| pattern | excel_file | 仅接受 .xlsx 文件 |

## 权限

- 页级：登录即可（需具备该项目的模板标注权限）

## 依赖

- API 意向名：loadTemplate, loadDocTypePath, loadEffectiveBoxes, loadBoxes, saveBoxes, loadExcelMappings, saveExcelMappings, uploadExcelTemplate, listEffectiveFields（Phase B 经 query_contract 寻址；excel 相关对应 GET/PUT /api/templates/:id/excel-mappings、POST /api/templates/:id/excel-template）
- 语义组件 id：PageHeader, EmptyState, DataTable, FormField, PrimaryButton

## Rules

1. `layout_kind=excel` 时调用 excel-mappings / excel-template API；`layout_kind=raster` 时沿用 FieldBox 画布，不得混用。
2. 继承基字段来自 DocType FieldDef，标注页只读不可编辑。
3. excel-mappings 行含 `cell`, `field_key`, `value_type`, `signature_role?`, `sheet_name?`；合并格以左上角 cell 为锚点。
4. 非目标：表格线检测、跨页续表、在线表单 layout_kind=form。
5. 原型已与既有 page.logic.md 及 vue 实现对齐，本版在保留全部既有操作的前提下补齐 schema L 结构。
