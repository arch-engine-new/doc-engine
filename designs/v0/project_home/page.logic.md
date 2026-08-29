# page.logic — 项目与规范包

## 元信息
- pageId: project_home
- feature: core-engine
- title: 项目与规范包
- route: /projects
- pageType: list

## 校验
- `deleteProject`：项目下仍有规范包时拒绝删除。
- `deleteSpecPack`：规范包仍有关联 Job 时拒绝删除。
- `updateSpecPack`：重命名名称不得含公路、水利、房建。
- `createDocType`：`name` 非空；`packId` 须存在；`parentDocTypeId` 可选且须同属该 pack。
- `deleteDocType`：仍有子类型、关联模板或 Job 时拒绝（409）。
- `saveFieldDefs`：同类型 `field_key` 唯一；子类型不得与祖先链重复 key（409）。
- `createTemplate`：须指定 `docTypeId`；模板归属 pack 与 DocType 一致。

## 操作明细
| 操作 | 触发 | 结果 |
|------|------|------|
| listProjects | 进入 | Project[] |
| createProject | 新建项目 | Project |
| updateProject | 项目行重命名 | Project |
| deleteProject | 项目行删除 | Project（逻辑删除） |
| createSpecPack | 新建空规范包 | SpecPack（无行业预置） |
| updateSpecPack | 规范包行重命名 | SpecPack |
| deleteSpecPack | 规范包行删除 | SpecPack（逻辑删除） |
| listDocTypes | 展开规范包行 | DocType[]（名称、父类型、模板数） |
| createDocType | 新建文档类型 | DocType（可选 parentDocTypeId） |
| editFieldDefs | DocType 行「编辑基字段」 | FieldDef[]（GET/PUT field-defs） |
| createTemplate | DocType 行「新建模板」 | Template（带 doc_type_id） |
| openAnnotate | DocType 行「标注」 | → /templates/:id/annotate |
| openRules | 规则 | → /packs/:id/rules |
| openStepChat | 进入 | 问如何建空包、DocType 与基字段；不预置条文 |

## 主流程
1. 列出项目与规范包。
2. 新建空包，界面文案不得出现公路/水利/房建预置规则。
3. 展开规范包 → 文档类型表：创建类型（可选父类型）→ 编辑基字段（FieldDef，无坐标）→ 新建模板 → 跳转标注。
4. 进入模板标注或规则编辑。
5. 列表行可重命名或删除（受约束限制）。

## 状态
loading / empty / error / ready

## 依赖
- 实体：Project, SpecPack, DocType, FieldDef, Template
- API：`GET /api/packs/:packId/doc-types`；`POST /api/doc-types`；`GET/PUT /api/doc-types/:id/field-defs`；`POST /api/templates`
- 验收：A1（含 AC-1 DocType 列表与 CRUD）
