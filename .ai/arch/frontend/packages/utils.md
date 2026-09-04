# Utils

_No utils discovered._

## memory

| Field | Value |
|-------|-------|
| Summary | core-engine 包中 blob 模块的内存（memory）实现，位于 packages/core-engine/src/blob/memory.ts，提供基于内存的 blob 存储/读写能力，不依赖磁盘或远程存储介质。 |
| When to use | 在单元测试、示例代码或临时运行场景中需要 blob 存储但不希望引入持久化依赖时使用；也可作为 blob 存储接口在 core-engine 内的最小可用内存实现进行开发调试。 |
| How to use | 从 packages/core-engine/src/blob/memory.ts 导入 memory 相关导出（当前扫描未捕获具体 signatures，具体导出符号以源码为准），实例化内存 blob 存储后按 blob 通用接口进行读写；生产环境需要持久化时请替换为其他 blob 实现。javadoc 暂无。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | memory, blob, core-engine, packages, in-memory, TypeScript, util |
| Source | refresh |
| Path | packages/core-engine/src/blob/memory.ts |
| Updated | 2026-08-28T22:10:10.492Z |

## minio

| Field | Value |
|-------|-------|
| Summary | core-engine 包中 blob（二进制大对象）存储模块的 minio 工具，封装与 MinIO / S3 兼容对象存储的交互能力（如 bucket 管理、对象上传下载、presigned URL 预签名链接）。扫描未捕获到 javadoc 与函数签名（暂无），具体能力以源码为准。 |
| When to use | 当 core-engine 需要访问对象存储时使用，例如：blob 文件的上传、下载、删除，管理 bucket，或为前端生成 presigned URL 临时访问链接。场景涉及 minio 客户端初始化与 blob 存取时优先复用本工具。 |
| How to use | 源码位于 packages/core-engine/src/blob/minio.ts，直接从该文件导入 minio 相关工具使用。通常需要提供 MinIO / S3 兼容存储的连接配置（endpoint、accessKey、secretKey、bucket 等）。实际导出签名暂无扫描结果（exports 为空），建议阅读源文件确认后再调用。 |
| Exports | 暂无 |
| Related | blob |
| Tags | minio, blob, core-engine, object-storage, S3, bucket, presigned-url |
| Source | refresh |
| Path | packages/core-engine/src/blob/minio.ts |
| Updated | 2026-08-28T22:10:25.681Z |

## port

| Field | Value |
|-------|-------|
| Summary | core-engine 包 OCR 模块的 port（端口）定义，位于 packages/core-engine/src/ocr/port.ts。该文件遵循 port/adapter（端口/适配器，六边形架构）模式，用于声明 OCR 能力的抽象接口契约，具体 OCR 引擎实现由 adapter 层提供并注入到 core-engine。 |
| When to use | 当需要在 core-engine 中接入、替换或 mock OCR 引擎实现，或要为 OCR 能力编写新的 adapter（适配器）实现时，先查阅本 port 定义以确认接口契约。也适用于梳理 OCR 相关依赖注入关系的场景。 |
| How to use | 从 packages/core-engine/src/ocr/port.ts 导入 port 定义的接口/类型，在 adapter 中实现该接口，并通过依赖注入方式向 core-engine 提供 OCR 能力。注意：本卡片暂无公开签名信息（signatures 为空），具体导出内容请直接查看源文件确认。 |
| Exports | 暂无 |
| Related | core-engine, ocr |
| Tags | core-engine, ocr, port, adapter, typescript, frontend, 六边形架构, 依赖注入, 接口契约 |
| Source | refresh |
| Path | packages/core-engine/src/ocr/port.ts |
| Updated | 2026-08-28T22:12:49.420Z |

## ocr-fields

| Field | Value |
|-------|-------|
| Summary | OCR 字段提取工具（ocr-fields），位于 packages/core-engine/src/extract/ocr-fields.ts，属于 core-engine 的 extract（抽取）子模块，用于处理 OCR 识别结果中的字段（ocr fields）抽取逻辑。暂无详细签名信息。 |
| When to use | 当在 core-engine 引擎流水线中需要对 OCR 识别输出进行字段（fields）提取、整理或转换时使用；涉及 packages 内 extract 流程的字段处理场景可复用本工具。 |
| How to use | 从 packages/core-engine/src/extract/ocr-fields.ts 导入对应导出（具体导出签名暂无），在 core-engine 的 extract 流水线中调用以处理 OCR 字段数据。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | ocr, ocr-fields, fields, extract, core-engine, packages, util, OCR字段提取, frontend |
| Source | refresh |
| Path | packages/core-engine/src/extract/ocr-fields.ts |
| Updated | 2026-08-28T22:10:49.617Z |

