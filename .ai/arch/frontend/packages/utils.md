# Utils

_No utils discovered._

## index

| Field | Value |
|-------|-------|
| Summary | agent-runtime 包的入口文件（index.ts），位于 packages/agent-runtime/src/index.ts，通常负责聚合导出该包的公共 API。javadoc 暂无，signatures 暂无，具体导出成员暂无。 |
| When to use | 当代码需要引入 agent-runtime 包的对外能力时，通常经由该入口文件导入；具体适用场景暂无。 |
| How to use | 通过包名 agent-runtime import 该入口导出的成员；由于 signatures 暂无，具体导入方式与导出列表暂无。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | agent-runtime, index.ts, packages, TypeScript, runtime, 入口, frontend |
| Source | refresh |
| Path | packages/agent-runtime/src/index.ts |
| Updated | 2026-09-17T02:58:27.514Z |

## initDefaultLlmProvider

| Field | Value |
|-------|-------|
| Summary | initDefaultLlmProvider 是 packages/agent-runtime/src/llm/provider.ts 中的工具函数（util），用于初始化默认的 LLM（大语言模型）provider。该函数位于 agent-runtime 的 llm 模块内，负责在运行时建立默认模型提供方，供 agent 调用链路使用。由于 javadoc 与 signatures 暂缺，具体参数与返回值暂无。 |
| When to use | 当 agent-runtime 需要一个默认的 LLM provider（模型提供方）且调用方未显式指定 provider 时使用；适用于 llm 初始化阶段或需要兜底默认模型的场景。具体触发条件详情暂无。 |
| How to use | 从 packages/agent-runtime/src/llm/provider.ts 导入 initDefaultLlmProvider 后调用以获得默认 LLM provider 实例。由于 signatures 为空，具体入参、返回值与配置键暂无，建议直接查看源文件 packages/agent-runtime/src/llm/provider.ts 获取准确签名与用法。 |
| Exports | initDefaultLlmProvider |
| Related | 暂无 |
| Tags | initDefaultLlmProvider, agent-runtime, LLM, llm, provider, util, packages |
| Source | refresh |
| Path | packages/agent-runtime/src/llm/provider.ts |
| Updated | 2026-09-17T02:59:09.395Z |

## createLlmProvider

| Field | Value |
|-------|-------|
| Summary | packages/agent-runtime 中的 LLM provider 工厂函数 createLlmProvider，位于 packages/agent-runtime/src/llm/provider.ts，用于创建大语言模型（LLM）provider 实例，供 agent runtime 的调用链路统一接入 LLM 能力。 |
| When to use | 当 agent-runtime 模块需要接入大语言模型（LLM）并获取统一封装的 provider 实例时使用，例如为 agent 执行链路注入 LLM provider；具体函数签名暂无。 |
| How to use | 从 packages/agent-runtime/src/llm/provider.ts 导入 createLlmProvider，传入相应配置后调用以创建 LLM provider 实例，再交给 agent runtime 使用（详细入参说明暂无）。 |
| Exports | createLlmProvider |
| Related | 暂无 |
| Tags | createLlmProvider, LLM, provider, agent-runtime, factory, packages, provider.ts, TypeScript |
| Source | refresh |
| Path | packages/agent-runtime/src/llm/provider.ts |
| Updated | 2026-09-17T04:24:17.236Z |

## UnconfiguredLlmProvider

| Field | Value |
|-------|-------|
| Summary | packages/agent-runtime 中 LLM provider 的未配置占位实现（从命名与所在模块 llm/provider.ts 推断）：UnconfiguredLlmProvider（未配置 LLM Provider 的哨兵/兜底对象），当 LLM provider 缺少配置（如 API Key、模型名、provider 配置键）时替代真实 provider，在调用时显式抛出「LLM provider 未配置」错误，避免静默失败。 |
| When to use | 在 provider 工厂或初始化逻辑中检测到 LLM 配置缺失时，返回 UnconfiguredLlmProvider 作为默认 provider；或需要在调用 LLM 前快速失败并给出明确错误提示、而非静默降级时使用。 |
| How to use | 从 packages/agent-runtime/src/llm/provider.ts 导入 UnconfiguredLlmProvider，在 provider 选择/工厂函数中当配置校验失败时实例化并返回给上层调用方；具体构造参数与方法签名暂无，参见源码。 |
| Exports | UnconfiguredLlmProvider |
| Related | 暂无 |
| Tags | UnconfiguredLlmProvider, LLM, provider, llm-provider, agent-runtime, TypeScript, fallback, 哨兵对象, 未配置兜底 |
| Source | refresh |
| Path | packages/agent-runtime/src/llm/provider.ts |
| Updated | 2026-09-17T02:59:28.647Z |

