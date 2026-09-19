# Component

## App

| Field | Value |
|-------|-------|
| Summary | web 前端 SPA 的根组件（App.vue），承载全局页面骨架与路由挂载入口，是 Vue 应用的最外层容器。 |
| When to use | 需要了解或修改前端全局布局、路由出口位置或页面整体结构时，从 App.vue 入手。 |
| How to use | 由 main 入口通过 createApp 挂载为根组件；调整全局布局或顶层路由结构时直接编辑 App.vue。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | Vue, SPA, App.vue, component, web, 根组件, 路由 |
| Source | scan |
| Path | apps/web/src/App.vue |
| Updated | 2026-09-14T07:01:49.515Z |

## DocumentGapsPanel

| Field | Value |
|-------|-------|
| Summary | 项目首页（project_home）视图下的 DocumentGapsPanel.vue 组件，用于展示文档缺口（Document Gaps）面板；源码 javadoc 暂无。 |
| When to use | 在 project_home 项目首页视图中需要展示文档缺口（Document Gaps）信息面板时使用。 |
| How to use | 在 Vue 视图中引入并挂载 apps/web/src/views/project_home/DocumentGapsPanel.vue 组件；组件的 props 与事件信息暂无，需查阅源码确认。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | frontend, web, Vue, component, DocumentGapsPanel, Document Gaps, project_home, views |
| Source | scan |
| Path | apps/web/src/views/project_home/DocumentGapsPanel.vue |
| Updated | 2026-09-14T07:02:25.765Z |

## ExcelCellMappingPanel

| Field | Value |
|-------|-------|
| Summary | ExcelCellMappingPanel 是 template_annotate 视图下的 Excel 单元格映射面板组件（ExcelCellMappingPanel.vue），用于标注模板中 Excel 单元格的映射配置；详细文档暂无。 |
| When to use | 在 template_annotate 页面中需要展示或编辑 Excel 单元格映射（cell mapping）时使用；具体触发条件暂无。 |
| How to use | 暂无 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | frontend, web, Vue, component, ExcelCellMappingPanel, template_annotate, Excel, cell mapping |
| Source | scan |
| Path | apps/web/src/views/template_annotate/ExcelCellMappingPanel.vue |
| Updated | 2026-09-14T07:03:03.177Z |

## index

| Field | Value |
|-------|-------|
| Summary | 暂无 javadoc；位于 apps/web/src/views/agent_runtime_control/index.vue，推断为 agent runtime 控制页（agent_runtime_control 视图）的入口组件。 |
| When to use | 需要渲染、调整或扩展 agent runtime 控制页（views/agent_runtime_control）的界面与交互时使用。 |
| How to use | 作为 Vue 路由视图组件加载，修改 index.vue 的模板与逻辑后经 Vite 构建生效；暂无更详细的用法说明。 |
| Exports | 暂无 |
| Related | getAgentTrace, http |
| Tags | Vue, vue, component, index.vue, agent_runtime_control, agent runtime, view, web |
| Source | scan |
| Path | apps/web/src/views/agent_runtime_control/index.vue |
| Updated | 2026-09-14T07:04:34.578Z |

## index

| Field | Value |
|-------|-------|
| Summary | 审计追溯（audit_trace）视图组件，位于 apps/web/src/views/audit_trace/index.vue，作为 web 前端的页面级 Vue 单文件组件（SFC），用于展示审计追溯/轨迹记录页面。扫描未提供 javadoc 与 signatures，内部 API 暂无。 |
| When to use | 需要在 web 前端查看、检索或回溯审计追溯（audit_trace）记录页面时使用；与 check_findings、pending_review 等视图同属 views 页面层。 |
| How to use | 暂无（扫描未提供组件签名与 props 信息）。通常由 Vue Router 以 views 页面形式挂载 apps/web/src/views/audit_trace/index.vue 路由后访问。 |
| Exports | 暂无 |
| Related | apps/web/src/views/check_findings/index.vue, apps/web/src/views/pending_review/index.vue |
| Tags | vue, Vue, SFC, web, frontend, views, audit_trace, index.vue, 审计追溯, 页面组件 |
| Source | scan |
| Path | apps/web/src/views/audit_trace/index.vue |
| Updated | 2026-09-14T07:05:19.301Z |