## handle-request

| Field | Value |
|-------|-------|
| Summary | core-engine 包 http 模块下的 HTTP 请求处理工具（handle-request），位于 packages/core-engine/src/http/handle-request.ts，用于统一封装 HTTP 请求的发起、响应处理与错误处理流程。 |
| When to use | 当业务代码需要通过 core-engine 发起 HTTP 请求、复用统一的请求/响应封装或集中处理请求异常时，使用 handle-request；避免在调用方散落重复的请求样板代码。 |
| How to use | 从 packages/core-engine/src/http/handle-request.ts 导入 handle-request 相关导出（预计导出名为 handleRequest），传入请求配置（URL、method、headers、body 等）调用并消费其返回的响应或错误。具体函数签名暂无，使用前建议先查看源码确认入参出参。 |
| Exports | handleRequest |
| Related | core-engine, http |
| Tags | frontend, packages, core-engine, http, handle-request, handleRequest, HTTP, util |
| Source | refresh |
| Path | packages/core-engine/src/http/handle-request.ts |
| Updated | 2026-08-29T15:55:50.807Z |

## node

| Field | Value |
|-------|-------|
| Summary | core-engine 包中 http 模块的 Node.js 运行时 HTTP 适配工具（packages/core-engine/src/http/node.ts），为 Node 环境提供 HTTP 请求/传输能力的封装。具体导出符号暂无（扫描未捕获 signatures）。 |
| When to use | 当项目运行在 Node.js 环境、需要通过 core-engine 发起或处理 HTTP 请求时使用本模块；浏览器等其他运行时应改用 http 目录下对应的非 node 实现。 |
| How to use | 从 packages/core-engine/src/http/node.ts 导入所需工具（具体导出 API 暂无，建议先阅读源码确认接口签名），在 Node 运行时中调用其 HTTP 能力，作为 core-engine 的 node 侧 http 适配层接入。 |
| Exports | 暂无 |
| Related | core-engine, http |
| Tags | util, node, http, core-engine, Node.js, TypeScript, http adapter |
| Source | refresh |
| Path | packages/core-engine/src/http/node.ts |
| Updated | 2026-08-28T22:11:18.003Z |

## session

| Field | Value |
|-------|-------|
| Summary | core-engine 中位于 src/http 目录的 session（会话）工具模块，用于维护 HTTP 请求的会话状态（如 cookie、token 登录态）。本次扫描未提取到 javadoc 与公开签名，具体导出 API 暂无。 |
| When to use | 在 core-engine 内发起 HTTP 请求需要统一携带或读取 session（会话）、cookie、token 登录态时使用；由于签名信息缺失，具体触发场景暂无，建议直接查看源文件确认。 |
| How to use | 从 packages/core-engine/src/http/session 引入所需导出（具体导出项暂无签名信息），建议直接阅读 packages/core-engine/src/http/session.ts 源码确认导出函数与调用方式。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | session, http, core-engine, cookie, token, auth, util |
| Source | refresh |
| Path | packages/core-engine/src/http/session.ts |
| Updated | 2026-08-29T15:56:10.223Z |

## index

| Field | Value |
|-------|-------|
| Summary | packages/core-engine 的包入口 barrel 文件（packages/core-engine/src/index.ts），统一汇聚并再导出 core-engine 的公开 API，是外部消费 core-engine 引擎核心能力的唯一导出点。当前扫描未捕获到具体 export 语句（signatures 为空），实际导出清单以源码为准。 |
| When to use | 当应用或其他子包需要引用 core-engine 提供的引擎逻辑、类型定义或工具函数时，应从该入口导入，而不是深入 src 内部深层路径；在 core-engine 中新增公开能力时，也需在此 index.ts 登记导出以对外暴露。 |
| How to use | 在 monorepo 内通过包名或内部别名导入，例如：import { ... } from 'core-engine'（或 @scope/core-engine，取决于 workspace 配置）。因扫描阶段未提取到具体导出符号，请直接查看 packages/core-engine/src/index.ts 中的 export / export * from 语句确认可用成员。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | frontend, packages, core-engine, index.ts, barrel, entry, re-export, TypeScript, monorepo |
| Source | refresh |
| Path | packages/core-engine/src/index.ts |
| Updated | 2026-08-29T15:56:35.648Z |