## loadLlmRuntimeConfig

| Field | Value |
|-------|-------|
| Summary | 位于 packages/agent-runtime/src/llm/config.ts 的工具函数 loadLlmRuntimeConfig，用于加载 LLM 运行时配置（LlmRuntimeConfig），是 agent-runtime 包中 LLM 配置读取的入口 util。javadoc 暂无。 |
| When to use | 在 agent-runtime 中需要初始化或读取 LLM 运行时配置时使用；例如在调用 LLM 前，通过 loadLlmRuntimeConfig 获取 LlmRuntimeConfig 配置对象（模型、运行时参数等）。 |
| How to use | 从 packages/agent-runtime/src/llm/config.ts 导入 loadLlmRuntimeConfig 后直接调用，获取 LlmRuntimeConfig 运行时配置；详细入参与返回值签名的公开信息暂无。 |
| Exports | loadLlmRuntimeConfig |
| Related | 暂无 |
| Tags | util, loadLlmRuntimeConfig, LlmRuntimeConfig, agent-runtime, llm, config, LLM运行时配置, 配置加载 |
| Source | refresh |
| Path | packages/agent-runtime/src/llm/config.ts |
| Updated | 2026-09-17T04:24:22.611Z |

## FakeLlmProvider

| Field | Value |
|-------|-------|
| Summary | agent-runtime 包中的 FakeLlmProvider：一个伪造（fake/mock）的 LLM Provider 实现，位于 packages/agent-runtime/src/llm/provider.ts，用于在不调用真实 LLM API 的情况下返回预设响应，作为 Provider 接口的替身。 |
| When to use | 在单元测试、本地开发或前端演示（demo）场景下，需要替换真实 LLM 调用、避免网络依赖与 API 费用时，注入 FakeLlmProvider 作为 LLM Provider 的替代实现。 |
| How to use | 从 packages/agent-runtime/src/llm/provider.ts 导入 FakeLlmProvider，在初始化 agent-runtime 时将其作为 LLM Provider 接口的实现注入，即可获得离线模拟输出。具体方法签名暂无。 |
| Exports | FakeLlmProvider |
| Related | 暂无 |
| Tags | FakeLlmProvider, LLM, provider, mock, fake, agent-runtime, TypeScript, 测试 |
| Source | refresh |
| Path | packages/agent-runtime/src/llm/provider.ts |
| Updated | 2026-09-17T03:00:24.476Z |

## provider

| Field | Value |
|-------|-------|
| Summary | packages/agent-runtime 下的 LLM provider（大模型供应商适配）模块，位于 src/llm/provider.ts。负责为 agent-runtime 封装大模型（LLM）服务的接入与调用，提供统一的 provider 抽象层。原文件缺少 javadoc 与导出签名，具体 API 以源码为准。 |
| When to use | 在 agent-runtime 中需要接入、调用或切换大模型（LLM provider）时使用；当 agent 流程需要统一的 LLM 调用入口，或需要按 provider 维度隔离模型与凭据配置时，引用 packages/agent-runtime/src/llm/provider.ts。 |
| How to use | 暂无具体导出签名信息。可通过 import 路径 packages/agent-runtime/src/llm/provider.ts 引入；建议查阅源码中导出的 provider 工厂/适配器实现，按需传入模型名称与 API 凭据等配置后调用。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | llm, provider, agent-runtime, packages, TypeScript, LLM Provider, 大模型, 供应商适配, AI |
| Source | refresh |
| Path | packages/agent-runtime/src/llm/provider.ts |
| Updated | 2026-09-17T04:10:19.341Z |

## prompts

| Field | Value |
|-------|-------|
| Summary | core-engine 的 agent 提示词（prompts）模块，位于 packages/core-engine/src/agent/prompts.ts，集中定义/管理 agent 运行所需的 prompt 内容。注：本次扫描未捕获公开导出签名（signatures 为空），具体导出项请以源文件为准。 |
| When to use | 需要在 core-engine 中构建、调整或复用 agent 提示词模板（prompts）时；或排查 agent 行为异常、怀疑与 prompt 内容相关时，可从此模块入手。 |
| How to use | 暂无（扫描未捕获导出签名与调用示例），请查阅 packages/core-engine/src/agent/prompts.ts 源码确认导入路径与导出形式。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | prompts, prompt, agent, core-engine, 提示词, LLM, TypeScript, monorepo, util |
| Source | refresh |
| Path | packages/core-engine/src/agent/prompts.ts |
| Updated | 2026-09-17T04:10:20.393Z |