## index

| Field | Value |
|-------|-------|
| Summary | 检查发现（check_findings）视图组件，位于 apps/web/src/views/check_findings/index.vue，作为 web 前端的页面级 Vue 单文件组件（SFC），用于展示检查结果/问题发现清单页面。扫描未提供 javadoc 与 signatures，内部 API 暂无。 |
| When to use | 需要在 web 前端浏览或处理检查发现（check_findings）结果清单时使用；通常在审计追溯（audit_trace）之后、待审核（pending_review）处理之前查看。 |
| How to use | 暂无（扫描未提供组件签名与 props 信息）。通常由 Vue Router 以 views 页面形式挂载 apps/web/src/views/check_findings/index.vue 路由后访问。 |
| Exports | 暂无 |
| Related | apps/web/src/views/audit_trace/index.vue, apps/web/src/views/pending_review/index.vue |
| Tags | vue, Vue, SFC, web, frontend, views, check_findings, index.vue, 检查发现, 页面组件 |
| Source | scan |
| Path | apps/web/src/views/check_findings/index.vue |
| Updated | 2026-09-14T07:05:19.301Z |

## index

| Field | Value |
|-------|-------|
| Summary | 作业上传（job_upload）视图组件，位于 apps/web/src/views/job_upload/index.vue，作为 web 前端的页面级 Vue 单文件组件（SFC），用于提供作业文件上传入口页面。扫描未提供 javadoc 与 signatures，内部 API 暂无。 |
| When to use | 需要在 web 前端上传作业（job）文件或提交作业任务时使用；上传完成后的处理结果可在 check_findings、pending_review 视图中查看。 |
| How to use | 暂无（扫描未提供组件签名与 props 信息）。通常由 Vue Router 以 views 页面形式挂载 apps/web/src/views/job_upload/index.vue 路由后访问。 |
| Exports | 暂无 |
| Related | apps/web/src/views/check_findings/index.vue, apps/web/src/views/pending_review/index.vue |
| Tags | vue, Vue, SFC, web, frontend, views, job_upload, index.vue, 作业上传, upload, 页面组件 |
| Source | scan |
| Path | apps/web/src/views/job_upload/index.vue |
| Updated | 2026-09-14T07:05:19.301Z |

## index

| Field | Value |
|-------|-------|
| Summary | 待审核（pending_review）视图组件，位于 apps/web/src/views/pending_review/index.vue，作为 web 前端的页面级 Vue 单文件组件（SFC），用于展示等待人工复核/审核的条目页面。扫描未提供 javadoc 与 signatures，内部 API 暂无。 |
| When to use | 需要在 web 前端处理待人工复核（pending_review）条目、执行审核操作时使用；通常承接 job_upload 上传与 check_findings 检查发现之后的审核环节。 |
| How to use | 暂无（扫描未提供组件签名与 props 信息）。通常由 Vue Router 以 views 页面形式挂载 apps/web/src/views/pending_review/index.vue 路由后访问。 |
| Exports | 暂无 |
| Related | apps/web/src/views/audit_trace/index.vue, apps/web/src/views/check_findings/index.vue, apps/web/src/views/job_upload/index.vue |
| Tags | vue, Vue, SFC, web, frontend, views, pending_review, index.vue, 待审核, review, 页面组件 |
| Source | scan |
| Path | apps/web/src/views/pending_review/index.vue |
| Updated | 2026-09-14T07:05:19.301Z |

## index

| Field | Value |
|-------|-------|
| Summary | 项目首页视图（views/project_home），web 前端中项目概览与主入口页面的 Vue SFC 组件，javadoc 暂无 |
| When to use | 需要渲染项目首页（project_home）页面、调整项目概览布局或首页入口跳转逻辑时使用 |
| How to use | 通过前端路由加载 apps/web/src/views/project_home/index.vue（路由 path 通常指向 views/project_home 目录）；修改页面结构与样式请直接编辑该 .vue 文件；页面内依赖的子组件与接口调用见该文件内部 import，暂无导出签名信息 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | Vue, SFC, views, project_home, 项目首页, frontend, web, 页面组件 |
| Source | scan |
| Path | apps/web/src/views/project_home/index.vue |
| Updated | 2026-09-14T07:05:57.662Z |

