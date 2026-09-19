# Utils

## applyResetResult

| Field | Value |
|-------|-------|
| Summary | 处理 `/api/demo/reset` 的重置结果或首次加载的 demo 列表：`applyResetResult(body: DemoResetResult): void` 将返回的 demo ids 写入 demo-session 状态，供导航链接（nav links）使用，且状态可跨 SPA 路由导航存活。 |
| When to use | 前端调用 `/api/demo/reset` 后需要在导航链接中展示 demo ids；或首次加载 demo 列表需要初始化状态；需要 demo ids 在 SPA 路由切换后仍可用时。 |
| How to use | 从 services/demo-session.ts 导入 applyResetResult，将 `/api/demo/reset` 接口的响应体（DemoResetResult 结构）作为参数调用：`applyResetResult(body)`；随后各视图从 demo-session 状态读取 demo ids 渲染导航链接。 |
| Exports | applyResetResult(body: DemoResetResult): void |
| Related | 暂无 |
| Tags | applyResetResult, /api/demo/reset, DemoResetResult, demo-session, demo ids, SPA, nav links, web, TypeScript |
| Source | scan |
| Path | apps/web/src/services/demo-session.ts |
| Updated | 2026-09-14T07:01:49.516Z |

## boxStyle

| Field | Value |
|-------|-------|
| Summary | 模板扩展（template extension）FieldBoxes 的鼠标驱动矩形绘制辅助函数：`boxStyle(box)` 将 FieldBox 的坐标尺寸转换为画布元素的内联样式，配合 useAnnotateCanvas 的鼠标框选绘制流程使用。 |
| When to use | 在 template_annotate 视图中需要渲染、定位或高亮 FieldBox 矩形框时；或需要扩展 useAnnotateCanvas 中鼠标拖拽画框（rectangle drawing）交互逻辑时。 |
| How to use | 从 views/template_annotate/useAnnotateCanvas.ts 导入 boxStyle，传入 FieldBox 对象，将返回的样式对象直接绑定到模板中的矩形元素（如 position/width/height），实现鼠标绘制的实时预览。 |
| Exports | boxStyle(box: ...) |
| Related | useAnnotateCanvas |
| Tags | boxStyle, useAnnotateCanvas, FieldBoxes, template_annotate, template extension, rectangle drawing, canvas, 标注, Vue, TypeScript |
| Source | scan |
| Path | apps/web/src/views/template_annotate/useAnnotateCanvas.ts |
| Updated | 2026-09-14T07:01:49.516Z |

## CONFIRM_NEXT

| Field | Value |
|-------|-------|
| Summary | Walking Skeleton 视图使用的 API 结构定义（services/types.ts）中的 `CONFIRM_NEXT`：定义确认并进入下一步（confirm next）接口的请求/响应 shape，字段名与后端 ledger 的 snake_case 命名保持一致。 |
| When to use | 前端视图需按 Walking Skeleton 流程调用 confirm-next 类接口；需要构造或解析与 ledger 字段（snake_case）对齐的请求体/响应体时。 |
| How to use | 从 services/types.ts 导入 CONFIRM_NEXT 及相关类型，按其定义的 snake_case 字段名构造请求体或解析响应，确保前后端 ledger 字段命名一致，避免字段映射错误。 |
| Exports | CONFIRM_NEXT |
| Related | 暂无 |
| Tags | CONFIRM_NEXT, Walking Skeleton, snake_case, ledger, API, types, confirm next, web, TypeScript |
| Source | scan |
| Path | apps/web/src/services/types.ts |
| Updated | 2026-09-14T07:01:49.516Z |

## confirmSignatureTask