## context

| Field | Value |
|-------|-------|
| Summary | core-engine 包中 agent 模块的 context（上下文）工具，源码位于 packages/core-engine/src/agent/context.ts。该文件用于支撑 agent 执行过程中的上下文（context）构建与传递。当前缺少 javadoc 与 signatures，具体 API 定义暂无。 |
| When to use | 暂无（无 javadoc 说明）。一般场景：在 agent 相关流程中需要创建、读取或共享上下文数据时，可参考 packages/core-engine/src/agent/context.ts 中的实现。 |
| How to use | 暂无（无 signatures 信息）。请直接查看 packages/core-engine/src/agent/context.ts 源码确认导出内容与调用方式。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | context, agent, core-engine, packages, util, TypeScript, frontend |
| Source | refresh |
| Path | packages/core-engine/src/agent/context.ts |
| Updated | 2026-09-19T06:04:57.352Z |

## session

| Field | Value |
|-------|-------|
| Summary | core-engine 包中的 HTTP session（会话）工具模块，位于 http 层，用于会话状态的处理与维护 |
| When to use | 在 core-engine 的 http 请求链路中需要读取、维护或传递 session 会话信息时使用 |
| How to use | 暂无 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | util, session, http, core-engine, packages, frontend |
| Source | refresh |
| Path | packages/core-engine/src/http/session.ts |
| Updated | 2026-09-17T04:11:01.514Z |

## handle-request

| Field | Value |
|-------|-------|
| Summary | core-engine 包（frontend scope）中的 HTTP 请求处理工具 handle-request，位于 packages/core-engine/src/http/handle-request.ts，负责封装与统一处理前端 http 请求逻辑。暂无 Javadoc 与函数签名信息。 |
| When to use | 当需要在 core-engine 中发起、拦截或统一处理 HTTP 请求（http 请求处理）时使用 handle-request。 |
| How to use | 暂无（无签名与文档信息，请参考源码 packages/core-engine/src/http/handle-request.ts） |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | handle-request, http, core-engine, packages, frontend, 前端, 请求处理, util |
| Source | refresh |
| Path | packages/core-engine/src/http/handle-request.ts |
| Updated | 2026-09-19T06:05:05.821Z |

## agent-runtime-factory

| Field | Value |
|-------|-------|
| Summary | Agent Runtime 工厂（agent-runtime-factory），位于 packages/core-engine/src/agent 目录下，属于 core-engine 包的工具模块，用于统一创建和配置 agent 运行时实例。 |
| When to use | 需要在 core-engine 中创建 Agent Runtime 实例，或将 agent 的初始化与配置逻辑收敛到统一工厂入口时使用。 |
| How to use | 从 packages/core-engine/src/agent/agent-runtime-factory.ts 导入 agent-runtime-factory 提供的工厂方法，传入 agent 配置以获取运行时实例；具体导出的 API 签名暂无。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | TypeScript, Factory, Agent Runtime, agent-runtime-factory, core-engine, agent, 工厂模式, 运行时 |
| Source | refresh |
| Path | packages/core-engine/src/agent/agent-runtime-factory.ts |
| Updated | 2026-09-17T04:11:09.890Z |

## step-chat-bridge

| Field | Value |
|-------|-------|
| Summary | step-chat-bridge（步骤-会话桥接工具），位于 packages/core-engine/src/agent/step-chat-bridge.ts，用于在 core-engine 的 agent（智能体）step（步骤）执行流程与 chat（聊天会话）之间建立桥接。源码缺少 javadoc 与签名信息，具体能力暂无。 |
| When to use | 当需要在 core-engine 中将 agent 的 step 执行事件或状态与 chat 会话进行双向传递或同步时使用；更具体的触发条件暂无。 |
| How to use | 从 packages/core-engine/src/agent/step-chat-bridge.ts 导入 step-chat-bridge 相关导出后调用；因 signatures 暂无，具体函数签名与调用方式暂无。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | step-chat-bridge, util, core-engine, agent, step, chat, bridge, TypeScript, packages |
| Source | refresh |
| Path | packages/core-engine/src/agent/step-chat-bridge.ts |
| Updated | 2026-09-17T04:11:50.361Z |

## job-pipeline