## baidu

| Field | Value |
|-------|-------|
| Summary | baidu OCR（百度光学字符识别）工具模块，位于 core-engine 包（packages/core-engine/src/ocr/baidu.ts），封装百度 OCR 文字识别相关工具能力。具体导出签名暂无（signatures 为空），请以源文件为准。 |
| When to use | 当需要在 frontend 的 core-engine 引擎中使用 baidu OCR 对图片进行文字识别时使用本模块；若需接入其他 OCR 供应商或通用 OCR 抽象层，应先查看 core-engine/src/ocr 目录下的其他实现。 |
| How to use | 从 core-engine 的 ocr/baidu 模块（packages/core-engine/src/ocr/baidu.ts）导入工具函数，传入待识别图片数据及 baidu OCR 所需的配置/凭证后调用识别能力；具体导出 API 与参数签名暂无，请直接阅读源文件确认。 |
| Exports | 暂无 |
| Related | core-engine, ocr |
| Tags | baidu, ocr, OCR, core-engine, packages, util, frontend, 光学字符识别, 文字识别 |
| Source | refresh |
| Path | packages/core-engine/src/ocr/baidu.ts |
| Updated | 2026-08-28T22:12:03.793Z |

## env

| Field | Value |
|-------|-------|
| Summary | core-engine 中 ocr 模块的环境工具（env），位于 packages/core-engine/src/ocr/env.ts，用于 ocr 运行环境探测与环境变量读取。具体导出签名信息暂无（无 javadoc 与 signatures）。 |
| When to use | 在 packages/core-engine 内需要判断或获取 ocr 运行环境（如运行平台、环境变量、环境开关）时，使用该 env 工具；其他模块需要复用 ocr 环境判断逻辑时也可引用。 |
| How to use | 从 packages/core-engine/src/ocr/env.ts 导入 env 模块的导出成员使用；当前暂无函数签名与 javadoc，建议直接阅读源文件确认可用导出与调用方式。 |
| Exports | 暂无 |
| Related | core-engine, ocr |
| Tags | env, ocr, core-engine, packages, util, environment, typescript, 环境探测 |
| Source | refresh |
| Path | packages/core-engine/src/ocr/env.ts |
| Updated | 2026-08-28T22:12:25.754Z |

## fake

| Field | Value |
|-------|-------|
| Summary | packages/core-engine 中 ocr 目录下的 fake（伪造/模拟）OCR 实现，用于在没有真实 OCR 引擎时提供模拟数据或桩（stub）输出。原始 javadoc 与签名信息暂无。 |
| When to use | 在 core-engine 内调试 OCR 相关流程但不想接入真实 OCR 服务时使用，例如编写单元测试、演示 demo、离线开发或模拟 OCR 识别结果。 |
| How to use | 从 packages/core-engine/src/ocr/fake.ts 导入 fake OCR 实现并注入到依赖 OCR 的调用处，替代真实 OCR 引擎获取模拟结果；具体导出符号暂无签名信息，请直接查看源文件确认。 |
| Exports | 暂无 |
| Related | ocr |
| Tags | ocr, fake, core-engine, packages, mock, stub, OCR, testing, typescript |
| Source | refresh |
| Path | packages/core-engine/src/ocr/fake.ts |
| Updated | 2026-08-28T22:12:34.982Z |

## job-pipeline

| Field | Value |
|-------|-------|
| Summary | 位于 packages/core-engine/src/pipeline/job-pipeline.ts 的工具模块（util），承担 core-engine 内 job-pipeline（作业流水线）相关的编排处理逻辑；本资产的 javadoc 与 signatures 暂无，具体导出 API 待补充。 |
| When to use | 当需要在 core-engine 中组织、串联或调度 job（作业）处理流程，或检索 pipeline / job-pipeline 相关实现时使用；具体适用场景说明暂无。 |
| How to use | 从 packages/core-engine/src/pipeline/job-pipeline.ts 模块导入使用；由于 signatures 为空，详细调用方式与参数说明暂无，建议先阅读 job-pipeline 源码确认导出内容后再集成。 |
| Exports | 暂无 |
| Related | core-engine |
| Tags | TypeScript, frontend, util, job-pipeline, core-engine, pipeline, packages |
| Source | refresh |
| Path | packages/core-engine/src/pipeline/job-pipeline.ts |
| Updated | 2026-08-29T08:50:05.520Z |

