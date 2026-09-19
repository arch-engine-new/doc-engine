# Component

_No component discovered._

## StepChat

| Field | Value |
|-------|-------|
| Summary | StepChat：分步骤聊天/引导式对话组件（Vue 单文件组件，位于 apps/web/src/components/StepChat.vue）。javadoc 暂无，具体 props、事件与内部状态定义暂无。 |
| When to use | 需要在页面中嵌入按步骤（step）推进的聊天或问答交互界面时使用；具体可配置项与适用子场景暂无。 |
| How to use | 在 Vue 页面或组件中通过 import StepChat from 'apps/web/src/components/StepChat.vue' 引入，并在 template 中以 <StepChat /> 方式挂载；具体 props / events 传参方式暂无。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | component, Vue, StepChat, 聊天, 分步对话, 前端, frontend, apps |
| Source | refresh |
| Path | apps/web/src/components/StepChat.vue |
| Updated | 2026-09-17T04:10:21.745Z |

## index

| Field | Value |
|-------|-------|
| Summary | apps/web 前端应用中的标准库（standard_lib）视图入口组件，文件路径为 apps/web/src/views/standard_lib/index.vue。该组件作为 standard_lib（标准库）页面的 Vue 视图入口，负责承载标准库相关功能的页面级渲染逻辑。 |
| When to use | 当需要在 apps/web 前端中访问或修改 standard_lib（标准库）页面的界面与交互逻辑时使用；路由配置中指向 apps/web/src/views/standard_lib/ 目录时，该 index.vue 即为对应视图入口。 |
| How to use | 暂无 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | Vue, component, view, standard_lib, apps, web, views, index.vue |
| Source | refresh |
| Path | apps/web/src/views/standard_lib/index.vue |
| Updated | 2026-09-19T06:23:11.736Z |

## StandardLib

| Field | Value |
|-------|-------|
| Summary | 前端视图组件 StandardLib，位于 apps/web/src/views/standard_lib/index.vue，是「标准库（standard_lib）」页面入口，用于标准资产库的展示/管理。组件详细说明暂无（javadoc 为「暂无」）。 |
| When to use | 需要在 apps/web 前端中提供标准库（standard_lib）浏览或管理页面时使用；具体业务约束暂无（signatures 为空）。 |
| How to use | 作为 Vue 路由页面挂载：在 apps/web 的路由配置中注册 views/standard_lib/index.vue 对应路由；或在父组件中 import StandardLib 后以 <StandardLib /> 使用。具体 props/events 暂无。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | Vue, frontend, StandardLib, standard_lib, 标准库, views, apps/web |
| Source | refresh |
| Path | apps/web/src/views/standard_lib/index.vue |
| Updated | 2026-09-17T12:10:22.890Z |

## HitDetailPanel

| Field | Value |
|-------|-------|
| Summary | standard_lib（标准库）视图下的命中详情面板组件 HitDetailPanel，用于展示检索命中（hit）条目的详细内容，文件位于 apps/web/src/views/standard_lib/HitDetailPanel.vue。 |
| When to use | 当用户在 standard_lib 标准库页面点击某条检索命中结果，需要查看该 hit 的详情信息时，使用 HitDetailPanel 渲染详情面板。 |
| How to use | 在 standard_lib 相关视图中引入 HitDetailPanel.vue 并注册为子组件，将选中的命中条目数据通过 props 传入即可渲染；具体 props 与事件定义暂无。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | Vue, component, HitDetailPanel, standard_lib, views, apps, frontend, 命中详情面板 |
| Source | refresh |
| Path | apps/web/src/views/standard_lib/HitDetailPanel.vue |
| Updated | 2026-09-19T06:23:52.638Z |

## RetrieveHitsTable

| Field | Value |
|-------|-------|
| Summary | 标准库（standard_lib）模块下的检索命中结果表格组件 RetrieveHitsTable，位于 apps/web/src/views/standard_lib/RetrieveHitsTable.vue，用于以表格形式展示检索（retrieve）返回的命中条目（hits）。组件 javadoc 暂无，具体 props 与事件定义暂无。 |
| When to use | 在标准库（standard_lib）页面中需要展示检索（retrieve）结果列表时使用；当需要将 hits 检索命中数据以统一表格样式呈现、避免各处重复实现结果表格时，复用该组件。 |
| How to use | 在 standard_lib 相关视图中 import RetrieveHitsTable（路径 apps/web/src/views/standard_lib/RetrieveHitsTable.vue），将检索返回的 hits 数据通过 props 传入进行渲染；具体 props 名称、事件与插槽定义暂无，请查看源码确认。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | Vue, Vue组件, RetrieveHitsTable, standard_lib, 标准库, retrieve, hits, 检索, 检索命中, 表格, table, views, apps, web, frontend |
| Source | refresh |
| Path | apps/web/src/views/standard_lib/RetrieveHitsTable.vue |
| Updated | 2026-09-19T06:23:57.609Z |
