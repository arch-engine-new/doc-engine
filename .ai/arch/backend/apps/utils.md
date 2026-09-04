# Utils

_No utils discovered._

## agent-runtime

| Field | Value |
|-------|-------|
| Summary | 位于 apps/web/src/services/agent-runtime.ts 的 agent-runtime（智能体运行时）服务模块，承载 web 端 agent 会话与执行相关的运行时逻辑。扫描未捕获 javadoc 与函数签名，具体职责细节暂无。 |
| When to use | 在 apps/web 前端需要接入、扩展或调试 agent-runtime（智能体运行时）行为（如 agent 会话管理、运行时状态流转）时使用；具体适用场景暂无。 |
| How to use | 在 apps/web 代码中从 src/services/agent-runtime 导入该模块使用；具体导出的函数、类及调用方式暂无（无 signatures 与 javadoc），建议直接阅读 agent-runtime.ts 源码确认 API。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | agent-runtime, apps/web, services, agent, runtime, TypeScript, util |
| Source | refresh |
| Path | apps/web/src/services/agent-runtime.ts |
| Updated | 2026-08-29T03:14:50.612Z |

## http

| Field | Value |
|-------|-------|
| Summary | apps/web 前端应用的 http 请求服务，位于 apps/web/src/services/http.ts，统一封装 HTTP 请求（如 axios / fetch）的发送、基础配置与错误处理，供页面与模块调用后端 API。 |
| When to use | 在 apps/web 前端需要发起后端 API 请求、统一设置请求头（headers）、超时（timeout）、错误或响应拦截时，应使用该 http 服务而非直接调用底层请求库。 |
| How to use | 在前端代码中从 apps/web/src/services/http.ts 导入 http 服务，调用其封装的请求方法发起 GET / POST 等调用；具体导出方法以源码为准。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | http, services, web, frontend, TypeScript, fetch, axios, api-client, request |
| Source | refresh |
| Path | apps/web/src/services/http.ts |
| Updated | 2026-08-29T15:48:20.863Z |

## types

| Field | Value |
|-------|-------|
| Summary | apps/web 前端 services 层的 TypeScript 类型定义文件（types.ts），集中声明服务层共用类型（如接口请求/响应类型定义），供 apps/web/src/services 下的各服务模块 import 复用。当前扫描未提取到 Javadoc 与公开签名。 |
| When to use | 在 apps/web 中编写或修改 service 层代码、需要复用或扩展统一类型定义（请求参数、响应结构等）时使用；排查类型报错或追溯某个类型来源时也可定位到本文件。 |
| How to use | 暂无（未提取到 Javadoc 与导出签名）。通常通过 import 引入该文件导出的 TypeScript 类型；建议直接查看 apps/web/src/services/types.ts 确认实际导出的类型名。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | TypeScript, types, type-definitions, services, apps/web, frontend |
| Source | refresh |
| Path | apps/web/src/services/types.ts |
| Updated | 2026-08-29T15:48:22.991Z |

## useProjectHome

| Field | Value |
|-------|-------|
| Summary | useProjectHome 是 apps/web 项目首页（project_home）视图的组合式函数（composable），封装项目首页的响应式状态与业务逻辑，位于 views/project_home/ 目录下，供首页视图组件复用。 |
| When to use | 当需要在项目首页（project_home）视图中组织或复用状态管理、数据加载等逻辑时使用 useProjectHome；适合希望将首页 UI 与逻辑分离（关注点分离、便于测试）的场景。 |
| How to use | 在 project_home 视图组件中导入并调用 useProjectHome()，获取其返回的响应式状态与方法，绑定到模板中使用；详细签名暂无。 |
| Exports | useProjectHome |
| Related | 暂无 |
| Tags | useProjectHome, project_home, Vue, Composition API, composable, TypeScript, apps/web, 项目首页 |
| Source | refresh |
| Path | apps/web/src/views/project_home/useProjectHome.ts |
| Updated | 2026-08-29T15:50:18.400Z |