## agent-runtime-factory

| Field | Value |
|-------|-------|
| Summary | 位于 packages/core-engine/src/agent/agent-runtime-factory.ts 的 util 模块，即 agent-runtime-factory（Agent 运行时工厂），用于创建/装配 core-engine 中的 Agent Runtime 实例。代码扫描未提取到 signatures 与 javadoc，具体导出 API 暂无。 |
| When to use | 当需要在 core-engine 内统一创建或初始化 Agent Runtime 实例、避免在各处手工拼装 Agent 运行时依赖时，引用 agent-runtime-factory。具体业务触发场景说明暂无。 |
| How to use | 在 TypeScript 前端代码中从 packages/core-engine 的 agent/agent-runtime-factory 模块导入并调用其工厂方法生成 Agent Runtime 实例；由于 signatures 暂无，入参、返回值请以 agent-runtime-factory.ts 源码实际导出为准。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | agent-runtime-factory, AgentRuntimeFactory, core-engine, agent, runtime, factory, util, TypeScript, frontend, packages |
| Source | refresh |
| Path | packages/core-engine/src/agent/agent-runtime-factory.ts |
| Updated | 2026-08-29T03:14:58.430Z |

## job-step-orchestrator

| Field | Value |
|-------|-------|
| Summary | core-engine 中 agent 模块的任务步骤编排工具 job-step-orchestrator，位于 packages/core-engine/src/agent/job-step-orchestrator.ts，用于将 agent 任务拆分为多个 step 并按序调度编排执行。暂无 javadoc 详细说明。 |
| When to use | 当需要在 core-engine 内对 agent 任务进行多步骤（step）编排与调度，例如步骤顺序执行、步骤间状态传递、任务流程控制时，使用本工具。 |
| How to use | 从 packages/core-engine/src/agent/job-step-orchestrator.ts 导入 job-step-orchestrator 的编排能力，将任务步骤注册或传入编排器后交由其调度执行。当前暂无导出签名（signatures）信息，具体 API 参数请直接查阅源码。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | frontend, TypeScript, core-engine, agent, job-step-orchestrator, orchestrator, step, task-scheduling, packages |
| Source | refresh |
| Path | packages/core-engine/src/agent/job-step-orchestrator.ts |
| Updated | 2026-08-29T03:14:53.174Z |

## step-chat-bridge

| Field | Value |
|-------|-------|
| Summary | packages/core-engine 中 agent 模块下的桥接工具，用于连接 step（步骤执行）与 chat（聊天会话）两侧，在 agent 的 step 流程和 chat 交互之间转发消息、事件或产物。具体导出符号与实现细节暂无（javadoc 与 signatures 均为空）。 |
| When to use | 当需要在 core-engine 的 agent 执行链路中打通 step 步骤与 chat 会话（例如将 step 执行结果投递到 chat、或将 chat 输入驱动 step 流转）时使用；具体适用场景文档暂无，需结合源码确认。 |
| How to use | 从 packages/core-engine/src/agent/step-chat-bridge.ts 导入使用；因 signatures 为空，具体导出的类/函数名暂无，接入前建议直接阅读该文件确认桥接接口与调用约定。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | step-chat-bridge, core-engine, agent, step, chat, bridge, util, packages, frontend, typescript |
| Source | refresh |
| Path | packages/core-engine/src/agent/step-chat-bridge.ts |
| Updated | 2026-08-29T03:14:49.163Z |

## tools

| Field | Value |
|-------|-------|
| Summary | core-engine 中 agent 的工具集定义模块，位于 packages/core-engine/src/agent/tools.ts，集中声明 agent 可调用的 tools（工具）。javadoc 暂无，signatures 为空，更多细节暂无。 |
| When to use | 当需要在 agent 中注册、扩展或复用 tools（工具）能力，或在 packages/core-engine 中定位 agent 工具定义入口时使用本资产。 |
| How to use | 从 packages/core-engine/src/agent/tools.ts 导入所需 tools 定义并注册到 agent 运行时；具体导出签名暂无（signatures 为空），建议直接查阅源文件确认可用的工具导出。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | TypeScript, agent, tools, core-engine, packages, util |
| Source | refresh |
| Path | packages/core-engine/src/agent/tools.ts |
| Updated | 2026-08-29T02:11:55.648Z |