## index

| Field | Value |
|-------|-------|
| Summary | 规则编辑器视图（views/rule_editor），web 前端中用于编辑规则（rule）配置的页面级 Vue SFC 组件，javadoc 暂无 |
| When to use | 需要编辑规则内容、调整 rule_editor 页面的表单交互或规则校验展示逻辑时使用 |
| How to use | 通过前端路由加载 apps/web/src/views/rule_editor/index.vue（路由 path 通常指向 views/rule_editor 目录）；修改编辑器交互请直接编辑该 .vue 文件；编辑器依赖的组件与 API 调用见该文件内部 import，暂无导出签名信息 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | Vue, SFC, views, rule_editor, 规则编辑器, rule, frontend, web, 页面组件 |
| Source | scan |
| Path | apps/web/src/views/rule_editor/index.vue |
| Updated | 2026-09-14T07:05:57.662Z |

## index

| Field | Value |
|-------|-------|
| Summary | 标准库视图（views/standard_lib），web 前端中用于浏览与管理标准库条目的页面级 Vue SFC 组件，javadoc 暂无 |
| When to use | 需要展示 standard_lib 标准库列表、检索标准条目或调整标准库内容管理界面时使用 |
| How to use | 通过前端路由加载 apps/web/src/views/standard_lib/index.vue（路由 path 通常指向 views/standard_lib 目录）；调整列表展示、筛选与分页逻辑请直接编辑该 .vue 文件；依赖的子组件与接口见该文件内部 import，暂无导出签名信息 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | Vue, SFC, views, standard_lib, 标准库, frontend, web, 页面组件 |
| Source | scan |
| Path | apps/web/src/views/standard_lib/index.vue |
| Updated | 2026-09-14T07:05:57.662Z |

## index

| Field | Value |
|-------|-------|
| Summary | 模板标注视图（views/template_annotate），web 前端中用于模板（template）标注（annotate）作业与标注结果展示的页面级 Vue SFC 组件，javadoc 暂无 |
| When to use | 需要进行 template_annotate 模板标注操作、查看标注状态或调整标注交互流程时使用 |
| How to use | 通过前端路由加载 apps/web/src/views/template_annotate/index.vue（路由 path 通常指向 views/template_annotate 目录）；修改标注流程与画布交互请直接编辑该 .vue 文件；标注依赖的组件与接口见该文件内部 import，暂无导出签名信息 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | Vue, SFC, views, template_annotate, 模板标注, annotate, template, frontend, web, 页面组件 |
| Source | scan |
| Path | apps/web/src/views/template_annotate/index.vue |
| Updated | 2026-09-14T07:05:57.662Z |

## index

| Field | Value |
|-------|-------|
| Summary | 卷预览（volume_preview）视图入口组件，位于 apps/web/src/views/volume_preview/index.vue，暂无额外文档。 |
| When to use | 需要在 web 前端展示 volume_preview（卷预览）页面时。 |
| How to use | 暂无 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | vue, frontend, web, volume_preview, views |
| Source | scan |
| Path | apps/web/src/views/volume_preview/index.vue |
| Updated | 2026-09-14T07:06:43.075Z |

## InheritedFieldsPanel

| Field | Value |
|-------|-------|
| Summary | 模板标注（template_annotate）视图中的 InheritedFieldsPanel 面板组件，位于 apps/web/src/views/template_annotate/InheritedFieldsPanel.vue，暂无额外文档。 |
| When to use | 在 template_annotate（模板标注）页面需要展示继承字段（inherited fields）面板时。 |
| How to use | 暂无 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | vue, frontend, web, InheritedFieldsPanel, template_annotate |
| Source | scan |
| Path | apps/web/src/views/template_annotate/InheritedFieldsPanel.vue |
| Updated | 2026-09-14T07:06:43.075Z |

## ProjectHomeDialogs