| Field | Value |
|-------|-------|
| Summary | frontend packages 下的 job-pipeline（任务流水线）工具模块，位于 core-engine 包的 src/pipeline/job-pipeline.ts，据命名推断用于编排 job 任务的执行流程。该文件暂无 javadoc 注释与公开签名（signatures）信息，具体 API 以源码为准。 |
| When to use | 当需要在 core-engine 中组织 job 的执行顺序、构建任务流水线（pipeline）流程，或在 packages 内复用任务编排逻辑时使用；具体导出入口暂无（javadoc 与 signatures 缺失，请先查源码确认）。 |
| How to use | 从 packages/core-engine/src/pipeline/job-pipeline.ts 导入 job-pipeline 相关导出并按流水线方式调用；因该文件暂无 javadoc 与签名说明，建议先阅读源码确认导出成员、参数与返回值后再集成到业务代码。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | job-pipeline, pipeline, job, core-engine, packages, TypeScript, 任务流水线, frontend |
| Source | refresh |
| Path | packages/core-engine/src/pipeline/job-pipeline.ts |
| Updated | 2026-09-17T04:12:13.210Z |

## config

| Field | Value |
|-------|-------|
| Summary | agent-runtime 包内的 LLM 配置模块，源码位于 src/llm/config.ts，用于集中定义与读取 LLM（大语言模型）相关配置项。该文件的 javadoc 与 signatures 均为空，具体配置键与导出细节暂无。 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | llm, LLM（大语言模型）, config, agent-runtime, packages, util, frontend |
| Source | refresh |
| Path | packages/agent-runtime/src/llm/config.ts |
| Updated | 2026-09-17T04:34:38.346Z |

## library

| Field | Value |
|-------|-------|
| Summary | core-engine 包 retrieve 模块下的 library 工具模块（packages/core-engine/src/retrieve/library.ts），用于 library（资产库）检索相关的工具能力封装。javadoc 暂无，公开 API 签名暂无。 |
| When to use | 当需要在 core-engine 的 retrieve（检索）流程中复用 library（资产库）相关的工具逻辑时；具体适用条件暂无。 |
| How to use | 暂无（未提取到公开函数签名，请直接查看 packages/core-engine/src/retrieve/library.ts 源码确认可用导出）。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | util, library, retrieve, core-engine, packages, frontend |
| Source | refresh |
| Path | packages/core-engine/src/retrieve/library.ts |
| Updated | 2026-09-19T05:51:00.415Z |

## ports

| Field | Value |
|-------|-------|
| Summary | core-engine 的 retrieve（检索）模块端口定义文件，位于 packages/core-engine/src/retrieve/ports.ts，用于抽象 core-engine 检索流程与外部依赖之间的边界（ports / 端口适配器模式）。该文件当前 javadoc 为暂无，signatures 为空，具体导出接口暂无。 |
| When to use | 在 core-engine 中为 retrieve（检索）链路接入外部实现（adapter / 适配器）时使用；需要查看或实现 ports 端口接口、扩展检索相关依赖注入边界时参考此文件。 |
| How to use | 暂无（signatures 与 javadoc 均为空，请直接阅读 packages/core-engine/src/retrieve/ports.ts 源码确认导出内容与用法）。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | ports, retrieve, core-engine, packages, TypeScript, 端口适配器, ports-and-adapters, 边界抽象 |
| Source | refresh |
| Path | packages/core-engine/src/retrieve/ports.ts |
| Updated | 2026-09-19T07:46:41.259Z |

## rerank

| Field | Value |
|-------|-------|
| Summary | rerank（重排序）工具函数，位于 packages/core-engine 的 retrieve（检索）模块，源码路径 packages/core-engine/src/retrieve/rerank.ts。暂无 javadoc 与导出签名，推测用于对检索召回的结果按相关性或分数进行二次排序。 |
| When to use | 当通过 core-engine 的 retrieve 检索召回一批结果后，需要在返回给上层之前对结果做 rerank（重排序，例如按相关性得分重新排序）时使用。具体的适用条件与限制暂无 javadoc 信息。 |
| How to use | 暂无签名信息；请直接阅读 packages/core-engine/src/retrieve/rerank.ts 源码确认导出形式（默认导出或命名导出 rerank）与入参结构，再在检索流程中导入并传入召回结果调用。完整调用示例暂无。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | TypeScript, rerank, retrieve, core-engine, packages, 重排序, 检索 |
| Source | refresh |
| Path | packages/core-engine/src/retrieve/rerank.ts |
| Updated | 2026-09-19T07:46:47.149Z |