## review

| Field | Value |
|-------|-------|
| Summary | core-engine 包流水线（pipeline）中的 review 审查步骤工具，源码位于 packages/core-engine/src/pipeline/review.ts，用于在 pipeline 执行流程中承载 review（审查）环节的处理逻辑。具体导出签名信息暂无。 |
| When to use | 当需要在 core-engine 的 pipeline 流程中插入或调用 review 审查环节，或需要定位 pipeline/review.ts 的实现时使用本卡片。具体触发条件与前置依赖暂无。 |
| How to use | 通过导入 packages/core-engine/src/pipeline/review.ts 使用（具体导出项暂无），通常作为 pipeline 的一个步骤与上下游 stage 组合调用。详细调用示例暂无。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | TypeScript, core-engine, pipeline, review, review.ts, util, packages |
| Source | refresh |
| Path | packages/core-engine/src/pipeline/review.ts |
| Updated | 2026-08-29T02:11:57.570Z |

## effective-boxes

| Field | Value |
|-------|-------|
| Summary | core-engine 中 extract 阶段的工具模块（源文件：packages/core-engine/src/extract/effective-boxes.ts），用于计算/提取 effective boxes（有效盒，即有效边界区域）。javadoc 与函数签名信息暂无。 |
| When to use | 当在 core-engine 的 extract 流程中需要获取或计算 effective boxes（有效盒/有效边界区域）时使用；涉及布局、渲染或区域提取相关逻辑时可优先查阅本模块。 |
| How to use | 从 packages/core-engine/src/extract/effective-boxes.ts 按需导入。具体导出签名暂无，请直接查看该源文件确认可用的导出函数/常量后再调用。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | effective-boxes, core-engine, extract, frontend, util, boxes |
| Source | refresh |
| Path | packages/core-engine/src/extract/effective-boxes.ts |
| Updated | 2026-08-29T08:47:43.748Z |

## ledger

| Field | Value |
|-------|-------|
| Summary | core-engine 引擎包持久化层（persistence）下的 ledger（账本）工具模块，源码位于 packages/core-engine/src/persistence/ledger.ts，承担 ledger 账本数据的持久化处理职责；模块暂无 javadoc 与 signatures，具体导出接口暂无。 |
| When to use | 在 core-engine 中需要对 ledger（账本）数据进行持久化读写或维护时使用；由于该模块暂无 javadoc 说明，建议结合 persistence 目录下的其他模块共同判断适用场景。 |
| How to use | 从 packages/core-engine/src/persistence/ledger.ts 引入该工具模块；因未提供 signatures，导出的 API 暂无记录，使用前请直接阅读源码确认可用的 ledger 相关函数或类型。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | ledger, persistence, core-engine, packages, util, TypeScript, 账本, 持久化 |
| Source | refresh |
| Path | packages/core-engine/src/persistence/ledger.ts |
| Updated | 2026-08-29T15:57:10.352Z |

## migrate

| Field | Value |
|-------|-------|
| Summary | core-engine 的 persistence（持久化）层数据迁移工具，位于 packages/core-engine/src/persistence/migrate.ts，提供 migrate（迁移）能力，用于处理持久化数据的结构或版本迁移。当前扫描未捕获 Javadoc 与函数签名，具体行为以源码为准。 |
| When to use | 当需要为 core-engine 的 persistence（持久化）层执行 migrate（数据迁移）、升级持久化数据结构或版本时使用本工具；因缺少 Javadoc 与签名信息，具体适用场景建议结合 packages/core-engine/src/persistence/migrate.ts 源码确认。 |
| How to use | 从 packages/core-engine/src/persistence/migrate.ts 导入 migrate 相关导出并调用；signatures 为空，入参与返回值请直接查阅源码确认，待补充签名信息后可更新本卡片。 |
| Exports | migrate |
| Related | 暂无 |
| Tags | frontend, core-engine, persistence, migrate, 数据迁移, util, packages |
| Source | refresh |
| Path | packages/core-engine/src/persistence/migrate.ts |
| Updated | 2026-08-29T15:57:38.793Z |

## pg-store

