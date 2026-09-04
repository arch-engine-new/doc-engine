# Utils

_No utils discovered._

## useAnnotateCanvas

| Field | Value |
|-------|-------|
| Summary | useAnnotateCanvas 是 apps/web 前端 template_annotate（模板标注）视图下的 Canvas 画布标注组合式函数（composable），封装在画布上进行标注绘制与交互的逻辑。 |
| When to use | 在 apps/web 中开发模板标注功能、需要在 Canvas 画布上实现标注（绘制/编辑标注元素）交互时使用；服务于 template_annotate 视图页面。 |
| How to use | 在 template_annotate 相关的 Vue 组件中导入并调用 useAnnotateCanvas，获取画布标注所需的状态与方法并绑定到 Canvas 元素。暂无详细签名信息（signatures 为空），具体参数需查阅源码 apps/web/src/views/template_annotate/useAnnotateCanvas.ts。 |
| Exports | useAnnotateCanvas |
| Related | template_annotate |
| Tags | Vue, Canvas, composable, useAnnotateCanvas, template_annotate, 标注, 标注画布, frontend |
| Source | refresh |
| Path | apps/web/src/views/template_annotate/useAnnotateCanvas.ts |
| Updated | 2026-08-29T15:53:07.739Z |

## useProjectHome

| Field | Value |
|-------|-------|
| Summary | 项目主页（project_home）的组合式函数（Composable），封装 useProjectHome 相关的状态与逻辑，供项目主页视图复用。暂无更多签名与注释信息。 |
| When to use | 在开发或维护项目主页（apps/web/src/views/project_home）相关功能时使用；需要复用项目主页的状态管理、数据加载或交互逻辑时引入 useProjectHome。 |
| How to use | 在 project_home 视图组件中导入 useProjectHome 并调用，获取其返回的状态与方法绑定到模板；遵循 Vue Composition API 的 setup 用法。暂无详细 API 签名信息。 |
| Exports | useProjectHome |
| Related | 暂无 |
| Tags | useProjectHome, project_home, Vue, Composition API, composable, frontend |
| Source | refresh |
| Path | apps/web/src/views/project_home/useProjectHome.ts |
| Updated | 2026-08-30T06:55:42.621Z |

## http

| Field | Value |
|-------|-------|
| Summary | apps/web 前端的 http 请求工具，位于 apps/web/src/services/http.ts，统一封装 HTTP 请求能力（如基于 axios 或 fetch 的实例、拦截器与响应处理），供前端各页面/服务复用。 |
| When to use | 当 apps/web 前端需要发起 HTTP 请求、统一配置请求头/超时、集中处理响应与错误时使用本工具；新模块接入后端 API 时优先复用此 http 封装而非直接裸用 fetch/axios。 |
| How to use | 从 services/http 导入 http 工具后调用其请求方法（具体导出签名暂无，建议查看源文件 apps/web/src/services/http.ts 确认导出名与参数形式）。 |
| Exports | http |
| Related | 暂无 |
| Tags | frontend, web, http, axios, fetch, request, services, apps/web |
| Source | refresh |
| Path | apps/web/src/services/http.ts |
| Updated | 2026-08-30T06:55:48.062Z |
