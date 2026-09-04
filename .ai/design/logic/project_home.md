# page.logic — 项目与规范包

## 元信息
- pageId: project_home
- feature: core-engine
- title: 项目与规范包
- route: /projects
- pageType: list

## 操作明细
| 操作 | 触发 | 结果 |
|------|------|------|
| listProjects | 进入 | Project[] |
| createProject | 新建项目 | Project |
| updateProject | 项目行重命名 | Project |
| deleteProject | 项目行删除 | Project（逻辑删除） |
| createSpecPack | 新建空规范包 | SpecPack + 默认 DocType + 空模板 |
| updateSpecPack | 规范包行重命名 | SpecPack |
| deleteSpecPack | 规范包行删除 | SpecPack（逻辑删除） |
| listDocTypes | 展开规范包「文档类型」 | DocType[]（含 parent_name、template_count） |
| createDocType | 新建文档类型 | DocType（可选 parent_doc_type_id） |
| saveFieldDefs | 编辑基字段 | FieldDef[]（无坐标） |
| createTemplate | 为 DocType 新建模板 | Template（绑定 doc_type_id） |
| openAnnotate | 标注模板 / DocType 行标注 | → /templates/:id/annotate |
| openRules | 规则 | → /packs/:id/rules |
| openStepChat | 进入 | 问如何建空包与文档类型；不预置条文 |
| listDocumentGaps | 进入 / 补表后 | `GET /api/projects/:id/document-gaps` → 缺表列表 |
| generateInspectionBatch | DocType 行「生成检验批」 | generate → upload；更新 artifact 状态与 trace |
| fillDocumentGap | 缺表面板「补表」 | 对缺表 DocType 调用 generateInspectionBatch |

## 主流程
1. 列出项目与规范包。
2. 新建空包时自动创建「默认类型」与空模板；界面文案不得出现公路/水利预置规则。
3. 展开规范包查看文档类型树；配置基字段（FieldDef）后新建模板并进入标注。
4. 列表行可重命名或删除（受约束限制）。
5. 按项目展示缺表列表（CompletenessRule 对比 DocumentArtifact）；「补表」触发 Excel 生成并上传。
6. Excel DocType（`layout_kind=excel` 且已上传模板）可「生成检验批」；成功后展示 artifact 状态与审计链接。

## 约束
- `deleteProject`：项目下仍有规范包时拒绝删除。
- `deleteSpecPack`：规范包仍有关联 Job 时拒绝删除。
- `updateSpecPack`：重命名名称不得含公路、水利、房建。
- FieldDef 与 FieldBox 分工：类型基字段无坐标；模板页只标扩展框。
- CompletenessRule：规范包级应备 DocType 清单；`listDocumentGaps` 仅返回 required 且尚无 artifact 的项。
- `generateInspectionBatch`：要求 DocType 有关联 `layout_kind=excel` 且 `excel_template_uri` 非空的模板；否则提示先配置 Excel 模板与映射。

## 状态
loading / empty / error / ready

## 依赖
- 实体：Project, SpecPack, DocType, FieldDef, Template, CompletenessRule, DocumentArtifact
- API：`GET document-gaps`；`POST documents/generate`；`POST documents/:artifactId/upload`
- 验收：A1、AC-1、AC-3、AC-5、AC-6、AC-8