| Field | Value |
|-------|-------|
| Summary | pg-store 是 core-engine 包 persistence 层的持久化存储工具，基于 pg（PostgreSQL）实现数据库读写与状态落盘。 |
| When to use | 当 core-engine 需要将运行状态、任务数据持久化到 PostgreSQL（pg）数据库，或需要统一的数据存储层时使用 pg-store。 |
| How to use | 在 packages/core-engine 中从 persistence/pg-store 引入该模块，通过其 pg（PostgreSQL）连接执行读写；具体导出 API 暂无（signatures 为空），建议直接阅读 packages/core-engine/src/persistence/pg-store.ts 源码确认调用方式。 |
| Exports | 暂无 |
| Related | core-engine |
| Tags | pg-store, pg, PostgreSQL, persistence, core-engine, 存储层, util |
| Source | refresh |
| Path | packages/core-engine/src/persistence/pg-store.ts |
| Updated | 2026-08-29T15:58:36.661Z |

## store

| Field | Value |
|-------|-------|
| Summary | core-engine 的持久化 store 工具，位于 packages/core-engine/src/persistence/store.ts，负责引擎数据的持久化（persistence）存取。具体导出的方法与类签名信息暂无。 |
| When to use | 当在 core-engine（packages）中需要保存、恢复或读写持久化状态（persistence store），例如将引擎状态落盘存储或从存储中还原数据时使用本工具。 |
| How to use | 从 packages/core-engine/src/persistence/store.ts 导入 store 相关导出并调用其持久化读写接口；由于本资产暂无可用签名信息，具体 API 用法请直接查阅 store.ts 源文件确认。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | TypeScript, util, store, persistence, core-engine, packages |
| Source | refresh |
| Path | packages/core-engine/src/persistence/store.ts |
| Updated | 2026-08-29T15:59:03.984Z |

## seed

| Field | Value |
|-------|-------|
| Summary | core-engine 流水线（pipeline）中的 seed 工具模块，位于 packages/core-engine/src/pipeline/seed.ts，用于生成种子数据或初始化 pipeline 状态；模块 javadoc 与公开签名信息暂无。 |
| When to use | 当需要在 core-engine 的 pipeline 阶段进行种子数据初始化、构造初始状态或复用统一 seed 入口时使用；具体适用场景暂无注释说明。 |
| How to use | 从 packages/core-engine/src/pipeline/seed.ts 导入使用；该模块暂无公开签名（signatures）与 javadoc，建议直接阅读 seed.ts 源码确认导出形式与调用方式。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | seed, core-engine, pipeline, TypeScript, util, seed.ts, 种子数据, 初始化 |
| Source | refresh |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-08-29T15:59:35.292Z |

## types

| Field | Value |
|-------|-------|
| Summary | packages/core-engine 的 TypeScript 类型定义模块（src/types.ts），集中声明核心引擎（core-engine）的公共类型、接口与类型别名，供引擎内部及跨包引用。具体导出签名暂无扫描信息。 |
| When to use | 在开发或修改 packages/core-engine 相关功能、需要为变量/函数参数/返回值标注 core-engine 类型时使用；其他包（如 frontend 应用）需要复用 core-engine 的类型定义而非运行时逻辑时，也应从本模块导入。 |
| How to use | 通过 `import type { ... } from` 相对路径（如 `../types`）或 core-engine 包入口导入所需类型；具体可导入的导出项暂无签名信息，请直接查看 packages/core-engine/src/types.ts 源文件确认实际导出内容。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | TypeScript, types, core-engine, 类型定义, packages, frontend, type-definitions |
| Source | refresh |
| Path | packages/core-engine/src/types.ts |
| Updated | 2026-08-29T15:59:58.082Z |

## document-pipeline

| Field | Value |
|-------|-------|
| Summary | core-engine 中的 document-pipeline（文档流水线）工具，位于 packages/core-engine/src/pipeline/document-pipeline.ts，用于对文档数据执行 pipeline 式流转处理。具体导出 API 与实现细节暂无。 |
| When to use | 当在 packages/core-engine 内需要对文档（document）执行分阶段流水线（pipeline）处理时使用本资产；具体触发场景暂无。 |
| How to use | 从 packages/core-engine/src/pipeline/document-pipeline.ts 引入 document-pipeline 并接入文档处理链路（具体导出签名暂无，可参考同目录 pipeline 相关模块组合使用）。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | document-pipeline, pipeline, core-engine, packages, frontend, util, document |
| Source | refresh |
| Path | packages/core-engine/src/pipeline/document-pipeline.ts |
| Updated | 2026-08-29T15:59:18.382Z |

