# Component

_No component discovered._

## index

| Field | Value |
|-------|-------|
| Summary | 待审核视图页面组件，位于 apps/web/src/views/pending_review/index.vue，是 pending_review（待审核）业务页面的入口 Vue SFC。该扫描未提取到 javadoc 或方法签名，组件内部逻辑暂无。 |
| When to use | 当需要在 apps/web 前端应用中实现或修改 pending_review（待审核）相关页面时使用本组件，例如待审核列表展示、审核入口跳转等场景。 |
| How to use | 作为 Vue Router 视图组件使用：在路由配置中将路径映射到 apps/web/src/views/pending_review/index.vue（通常通过 () => import(...) 动态导入其 default 导出）。如需扩展功能，直接编辑该 index.vue 文件；如需复用子逻辑，建议拆分子组件后在本页面中引入。 |
| Exports | default |
| Related | 暂无 |
| Tags | Vue, SFC, pending_review, index.vue, apps/web, views, RouterView, 待审核 |
| Source | refresh |
| Path | apps/web/src/views/pending_review/index.vue |
| Updated | 2026-08-30T06:55:48.532Z |

## DocumentGapsPanel

| Field | Value |
|-------|-------|
| Summary | Vue 面板组件 DocumentGapsPanel，位于项目首页视图目录 apps/web/src/views/project_home/ 下，用于在项目首页展示文档缺口（Document Gaps）信息，帮助用户发现缺失或与代码不一致的文档。 |
| When to use | 在 apps/web 前端项目首页需要呈现文档缺口概览、检查文档完整性时使用该组件；作为 project_home 视图的子面板挂载。 |
| How to use | 在 project_home 视图（apps/web/src/views/project_home/）中引入并挂载 DocumentGapsPanel 组件；具体 props、事件与导出签名暂无（signatures 为空）。 |
| Exports | DocumentGapsPanel |
| Related | 暂无 |
| Tags | Vue, DocumentGapsPanel, project_home, Document Gaps, 文档缺口, component, frontend, apps/web |
| Source | refresh |
| Path | apps/web/src/views/project_home/DocumentGapsPanel.vue |
| Updated | 2026-08-29T15:53:52.369Z |

## ProjectPackTable

| Field | Value |
|-------|-------|
| Summary | 项目首页（project_home）视图中的 ProjectPackTable 表格组件，用于以表格形式集中展示项目的 Pack（项目包）数据列表。 |
| When to use | 在 apps/web 的 project_home（项目首页）页面需要展示、浏览项目 Pack 列表数据（如项目包记录、状态列等）时使用。 |
| How to use | 组件文件位于 apps/web/src/views/project_home/ProjectPackTable.vue，可在 project_home 相关视图中以 Vue 组件方式引入并渲染；暂无公开签名信息，具体 props 与 emit 事件以源码为准。 |
| Exports | ProjectPackTable |
| Related | project_home |
| Tags | Vue, ProjectPackTable, project_home, Pack, table, component, apps/web |
| Source | refresh |
| Path | apps/web/src/views/project_home/ProjectPackTable.vue |
| Updated | 2026-08-29T15:50:22.710Z |

## ExcelCellMappingPanel

| Field | Value |
|-------|-------|
| Summary | ExcelCellMappingPanel 是位于 template_annotate（模板标注）视图目录下的 Vue 单元格映射面板组件，用于在模板标注流程中建立并展示 Excel 单元格与模板字段之间的映射（cell mapping）关系。 |
| When to use | 在 template_annotate（模板标注）页面中需要可视化配置或调整 Excel 单元格与模板字段的映射关系、查看映射结果时使用 ExcelCellMappingPanel 组件。 |
| How to use | 在 template_annotate 相关视图中导入 ExcelCellMappingPanel（Vue SFC 组件，默认导出）并挂载到模板标注页面，传入待映射的 Excel 单元格数据与模板字段数据进行映射配置。具体 props/emits 签名扫描未捕获，暂无，需查看组件源码确认。 |
| Exports | ExcelCellMappingPanel（default export，Vue SFC 组件） |
| Related | template_annotate |
| Tags | Vue, Vue3, SFC, ExcelCellMappingPanel, template_annotate, Excel, cell mapping, 单元格映射, 模板标注 |
| Source | refresh |
| Path | apps/web/src/views/template_annotate/ExcelCellMappingPanel.vue |
| Updated | 2026-08-30T06:55:51.343Z |

## ProjectHomeDialogs

