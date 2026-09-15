# 项目与规范包

## 操作明细

| 操作 | 触发 | 结果 | 确认 | 角色 |
|------|------|------|------|------|
| listProjects | 进入页 | 加载项目与规范包列表 | 无 | 登录即可 |
| createProject | 点击「新建项目」 | 创建项目并刷新列表 | 无 | 登录即可 |
| updateProject | 项目行「重命名」 | 更新项目名 | 无 | 登录即可 |
| deleteProject | 项目行「删除」 | 项目逻辑删除；项目下仍有规范包时拒绝 | 确认删除该项目？ | 登录即可 |
| createSpecPack | 点击「新建空规范包」 | 创建空规范包 + 默认 DocType + 空模板；文案不含公路/水利/房建预置 | 无 | 登录即可 |
| updateSpecPack | 规范包行「重命名」 | 更新规范包名（不得含公路、水利、房建） | 无 | 登录即可 |
| deleteSpecPack | 规范包行「删除」 | 规范包逻辑删除；仍关联 Job 时拒绝 | 确认删除该规范包？ | 登录即可 |
| listDocTypes | 展开规范包行「收起类型/展开类型」 | 展示文档类型树（含 parent_name、template_count） | 无 | 登录即可 |
| createDocType | 点击「新建文档类型」 | 创建 DocType（可选 parent_doc_type_id） | 无 | 登录即可 |
| saveFieldDefs | 点击「保存基字段」 | 保存 FieldDef[]（无坐标，坐标由模板扩展框补充） | 无 | 登录即可 |
| addFieldDef | 点击「添加字段」 | 在基字段编辑表新增一行 field_key/value_type/required | 无 | 登录即可 |
| createTemplate | DocType 行「新建模板」 | 创建模板并绑定 doc_type_id | 无 | 登录即可 |
| openAnnotate | 点击「标注模板」或 DocType 行「标注」 | 跳转 /templates/:id/annotate | 无 | 登录即可 |
| openRules | 点击「规则」 | 跳转 /packs/:id/rules | 无 | 登录即可 |
| listDocumentGaps | 进入页 | 加载缺表清单（required 且尚无 artifact） | 无 | 登录即可 |
| generateInspectionBatch | DocType 行「生成检验批」 | generate → upload；更新 artifact 状态与 trace，展示「已上传」标签 | 无 | 登录即可 |
| fillDocumentGap | 缺表清单「补表」按钮 | 对缺表 DocType 触发 generateInspectionBatch 后刷新清单 | 无 | 登录即可 |

## 主流程

1. 进入页加载项目/规范包列表与当前项目缺表清单（listDocumentGaps）。
2. 新建空规范包（自动创建默认 DocType 与空模板）；展开规范包查看文档类型树。
3. 编辑并保存 DocType 基字段（FieldDef，无坐标）；新建模板并进入标注。
4. 对已上传 Excel 模板的 DocType「生成检验批」（generate → upload）；缺表处「补表」可快捷触发同样流程。

## 状态

- `loading`：列表与缺表清单加载中显示 Spinner
- `empty`：无项目/规范包或缺表清单为空时展示 EmptyState（非权限问题）
- `forbidden`：无权限进入或操作时展示提示（与 empty 区分）
- `error`：加载或生成/上传失败时展示 Alert + 重试
- `success`：生成检验批并上传成功后展示「已上传」标签

## 字段与列

| name | 类型 | 必填 | 展示 | 语义组件（可选） |
|------|------|------|------|------------------|
| projectName | string | yes | 表单 / 表格列 | FormField / DataTable 列 |
| specPackName | string | yes | 表单 / 表格列 | FormField / DataTable 列 |
| version | string | no | 表格列 | DataTable 列 |
| template | string | no | 表格列 | DataTable 列 |
| docTypeName | string | yes | 表格列 | DataTable 列 |
| parentName | string | no | 表格列 | DataTable 列 |
| templateCount | number | no | 表格列 | DataTable 列 |
| fieldKey | string | yes | 表单 | FormField |
| valueType | enum | yes | 表单 | FormField（string/date/number） |
| required | boolean | yes | 表单 | FormField |
| gapName | string | no | 只读 | 只读列表 |
| artifactStatus | enum | no | 只读（已上传标签） | Tag |

## 查询参数

| 参数名 | 含义 | 默认值 |
|--------|------|--------|
| projectName | 项目名输入/归属项目选择 | 演示项目-夹具 |
| specPackName | 规范包名 | 空包-收货单级 |

## 选项数据源

| 字段 | 控件 | 来源 | 意向 API 或字典 type | value | label | 父字段(级联) | 加载时机 |
|------|------|------|----------------------|-------|-------|--------------|----------|
| 归属项目 | Select | MOCK→API | listProjects | id | name | 无 | mount |
| valueType | Select | dict | dictValueType | value | label | 无 | mount |

## 校验

| 规则 | 范围 | 说明 |
|------|------|------|
| required | projectName / specPackName / fieldKey | 必填不能为空 |
| pattern | specPackName | 名称不得含公路、水利、房建 |
| cross-field | deleteProject / deleteSpecPack | 存在关联规范包或 Job 时拒绝删除并提示 |
| cross-field | generateInspectionBatch | DocType 须有 layout_kind=excel 且 excel_template_uri 非空的模板，否则提示先配置 |

## 权限

- 页级：登录即可

## 依赖

- API 意向名：listProjects, createProject, updateProject, deleteProject, createSpecPack, updateSpecPack, deleteSpecPack, listDocTypes, createDocType, saveFieldDefs, createTemplate, listDocumentGaps, generateInspectionBatch, fillDocumentGap
- 语义组件 id：PageHeader, EmptyState, PrimaryButton, DataTable, FormField, SearchBar

## Rules

1. 界面文案不得出现公路/水利/房建预置字样；规范包由用户自行配置。
2. FieldDef 无坐标，坐标由模板扩展框（FieldBox）补充。
3. listDocumentGaps 仅返回 required 且尚无 artifact 的项；补表走 generate → upload。
4. 本页原型已与旧版 page.logic.md 对齐，以上操作与旧逻辑一致。