## embeddings

| Field | Value |
|-------|-------|
| Summary | core-engine 包中 retrieve（检索）模块的 embeddings 工具，负责向量 embedding 的生成与处理，为语义检索/RAG 流水线提供向量表示支持。 |
| When to use | 在 core-engine 的 retrieve（检索）链路中需要对文本或数据生成向量 embedding、进行相似度计算或构建语义检索基础能力时使用。 |
| How to use | 暂无 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | embeddings, vector, retrieve, RAG, 语义检索, core-engine, TypeScript, util |
| Source | refresh |
| Path | packages/core-engine/src/retrieve/embeddings.ts |
| Updated | 2026-09-19T07:47:19.600Z |

## QdrantVectorStore

| Field | Value |
|-------|-------|
| Summary | QdrantVectorStore 是 packages/core-engine 中 retrieve（检索）模块的向量存储工具，封装 Qdrant 向量数据库客户端，提供向量数据写入与相似度检索能力，典型用于 RAG 场景的 retrieve 召回环节。 |
| When to use | 当 core-engine 需要接入 Qdrant 进行向量存储、语义相似度检索（如 RAG 的 retrieve 阶段、embedding 召回）时使用 QdrantVectorStore。 |
| How to use | 暂无公开签名信息；可从 packages/core-engine/src/retrieve/qdrant.ts 导入 QdrantVectorStore，用于向量集合的写入与相似度查询，具体 API 见源码。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | QdrantVectorStore, Qdrant, vector store, 向量检索, retrieve, RAG, embedding, core-engine, packages, TypeScript |
| Source | refresh |
| Path | packages/core-engine/src/retrieve/qdrant.ts |
| Updated | 2026-09-19T08:22:16.583Z |

## StandardLibrary

| Field | Value |
|-------|-------|
| Summary | 标准库 StandardLibrary（util），位于 packages/core-engine/src/retrieve/library.ts，属于 core-engine 的 retrieve（检索）链路的基础工具资产；javadoc 暂无，公开签名暂未提取，具体能力待补充。 |
| When to use | 暂无（可参考：需要在 core-engine retrieve 检索流程中复用 StandardLibrary 标准库能力时） |
| How to use | 暂无（源码位置：packages/core-engine/src/retrieve/library.ts，请结合 StandardLibrary 导出项阅读使用） |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | util, StandardLibrary, library.ts, core-engine, retrieve, packages, frontend, TypeScript |
| Source | refresh |
| Path | packages/core-engine/src/retrieve/library.ts |
| Updated | 2026-09-19T08:37:44.666Z |

## JobPipeline

| Field | Value |
|-------|-------|
| Summary | 暂无文档说明。根据命名与路径，JobPipeline（任务流水线）位于 packages/core-engine/src/pipeline/job-pipeline.ts，属于 core-engine 包中的 pipeline（流水线）模块。 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | JobPipeline, core-engine, pipeline, job-pipeline, util, TypeScript |
| Source | refresh |
| Path | packages/core-engine/src/pipeline/job-pipeline.ts |
| Updated | 2026-09-19T08:37:46.009Z |

## StandardIngestWorker

| Field | Value |
|-------|-------|
| Summary | StandardIngestWorker：packages/core-engine 中的标准 ingest（摄取/入库）worker，位于 src/retrieve/ingest-worker.ts，服务于 retrieve（检索）链路的资料摄取环节。javadoc 暂无，公开签名信息暂无。 |
| When to use | 需要在 core-engine 的 retrieve（检索）链路中执行标准 ingest（摄取）任务时参考该 worker；具体触发条件与能力暂无文档描述。 |
| How to use | 暂无 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | StandardIngestWorker, ingest-worker, ingest, worker, retrieve, core-engine, packages, util, TypeScript |
| Source | refresh |
| Path | packages/core-engine/src/retrieve/ingest-worker.ts |
| Updated | 2026-09-19T08:52:43.990Z |

## live-ports

| Field | Value |
|-------|-------|
| Summary | core-engine（核心引擎）retrieve 模块下的 live-ports 工具，与实时端口（live ports）的检索/获取能力相关；该文件暂无 JSDoc 与函数签名信息，细节待补充。 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | live-ports, core-engine, retrieve, util, packages, TypeScript |
| Source | refresh |
| Path | packages/core-engine/src/retrieve/live-ports.ts |
| Updated | 2026-09-19T10:53:45.446Z |