| Field | Value |
|-------|-------|
| Summary | 项目首页（project_home）的弹窗集合组件 ProjectHomeDialogs，位于 apps/web/src/views/project_home/，集中承载首页视图各类对话框（dialog）的渲染与开关控制。 |
| When to use | 在 apps/web 项目首页视图需要统一挂载或管理多个弹窗时使用，通常由 project_home 首页主视图引入，避免各弹窗散落在主视图模板中。 |
| How to use | 在 project_home 相关视图（如 ProjectHome 主页面）中引入 ProjectHomeDialogs 组件，通过 props 或事件驱动各 dialog 的显示、隐藏与数据传递。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | Vue, component, ProjectHomeDialogs, project_home, dialog, apps/web |
| Source | refresh |
| Path | apps/web/src/views/project_home/ProjectHomeDialogs.vue |
| Updated | 2026-08-29T15:52:53.644Z |

## InheritedFieldsPanel

| Field | Value |
|-------|-------|
| Summary | InheritedFieldsPanel 是 template_annotate（模板标注）视图下的继承字段面板组件，位于 apps/web/src/views/template_annotate/InheritedFieldsPanel.vue，用于在模板标注场景中展示和处理继承（Inherited）字段信息。 |
| When to use | 在模板标注（template_annotate）页面需要向用户展示继承自上级模板或数据源的字段列表，并支持查看/选用这些继承字段时使用 InheritedFieldsPanel。暂无更详细的触发条件说明。 |
| How to use | 从 apps/web/src/views/template_annotate/InheritedFieldsPanel.vue 导入 InheritedFieldsPanel 组件，在模板标注相关视图中注册并渲染，通过 props 传入继承字段数据。暂无具体的 props 与事件签名说明。 |
| Exports | InheritedFieldsPanel |
| Related | 暂无 |
| Tags | Vue, InheritedFieldsPanel, template_annotate, apps/web, 继承字段, 模板标注, 组件 |
| Source | refresh |
| Path | apps/web/src/views/template_annotate/InheritedFieldsPanel.vue |
| Updated | 2026-08-29T15:52:57.347Z |

## WordingReviewPanel

| Field | Value |
|-------|-------|
| Summary | WordingReviewPanel（文案审核面板）是位于 apps/web/src/views/pending_review 目录下的 Vue 视图组件，用于展示和操作待审核文案（pending_review）列表。 |
| When to use | 当需要在 Web 端实现文案审核流程、进入 pending_review 待审核页面、或对 WordingReviewPanel 进行扩展修改时使用本组件。 |
| How to use | 在 apps/web 项目的路由或父视图中引用 WordingReviewPanel.vue；无对外导出的方法签名（signatures 为空），具体调用方式暂无。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | Vue, WordingReviewPanel, pending_review, 文案审核, apps/web |
| Source | refresh |
| Path | apps/web/src/views/pending_review/WordingReviewPanel.vue |
| Updated | 2026-08-30T06:55:40.062Z |

## SignatureConfirmDialog

| Field | Value |
|-------|-------|
| Summary | 待审核（pending_review）流程中的签字确认弹窗组件 SignatureConfirmDialog，位于 apps/web/src/views/pending_review/SignatureConfirmDialog.vue，用于在审核处理页面弹出签名/签字确认交互。 |
| When to use | 在 pending_review（待审核）相关视图中，需要用户对审核操作进行签字确认（SignatureConfirm）时使用本弹窗组件。 |
| How to use | 从 apps/web/src/views/pending_review/SignatureConfirmDialog.vue 导入组件，按 Vue 单文件组件方式在 pending_review 视图中挂载使用；具体 props/emits 暂无。 |
| Exports | 暂无 |
| Related | apps/web/src/views/pending_review |
| Tags | Vue, component, SignatureConfirmDialog, pending_review, signature, dialog, confirm, web |
| Source | refresh |
| Path | apps/web/src/views/pending_review/SignatureConfirmDialog.vue |
| Updated | 2026-08-30T06:55:48.135Z |

## SignatureReviewPanel

| Field | Value |
|-------|-------|
| Summary | 签字审核面板组件（SignatureReviewPanel），位于 apps/web/src/views/pending_review/ 目录，用于待审核（pending_review）流程中签字/签名材料的展示与审核操作界面。该组件为 Vue 单文件组件，本身未附带 javadoc 与公开 signatures，细节暂无。 |
| When to use | 在 apps/web 的待审核（pending_review）视图中，需要向审核人展示签字/签名内容并执行审核操作（如通过、驳回）时使用该面板。 |
| How to use | 从 apps/web/src/views/pending_review/SignatureReviewPanel.vue 导入该 Vue 单文件组件，嵌入 pending_review 相关页面或路由视图作为审核子面板；通过 props 传入待审核的签字数据并监听审核结果事件完成流程流转。具体 props / emits 签名暂无（源码未提供 signatures 与 javadoc）。 |
| Exports | SignatureReviewPanel |
| Related | 暂无 |
| Tags | Vue, SignatureReviewPanel, pending_review, apps/web, 签字审核, 待审核, 审核面板, component |
| Source | refresh |
| Path | apps/web/src/views/pending_review/SignatureReviewPanel.vue |
| Updated | 2026-08-30T06:55:48.413Z |