| Field | Value |
|-------|-------|
| Summary | project_home（项目首页）视图下的弹窗集合组件 ProjectHomeDialogs（Vue SFC，位于 apps/web/src/views/project_home/ProjectHomeDialogs.vue）。 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | 暂无 |
| Related | ProjectPackTable |
| Tags | Vue, component, ProjectHomeDialogs, project_home, dialog, web |
| Source | scan |
| Path | apps/web/src/views/project_home/ProjectHomeDialogs.vue |
| Updated | 2026-09-14T07:08:13.058Z |

## ProjectPackTable

| Field | Value |
|-------|-------|
| Summary | project_home（项目首页）视图下的 Pack 表格组件 ProjectPackTable（Vue SFC，位于 apps/web/src/views/project_home/ProjectPackTable.vue）。 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | 暂无 |
| Related | ProjectHomeDialogs |
| Tags | Vue, component, ProjectPackTable, project_home, table, web |
| Source | scan |
| Path | apps/web/src/views/project_home/ProjectPackTable.vue |
| Updated | 2026-09-14T07:08:13.058Z |

## SignatureConfirmDialog

| Field | Value |
|-------|-------|
| Summary | pending_review（待审核）视图下的签名确认弹窗组件（Vue SFC），javadoc 暂无。 |
| When to use | 在待审核（pending_review）流程中，需要用户确认签名（signature confirm）后才继续提交审核结果时使用。 |
| How to use | 在 views/pending_review 下的页面中引入 SignatureConfirmDialog.vue，通过 props / v-model 控制弹窗开关并监听确认事件完成签名提交；javadoc 暂无，具体接口以源码为准。 |
| Exports | SignatureConfirmDialog |
| Related | apps/web/src/views/pending_review/SignatureConfirmDialog.vue, web |
| Tags | SignatureConfirmDialog, pending_review, 签名确认, signature, dialog, Vue, SFC, web |
| Source | scan |
| Path | apps/web/src/views/pending_review/SignatureConfirmDialog.vue |
| Updated | 2026-09-14T07:09:01.421Z |

## SignatureReviewPanel

| Field | Value |
|-------|-------|
| Summary | 位于 apps/web/src/views/pending_review/ 的 Vue 组件，用于待审核（pending_review）流程中的签名审核面板（SignatureReviewPanel）。原始 javadoc 暂无，具体交互细节以源码为准。 |
| When to use | 在待审核（pending_review）页面需要展示并处理签名（signature）审核操作时使用该面板组件。 |
| How to use | 在 views/pending_review 相关页面中引入 SignatureReviewPanel 组件并按 props 传入待审数据（具体 props 见源码）；用法暂无更多文档。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | Vue, component, SignatureReviewPanel, pending_review, signature, review |
| Source | scan |
| Path | apps/web/src/views/pending_review/SignatureReviewPanel.vue |
| Updated | 2026-09-14T07:09:51.958Z |

## StepChat

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | 暂无 |
| Source | refresh |
| Path | apps/web/src/components/StepChat.vue |
| Updated | 2026-09-17T03:29:44.478Z |

## UploadToolbar

| Field | Value |
|-------|-------|
| Summary | job_upload 视图中的上传工具栏 Vue 组件（UploadToolbar.vue），作为触发文件上传操作（配合 uploadJob）的 UI 入口；javadoc 暂无。 |
| When to use | 在 job_upload 页面需要提供上传工具栏 UI（选择文件并发起 job 上传）时复用该组件。 |
| How to use | 在 job_upload 视图中引入并挂载 `UploadToolbar.vue` 组件；具体 props/events 暂无，可参考源码 `apps/web/src/views/job_upload/UploadToolbar.vue`。 |
| Exports | 暂无 |
| Related | uploadJob |
| Tags | UploadToolbar, job_upload, Vue, component, upload, frontend, web |
| Source | scan |
| Path | apps/web/src/views/job_upload/UploadToolbar.vue |
| Updated | 2026-09-14T07:10:38.061Z |

## WordingReviewPanel