| Field | Value |
|-------|-------|
| Summary | 签名任务确认函数 confirmSignatureTask(taskId, signerName)，位于 services/http.ts，基于该文件对线上 `/api/*` 接口的 Fetch 封装（Vite middleware → JobPipeline 链路）提交签名确认。 |
| When to use | 前端已获得 taskId 与 signerName，需要调用 `/api/*` 接口完成签名任务确认时使用。 |
| How to use | 从 apps/web/src/services/http.ts 导入 confirmSignatureTask，传入 taskId: string 与 signerName: string，函数返回 Promise；底层复用 http.ts 的 fetch 封装（Vite middleware → JobPipeline）。 |
| Exports | confirmSignatureTask |
| Related | dictLabel |
| Tags | frontend, web, http, fetch, confirmSignatureTask, taskId, signerName, /api/*, Vite middleware, JobPipeline, Promise |
| Source | scan |
| Path | apps/web/src/services/http.ts |
| Updated | 2026-09-14T07:02:25.765Z |

## demoNav

| Field | Value |
|-------|-------|
| Summary | demoNav 常量，保存调用 `/api/demo/reset` 重置或首次拉取列表后的 demo ids，供导航链接（nav links）使用，且在 SPA navigation（单页应用路由切换）中数据保持存活。 |
| When to use | demo（演示）模式下，在 `/api/demo/reset` 之后或首次获取列表后渲染导航链接，并需要在 SPA 路由跳转间保留 demo ids 时使用。 |
| How to use | 从 apps/web/src/services/demo-session.ts 导入 export const demoNav，在导航相关组件中读取其中的 demo ids 生成链接；SPA navigation 过程中无需重新请求。 |
| Exports | demoNav |
| Related | 暂无 |
| Tags | frontend, web, demoNav, demo-session, demo ids, /api/demo/reset, SPA navigation, nav links, SPA |
| Source | scan |
| Path | apps/web/src/services/demo-session.ts |
| Updated | 2026-09-14T07:02:25.765Z |

## dictLabel

| Field | Value |
|-------|-------|
| Summary | 字典标签工具函数 dictLabel(items: DictItem[], value: string): string，位于 services/http.ts（该文件同时提供对线上 `/api/*` 的 Fetch 封装，Vite middleware → JobPipeline 链路），将字典值 value 转为对应标签文本。 |
| When to use | 前端持有字典数据 DictItem[]，需要把字典 value 映射为可显示的 label 文本时使用。 |
| How to use | 从 apps/web/src/services/http.ts 导入 dictLabel，传入 DictItem[] 数组与 value: string，返回对应标签字符串，通常在渲染层展示字典项时调用。 |
| Exports | dictLabel |
| Related | confirmSignatureTask |
| Tags | frontend, web, http, dictLabel, DictItem, dictionary, /api/*, Vite middleware, JobPipeline |
| Source | scan |
| Path | apps/web/src/services/http.ts |
| Updated | 2026-09-14T07:02:25.765Z |

## ensureDemoSession

| Field | Value |
|-------|-------|
| Summary | ensureDemoSession 获取演示会话的导航 ids（DemoNavIds），供 /api/demo/reset 之后或首次列表加载后的导航链接使用，状态可在 SPA navigation 之间保留。 |
| When to use | 在 SPA 中需要为导航链接填充 demo ids（DemoNavIds），或刚调用过 /api/demo/reset、首次拉取列表后需要确保演示会话可用时使用。 |
| How to use | 在组件初始化或路由跳转前调用 await ensureDemoSession()，返回 Promise<DemoNavIds>；用返回的 ids 拼装导航链接，SPA 导航期间无需重复重置会话。 |
| Exports | ensureDemoSession, DemoNavIds |
| Related | 暂无 |
| Tags | frontend, web, util, ensureDemoSession, DemoNavIds, /api/demo/reset, SPA, demo-session |
| Source | scan |
| Path | apps/web/src/services/demo-session.ts |
| Updated | 2026-09-14T07:03:03.177Z |

## errorMessage

| Field | Value |
|-------|-------|
| Summary | errorMessage 将 unknown 类型的错误对象转换为可展示的 string，配合 http.ts 中访问 live /api/*（Vite middleware → JobPipeline）的 fetch 封装使用。 |
| When to use | 调用 /api/* 接口（请求经 Vite middleware 转发到 JobPipeline）在 catch 中捕获 err: unknown 后，需要生成用户可读的错误文案时使用。 |
| How to use | 在 fetch 请求的 try/catch 中调用 errorMessage(err)，将返回的 string 用于 toast、提示条或状态展示；注意仅做文案转换，不负责重试逻辑。 |
| Exports | errorMessage |
| Related | fetchDocumentGaps |
| Tags | frontend, web, http, util, errorMessage, fetch, /api/*, Vite middleware, JobPipeline, error handling |
| Source | scan |
| Path | apps/web/src/services/http.ts |
| Updated | 2026-09-14T07:03:03.177Z |

## fetchDocumentGaps

| Field | Value |
|-------|-------|
| Summary | fetchDocumentGaps 按项目 id（projectId）拉取文档缺口（document gaps）数据，走 live /api/* 请求链路（Vite middleware → JobPipeline）。 |
| When to use | 前端需要查询某个 project 下的 document gaps（文档缺口）列表时使用；projectId 为必填参数。 |
| How to use | 调用 await fetchDocumentGaps(projectId) 并传入项目 id 字符串，返回 Promise 包裹的文档缺口数据；异常可配合 errorMessage 转成可读文案。 |
| Exports | fetchDocumentGaps |
| Related | errorMessage |
| Tags | frontend, web, http, util, fetchDocumentGaps, projectId, document gaps, /api/*, Vite middleware, JobPipeline |
| Source | scan |
| Path | apps/web/src/services/http.ts |
| Updated | 2026-09-14T07:03:03.177Z |

## fetchExcelMappings

| Field | Value |
|-------|-------|
| Summary | 按 templateId 拉取 Excel 单元格映射列表（返回 Promise<ExcelCellMappingView[]>），是 http.ts 中的 Fetch wrapper，走 live /api/*（Vite middleware → JobPipeline）。 |
| When to use | 前端需要按 templateId 展示或编辑 Excel 单元格映射（ExcelCellMappingView）时；需要实时 /api/* 数据（Vite middleware 代理到 JobPipeline）而非静态 mock 时。 |
| How to use | 在 apps/web/src/services/http.ts 中 import { fetchExcelMappings }，传入 templateId: string，await 后得到 ExcelCellMappingView[]；请求经 Vite middleware 转发到 JobPipeline 的 /api/* 接口。 |
| Exports | fetchExcelMappings(templateId: string): Promise<ExcelCellMappingView[]> |
| Related | fetchPendingSignatures, generateDocument |
| Tags | web, frontend, http.ts, fetch, fetchExcelMappings, templateId, ExcelCellMappingView, /api/*, Vite middleware, JobPipeline, Excel |
| Source | scan |
| Path | apps/web/src/services/http.ts |
| Updated | 2026-09-14T07:03:45.519Z |

## fetchPendingSignatures

| Field | Value |
|-------|-------|
| Summary | 拉取待签名任务列表（返回 Promise<SignatureTaskView[]>），是 http.ts 中的 Fetch wrapper，走 live /api/*（Vite middleware → JobPipeline）。 |
| When to use | 前端需要展示待签名（pending signatures）任务清单或签名提醒时；需要 SignatureTaskView 的实时数据来源时。 |
| How to use | 在 apps/web/src/services/http.ts 中 import { fetchPendingSignatures }，无参数调用，await 后得到 SignatureTaskView[]；请求经 Vite middleware 转发到 JobPipeline 的 /api/* 接口。 |
| Exports | fetchPendingSignatures(): Promise<SignatureTaskView[]> |
| Related | fetchExcelMappings, generateDocument |
| Tags | web, frontend, http.ts, fetch, fetchPendingSignatures, SignatureTaskView, signature, pending signatures, /api/*, Vite middleware, JobPipeline |
| Source | scan |
| Path | apps/web/src/services/http.ts |
| Updated | 2026-09-14T07:03:45.519Z |

## generateDocument

| Field | Value |
|-------|-------|
| Summary | 按 projectId 提交 GenerateDocumentInput 触发文档生成（返回 Promise 结果），是 http.ts 中的 Fetch wrapper，走 live /api/*（Vite middleware → JobPipeline）。 |
| When to use | 前端需要为指定 projectId 发起文档生成请求时；需要提交 GenerateDocumentInput 参数并等待后端生成结果时。 |
| How to use | 在 apps/web/src/services/http.ts 中 import { generateDocument }，传入 projectId: string 与 GenerateDocumentInput，await Promise 获取生成结果；请求经 Vite middleware 转发到 JobPipeline 的 /api/* 接口。 |
| Exports | generateDocument(projectId: string, input: GenerateDocumentInput): Promise<...> |
| Related | fetchExcelMappings, fetchPendingSignatures |
| Tags | web, frontend, http.ts, fetch, generateDocument, projectId, GenerateDocumentInput, /api/*, Vite middleware, JobPipeline, document |
| Source | scan |
| Path | apps/web/src/services/http.ts |
| Updated | 2026-09-14T07:03:45.519Z |

## getAgentRun

| Field | Value |
|-------|-------|
| Summary | 按 runId 获取单个 agent run 元数据（返回 Promise<AgentRunRow>），列出控制面可见的 agent run，供 internal 页筛选 job-step-v1。 |
| When to use | internal 页需要按 runId 查看某个 agent run 的控制面元数据时；需要配合 job-step-v1 筛选/关联 job step 时。 |
| How to use | 在 apps/web/src/services/agent-runtime.ts 中 import { getAgentRun }，传入 runId: string，await 后得到 AgentRunRow；用于控制面 agent run 元数据查询，再按 job-step-v1 过滤展示。 |
| Exports | getAgentRun(runId: string): Promise<AgentRunRow> |
| Related | 暂无 |
| Tags | web, frontend, agent-runtime.ts, getAgentRun, runId, AgentRunRow, agent run, job-step-v1, internal, 控制面 |
| Source | scan |
| Path | apps/web/src/services/agent-runtime.ts |
| Updated | 2026-09-14T07:03:45.519Z |

## getAgentTrace

| Field | Value |
|-------|-------|
| Summary | 封装 getAgentTrace(runId: string) 请求，列出控制面可见的 agent run 元数据，返回 Promise<AgentTraceEvent[]>，供 internal 页筛选 job-step-v1 事件。 |
| When to use | 需要在 internal 页按 runId 追踪某个 agent run、查看或筛选 job-step-v1 trace 事件时使用。 |
| How to use | 从 apps/web/src/services/agent-runtime.ts 导入 getAgentTrace，传入 runId，await 返回的 Promise<AgentTraceEvent[]> 后在页面中渲染或筛选 job-step-v1 事件列表。 |
| Exports | getAgentTrace, AgentTraceEvent |
| Related | http, HttpError |
| Tags | web, TypeScript, getAgentTrace, AgentTraceEvent, job-step-v1, agent run, runId, trace, internal, agent-runtime |
| Source | scan |
| Path | apps/web/src/services/agent-runtime.ts |
| Updated | 2026-09-14T07:04:34.577Z |

## http

| Field | Value |
|-------|-------|
| Summary | web 前端模块的 HTTP 请求服务封装（apps/web/src/services/http.ts），作为前端与后端 API 交互的统一入口，收敛请求配置、拦截器与错误处理等逻辑。源码 javadoc 暂无、方法签名暂无，具体实现以 http.ts 源码为准。 |
| When to use | 在 web 前端需要向后端发起 HTTP 请求时使用；需要统一的请求入口、鉴权头注入、错误处理等横切逻辑时使用，避免在页面组件中分散地直接调用网络请求 API。 |
| How to use | 从 services/http 路径导入（文件位于 apps/web/src/services/http.ts），在业务代码中调用其导出的请求方法访问后端接口；由于导出签名暂无，具体可用方法、参数与返回结构请查阅 http.ts 源码确认。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | http, frontend, web, TypeScript, HTTP 请求, services, 网络请求封装, API 调用, 请求封装 |
| Source | refresh |
| Path | apps/web/src/services/http.ts |
| Updated | 2026-09-15T09:39:36.348Z |

## HttpError

| Field | Value |
|-------|-------|
| Summary | http fetch wrapper 的错误类型，class HttpError extends Error，用于标识 `/api/*`（Vite middleware → JobPipeline）请求失败的场景。 |
| When to use | 调用 http 请求 live `/api/*` 端点失败、需要捕获并区分错误类型时使用。 |
| How to use | 从 apps/web/src/services/http.ts 导入 HttpError，在 http 调用外层 try/catch 中用 instanceof HttpError 判断是否为请求错误并读取错误信息。 |
| Exports | HttpError |
| Related | http, getAgentTrace |
| Tags | web, TypeScript, HttpError, Error, http, fetch, /api/*, Vite middleware, JobPipeline, HttpErrorextends |
| Source | scan |
| Path | apps/web/src/services/http.ts |
| Updated | 2026-09-14T07:04:34.578Z |

## listAgentRuns

| Field | Value |
|-------|-------|
| Summary | 列出控制面可见的 agent run 元数据，返回 AgentRunRow[]，供 internal 页筛选 job-step-v1。 |
| When to use | 需要在 internal 页面按 job-step-v1 筛选 agent run 记录，或查询控制面 agent run 列表时调用。 |
| How to use | 从 apps/web/src/services/agent-runtime 导入 listAgentRuns，await 调用后得到 Promise<AgentRunRow[]>，再用于页面渲染或筛选。 |
| Exports | listAgentRuns |
| Related | 暂无 |
| Tags | agent-runtime, listAgentRuns, AgentRunRow, job-step-v1, frontend, web |
| Source | scan |
| Path | apps/web/src/services/agent-runtime.ts |
| Updated | 2026-09-14T07:06:43.075Z |

## LIVE_API

| Field | Value |
|-------|-------|
| Summary | Prototype 阶段遗留的 mock 常量 LIVE_API（位于 mocks/index.ts）；已接线的 Walking Skeleton 页面通过 http.ts 直接使用 live /api，其余 shell 页面尚未读取该模块。 |
| When to use | 暂无（属遗留物，排查 shell 页面数据来源或清理 mock 残留时可参考）。 |
| How to use | 暂无 |
| Exports | LIVE_API |
| Related | http.ts |
| Tags | LIVE_API, mocks, http.ts, Walking Skeleton, frontend, web |
| Source | scan |
| Path | apps/web/src/mocks/index.ts |
| Updated | 2026-09-14T07:06:43.075Z |

## loadDemoNav

| Field | Value |
|-------|-------|
| Summary | loadDemoNav：加载用于导航链接（nav links）的 Demo ids，数据来自 /api/demo/reset 之后或首次列表加载的结果，并在 SPA navigation（单页应用路由切换）后保持不丢。 |
| When to use | 需要为导航栏构建携带 demo ids 的 nav links，且要求这些 ids 在调用 /api/demo/reset 或首次列表加载后仍然有效；需要保证 SPA navigation 后导航链接数据不丢失时使用。 |
| How to use | 在导航相关组件中直接调用 loadDemoNav()（无参数，返回 void），该函数位于 services/demo-session.ts，内部维护跨路由存活的 Demo ids 供 nav links 使用。 |
| Exports | loadDemoNav |
| Related | loadDict |
| Tags | loadDemoNav, demo ids, nav links, /api/demo/reset, SPA, SPA navigation, demo-session, frontend, TypeScript |
| Source | scan |
| Path | apps/web/src/services/demo-session.ts |
| Updated | 2026-09-14T07:07:33.884Z |

## loadDict

| Field | Value |
|-------|-------|
| Summary | loadDict：fetch 封装工具，按 dictType 拉取字典数据，走实时 /api/* 链路（Vite middleware → JobPipeline），返回 Promise<DictItem[]>。 |
| When to use | 前端页面需要从后端实时 /api/* 接口获取字典数据（DictItem 列表）时使用；适合走 Vite middleware → JobPipeline 真实链路而非 mock 的场景。 |
| How to use | 调用 loadDict(dictType) 传入字典类型字符串，await 返回的 Promise 得到 DictItem[] 数组；底层请求由 services/http.ts 的 fetch wrapper 发往 /api/*（Vite middleware → JobPipeline）。 |
| Exports | loadDict, DictItem |
| Related | mockNote, prettyJson |
| Tags | loadDict, dictType, DictItem, fetch, fetch wrapper, /api/*, Vite middleware, JobPipeline, http.ts, frontend |
| Source | scan |
| Path | apps/web/src/services/http.ts |
| Updated | 2026-09-14T07:07:33.884Z |

## mockNote

| Field | Value |
|-------|-------|
| Summary | mockNote：原型阶段遗留的 mock 函数，按 pageId 返回该页面的 mock 备注文本；已接线的 Walking Skeleton 页面已改用 http.ts 走实时 /api，其余 shell 页面目前也不读取 mocks/index.ts 该模块。 |
| When to use | 仅限调试尚未接线的 shell 页面或回顾原型阶段内容时使用；新代码应通过 http.ts 的 loadDict 调用实时 /api，而不是继续依赖此 mock 遗留物。 |
| How to use | 调用 mockNote(pageId) 传入页面标识，返回对应的 mock 备注字符串（mocks/index.ts）；注意已接线的 Walking Skeleton 页面应改走 http.ts 的实时 /api 链路。 |
| Exports | mockNote |
| Related | loadDict |
| Tags | mockNote, mock, pageId, prototype, Walking Skeleton, shell pages, http.ts, /api, mocks/index.ts, frontend |
| Source | scan |
| Path | apps/web/src/mocks/index.ts |
| Updated | 2026-09-14T07:07:33.885Z |

## prettyJson

| Field | Value |
|-------|-------|
| Summary | prettyJson：JSON 美化工具，将任意 value 格式化为可读字符串；所在 services/types.ts 同时定义 Walking Skeleton 视图使用的 API shapes，字段名与 ledger 的 snake_case 保持一致。 |
| When to use | 在 Walking Skeleton 视图中展示或调试 API 响应、需要格式化输出 JSON 时使用；需要与 ledger 数据的 snake_case 字段名保持一致的 API shapes 场景。 |
| How to use | 调用 prettyJson(value) 传入任意 unknown 值，返回美化后的 JSON 字符串；常配合 types.ts 中定义的 API shapes（snake_case 对齐 ledger）一起用于视图渲染或日志输出。 |
| Exports | prettyJson |
| Related | loadDict |
| Tags | prettyJson, JSON, Walking Skeleton, API shapes, snake_case, ledger, types.ts, frontend, TypeScript, API |
| Source | scan |
| Path | apps/web/src/services/types.ts |
| Updated | 2026-09-14T07:07:33.885Z |

## rememberDemoNav

| Field | Value |
|-------|-------|
| Summary | rememberDemoNav(partial: Partial<DemoNavIds>): void —— 在调用 /api/demo/reset 之后或首次获取列表时，保存用于导航链接（nav links）的 Demo ids（DemoNavIds），状态可跨 SPA 路由跳转保留（Survives SPA navigation）。 |
| When to use | 在 /api/demo/reset 完成或首次拿到 Demo 列表后，需要把导航 ids（DemoNavIds）写入本地会话、保证后续 SPA 跳转后导航链接仍可用时使用。 |
| How to use | 从 apps/web/src/services/demo-session.ts 导入 rememberDemoNav，传入 Partial<DemoNavIds> 类型的部分字段即可，无返回值（void）。与 resetDemo 搭配使用。 |
| Exports | rememberDemoNav(partial: Partial<DemoNavIds>): void |
| Related | resetDemo, DemoNavIds |
| Tags | TypeScript, util, rememberDemoNav, DemoNavIds, /api/demo/reset, SPA, demo-session, web |
| Source | scan |
| Path | apps/web/src/services/demo-session.ts |
| Updated | 2026-09-14T07:08:13.058Z |

## resetDemo

| Field | Value |
|-------|-------|
| Summary | resetDemo(): Promise<DemoResetResult> —— 调用 /api/demo/reset 重置 Demo 数据，返回 DemoResetResult；重置后或首次列表得到的导航 ids 通过 rememberDemoNav 记忆，可跨 SPA 路由跳转保留（Survives SPA navigation）。 |
| When to use | 需要将 Demo 环境重置为初始状态（调用 /api/demo/reset）并获取新的导航 ids 时使用。 |
| How to use | 从 apps/web/src/services/demo-session.ts 导入 resetDemo，以 Promise 方式调用并处理返回的 DemoResetResult；随后可调用 rememberDemoNav 保存新的 DemoNavIds。 |
| Exports | resetDemo(): Promise<DemoResetResult> |
| Related | rememberDemoNav, DemoResetResult |
| Tags | TypeScript, util, resetDemo, DemoResetResult, /api/demo/reset, SPA, demo-session, web |
| Source | scan |
| Path | apps/web/src/services/demo-session.ts |
| Updated | 2026-09-14T07:08:13.058Z |

## resumeAgentHitl

| Field | Value |
|-------|-------|
| Summary | 恢复指定 runId 的 agent HITL（human-in-the-loop，人工介入等待）执行：向 agent-runtime 提交 decision 决策使 run 继续运行。javadoc 提及控制面可见的 agent run 元数据，供 internal 页筛选 job-step-v1。 |
| When to use | 当某个 agent run 停在 HITL 人工审批节点、需要携带 token 提交 decision 恢复执行时；或在控制面 internal 页按 job-step-v1 筛选出待处理的 agent run 后调用。 |
| How to use | 从 apps/web/src/services/agent-runtime.ts 导入 resumeAgentHitl，传入 runId、token 与 decision（unknown 类型，按后端契约传 JSON），返回 Promise<void> 表示恢复动作已提交。 |
| Exports | resumeAgentHitl |
| Related | apps/web/src/services/agent-runtime.ts, web |
| Tags | resumeAgentHitl, HITL, agent-runtime, runId, token, decision, job-step-v1, agent run, web, TypeScript |
| Source | scan |
| Path | apps/web/src/services/agent-runtime.ts |
| Updated | 2026-09-14T07:09:01.420Z |

## router

| Field | Value |
|-------|-------|
| Summary | web 前端的路由实例（export const router），集中管理 apps/web 的页面路由与导航。位于 apps/web/src/router.ts，javadoc 暂无。 |
| When to use | 在应用入口注册路由、为新增视图添加 path 到组件的映射、或在组件外需要编程式导航（router.push / router.replace）时使用。 |
| How to use | 在入口处 import { router } 并挂载（app.use(router)）；新增页面时在 apps/web/src/router.ts 中注册路由记录。javadoc 暂无，具体路由表结构以源码为准。 |
| Exports | router |
| Related | apps/web/src/router.ts, web |
| Tags | router, Vue Router, 路由, router.ts, navigation, web |
| Source | scan |
| Path | apps/web/src/router.ts |
| Updated | 2026-09-14T07:09:01.420Z |

## saveExcelMappings

| Field | Value |
|-------|-------|
| Summary | 保存 Excel 单元格映射的 fetch 封装：按 templateId 提交 ExcelCellMappingWrite[]，返回 ExcelCellMappingView[]。javadoc：Fetch wrapper for live /api/*（Vite middleware → JobPipeline）。 |
| When to use | 在模板编辑流程中，需要把用户调整的 Excel 单元格映射（ExcelCellMappingWrite）通过 /api/* 持久化到后端 JobPipeline 时调用。 |
| How to use | 从 apps/web/src/services/http.ts 导入 saveExcelMappings，传入 templateId 与 mappings（ExcelCellMappingWrite[]），await 返回的 ExcelCellMappingView[] 以刷新界面；请求走 live /api/*（Vite middleware → JobPipeline）。 |
| Exports | saveExcelMappings |
| Related | apps/web/src/services/http.ts, JobPipeline, web |
| Tags | saveExcelMappings, ExcelCellMappingWrite, ExcelCellMappingView, templateId, /api/*, fetch, Vite middleware, JobPipeline, http.ts, web, TypeScript |
| Source | scan |
| Path | apps/web/src/services/http.ts |
| Updated | 2026-09-14T07:09:01.421Z |

## uploadDocumentArtifact

| Field | Value |
|-------|-------|
| Summary | services/http.ts 中的 fetch 封装工具：Fetch wrapper for live `/api/*`（Vite middleware → JobPipeline）。通过 uploadDocumentArtifact(projectId, artifactId) 将项目的文档 artifact 提交到后端 JobPipeline。 |
| When to use | 前端需要把 projectId + artifactId 对应的 document artifact 经 `/api/*` 提交至 JobPipeline 处理时使用 uploadDocumentArtifact。 |
| How to use | `import { uploadDocumentArtifact } from '.../services/http'`，调用 uploadDocumentArtifact(projectId: string, artifactId: string)，返回 Promise<...>；请求经由 Vite middleware 代理到线上 `/api/*`。 |
| Exports | uploadDocumentArtifact(projectId: string, artifactId: string): Promise<...> |
| Related | uploadExcelTemplate |
| Tags | TypeScript, fetch, http, uploadDocumentArtifact, JobPipeline, Vite, /api/*, artifact, projectId, document, artifactId |
| Source | scan |
| Path | apps/web/src/services/http.ts |
| Updated | 2026-09-14T07:09:51.958Z |

## uploadExcelTemplate

| Field | Value |
|-------|-------|
| Summary | services/http.ts 中的 fetch 封装工具：Fetch wrapper for live `/api/*`（Vite middleware → JobPipeline）。通过 uploadExcelTemplate(templateId, file, excelSheetName?) 上传 Excel 模板文件。 |
| When to use | 前端需要上传 Excel 模板文件（File 对象），并可选指定 excelSheetName，经 `/api/*` 提交到 JobPipeline 时使用 uploadExcelTemplate。 |
| How to use | `import { uploadExcelTemplate } from '.../services/http'`，调用 uploadExcelTemplate(templateId: string, file: File, excelSheetName?: string)，返回 Promise<...>；请求经由 Vite middleware 代理到线上 `/api/*`。 |
| Exports | uploadExcelTemplate(templateId: string, file: File, excelSheetName?: string): Promise<...> |
| Related | uploadDocumentArtifact |
| Tags | TypeScript, fetch, http, uploadExcelTemplate, Excel, excelSheetName, templateId, JobPipeline, Vite, /api/*, file upload |
| Source | scan |
| Path | apps/web/src/services/http.ts |
| Updated | 2026-09-14T07:09:51.958Z |

## uploadJob

| Field | Value |
|-------|-------|
| Summary | 封装 fetch 的 live `/api/*` 上传工具（http.ts）：请求经 Vite middleware 转发到后端 JobPipeline，用于上传 job 文件（`file: File` + 可选 `fields` 表单字段）。 |
| When to use | 前端需要向 `/api/*` 提交 job 上传（File 文件 + 附加 fields）、并依赖 Vite middleware 到 JobPipeline 的 live 链路时使用。 |
| How to use | `import { uploadJob } from '@/services/http'`，传入 `file: File` 与可选 `fields`；函数内部通过 fetch 调用 live `/api/*` 接口完成上传。 |
| Exports | uploadJob |
| Related | UploadToolbar |
| Tags | uploadJob, fetch, /api/*, Vite middleware, JobPipeline, http.ts, upload, TypeScript, frontend, web |
| Source | scan |
| Path | apps/web/src/services/http.ts |
| Updated | 2026-09-14T07:10:38.061Z |

## useAnnotateCanvas

| Field | Value |
|-------|-------|
| Summary | template_annotate 标注画布 composable：鼠标驱动的矩形绘制（mouse-driven rectangle drawing），为模板扩展维护 FieldBoxes（写入 `boxes: Ref<DraftBox[]>`）。 |
| When to use | 在 template_annotate 页面需要用鼠标在画布上拉框、以 `nextKey`/`nextType` 生成新的 FieldBox 并追加到 `DraftBox[]` 时使用。 |
| How to use | `import { useAnnotateCanvas }`，传入 `boxes: Ref<DraftBox[]>`、`nextKey: Ref<string>`、`nextType: Ref<string>` 与脏标记回调 `onDirty: () => void`；拖拽绘制矩形后新 box 按 nextKey/nextType 写入 boxes 并触发 onDirty。 |
| Exports | useAnnotateCanvas |
| Related | 暂无 |
| Tags | useAnnotateCanvas, template_annotate, DraftBox, FieldBoxes, onDirty, composable, annotation, Vue, TypeScript, frontend, web, nextKey, nextType |
| Source | scan |
| Path | apps/web/src/views/template_annotate/useAnnotateCanvas.ts |
| Updated | 2026-09-14T07:10:38.061Z |

## useProjectHome

| Field | Value |
|-------|-------|
| Summary | 项目首页（project_home）页面逻辑 composable：管理 projects 列表、packs 与 DocType 配置。 |
| When to use | 构建 project_home 首页，需要加载或操作 projects、packs 以及 DocType 配置时使用。 |
| How to use | `import { useProjectHome }` 并调用 `useProjectHome()`，获取项目首页所需的 projects、packs、DocType 配置相关状态与方法；具体返回字段见 `apps/web/src/views/project_home/useProjectHome.ts`。 |
| Exports | useProjectHome |
| Related | 暂无 |
| Tags | useProjectHome, project_home, projects, packs, DocType, composable, Vue, TypeScript, frontend, web |
| Source | scan |
| Path | apps/web/src/views/project_home/useProjectHome.ts |
| Updated | 2026-09-14T07:10:38.061Z |

## RetrieveHitView

| Field | Value |
|-------|-------|
| Summary | RetrieveHitView（检索命中视图）类型定义：位于 apps/web/src/services/types.ts，用于描述前端展示检索命中结果（retrieval hit）的视图层数据结构。源码暂无 javadoc 与 signatures，具体字段与导出形式以 RetrieveHitView 源码为准。 |
| When to use | 当 web 前端组件需要以类型安全的方式消费或渲染检索命中视图数据时使用，例如在组件 props、状态声明或 services 层 API 响应解析中引用 RetrieveHitView 类型。 |
| How to use | 在 apps/web/src 下通过 import 导入 RetrieveHitView 类型用于标注视图数据结构（导入路径以项目 alias 配置为准）；使用前请查阅 apps/web/src/services/types.ts 中的 RetrieveHitView 定义确认字段。暂无更多使用示例。 |
| Exports | RetrieveHitView |
| Related | 暂无 |
| Tags | RetrieveHitView, TypeScript, types, services, web, frontend, 检索命中视图, 类型定义, retrieval hit |
| Source | refresh |
| Path | apps/web/src/services/types.ts |
| Updated | 2026-09-15T09:40:24.307Z |