## fill-service

| Field | Value |
|-------|-------|
| Summary | core-engine 包内的 Excel 填充服务（fill-service），位于 packages/core-engine/src/excel/fill-service.ts，用于处理 Excel 数据/单元格填充相关逻辑。候选未提供 signatures 与 javadoc，具体导出 API 暂无。 |
| When to use | 前端需要生成或填充 Excel 内容（如报表导出、模板数据填充、单元格写入）且项目依赖 core-engine 包时使用本服务。 |
| How to use | 暂无具体调用示例（候选 signatures 为空）；一般可从 packages/core-engine/src/excel/fill-service 模块导入 fill-service 相关函数使用。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | TypeScript, frontend, packages, core-engine, excel, fill, fill-service |
| Source | refresh |
| Path | packages/core-engine/src/excel/fill-service.ts |
| Updated | 2026-08-29T15:55:24.550Z |

## effective-mappings

| Field | Value |
|-------|-------|
| Summary | core-engine 中 excel 模块下的映射工具，用于计算 effective-mappings（最终生效的 Excel 列/字段映射），一般在默认映射与自定义覆盖配置合并后得出实际生效结果。源码位于 packages/core-engine/src/excel/effective-mappings.ts。 |
| When to use | 在 Excel 导入/导出流程中需要确定最终生效的列映射（effective-mappings）时使用，例如：合并默认列映射与用户覆盖配置、为 core-engine 的 excel 处理链路提供实际生效的字段映射等场景。 |
| How to use | 从 packages/core-engine/src/excel/effective-mappings.ts 导入 effective-mappings 相关函数，传入原始映射与覆盖配置，获取合并后最终生效的映射结果。该候选的 signatures 与 javadoc 暂无（扫描未捕获导出签名），使用前请查阅源码确认具体导出函数名与参数。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | TypeScript, frontend, excel, effective-mappings, core-engine, mapping, util |
| Source | refresh |
| Path | packages/core-engine/src/excel/effective-mappings.ts |
| Updated | 2026-08-29T15:54:56.901Z |

## pg-migrate

| Field | Value |
|-------|-------|
| Summary | core-engine 包 persistence（持久层）目录下的 PostgreSQL 数据库迁移工具（pg-migrate），用于管理数据库 schema 的版本迁移与升级，文件位于 packages/core-engine/src/persistence/pg-migrate.ts。 |
| When to use | 当 core-engine 需要对 PostgreSQL 执行数据库迁移（migration）、初始化表结构或随版本发布升级 schema 时使用；适合服务启动时自动执行 migrate 或部署流程中调用。 |
| How to use | 从 packages/core-engine/src/persistence/pg-migrate.ts 引入（具体导出签名暂无，signatures 为空）；通常在启动脚本或部署钩子中调用迁移入口，建立 PostgreSQL 连接后执行迁移（up/down），建议与 core-engine 的 persistence 层其他模块配合使用。 |
| Exports | 暂无 |
| Related | core-engine, persistence |
| Tags | pg-migrate, PostgreSQL, pg, migration, migrate, persistence, core-engine, database, sql, util |
| Source | refresh |
| Path | packages/core-engine/src/persistence/pg-migrate.ts |
| Updated | 2026-08-29T15:58:07.242Z |

## mock

| Field | Value |
|-------|-------|
| Summary | core-engine 的 mock（模拟）适配器，位于 packages/core-engine/src/adapter/mock.ts，用于在没有真实依赖的情况下为引擎提供可用的 mock adapter 行为，便于测试与本地联调。 |
| When to use | 当需要为 core-engine 提供 mock 数据源或模拟 adapter（适配器）实现时使用，例如单元测试、本地开发环境或尚无真实后端服务的场景。 |
| How to use | 从 packages/core-engine/src/adapter/mock.ts 导入该 mock 适配器，并将其作为 adapter 注入 core-engine。暂无更多 API 细节。 |
| Exports | 暂无 |
| Related | core-engine, adapter |
| Tags | mock, adapter, core-engine, packages, util, testing |
| Source | refresh |
| Path | packages/core-engine/src/adapter/mock.ts |
| Updated | 2026-08-29T15:54:34.375Z |