| Field | Value |
|-------|-------|
| Summary | apps/web 前端 pending_review（待审核）视图下的文案审核面板组件 WordingReviewPanel.vue，用于展示待审核的 Wording（文案/措辞）条目并支持审核操作。组件细节（javadoc/signatures）暂无。 |
| When to use | 需要在 pending_review（待审核）流程中查看或处理 Wording 文案审核任务时，使用 WordingReviewPanel 面板进行审核、通过或驳回等操作。 |
| How to use | 作为 Vue SFC 组件，在 apps/web 的路由或其他视图中 import WordingReviewPanel 后挂载使用；具体 props 与事件定义暂无。 |
| Exports | WordingReviewPanel |
| Related | 暂无 |
| Tags | Vue, component, WordingReviewPanel, pending_review, 文案审核, views, web |
| Source | scan |
| Path | apps/web/src/views/pending_review/WordingReviewPanel.vue |
| Updated | 2026-09-14T07:11:10.770Z |

## RetrieveHitsTable

| Field | Value |
|-------|-------|
| Summary | RetrieveHitsTable（检索命中结果表格）组件，位于标准库 views/standard_lib 下，以表格形式展示检索（retrieve）操作的命中结果列表。 |
| When to use | 需要在标准库页面中以表格形式呈现检索命中结果时使用 RetrieveHitsTable；具体 props 与事件签名暂无。 |
| How to use | 具体用法暂无（javadoc 与 signatures 均为空），可在 RetrieveHitsTable.vue 源码中确认其 props、事件与插槽定义后按 Vue SFC 方式引入使用。 |
| Exports | RetrieveHitsTable |
| Related | 暂无 |
| Tags | Vue, RetrieveHitsTable, standard_lib, 检索, 检索命中, 表格, views |
| Source | refresh |
| Path | apps/web/src/views/standard_lib/RetrieveHitsTable.vue |
| Updated | 2026-09-19T06:36:26.739Z |

## StandardLib

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | 暂无 |
| Source | refresh |
| Path | apps/web/src/views/standard_lib/index.vue |
| Updated | 2026-09-19T06:36:18.181Z |

## PdfTickPanel

| Field | Value |
|-------|-------|
| Summary | PdfTickPanel（PDF 勾选/标注面板）是 web 前端 standard_lib（标准库）视图下的 Vue 组件，位于 apps/web/src/views/standard_lib/PdfTickPanel.vue，用于展示与操作 PDF 打勾标注面板。组件内部的 props / 方法签名暂无（signatures 为空，javadoc 暂无）。 |
| When to use | 需要在 web 前端 standard_lib 视图中渲染 PDF 勾选标注面板、或在标准库相关页面嵌入 PdfTickPanel 组件时使用；更细的适用条件暂无。 |
| How to use | 在 Vue 视图中 import PdfTickPanel（apps/web/src/views/standard_lib/PdfTickPanel.vue，SFC 默认导出），在 template 中以 <PdfTickPanel /> 方式挂载；具体的 props、events、slots 用法暂无。 |
| Exports | PdfTickPanel (Vue SFC default export) |
| Related | 暂无 |
| Tags | PdfTickPanel, Vue, frontend, web, standard_lib, PDF, 勾选标注 |
| Source | refresh |
| Path | apps/web/src/views/standard_lib/PdfTickPanel.vue |
| Updated | 2026-09-17T12:35:06.701Z |

## HitDetailPanel

| Field | Value |
|-------|-------|
| Summary | HitDetailPanel（命中详情面板）组件，位于 web 前端标准库（standard_lib）视图目录下，用于展示检索命中（hit）条目的详情内容。 |
| When to use | 当用户在标准库（standard_lib）中执行检索，需要查看某条命中（hit）结果的详细信息时使用。 |
| How to use | 在 standard_lib 相关页面中引入并挂载 HitDetailPanel 组件；该组件的具体 props 与事件签名暂无，使用前请查阅源码确认。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | Vue, HitDetailPanel, standard_lib, 命中详情, 标准库, hit detail |
| Source | refresh |
| Path | apps/web/src/views/standard_lib/HitDetailPanel.vue |
| Updated | 2026-09-19T06:38:13.446Z |
