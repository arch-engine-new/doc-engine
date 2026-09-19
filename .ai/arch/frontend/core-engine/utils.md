# Utils

## AgentRuntimeFactory

| Field | Value |
|-------|-------|
| Summary | AgentRuntimeFactory（Agent 运行时工厂），位于 core-engine 模块的 agent 子目录，用于创建/组装 agent 运行时的工厂类工具。javadoc 与方法签名暂缺，具体能力待补充。 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | core-engine, AgentRuntimeFactory, agent, factory, runtime, TypeScript |
| Source | refresh |
| Path | packages/core-engine/src/agent/agent-runtime-factory.ts |
| Updated | 2026-09-17T03:57:34.506Z |

## blobObjectUri

| Field | Value |
|-------|-------|
| Summary | MinIO blob 存储工具（packages/core-engine/src/blob/minio.ts）：blobObjectUri(bucket, key) 由 bucket 与 key 生成 blob 对象 URI；构造函数直接接收 endpoint/keys，调用方无需读取 .env；MinIO 凭证保持本地，该存储不是 资料云 / pending-mount 适配器。 |
| When to use | 需要为 MinIO 中 bucket + key 组合的对象生成 blob URI 时；使用本地 MinIO 凭证（不读 .env、非 资料云 / pending-mount 场景）访问 blob 对象时。 |
| How to use | 调用 blobObjectUri(bucket, key) 得到对象 URI；构造 MinIO 存储时直接传入 endpoint/keys 而不是读 .env；不要将其用作 资料云 / pending-mount 适配器。 |
| Exports | blobObjectUri |
| Related | 暂无 |
| Tags | TypeScript, core-engine, MinIO, blobObjectUri, blob, bucket, key, endpoint, .env, 资料云, pending-mount |
| Source | scan |
| Path | packages/core-engine/src/blob/minio.ts |
| Updated | 2026-09-14T06:34:16.523Z |

## buildAutoWording

| Field | Value |
|-------|-------|
| Summary | 构建 agent 自动措辞 prompt 的工具：buildAutoWording(jobId, blocking: FindingRow[]) 基于 job 标识与 blocking FindingRow 生成措辞文本，用于标记允许运行 check_wording Tool 的步骤；check_wording 只做措辞校验，绝不写 Receipt。 |
| When to use | 需要为 agent 生成自动措辞 prompt、并指定哪些步骤允许运行 check_wording Tool 时；需要按 jobId 与 blocking FindingRow 组装提示内容时。 |
| How to use | 调用 buildAutoWording(jobId, blocking)，传入 jobId 与阻塞项 FindingRow 数组，得到可注入 agent prompt 的措辞文本；注意 check_wording Tool 不会写 Receipt。 |
| Exports | buildAutoWording |
| Related | check_wording, FindingRow, Receipt |
| Tags | TypeScript, core-engine, buildAutoWording, check_wording, FindingRow, Receipt, prompt, agent, wording, jobId |
| Source | scan |
| Path | packages/core-engine/src/agent/prompts.ts |
| Updated | 2026-09-14T06:34:16.524Z |

## buildJobContext

| Field | Value |
|-------|-------|
| Summary | 构建 agent 任务上下文的工具函数 buildJobContext，位于 packages/core-engine/src/agent/context.ts，用于在 core-engine 内组装 JobContext（任务运行上下文）对象，聚合 agent 执行所需的运行时信息。 |
| When to use | 在 core-engine 的 agent 流程中需要初始化、组装或传递任务上下文（JobContext）时使用；例如启动一次 agent job 前，通过 buildJobContext 生成统一的上下文对象供后续步骤消费。 |
| How to use | 暂无（扫描未提供签名与调用示例）；根据命名推断：从 packages/core-engine/src/agent/context.ts 导入 buildJobContext，传入 job 相关参数后获得 JobContext 对象。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | buildJobContext, JobContext, agent, context.ts, core-engine, util, TypeScript |
| Source | refresh |
| Path | packages/core-engine/src/agent/context.ts |
| Updated | 2026-09-17T03:28:41.994Z |

## buildJobStepGraphDefinition

| Field | Value |
|-------|-------|
| Summary | 构建 job-step-v1 的 GraphDefinition（buildJobStepGraphDefinition）：覆盖 job-step-v1 运行的 step，并确保 confirm-next 能恢复 HITL（human-in-the-loop）流程。 |
| When to use | 需要在指定 step 上运行 job-step-v1 图、且 confirm-next 必须恢复 HITL 等待确认时使用；由 JobPipeline 与 ToolRegistry 工厂产出图定义。 |
| How to use | 调用 `buildJobStepGraphDefinition(pipeline, registry)` 返回 GraphDefinition 后交给图执行器注册运行；_registry 参数目前仅用于工厂签名兼容。 |
| Exports | buildJobStepGraphDefinition, GraphDefinition |
| Related | core-engine/agent/context, core-engine/agent/step-chat-bridge |
| Tags | core-engine, buildJobStepGraphDefinition, job-step-v1, confirm-next, HITL, GraphDefinition, ToolRegistry, JobPipeline, graph, orchestrator |
| Source | scan |
| Path | packages/core-engine/src/agent/job-step-orchestrator.ts |
| Updated | 2026-09-14T06:35:07.629Z |

## buildPreviewTree

| Field | Value |
|-------|-------|
| Summary | 工程量预览台 buildPreviewTree：仅生成嵌套分组快照 VolumePreviewTree，tree.submitted 恒为 false；绝不写 Receipt、绝不标记 job submitted；groupKeys 来自 spec pack，而非行业预设（公路/水利/房建）。 |
| When to use | 需要对 VolumeLeaf 列表做分组预览展示（预览台/预演）时使用；切勿用于提交链路——它不写 Receipt、不置 submitted 状态。 |
| How to use | 调用 `buildPreviewTree(leaves, groupKeys, orderKey)` 传入 VolumeLeaf[]、分组键与排序键得到 VolumePreviewTree；分组键应从 spec pack 获取，不要硬编码公路/水利/房建预设。 |
| Exports | buildPreviewTree, VolumePreviewTree, VolumeLeaf |
| Related | core-engine/pipeline/volume |
| Tags | core-engine, buildPreviewTree, VolumeLeaf, VolumePreviewTree, tree.submitted, Receipt, groupKeys, spec pack, preview, 工程量, 公路, 水利, 房建, volume.ts, orderKey |
| Source | scan |
| Path | packages/core-engine/src/pipeline/volume.ts |
| Updated | 2026-09-14T06:35:07.630Z |

## buildStepChatGraphDefinition

| Field | Value |
|-------|-------|
| Summary | 原生 step-chat-v1 图定义 buildStepChatGraphDefinition：prepare → branch search/tool → llm → branch draft/tool → assemble。Kahn scheduling 统计每条普通入边的 in-degree；独占分支臂后汇合（search\|skip → llm、draft\|skip → assemble）会让汇合点入度永远停在 1，被跳过分支用 throwSkipJoin 抛 stub、其 onError 边绕过 in-degree 汇入。search 未命中时不编造 clause_id（appendEmptySearchNotice），回复超长用 capWording 截断。 |
| When to use | 需要在 step 内提供对话（step-chat-v1）能力，并按 should_search / should_draft 分支决定是否调用 search_clause 检索条款与 check_wording 核词、最终 assembleReply 组装回复时使用。 |
| How to use | 调用 `buildStepChatGraphDefinition(pipeline, registry)` 返回 GraphDefinition；registry 仅作工厂签名兼容，工具经 ControlPlane 默认 registry 解析。prepareStepChat 要求输入含 traceId、step、userMessage；search_hits 为空时会附加未命中提示（NO_HIT_REPLY_LINE），存在 proposal_id 时提示在待审页确认——对话不能代替确认。 |
| Exports | buildStepChatGraphDefinition, GraphDefinition, StepChatPrep, prepareStepChat, assembleReply, throwSkipJoin |
| Related | core-engine/agent/context, core-engine/agent/job-step-orchestrator |
| Tags | core-engine, buildStepChatGraphDefinition, step-chat-v1, GraphDefinition, GraphEdge, GraphNode, Kahn, in-degree, onError, throwSkipJoin, should_search, should_draft, search_clause, check_wording, clause_id, proposal_id, StepChatPrep, search_hits, llm_text, capWording, formatHitsForPrompt, appendEmptySearchNotice, branch, tool, llm, HITL, agent-graph, JobPipeline, ToolRegistry, nodeId, isArray, clauseId, replyAlreadyMentionsMiss, didAttemptSearch, StepChatAssembleInputs |
| Source | scan |
| Path | packages/core-engine/src/agent/step-chat-bridge.ts |
| Updated | 2026-09-14T06:35:07.630Z |

## CHECK_WORDING_FIXTURE

| Field | Value |
|-------|-------|
| Summary | Review desk 流程夹具：cognition（AI 侧）只写入 pending 状态的 Proposal，人工确认后才写入 Receipt。checkWording 是 cognition 端口，CHECK_WORDING_FIXTURE 是其确定性 wording 夹具，不调用真实 LLM。 |
| When to use | 需要替换或测试 checkWording cognition 端口、或在无真实 LLM 环境下验证 Review desk 的 pending Proposal → 人工确认写 Receipt 状态流转时使用。 |
| How to use | 从 packages/core-engine/src/pipeline/review.ts 导入 CHECK_WORDING_FIXTURE，作为 checkWording 端口的确定性实现注入 pipeline，用于跑通 cognition 写 pending Proposal 与人工确认写 Receipt 的链路。 |
| Exports | CHECK_WORDING_FIXTURE |
| Related | commitAdapterWrite |
| Tags | CHECK_WORDING_FIXTURE, checkWording, Review desk, cognition, Proposal, Receipt, fixture, LLM, pipeline, review |
| Source | scan |
| Path | packages/core-engine/src/pipeline/review.ts |
| Updated | 2026-09-14T06:36:20.576Z |

## commitAdapterWrite

| Field | Value |
|-------|-------|
| Summary | C4 mock adapter 的写入函数 commitAdapterWrite：pending-mount 时返回 receipt_id；没有 receipt 的写入会失败且不持久化。 |
| When to use | 需要模拟 C4 mock adapter 的写入约束（先 pending-mount 获取 receipt_id 再提交写入）进行测试，或验证无 receipt 的写入被拒绝且不落库时使用。 |
| How to use | 在 adapter mock 场景中调用 commitAdapterWrite：先通过 pending-mount 拿到 receipt_id，再携带该 receipt 提交写入；无 receipt 直接写入将失败，数据不会持久化。 |
| Exports | 暂无 |
| Related | CHECK_WORDING_FIXTURE |
| Tags | commitAdapterWrite, C4, mock adapter, pending-mount, receipt_id, adapter, mock, Receipt |
| Source | scan |
| Path | packages/core-engine/src/adapter/mock.ts |
| Updated | 2026-09-14T06:36:20.576Z |

## CONCRETE_DOC_TYPE_ID

| Field | Value |
|-------|-------|
| Summary | SLICE-1 seed 中的混凝土 DocType ID：已发布规则 R1 required(编号) 与 R2 compare(日期A, ≤, 日期B)，blocking=1。DocType demo 含 parent 字段 编号/日期A，child 字段 特殊批号挂在 PACK_ID 上；对应 Excel demo 混凝土施工检验批（GB 50204），配有 fixture xlsx 与 cell mappings。 |
| When to use | 初始化 SLICE-1 seed、需要混凝土检验批 DocType 的 ID，或需要配置/校验 R1 required(编号)、R2 compare(日期A, ≤, 日期B) 规则（blocking=1）时使用。 |
| How to use | 从 packages/core-engine/src/pipeline/seed.ts 导入 CONCRETE_DOC_TYPE_ID，用于注册或查询混凝土施工检验批（GB 50204）的 DocType；配合 CONCRETE_FIXTURE_MAPPING_JSON 与 loadConcreteFixtureMapping 加载 fixture xlsx 的 cell mappings。 |
| Exports | 暂无 |
| Related | CONCRETE_FIXTURE_MAPPING_JSON |
| Tags | CONCRETE_DOC_TYPE_ID, SLICE-1, R1, R2, required, compare, blocking, DocType, PACK_ID, 混凝土施工检验批, GB 50204, seed, fixture xlsx, SLICE |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-09-14T06:36:20.576Z |

## CONCRETE_FIXTURE_MAPPING_JSON

| Field | Value |
|-------|-------|
| Summary | 混凝土施工检验批（GB 50204）fixture xlsx 的单元格映射 JSON 默认路径常量；loadConcreteFixtureMapping 读取该 JSON 返回 ConcreteFixtureMapping，服务于 SLICE-1 seed 的 Excel demo 与 cell mappings。 |
| When to use | 在 seed 或测试中需要把 fixture xlsx 字段映射到单元格（cell mappings）、或需要获取 ConcreteFixtureMapping 数据时使用。 |
| How to use | 直接调用 loadConcreteFixtureMapping()，以 CONCRETE_FIXTURE_MAPPING_JSON 作为默认 jsonPath 返回 ConcreteFixtureMapping；也可传入自定义 jsonPath 指向其它映射文件。 |
| Exports | loadConcreteFixtureMapping, CONCRETE_FIXTURE_MAPPING_JSON |
| Related | CONCRETE_DOC_TYPE_ID |
| Tags | CONCRETE_FIXTURE_MAPPING_JSON, loadConcreteFixtureMapping, ConcreteFixtureMapping, fixture xlsx, cell mappings, GB 50204, 混凝土施工检验批, SLICE-1, seed, jsonPath, DocType, SLICE |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-09-14T06:36:20.576Z |

## CONCRETE_FIXTURE_XLSX

| Field | Value |
|-------|-------|
| Summary | SLICE-1 seed 常量，指向混凝土施工检验批 (GB 50204) 的 fixture xlsx 资源，用于 Excel 演示数据源；配套规则为 published R1 required(编号) 与 R2 compare(日期A, ≤, 日期B)，blocking=1。 |
| When to use | 在 SLICE-1 seed 流程中需要加载混凝土施工检验批 (GB 50204) 的 fixture xlsx 作为 Excel 演示输入时使用。 |
| How to use | 从 packages/core-engine/src/pipeline/seed.ts 导入 CONCRETE_FIXTURE_XLSX，配合 concreteCellMappingsFromFixture 生成 cell mappings 后写入种子数据。 |
| Exports | CONCRETE_FIXTURE_XLSX |
| Related | CONCRETE_TEMPLATE_NAME, CONCRETE_TEMPLATE_XLSX_FILE, concreteCellMappingsFromFixture |
| Tags | core-engine, seed, pipeline, SLICE-1, xlsx, fixture, GB 50204, 混凝土施工检验批, PACK_ID, R1, R2, blocking, cell mappings, DocType, SLICE |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-09-14T06:37:01.477Z |

## CONCRETE_TEMPLATE_NAME

| Field | Value |
|-------|-------|
| Summary | SLICE-1 seed 常量，定义混凝土施工检验批 (GB 50204) 的模板名称，配合 fixture xlsx + cell mappings 完成 DocType/模板演示（R1 required(编号)、R2 compare(日期A, ≤, 日期B)，blocking=1）。 |
| When to use | 在 SLICE-1 seed 中需要按名称注册或查找混凝土施工检验批 (GB 50204) 模板时使用。 |
| How to use | 从 packages/core-engine/src/pipeline/seed.ts 导入 CONCRETE_TEMPLATE_NAME，作为模板名称参数传入 seed 写入逻辑，与 CONCRETE_TEMPLATE_XLSX_FILE、CONCRETE_FIXTURE_XLSX 搭配使用。 |
| Exports | CONCRETE_TEMPLATE_NAME |
| Related | CONCRETE_FIXTURE_XLSX, CONCRETE_TEMPLATE_XLSX_FILE, concreteCellMappingsFromFixture |
| Tags | core-engine, seed, pipeline, SLICE-1, template, GB 50204, 混凝土施工检验批, DocType, R1, R2, blocking, PACK_ID, SLICE |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-09-14T06:37:01.477Z |

## CONCRETE_TEMPLATE_XLSX_FILE

| Field | Value |
|-------|-------|
| Summary | SLICE-1 seed 常量，引用混凝土施工检验批 (GB 50204) 的模板 xlsx 文件，用于在 seed 中上传模板并建立 cell mappings 演示（R1 required(编号)、R2 compare(日期A, ≤, 日期B)，blocking=1）。 |
| When to use | 需要在 SLICE-1 seed 流程中读取或上传混凝土施工检验批 (GB 50204) 的模板 xlsx 文件时使用。 |
| How to use | 从 packages/core-engine/src/pipeline/seed.ts 导入 CONCRETE_TEMPLATE_XLSX_FILE，作为模板文件来源传给 seed 上传/注册逻辑，再结合 concreteCellMappingsFromFixture 生成 cell mappings。 |
| Exports | CONCRETE_TEMPLATE_XLSX_FILE |
| Related | CONCRETE_FIXTURE_XLSX, CONCRETE_TEMPLATE_NAME, concreteCellMappingsFromFixture |
| Tags | core-engine, seed, pipeline, SLICE-1, xlsx, GB 50204, 混凝土施工检验批, PACK_ID, R1, R2, blocking, cell mappings, DocType, SLICE |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-09-14T06:37:01.477Z |

## concreteCellMappingsFromFixture

| Field | Value |
|-------|-------|
| Summary | 将 ConcreteFixtureMapping 转换为 ConcreteCellMappingWrite[] 的工具函数，用于 SLICE-1 seed 中把混凝土施工检验批 (GB 50204) fixture 的单元格映射写入系统（R1 required(编号)、R2 compare(日期A, ≤, 日期B)，blocking=1，child 特殊批号 on PACK_ID）。 |
| When to use | 在 seed 流程中已有 fixture 映射定义（ConcreteFixtureMapping），需要生成可写入的 ConcreteCellMappingWrite[] 单元格映射列表时使用。 |
| How to use | 调用 concreteCellMappingsFromFixture(fixture: ConcreteFixtureMapping): ConcreteCellMappingWrite[]，传入 fixture 映射对象，将返回的 ConcreteCellMappingWrite[] 结果写入 cell mappings 存储，与 CONCRETE_FIXTURE_XLSX、CONCRETE_TEMPLATE_XLSX_FILE 配套使用。 |
| Exports | concreteCellMappingsFromFixture |
| Related | CONCRETE_FIXTURE_XLSX, CONCRETE_TEMPLATE_NAME, CONCRETE_TEMPLATE_XLSX_FILE |
| Tags | core-engine, seed, pipeline, SLICE-1, concreteCellMappingsFromFixture, ConcreteFixtureMapping, ConcreteCellMappingWrite, cell mappings, GB 50204, 混凝土施工检验批, PACK_ID, R1, R2, blocking, DocType, SLICE |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-09-14T06:37:01.477Z |

## concreteCompletenessRules

| Field | Value |
|-------|-------|
| Summary | SLICE-1 seed 种子数据生成器：根据 docTypeId 生成已发布（published）的完整度规则数组 ConcreteCompletenessRuleWrite[]，包含 R1 required(编号) 与 R2 compare(日期A, ≤, 日期B)，blocking=1。服务于 DocType demo（parent 编号/日期A, child 特殊批号 on PACK_ID）与混凝土施工检验批（GB 50204）Excel demo。 |
| When to use | 初始化 SLICE-1 种子数据时；需要为 DocType 演示配置 R1/R2 完整度规则（blocking=1）时；需要构造 ConcreteCompletenessRuleWrite 写入结构时。 |
| How to use | import { concreteCompletenessRules } from 'packages/core-engine/src/pipeline/seed'；调用 concreteCompletenessRules(docTypeId) 得到 ConcreteCompletenessRuleWrite[] 后写入规则存储。通常与 concreteFieldDefsFromFixture、concreteFillRulesFromFixture 配合完成 seed 流程。 |
| Exports | concreteCompletenessRules, ConcreteCompletenessRuleWrite |
| Related | concreteFieldDefsFromFixture, concreteFillRulesFromFixture |
| Tags | core-engine, seed, SLICE-1, docTypeId, ConcreteCompletenessRuleWrite, R1, R2, required, compare, blocking, DocType, PACK_ID, 特殊批号, 混凝土施工检验批, GB 50204, fixture, concreteCompletenessRules, SLICE |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-09-14T06:37:53.948Z |

## concreteFieldDefsFromFixture

| Field | Value |
|-------|-------|
| Summary | 从 ConcreteFixtureMapping fixture 生成字段定义数组，对应 SLICE-1 seed 的 DocType demo：parent 编号/日期A，child 特殊批号 on PACK_ID。配合混凝土施工检验批（GB 50204）的 fixture xlsx + cell mappings 使用。 |
| When to use | 搭建 SLICE-1 种子数据时；需要将 fixture xlsx 的 cell mappings 转换为字段定义时；需要为 DocType 配置 parent（编号、日期A）与 child（特殊批号/PACK_ID）字段时。 |
| How to use | import { concreteFieldDefsFromFixture } from 'packages/core-engine/src/pipeline/seed'；传入 ConcreteFixtureMapping，得到字段定义数组并写入 DocType 存储。与 concreteCompletenessRules、concreteFillRulesFromFixture 组合调用完成完整 seed。 |
| Exports | concreteFieldDefsFromFixture |
| Related | concreteCompletenessRules, concreteFillRulesFromFixture |
| Tags | core-engine, seed, SLICE-1, ConcreteFixtureMapping, DocType, PACK_ID, cell mappings, fixture, 特殊批号, 混凝土施工检验批, GB 50204, concreteFieldDefsFromFixture, SLICE |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-09-14T06:37:53.948Z |

## concreteFillRulesFromFixture

| Field | Value |
|-------|-------|
| Summary | 从 ConcreteFixtureMapping fixture 生成填单规则数组 ConcreteFillRuleWrite[]，属于 SLICE-1 seed：published R1 required(编号) 与 R2 compare(日期A, ≤, 日期B)，blocking=1。配合混凝土施工检验批（GB 50204）fixture xlsx + cell mappings 使用。 |
| When to use | 初始化 SLICE-1 种子数据时；需要为混凝土施工检验批（GB 50204）生成与 R1/R2 对应的 ConcreteFillRuleWrite 填单规则时。 |
| How to use | import { concreteFillRulesFromFixture } from 'packages/core-engine/src/pipeline/seed'；传入 ConcreteFixtureMapping，得到 ConcreteFillRuleWrite[] 并写入规则存储。与 concreteCompletenessRules、concreteFieldDefsFromFixture 一起构成完整 seed 流程。 |
| Exports | concreteFillRulesFromFixture, ConcreteFillRuleWrite |
| Related | concreteCompletenessRules, concreteFieldDefsFromFixture |
| Tags | core-engine, seed, SLICE-1, ConcreteFixtureMapping, ConcreteFillRuleWrite, R1, R2, required, compare, blocking, 混凝土施工检验批, GB 50204, fixture, concreteFillRulesFromFixture, DocType, SLICE |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-09-14T06:37:53.948Z |

## CONFIRM_NEXT

| Field | Value |
|-------|-------|
| Summary | job-pipeline.ts 中的 Walking-skeleton 作业流水线：fixture upload → extract JSON → R1/R2 → findings + audit。导出常量 CONFIRM_NEXT 用于人工确认推进。Chat 为 HITL-only：仅持久化消息，不改变 job.status，不写 Receipt。 |
| When to use | 需要串联 fixture upload 到 R1/R2 校验再到 findings + audit 的作业流程时；需要实现 CONFIRM_NEXT 人工确认（HITL）推进时；需要理解 Chat 不影响 job.status、不写 Receipt 的边界约束时。 |
| How to use | import { CONFIRM_NEXT } from 'packages/core-engine/src/pipeline/job-pipeline'；按流水线阶段（fixture upload → extract JSON → R1/R2 → findings + audit）驱动 job，CONFIRM_NEXT 用于人工确认下一步。注意 Chat 消息仅持久化，禁止据此修改 job.status 或写 Receipt。 |
| Exports | CONFIRM_NEXT |
| Related | 暂无 |
| Tags | core-engine, job-pipeline, CONFIRM_NEXT, HITL, HITL-only, Walking-skeleton, fixture upload, extract JSON, R1, R2, findings, audit, job.status, Receipt, JSON |
| Source | scan |
| Path | packages/core-engine/src/pipeline/job-pipeline.ts |
| Updated | 2026-09-14T06:37:53.948Z |

## CORE_ENGINE_VERSION

| Field | Value |
|-------|-------|
| Summary | core-engine 的版本常量 CORE_ENGINE_VERSION，由 packages/core-engine/src/index.ts 统一导出，用于标识当前核心引擎的版本号。 |
| When to use | 需要在运行时读取或展示 core-engine 版本、做版本兼容性判断、或在日志/遥测中埋版本号时使用。 |
| How to use | 通过 import { CORE_ENGINE_VERSION } 从 core-engine 入口（src/index.ts）导入，直接读取该常量字符串即可；javadoc 暂无，具体值以源码为准。 |
| Exports | CORE_ENGINE_VERSION |
| Related | 暂无 |
| Tags | core-engine, CORE_ENGINE_VERSION, version, TypeScript, 常量 |
| Source | scan |
| Path | packages/core-engine/src/index.ts |
| Updated | 2026-09-14T06:38:50.745Z |

## coreEngineHttpPlugin

| Field | Value |
|-------|-------|
| Summary | Vite 中间件插件 coreEngineHttpPlugin，采用结构性 ViteMiddlewarePlugin 形状以避免 core-engine 依赖 vite 包；对 isAdapterPath 命中的 /api/ 与 /adapter/ 前缀请求进行处理，并内置手写 multipart 解析器，让 POST /api/jobs/upload 拿到二进制文件字节且不新增依赖。 |
| When to use | 在本地 Vite dev server 需要为 /api/、/adapter/ 路径挂自定义中间件时；或上传路由 POST /api/jobs/upload 需要解析 multipart/form-data 的 boundary、Content-Disposition 与文件字节时使用。 |
| How to use | 在 vite 配置的 plugins 中加入 coreEngineHttpPlugin()，插件通过 configureServer(server) 注册 middlewares.use 回调。内部工具链：isAdapterPath 判定是否为 /api/ 或 /adapter/ 路径；readContentType / isMultipartContentType 判定 multipart/form-data；extractBoundary 提取 boundary；parseContentDisposition 解析 name 与 filename；guessMime 推断 Content-Type（.jpg/.jpeg→image/jpeg、.png→image/png、.pdf→application/pdf，默认 application/octet-stream）。仅暴露 POST /api/jobs/upload 所需字段。 |
| Exports | coreEngineHttpPlugin |
| Related | 暂无 |
| Tags | core-engine, coreEngineHttpPlugin, ViteMiddlewarePlugin, configureServer, middlewares, isAdapterPath, readContentType, isMultipartContentType, extractBoundary, parseContentDisposition, guessMime, multipart/form-data, /api/jobs/upload, Vite, upload, IncomingMessage, ServerResponse, startsWith, isArray, contentType, toLowerCase, endsWith, fileName |
| Source | scan |
| Path | packages/core-engine/src/http/node.ts |
| Updated | 2026-09-14T06:38:50.745Z |

## CoreEngineStore

| Field | Value |
|-------|-------|
| Summary | frontend 前端 core-engine 模块的持久化 Store 工具类 CoreEngineStore，源码位于 packages/core-engine/src/persistence/store.ts，负责状态（state）的持久化存取。 |
| When to use | 在 frontend 中需要跨会话保存/读取 core-engine 相关状态（persistence 持久化），或需要统一经由 CoreEngineStore 管理状态存取时使用。 |
| How to use | 从 packages/core-engine/src/persistence/store.ts 导入 CoreEngineStore 后实例化使用；当前扫描未获取到公开方法签名（signatures），具体 API 请参见源码。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | CoreEngineStore, core-engine, frontend, persistence, store, 持久化, 状态管理 |
| Source | refresh |
| Path | packages/core-engine/src/persistence/store.ts |
| Updated | 2026-09-15T10:04:20.957Z |

## createCheckWordingToolHandler

| Field | Value |
|-------|-------|
| Summary | Review desk 工具处理器工厂 createCheckWordingToolHandler(desk: ReviewDesk)：cognition 侧只允许写入 pending 的 Proposal，人工确认后才写入 Receipt；checkWording 是 cognition 的端口（cognition port），当前使用确定性 wording fixture，不调用真实 LLM。 |
| When to use | 在 pipeline 的 review 环节需要为 cognition 提供 checkWording 工具，或搭建 ReviewDesk 上「pending Proposal → 人工确认 → Receipt 落账」流程时使用。 |
| How to use | 先构造 ReviewDesk 实例，再调用 createCheckWordingToolHandler(desk) 生成工具 handler，注册到 cognition 的工具调用表；cognition 调用 checkWording 时返回确定性 fixture 结果，仅写入 pending Proposal，待人工确认后由 desk 写入 Receipt。 |
| Exports | createCheckWordingToolHandler |
| Related | ReviewDesk |
| Tags | core-engine, createCheckWordingToolHandler, checkWording, ReviewDesk, Proposal, Receipt, cognition, review, fixture, pipeline, LLM |
| Source | scan |
| Path | packages/core-engine/src/pipeline/review.ts |
| Updated | 2026-09-14T06:38:50.745Z |

## createDemoHttpServer

| Field | Value |
|-------|-------|
| Summary | createDemoHttpServer 在 Node 上创建 demo HTTP 服务器（签名 createDemoHttpServer(port = 8787): Server），内置手写 multipart 解析器（hand-rolled multipart parser），让上传路由无需新增依赖即可拿到二进制文件字节，仅暴露 POST /api/jobs/upload 所需字段；包含 isAdapterPath（匹配 /api/ 与 /adapter/ 前缀）、readContentType/isMultipartContentType（识别 multipart/form-data）、extractBoundary（从 content-type 提取 boundary）、parseContentDisposition（解析 name/filename）、guessMime（按扩展名或 part content-type 猜 MIME，如 image/jpeg、application/pdf、application/octet-stream）。另定义 ViteMiddlewarePlugin 结构形状，使 core-engine 不依赖 vite 包。 |
| When to use | 本地/演示环境需要脱离 Vite 直接跑 API 服务器时；POST /api/jobs/upload 等上传路由需要解析 multipart/form-data 取文件字节时；需要 isAdapterPath 判断 /api/、/adapter/ 前缀的 adapter 路径时；需要一个零依赖的 boundary/content-disposition/MIME 解析（extractBoundary、parseContentDisposition、guessMime）时。 |
| How to use | import { createDemoHttpServer } 后调用 createDemoHttpServer(8787) 得到 Node Server 并监听；请求先经 isAdapterPath 过滤 /api/、/adapter/ 前缀；multipart 请求按 readContentType → isMultipartContentType → extractBoundary 提取 boundary，再由 parseContentDisposition 取 name/filename、guessMime 定 MIME，最终把文件字节交给 POST /api/jobs/upload 处理；如需挂到 Vite dev server，可按 ViteMiddlewarePlugin.configureServer(server.middlewares.use) 形状接入。 |
| Exports | createDemoHttpServer |
| Related | POST /api/jobs/upload, ViteMiddlewarePlugin, packages/core-engine/src/http |
| Tags | Node.js, http, multipart/form-data, createDemoHttpServer, isAdapterPath, extractBoundary, parseContentDisposition, guessMime, readContentType, isMultipartContentType, /api/jobs/upload, /adapter/, ViteMiddlewarePlugin, 8787, Server, configureServer, IncomingMessage, ServerResponse, startsWith, isArray, contentType, toLowerCase, endsWith, fileName |
| Source | scan |
| Path | packages/core-engine/src/http/node.ts |
| Updated | 2026-09-14T06:39:54.915Z |

## createSearchClauseToolHandler

| Field | Value |
|-------|-------|
| Summary | createSearchClauseToolHandler 创建标准库检索工具处理器：摄取侧按 clause heading（条款标题）入库，检索侧通过 Qdrant / Neo4j ports 端口查询，且仅从 retrieve hits 命中结果回填 Finding.clause_id；无行业预设（No industry presets）。 |
| When to use | 需要把标准/规范文本按 clause heading 切分摄取进 StandardLibrary 时；需要经 Qdrant 向量端口与 Neo4j 图端口做条款检索时；需要给 Finding 附带 clause_id 且只信任 retrieve 命中、禁止行业预设兜底时。 |
| How to use | import { createSearchClauseToolHandler } 并传入 StandardLibrary 实例：const handler = createSearchClauseToolHandler(library)；摄取流程按 clause heading 入库，查询流程调用 Qdrant/Neo4j retrieve 端口，命中后在 retrieve hits 上写入 Finding.clause_id，不做任何行业预设补全。 |
| Exports | createSearchClauseToolHandler |
| Related | StandardLibrary, Qdrant, Neo4j, Finding.clause_id, packages/core-engine/src/retrieve/library.ts |
| Tags | retrieve, StandardLibrary, Qdrant, Neo4j, clause_id, clause heading, Finding, createSearchClauseToolHandler, RAG, tool handler |
| Source | scan |
| Path | packages/core-engine/src/retrieve/library.ts |
| Updated | 2026-09-14T06:39:54.915Z |

## createStepChatRegistry

| Field | Value |
|-------|-------|
| Summary | 暂无 javadoc；据签名 createStepChatRegistry(pipeline: JobPipeline): ToolRegistry，用于基于 JobPipeline 构建 agent 侧的工具注册表 ToolRegistry（step chat registry）。 |
| When to use | 在 agent/tools 场景需要由 JobPipeline 派生工具注册表（ToolRegistry）时；需要把 pipeline 步骤暴露为 agent 聊天可调用工具时。 |
| How to use | import { createStepChatRegistry } from 'packages/core-engine/src/agent/tools'，传入 JobPipeline 实例：const registry: ToolRegistry = createStepChatRegistry(pipeline)；随后把 registry 提供给 agent 的工具调用入口。 |
| Exports | createStepChatRegistry |
| Related | JobPipeline, ToolRegistry, packages/core-engine/src/agent/tools.ts |
| Tags | agent, tools, createStepChatRegistry, JobPipeline, ToolRegistry, step chat |
| Source | scan |
| Path | packages/core-engine/src/agent/tools.ts |
| Updated | 2026-09-14T06:39:54.915Z |

## DEFAULT_FAKE_OCR_TEXT

| Field | Value |
|-------|-------|
| Summary | 默认注入的 OCR 文本页常量 DEFAULT_FAKE_OCR_TEXT：后续测试可直接从中解析 编号/日期A/日期B，无需真实 vendor 调用。日期刻意倒置（日期A > 日期B），确保 Task 6 接入 extract 后 R2 compare（比对）仍保持 blocking（阻塞）行为。 |
| When to use | 为 OCR/extract 测试提供固定样例页时；需要验证日期倒置（日期A > 日期B）下 R2 compare 阻塞逻辑时；避免测试依赖真实 vendor 调用时。 |
| How to use | 直接 import DEFAULT_FAKE_OCR_TEXT 作为 fake OCR vendor 的返回文本，供下游测试解析 编号/日期A/日期B 并驱动 R2 compare。 |
| Exports | DEFAULT_FAKE_OCR_TEXT |
| Related | 暂无 |
| Tags | DEFAULT_FAKE_OCR_TEXT, OCR, vendor, R2, compare, extract, Task 6, 编号, 日期A, 日期B, fake, test-fixture, core-engine |
| Source | scan |
| Path | packages/core-engine/src/ocr/fake.ts |
| Updated | 2026-09-14T06:40:30.870Z |

## defaultRetrievePorts

| Field | Value |
|-------|-------|
| Summary | 标准检索库 defaultRetrievePorts：按 clause heading（条款标题）执行 ingest，经 Qdrant/Neo4j 端口完成检索，且仅在 retrieve hits 命中时附加 Finding.clause_id。不含行业预设（No industry presets）。 |
| When to use | 需要标准检索管线（ingest by clause heading + Qdrant/Neo4j 检索）时；需要保证 Finding.clause_id 仅来自 retrieve hits 而非其他来源时；不希望引入行业预设时。 |
| How to use | 导入 defaultRetrievePorts，注入 Qdrant/Neo4j 端口实现后用于检索流程；检索命中（retrieve hits）结果会自动携带 Finding.clause_id。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | defaultRetrievePorts, Qdrant, Neo4j, Finding.clause_id, retrieve hits, ingest, clause heading, 标准库, 检索, core-engine, clause_id |
| Source | scan |
| Path | packages/core-engine/src/retrieve/library.ts |
| Updated | 2026-09-14T06:40:30.870Z |

## DEMO_DICTS

| Field | Value |
|-------|-------|
| Summary | DEMO_DICTS 是 core-engine 模块 http/dicts.ts 中导出的演示字典（dict）数据常量，供前端演示场景使用；原文件暂无 javadoc 说明 |
| When to use | 前端需要演示或 mock 字典（dict）数据时使用 DEMO_DICTS；其他具体适用条件暂无 |
| How to use | 从 packages/core-engine 的 src/http/dicts.ts 导入 DEMO_DICTS 常量直接使用；详细调用方式暂无 |
| Exports | DEMO_DICTS |
| Related | 暂无 |
| Tags | DEMO_DICTS, dicts, dict, http, core-engine, 常量, 演示数据, mock, 前端, TypeScript |
| Source | refresh |
| Path | packages/core-engine/src/http/dicts.ts |
| Updated | 2026-09-15T06:17:25.935Z |

## DemoHttpSession

| Field | Value |
|-------|-------|
| Summary | core-engine 包内的 HTTP 会话工具类 DemoHttpSession，位于 packages/core-engine/src/http/session.ts，用于封装 frontend 对 HTTP 请求的会话（session）管理。javadoc 与方法签名暂无。 |
| When to use | 当 frontend 需要通过 core-engine 发起带会话（session）状态的 HTTP 请求，或需要复用/扩展 DemoHttpSession 的会话封装能力时使用。更具体的适用场景暂无。 |
| How to use | 从 packages/core-engine/src/http/session.ts 导入 DemoHttpSession 并实例化调用；因 javadoc 与签名暂无，具体方法调用方式请参考源码 session.ts。 |
| Exports | DemoHttpSession |
| Related | 暂无 |
| Tags | frontend, core-engine, TypeScript, DemoHttpSession, http, session, HTTP, util |
| Source | refresh |
| Path | packages/core-engine/src/http/session.ts |
| Updated | 2026-09-17T03:56:48.185Z |

## DOC_TYPE_CHILD_ID

| Field | Value |
|-------|-------|
| Summary | SLICE-1 seed 常量，表示子文档 DocType 的 ID。child DocType 在 PACK_ID 上承载「特殊批号」字段；配套 Excel demo 为混凝土施工检验批（GB 50204），含 fixture xlsx 与 cell mappings。种子规则：published R1 required(编号)、R2 compare(日期A, ≤, 日期B)，blocking=1。 |
| When to use | 在 core-engine 中初始化 SLICE-1 种子数据、需要引用子文档 DocType ID（child 特殊批号 on PACK_ID）时使用。 |
| How to use | 从 packages/core-engine/src/pipeline/seed.ts 导入 DOC_TYPE_CHILD_ID，在 seed 流程中与 DOC_TYPE_PARENT_ID 搭配建立 parent/child DocType 关联（parent 编号/日期A，child 特殊批号 on PACK_ID），并配合混凝土施工检验批（GB 50204）的 fixture xlsx 与 cell mappings 完成初始化。 |
| Exports | DOC_TYPE_CHILD_ID |
| Related | DOC_TYPE_PARENT_ID, EMPTY_PACK_NAME, DocumentPipeline |
| Tags | core-engine, seed, SLICE-1, DOC_TYPE_CHILD_ID, DOC_TYPE_PARENT_ID, DocType, PACK_ID, R1, R2, blocking, GB 50204, xlsx, cell mappings, 混凝土施工检验批, SLICE |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-09-14T06:41:10.940Z |

## DOC_TYPE_PARENT_ID

| Field | Value |
|-------|-------|
| Summary | SLICE-1 seed 常量，表示父文档 DocType 的 ID。parent DocType 承载「编号/日期A」字段；配套 Excel demo 为混凝土施工检验批（GB 50204），含 fixture xlsx 与 cell mappings。种子规则：published R1 required(编号)、R2 compare(日期A, ≤, 日期B)，blocking=1。 |
| When to use | 在 core-engine 中初始化 SLICE-1 种子数据、需要引用父文档 DocType ID（parent 编号/日期A）时使用。 |
| How to use | 从 packages/core-engine/src/pipeline/seed.ts 导入 DOC_TYPE_PARENT_ID，在 seed 流程中与 DOC_TYPE_CHILD_ID 搭配建立 parent/child DocType 关联（parent 编号/日期A，child 特殊批号 on PACK_ID），并配合混凝土施工检验批（GB 50204）的 fixture xlsx 与 cell mappings 完成初始化。 |
| Exports | DOC_TYPE_PARENT_ID |
| Related | DOC_TYPE_CHILD_ID, EMPTY_PACK_NAME, DocumentPipeline |
| Tags | core-engine, seed, SLICE-1, DOC_TYPE_PARENT_ID, DOC_TYPE_CHILD_ID, DocType, PACK_ID, R1, R2, blocking, GB 50204, xlsx, cell mappings, 混凝土施工检验批, SLICE |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-09-14T06:41:10.940Z |

## DocumentPipeline

| Field | Value |
|-------|-------|
| Summary | Excel 文档流水线类（export class DocumentPipeline）：generate xlsx artifact → mock adapter upload → signature tasks → Receipt，端到端完成文档产物生成、上传、签名任务与回执产出。 |
| When to use | 需要通过流水线生成 Excel（xlsx）文档产物、经 mock adapter 上传、创建 signature tasks 并产出 Receipt 时使用。 |
| How to use | 从 packages/core-engine/src/pipeline/document-pipeline.ts 导入 DocumentPipeline 并实例化，依次执行四个阶段：generate xlsx artifact → mock adapter upload → signature tasks → Receipt；可与 seed.ts 中的 SLICE-1 种子数据（DOC_TYPE_PARENT_ID / DOC_TYPE_CHILD_ID / EMPTY_PACK_NAME）配合用于演示与测试。 |
| Exports | DocumentPipeline |
| Related | DOC_TYPE_PARENT_ID, DOC_TYPE_CHILD_ID, EMPTY_PACK_NAME |
| Tags | core-engine, DocumentPipeline, pipeline, xlsx, Excel, mock adapter, signature tasks, Receipt, SLICE-1 |
| Source | scan |
| Path | packages/core-engine/src/pipeline/document-pipeline.ts |
| Updated | 2026-09-14T06:41:10.940Z |

## EMPTY_PACK_NAME

| Field | Value |
|-------|-------|
| Summary | SLICE-1 seed 常量（export const EMPTY_PACK_NAME），表示空检验批名称的默认占位值。所在 seed 文件同时定义 published R1 required(编号)、R2 compare(日期A, ≤, 日期B) 规则，blocking=1。 |
| When to use | 在初始化种子数据或测试 fixture 时，需要一个表示空批名（空 PACK_NAME）的占位常量时使用。 |
| How to use | 从 packages/core-engine/src/pipeline/seed.ts 导入 EMPTY_PACK_NAME，在 seed 流程或测试 fixture 中作为空检验批名称占位；与 DOC_TYPE_PARENT_ID / DOC_TYPE_CHILD_ID 同属 SLICE-1 seed，可配合 DocumentPipeline 使用。 |
| Exports | EMPTY_PACK_NAME |
| Related | DOC_TYPE_PARENT_ID, DOC_TYPE_CHILD_ID, DocumentPipeline |
| Tags | core-engine, seed, SLICE-1, EMPTY_PACK_NAME, PACK_NAME, R1, R2, blocking, xlsx, fixture, DocType, SLICE |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-09-14T06:41:10.940Z |

## EMPTY_PACK_VERSION

| Field | Value |
|-------|-------|
| Summary | SLICE-1 种子常量 EMPTY_PACK_VERSION：已发布规则集为 R1 required(编号) 与 R2 compare(日期A, ≤, 日期B)，blocking=1；配套 DocType demo（parent 编号/日期A，child 特殊批号 on PACK_ID）与 Excel demo（混凝土施工检验批 GB 50204，含 fixture xlsx 与 cell mappings）。 |
| When to use | 初始化或重置 demo 种子数据时；需要复现 SLICE-1 已发布规则集（R1 required(编号)、R2 compare(日期A, ≤, 日期B)、blocking=1）或混凝土施工检验批 (GB 50204) Excel 模板演示时。 |
| How to use | 从 packages/core-engine/src/pipeline/seed.ts 导入 EMPTY_PACK_VERSION，随 seed 流程发布 R1/R2 规则并绑定 DocType（parent 编号/日期A，child 特殊批号 on PACK_ID），再关联 fixture xlsx 与 cell mappings 构建 Excel demo。 |
| Exports | EMPTY_PACK_VERSION |
| Related | evaluate, ExcelFillService |
| Tags | core-engine, seed, EMPTY_PACK_VERSION, SLICE-1, R1, R2, required, compare, blocking, DocType, PACK_ID, 特殊批号, 混凝土施工检验批, GB 50204, fixture, xlsx, cell mappings, TypeScript, SLICE |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-09-14T06:42:07.704Z |

## evaluate

| Field | Value |
|-------|-------|
| Summary | sourceDoc §4.3 规则解释器 evaluate：支持 all \| any \| required \| exists \| compare \| regex \| eq 等 DSL 算子；非法或未支持的 DSL 产出 fail 类 EvaluatedFinding，绝不抛异常。 |
| When to use | 需要对 ExtractionFields 字段集执行 EvaluableRule 规则求值并产出 EvaluatedFinding 时；需要规则引擎对坏 DSL 容错（yield fail finding 而非 throw）时。 |
| How to use | 调用 evaluate(fields: ExtractionFields, rules: EvaluableRule[]): EvaluatedFinding[]，传入抽取字段与规则数组；遍历返回的 EvaluatedFinding 处理 fail 项，DSL 含 all/any/required/exists/compare/regex/eq 算子。 |
| Exports | evaluate |
| Related | extractByTemplate |
| Tags | rules, interpreter, evaluate, ExtractionFields, EvaluableRule, EvaluatedFinding, DSL, all, any, required, exists, compare, regex, eq, fail finding, sourceDoc §4.3, core-engine, TypeScript, sourceDoc |
| Source | scan |
| Path | packages/core-engine/src/rules/interpreter.ts |
| Updated | 2026-09-14T06:42:07.705Z |

## ExcelFillService

| Field | Value |
|-------|-------|
| Summary | Excel 填充服务 ExcelFillService：读取 Excel template，应用 effective mappings 并做 placeholder 替换，返回 xlsx buffer。 |
| When to use | 需要基于 Excel template 生成最终 xlsx 文件（如检验批导出下载）时；已有 effective mappings 与 placeholder 需要注入业务数据时。 |
| How to use | 实例化 export class ExcelFillService，传入 Excel template 与 effective mappings，执行 placeholder substitution 后取回 xlsx buffer，用于下载或持久化。 |
| Exports | ExcelFillService |
| Related | EMPTY_PACK_VERSION |
| Tags | excel, ExcelFillService, template, effective mappings, placeholder, substitution, xlsx buffer, fill-service, core-engine, TypeScript |
| Source | scan |
| Path | packages/core-engine/src/excel/fill-service.ts |
| Updated | 2026-09-14T06:42:07.705Z |

## extractByTemplate

| Field | Value |
|-------|-------|
| Summary | 字段抽取函数 extractByTemplate：将 fixture JSON 投影到 template 的 FieldBox keys；缺失 key 置为 JSON null，保证 Job 抽取流程不抛异常。 |
| When to use | 需要把 fixture/抽取得到的原始字段映射为模板 FieldBoxKey 结构时；希望 Job 抽取阶段对缺失字段容错（返回 JSON null 而非抛错）时。 |
| How to use | 调用 extractByTemplate(fields: Record<string, unknown>, boxes: FieldBoxKey[]): Record<string, unknown>，传入原始字段与 FieldBox key 列表，得到按模板键组织的字段记录，缺失 key 为 JSON null。 |
| Exports | extractByTemplate |
| Related | evaluate |
| Tags | extract, extractByTemplate, FieldBox, FieldBoxKey, fixture JSON, JSON null, Job, extraction, core-engine, TypeScript, JSON |
| Source | scan |
| Path | packages/core-engine/src/extract/field-box.ts |
| Updated | 2026-09-14T06:42:07.705Z |

## extractOcrByTemplate

| Field | Value |
|-------|-------|
| Summary | extractOcrByTemplate 对 OCR 全文做硬解析（hard-parse），抽取 编号/日期A/日期B 三个字段，返回 Record<string, unknown>，供 Job 投影到 FieldBox；不凭空补造缺失键，也不为 DSL compare 交换倒置的日期。 |
| When to use | 当 Job 需要从 OCR 全文文本按模板硬解析出 编号/日期A/日期B 并投影到 FieldBox 时；需要保证不发明缺失键、不在 DSL compare 前交换倒置日期时使用。 |
| How to use | 从 packages/core-engine/src/extract/ocr-fields.ts 导入 extractOcrByTemplate，传入 text: string 与 boxes: FieldBoxKey[]，得到 Record<string, unknown> 形式的字段抽取结果，再由 Job 投影到 FieldBox 参与后续 DSL compare。 |
| Exports | extractOcrByTemplate, FieldBoxKey |
| Related | FakeOcr, fieldsForKind |
| Tags | extractOcrByTemplate, OCR, FieldBox, FieldBoxKey, hard-parse, 编号, 日期A, 日期B, DSL compare, 字段抽取, core-engine, DSL |
| Source | scan |
| Path | packages/core-engine/src/extract/ocr-fields.ts |
| Updated | 2026-09-14T06:42:53.485Z |

## FakeOcr

| Field | Value |
|-------|-------|
| Summary | FakeOcr：core-engine 模块 ocr 目录下的 OCR（光学字符识别）假实现（fake/mock），源码位于 packages/core-engine/src/ocr/fake.ts，用于在无真实 OCR 服务时提供占位或模拟的识别能力。javadoc 暂无。 |
| When to use | 本地开发、单元测试或联调阶段需要 OCR 能力，但真实 OCR 服务不可用、不稳定或不想依赖外部服务时，可用 FakeOcr 替换真实 OCR 实现以隔离外部依赖。 |
| How to use | 暂无（javadoc 与 signatures 均缺失）；建议从 packages/core-engine/src/ocr/fake.ts 导入 FakeOcr，参照同目录下真实 OCR 实现的接口进行替换注入。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | FakeOcr, OCR, ocr, fake, mock, core-engine, 测试替身, util |
| Source | refresh |
| Path | packages/core-engine/src/ocr/fake.ts |
| Updated | 2026-09-15T03:42:42.909Z |

## FakePrequery

| Field | Value |
|-------|-------|
| Summary | core-engine 检索链路（retrieve）中的 FakePrequery（预查询 prequery 的伪实现/测试替身），位于 packages/core-engine/src/retrieve/prequery.ts，通常作为 Prequery 的占位实现用于测试或未接入真实 prequery 时的兜底。javadoc 暂无。 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | FakePrequery |
| Related | Prequery |
| Tags | FakePrequery, prequery, retrieve, core-engine, util, TypeScript, mock, test-double |
| Source | refresh |
| Path | packages/core-engine/src/retrieve/prequery.ts |
| Updated | 2026-09-15T07:48:17.722Z |

## fieldsForKind

| Field | Value |
|-------|-------|
| Summary | fieldsForKind 提供 SLICE-1 seed 字段配置：已发布 R1 required（编号）与 R2 compare（日期A, ≤, 日期B），blocking=1；DocType demo：parent 编号/日期A，child 特殊批号 挂在 PACK_ID；Excel demo：混凝土施工检验批（GB 50204），带 fixture xlsx 与单元格映射。 |
| When to use | 初始化 pipeline seed 的字段与规则配置时；需要 DocType 父子字段示例（parent 编号/日期A，child 特殊批号 on PACK_ID）或 Excel 混凝土施工检验批（GB 50204）fixture 示例时使用。 |
| How to use | 从 packages/core-engine/src/pipeline/seed.ts 调用 fieldsForKind，按 DocType 取得已发布规则（R1 required 编号，R2 compare 日期A ≤ 日期B，blocking=1），供 Job 投影与 DSL compare 使用；Excel demo 依赖 fixture xlsx 与单元格映射。 |
| Exports | fieldsForKind |
| Related | extractOcrByTemplate, FakeOcr, FakePrequery |
| Tags | fieldsForKind, SLICE-1, seed, R1, R2 compare, blocking=1, DocType, PACK_ID, 特殊批号, 混凝土施工检验批, GB 50204, fixture xlsx, pipeline, core-engine, SLICE |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-09-14T06:42:53.486Z |

## FIXTURE_OK

| Field | Value |
|-------|-------|
| Summary | SLICE-1 seed 正向测试夹具 FIXTURE_OK：published R1 required(编号) 与 R2 compare(日期A, ≤, 日期B)，blocking=1。DocType demo 含 parent 编号/日期A 与 child 特殊批号 on PACK_ID；Excel demo 为 混凝土施工检验批 (GB 50204) fixture xlsx + cell mappings。 |
| When to use | 需要一套语义正确、应通过校验/比对的规则与文档种子数据时使用 FIXTURE_OK，例如验证 R1 required(编号)、R2 compare(日期A ≤ 日期B) 规则链、parent/child（PACK_ID 特殊批号）以及 GB 50204 混凝土施工检验批 Excel 解析链路。 |
| How to use | 在 pipeline 种子初始化（packages/core-engine/src/pipeline/seed.ts）中引用 FIXTURE_OK 作为合法 seed 装载：规则层使用 published R1/R2（compare 条件 日期A ≤ 日期B，blocking=1），文档层使用 parent 编号/日期A 与 PACK_ID 上的特殊批号，Excel 层加载 fixture xlsx 并应用 cell mappings。与 FIXTURE_REVERSED 成对使用做正反例测试。 |
| Exports | FIXTURE_OK |
| Related | FIXTURE_REVERSED |
| Tags | FIXTURE_OK, SLICE-1, seed, R1, R2, compare, blocking, PACK_ID, 特殊批号, GB 50204, 混凝土施工检验批, xlsx, cell mappings, DocType, core-engine, SLICE |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-09-14T06:43:25.713Z |

## FIXTURE_REVERSED

| Field | Value |
|-------|-------|
| Summary | SLICE-1 seed 反向测试夹具 FIXTURE_REVERSED：与 FIXTURE_OK 同源的规则集（published R1 required(编号)、R2 compare(日期A, ≤, 日期B)，blocking=1），但日期次序反转用于触发失败路径。DocType/Excel demo 同为 parent 编号/日期A、child 特殊批号 on PACK_ID、混凝土施工检验批 (GB 50204) fixture xlsx + cell mappings。 |
| When to use | 需要构造应被 R2 compare(日期A ≤ 日期B) 规则拒绝（blocking=1 生效）的反例数据时使用 FIXTURE_REVERSED，用于验证规则比对失败、阻断流程的分支。 |
| How to use | 与 FIXTURE_OK 成对使用：装载 FIXTURE_REVERSED 后，日期A/日期B 顺序颠倒，断言 R2 compare 规则触发 blocking 阻断；其余结构（parent 编号/日期A、PACK_ID 特殊批号、GB 50204 混凝土施工检验批 xlsx + cell mappings）保持一致以隔离变量。 |
| Exports | FIXTURE_REVERSED |
| Related | FIXTURE_OK |
| Tags | FIXTURE_REVERSED, FIXTURE_OK, SLICE-1, seed, R1, R2, compare, blocking, PACK_ID, 特殊批号, GB 50204, 混凝土施工检验批, xlsx, cell mappings, core-engine, DocType, SLICE |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-09-14T06:43:25.713Z |

## FixtureEmbeddings

| Field | Value |
|-------|-------|
| Summary | FixtureEmbeddings 是面向测试的确定性 hash / n-gram embeddings 实现（implements Embeddings）：相同 paraphrase 共享 n-gram 从而产生相近向量，使 semantic rerank 可通过。非生产级 embedding 服务，也不使用 .ai/arch/vectors.db。 (FixtureEmbeddingsimplements) |
| When to use | 在单测/集成测试中需要 Embeddings 接口的可复现实现时使用 FixtureEmbeddings，例如验证 semantic rerank（n-gram 相近即向量相近）而不依赖外部 embedding 服务或 .ai/arch/vectors.db 持久层。 |
| How to use | 在测试装配中 `new FixtureEmbeddings()`（或经 Embeddings 接口注入）替换生产实现；输入同义改写文本会因共享 n-gram 得到相近向量，据此断言 rerank 排序。勿在生产路径使用，生产应接入真实 embedding 服务并落到 .ai/arch/vectors.db。 |
| Exports | FixtureEmbeddings, Embeddings |
| Related | formatJobContextForPrompt |
| Tags | FixtureEmbeddings, Embeddings, n-gram, hash, deterministic, semantic rerank, paraphrase, vectors.db, .ai/arch, test fixture, core-engine, FixtureEmbeddingsimplements |
| Source | scan |
| Path | packages/core-engine/src/retrieve/embeddings.ts |
| Updated | 2026-09-14T06:43:25.713Z |

## formatJobContextForPrompt

| Field | Value |
|-------|-------|
| Summary | formatJobContextForPrompt 是 core-engine agent 模块（context.ts）中的工具函数，用于将 JobContext（任务上下文）格式化为可注入 Prompt 的文本。原代码暂无 javadoc 注释，具体格式化规则以源码实现为准。 |
| When to use | 当需要为 Agent 构建 Prompt、把 JobContext 序列化/格式化为文本片段时，调用 formatJobContextForPrompt。具体调用时机与上下游依赖暂无说明。 |
| How to use | 暂无（未扫描到函数签名与用法示例，请参考 packages/core-engine/src/agent/context.ts 中 formatJobContextForPrompt 的实现）。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | formatJobContextForPrompt, JobContext, Prompt, Agent, context, core-engine, TypeScript, util, 上下文格式化 |
| Source | refresh |
| Path | packages/core-engine/src/agent/context.ts |
| Updated | 2026-09-17T03:28:40.725Z |

## fromEnv

| Field | Value |
|-------|-------|
| Summary | 从 NodeJS.ProcessEnv 读取 MinIO 的 endpoint/keys 构造 MinioBlobStore 的工厂函数，调用方无需自行读 .env；MinIO 凭据仅保留在本地，此 store 不是资料云 / pending-mount 适配器。 |
| When to use | 需要为 blob 存储创建 MinIO 客户端（MinioBlobStore）且配置可从环境变量获取时；配置缺失时返回 null，适合可选依赖场景。 |
| How to use | 调用 fromEnv(env) 传入 NodeJS.ProcessEnv（缺省使用 process.env），返回 MinioBlobStore \| null；注意返回的 store 仅服务本地 MinIO，不要误用于资料云 / pending-mount 适配场景。 |
| Exports | fromEnv, MinioBlobStore |
| Related | 暂无 |
| Tags | fromEnv, MinIO, MinioBlobStore, blob, NodeJS.ProcessEnv, .env, endpoint, 资料云, pending-mount, core-engine, TypeScript, NodeJS, ProcessEnv |
| Source | scan |
| Path | packages/core-engine/src/blob/minio.ts |
| Updated | 2026-09-14T06:44:27.209Z |

## getSharedSession

| Field | Value |
|-------|-------|
| Summary | 获取进程内共享的 DemoHttpSession（封装 JobPipeline），供 demo HTTP 适配器使用；JSON 出入参遵循 ledger/row 的 snake_case 字段（job_id, trace_id, pack_id），请求体同时接受 camelCase 别名（jobId, packId 等）。 |
| When to use | demo HTTP 适配器需要拿到进程级共享的 JobPipeline 会话时；希望同一进程内多个请求复用同一 DemoHttpSession 上下文时。 |
| How to use | await getSharedSession() 返回 Promise<DemoHttpSession>；随后将返回的 session 传给 handleDemoRequest 处理具体请求。 |
| Exports | getSharedSession, DemoHttpSession |
| Related | handleDemoRequest |
| Tags | getSharedSession, DemoHttpSession, JobPipeline, job_id, trace_id, pack_id, jobId, packId, snake_case, camelCase, HTTP, session, ledger, core-engine, JSON |
| Source | scan |
| Path | packages/core-engine/src/http/session.ts |
| Updated | 2026-09-14T06:44:27.209Z |

## handleDemoRequest

| Field | Value |
|-------|-------|
| Summary | core-engine 包中的 HTTP 请求处理工具函数 handleDemoRequest，位于 packages/core-engine/src/http/handle-request.ts，用于统一处理 demo 请求入口。 |
| When to use | 当前端需要集中收口或统一拦截 demo 请求、复用 http 请求处理逻辑时使用 handleDemoRequest；暂无更详细的 javadoc 说明。 |
| How to use | 从 packages/core-engine/src/http/handle-request.ts 导入 handleDemoRequest 并传入请求参数调用；具体函数签名暂无（signatures 为空），可结合源码确认参数与返回值。 |
| Exports | handleDemoRequest |
| Related | 暂无 |
| Tags | util, handleDemoRequest, http, handle-request, core-engine, 请求处理, TypeScript |
| Source | refresh |
| Path | packages/core-engine/src/http/handle-request.ts |
| Updated | 2026-09-19T06:37:32.788Z |

## HASH_EMBED_DIM

| Field | Value |
|-------|-------|
| Summary | HASH_EMBED_DIM 常量定义确定性 hash / n-gram embeddings 的向量维度，专为测试设计：相同释义（paraphrases）共享 n-gram → 得到相似向量，使 semantic rerank 能通过。非生产级 embedding 服务，不涉及 `.ai/arch/vectors.db`。 |
| When to use | 在测试或 walking-skeleton 中需要确定性 embeddings、且无外部 embedding 服务依赖时；或需要与 HashEmbeddings 输出的向量维度保持一致时。不要用于生产检索。 |
| How to use | 从 packages/core-engine/src/retrieve/embeddings.ts 导入 HASH_EMBED_DIM，作为向量维度常量使用（如初始化向量数组、校验 Embeddings 实现的输出维度）。 |
| Exports | HASH_EMBED_DIM |
| Related | HashEmbeddings, IndependentReranker |
| Tags | HASH_EMBED_DIM, hash, n-gram, embeddings, semantic rerank, vector, test, walking-skeleton |
| Source | scan |
| Path | packages/core-engine/src/retrieve/embeddings.ts |
| Updated | 2026-09-14T06:45:07.541Z |

## HashEmbeddings

| Field | Value |
|-------|-------|
| Summary | HashEmbeddings 类实现 Embeddings 接口，提供确定性 hash / n-gram embeddings，专用于测试：同义改写因共享 n-gram 而得到相似向量，使 semantic rerank 能通过。非生产 embedding 服务，非 `.ai/arch/vectors.db`。 (HashEmbeddingsimplements) |
| When to use | 测试 semantic rerank 或检索链路时，需要 paraphrases 产生相似向量；本地/离线环境无 embedding 服务可用时。生产环境勿用。 |
| How to use | new HashEmbeddings() 后按 Embeddings 接口调用 embed 方法生成向量；配合 IndependentReranker 验证 cosine 相似度重排效果。 |
| Exports | HashEmbeddings |
| Related | HASH_EMBED_DIM, IndependentReranker |
| Tags | HashEmbeddings, Embeddings, hash, n-gram, embeddings, semantic rerank, vector, test, HashEmbeddingsimplements |
| Source | scan |
| Path | packages/core-engine/src/retrieve/embeddings.ts |
| Updated | 2026-09-14T06:45:07.541Z |

## IndependentReranker

| Field | Value |
|-------|-------|
| Summary | 独立重排序器（IndependentReranker），位于 packages/core-engine/src/retrieve/rerank.ts，用于在检索（retrieve）流程中对候选结果执行独立 rerank 重排序，各候选的打分相互独立。javadoc 与方法签名暂无，具体字段暂无。 |
| When to use | 当 retrieve 检索返回的候选集需要按相关性进行 rerank 重排序，且希望每个候选的评分独立计算、互不干扰时，使用 IndependentReranker。 |
| How to use | 从 packages/core-engine/src/retrieve/rerank.ts 导入 IndependentReranker 后调用；具体方法签名与参数暂无。 |
| Exports | IndependentReranker |
| Related | 暂无 |
| Tags | IndependentReranker, rerank, retrieve, RAG（检索增强生成）, core-engine, TypeScript |
| Source | refresh |
| Path | packages/core-engine/src/retrieve/rerank.ts |
| Updated | 2026-09-19T09:12:52.018Z |

## isMigrated

| Field | Value |
|-------|-------|
| Summary | isMigrated 函数检查 SQLite 迁移状态，覆盖 walking-skeleton ledger 表（SLICE-1..6 含 standard library）。生产契约仍是 docs/schema/generated/core-engine-migration.sql（PostgreSQL）。 |
| When to use | 在 SQLite（walking-skeleton）环境下启动前，需判断 ledger 表（SLICE-1..6）是否已迁移完成时。 |
| How to use | await isMigrated(dbPath)，传入 SQLite 数据库路径，返回 Promise<boolean>；返回 false 时先执行迁移再继续。生产环境（PostgreSQL）以 docs/schema/generated/core-engine-migration.sql 为准。 |
| Exports | isMigrated |
| Related | 暂无 |
| Tags | isMigrated, SQLite, migration, ledger, SLICE-1, SLICE-6, walking-skeleton, standard library, PostgreSQL, core-engine-migration.sql, dbPath, SLICE |
| Source | scan |
| Path | packages/core-engine/src/persistence/migrate.ts |
| Updated | 2026-09-14T06:45:07.541Z |

## JobPipeline

| Field | Value |
|-------|-------|
| Summary | core-engine 模块中的 JobPipeline（作业流水线）工具，位于 packages/core-engine/src/pipeline/job-pipeline.ts，用于将多个 Job（作业）按 pipeline 方式编排并统一执行。signatures 暂无，具体 API 以源文件为准。 |
| When to use | 需要在前端 core-engine 内编排、串联多个 Job 形成流水线（pipeline）并统一调度执行时使用。 |
| How to use | 从 packages/core-engine/src/pipeline/job-pipeline.ts 导入 JobPipeline，按 pipeline 顺序注册 Job 并触发执行；方法签名暂无（signatures 为空），具体用法请查看源文件。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | JobPipeline, pipeline, Job, core-engine, util, TypeScript, 任务流水线, 作业编排, 前端 |
| Source | refresh |
| Path | packages/core-engine/src/pipeline/job-pipeline.ts |
| Updated | 2026-09-19T09:13:24.653Z |

## JobStepOrchestrator

| Field | Value |
|-------|-------|
| Summary | 步骤编排器：定义 job-step-v1 何时运行，以及 confirm-next 必须恢复 HITL（人在回路）的步骤。 |
| When to use | 当需要编排 job-step-v1 的执行步骤，或在 confirm-next 后必须恢复 HITL 交互时使用。 |
| How to use | 通过 JobStepOrchestrator 管理步骤流转：由 job-step-v1 负责运行各步骤，confirm-next 触发恢复 HITL；可与 JobPipeline 配合完成整体流程编排。 |
| Exports | JobStepOrchestrator |
| Related | JobPipeline |
| Tags | JobStepOrchestrator, job-step-v1, confirm-next, HITL, orchestrator, 步骤编排, core-engine, TypeScript |
| Source | scan |
| Path | packages/core-engine/src/agent/job-step-orchestrator.ts |
| Updated | 2026-09-14T06:45:51.222Z |

## LedgerConflictError

| Field | Value |
|-------|-------|
| Summary | 账本冲突错误类（LedgerConflictError extends Error），在 job pipeline 写 Receipt 过程中发生账本（Ledger）冲突时抛出。 (LedgerConflictErrorextends, JSON, HITL) |
| When to use | 在捕获或识别 job pipeline / Receipt 写入引发的账本冲突（Ledger conflict）时使用。 |
| How to use | 在 JobPipeline 的 Receipt 写入流程中使用 try/catch 捕获 LedgerConflictError，对账本冲突做补偿处理或用户提示。 |
| Exports | LedgerConflictError |
| Related | JobPipeline |
| Tags | LedgerConflictError, Error, Receipt, ledger, 账本冲突, job pipeline, core-engine, TypeScript, LedgerConflictErrorextends, JSON, HITL |
| Source | scan |
| Path | packages/core-engine/src/pipeline/job-pipeline.ts |
| Updated | 2026-09-14T06:45:51.222Z |

## listCommittedAdapterWrites

| Field | Value |
|-------|-------|
| Summary | C4 mock adapter 的查询函数，返回已提交的写入记录 CommittedAdapterWrite[]。mock 语义：pending-mount 返回 receipt_id；无 receipt 的写入失败且不持久化。 |
| When to use | 在 C4 mock adapter 场景下，需要查看或断言哪些 adapter 写入已被提交（携带 receipt_id）、以及验证无 receipt 写入不持久化时使用。 |
| How to use | 调用 listCommittedAdapterWrites() 获取 CommittedAdapterWrite[]，用于验证 mock adapter 行为：pending-mount 返回 receipt_id，无 receipt 的写入失败且不落库。 |
| Exports | listCommittedAdapterWrites |
| Related | 暂无 |
| Tags | listCommittedAdapterWrites, CommittedAdapterWrite, C4, mock adapter, pending-mount, receipt_id, adapter, core-engine, TypeScript |
| Source | scan |
| Path | packages/core-engine/src/adapter/mock.ts |
| Updated | 2026-09-14T06:45:51.222Z |

## liveRetrievePorts

| Field | Value |
|-------|-------|
| Summary | core-engine 检索（retrieve）子系统的实时端口工具 liveRetrievePorts，位于 packages/core-engine/src/retrieve/live-ports.ts，用于定义或装配实时检索端口（live retrieval ports）。javadoc 与函数签名暂无，具体 API 详情暂无。 |
| When to use | 需要在 core-engine 中接入、扩展或替换实时检索（liveRetrievePorts / live-ports）能力时使用；详细触发场景暂无。 |
| How to use | 从 packages/core-engine/src/retrieve/live-ports.ts 引入 liveRetrievePorts 后调用；具体参数与返回值暂无（signatures 为空）。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | core-engine, retrieve, liveRetrievePorts, live-ports, util, 实时检索, 端口 |
| Source | refresh |
| Path | packages/core-engine/src/retrieve/live-ports.ts |
| Updated | 2026-09-19T13:22:36.787Z |

## loadConcreteFixtureMapping

| Field | Value |
|-------|-------|
| Summary | SLICE-1 seed 映射加载：published 规则 R1 required(编号) 与 R2 compare(日期A, ≤, 日期B)，blocking=1。DocType 演示：parent 编号/日期A，child 特殊批号 on PACK_ID。Excel 演示：混凝土施工检验批 (GB 50204)，含 fixture xlsx + cell mappings。 |
| When to use | 需要加载混凝土施工检验批 (GB 50204) 的 fixture 与 cell mappings 做种子数据/演示时；需要 R1/R2 规则示例（required、compare、blocking=1）及 parent/child DocType（编号、日期A、日期B、特殊批号、PACK_ID）时。 |
| How to use | 调用 loadConcreteFixtureMapping(jsonPath?)，默认读取 CONCRETE_FIXTURE_MAPPING_JSON，返回 ConcreteFixtureMapping 供 pipeline seed 使用。 |
| Exports | loadConcreteFixtureMapping, ConcreteFixtureMapping, CONCRETE_FIXTURE_MAPPING_JSON |
| Related | 暂无 |
| Tags | loadConcreteFixtureMapping, ConcreteFixtureMapping, CONCRETE_FIXTURE_MAPPING_JSON, SLICE-1, R1, R2, blocking, PACK_ID, GB 50204, 混凝土施工检验批, fixture, cell mappings, seed, Excel, TypeScript, jsonPath, DocType, SLICE |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-09-14T06:46:46.923Z |

## MAX_UPLOAD_BYTES

| Field | Value |
|-------|-------|
| Summary | Walking-skeleton job pipeline 的上传体积上限常量 MAX_UPLOAD_BYTES，约束 fixture upload → extract JSON → R1/R2 → findings + audit 流程的请求大小。同模块约定：Chat 仅 HITL（human-in-the-loop），只持久化消息，不改变 job.status，不写 Receipt。 |
| When to use | 校验上传文件是否超过上限需要拒绝时；搭建或理解 job pipeline（fixture upload → R1/R2 → findings + audit）的上传约束时。 |
| How to use | 从 job-pipeline 导入 MAX_UPLOAD_BYTES，在上传入口比较请求体大小，超限则拒绝并返回错误。 |
| Exports | MAX_UPLOAD_BYTES |
| Related | 暂无 |
| Tags | MAX_UPLOAD_BYTES, job pipeline, walking-skeleton, fixture upload, extract JSON, R1/R2, findings, audit, HITL, job.status, Receipt, TypeScript, JSON |
| Source | scan |
| Path | packages/core-engine/src/pipeline/job-pipeline.ts |
| Updated | 2026-09-14T06:46:46.924Z |

## MemoryBlobStore

| Field | Value |
|-------|-------|
| Summary | 内存版 BlobStore 实现 MemoryBlobStore：让单元测试无需 MinIO 或 process.env。put/get 时均复制 buffer，调用方无法篡改已存储对象。 |
| When to use | 编写单元测试需要 BlobStore 但不想依赖 MinIO / process.env 时；本地快速验证 blob 读写与隔离语义时。 |
| How to use | 实例化 MemoryBlobStore（implements BlobStore）注入被测代码；注意 put/get 返回的是 buffer 拷贝，外部修改不影响存储内容。 |
| Exports | MemoryBlobStore, BlobStore |
| Related | 暂无 |
| Tags | MemoryBlobStore, BlobStore, MinIO, process.env, in-memory, unit-test, blob, TypeScript, MemoryBlobStoreimplements |
| Source | scan |
| Path | packages/core-engine/src/blob/memory.ts |
| Updated | 2026-09-14T06:46:46.924Z |

## MemoryGraphStore

| Field | Value |
|-------|-------|
| Summary | 内存图存储器 MemoryGraphStore，位于 packages/core-engine/src/retrieve/memory-graph.ts，属于 core-engine 模块的 retrieve（检索）子系统，用于在内存中维护图结构数据以支撑基于图的检索与上下文组织。 |
| When to use | 当需要在 core-engine 内以图结构方式组织记忆/知识节点并执行内存级检索（retrieve）时使用 MemoryGraphStore；具体公开方法签名暂无（源码未提供 signatures）。 |
| How to use | 暂无公开 API 文档；请直接参考源码 packages/core-engine/src/retrieve/memory-graph.ts 中 MemoryGraphStore 的实例化与读写接口。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | MemoryGraphStore, core-engine, retrieve, memory-graph, graph-store, 内存图存储, 检索, util, frontend |
| Source | refresh |
| Path | packages/core-engine/src/retrieve/memory-graph.ts |
| Updated | 2026-09-15T06:17:21.125Z |

## MemoryVectorStore

| Field | Value |
|-------|-------|
| Summary | core-engine 检索（retrieve）模块中的内存向量存储实现 MemoryVectorStore，将向量（embedding）保存在进程内存中，用于在不依赖外部向量数据库的情况下执行向量相似度检索。 |
| When to use | 需要在 core-engine 的 retrieve 流程中进行轻量级向量检索时使用 MemoryVectorStore，适用于原型验证、小规模资产索引、单元测试或无需持久化的场景；若需持久化、大规模索引或分布式检索，应改用外部向量库方案。暂无更具体的 javadoc 描述。 |
| How to use | 暂无（未提取到公开方法签名与 javadoc，请参考 packages/core-engine/src/retrieve/memory-vector.ts 源码，确认初始化、向量写入与相似度查询的具体 API 后补充）。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | MemoryVectorStore, vector store, 向量检索, embedding, retrieve, 内存向量库, core-engine, TypeScript |
| Source | refresh |
| Path | packages/core-engine/src/retrieve/memory-vector.ts |
| Updated | 2026-09-15T10:05:10.562Z |

## MinioBlobStore

| Field | Value |
|-------|-------|
| Summary | 基于 MinIO 的 BlobStore 实现（MinioBlobStore），构造参数支持直接传入 endpoint/keys 而不必读取 .env；MinIO 凭据仅保留在本地，注意该存储不是资料云 / pending-mount 适配器。提供 fromEnv(env: NodeJS.ProcessEnv) 工厂函数与 MinioBlobStoreOptions 类型。 |
| When to use | 需要对接 MinIO 做对象/blob 读写、且希望显式传入 endpoint 与密钥（避免隐式读取 .env）时使用；请勿将其误用作资料云或 pending-mount 适配器。 |
| How to use | 通过 fromEnv(env) 从环境变量构建 MinioBlobStore 实例（失败返回 null），或用 MinioBlobStoreOptions 显式指定 endpoint/accessKey/secretKey 后直接构造，再以 BlobStore 接口注入调用方。 |
| Exports | fromEnv, MinioBlobStore, MinioBlobStoreOptions |
| Related | BlobStore, mockPendingMount |
| Tags | MinIO, BlobStore, MinioBlobStore, MinioBlobStoreOptions, fromEnv, endpoint, credentials, .env, 资料云, pending-mount, 对象存储, NodeJS, ProcessEnv, MinioBlobStoreimplements |
| Source | scan |
| Path | packages/core-engine/src/blob/minio.ts |
| Updated | 2026-09-14T06:47:12.894Z |

## mockPendingMount

| Field | Value |
|-------|-------|
| Summary | C4 mock adapter（mockPendingMount）：pending-mount 请求返回 receipt_id 回执；未携带 receipt 的写入会直接失败且不持久化，用于在无真实资料云依赖时模拟挂载流程。 |
| When to use | C4 架构验证或本地联调中需要模拟 pending-mount 行为、但不希望数据真实落盘时使用；也可用于验证调用方对「缺少 receipt 的写入被拒绝」这一约束的处理逻辑。 |
| How to use | 以 mock adapter 方式替换真实资料云/pending-mount 适配器注入；调用 pending-mount 获取 receipt_id 后再执行写入，写入时未携带 receipt 将触发失败且不会持久化任何数据。 |
| Exports | 暂无 |
| Related | MinioBlobStore |
| Tags | mockPendingMount, pending-mount, receipt_id, C4, mock adapter, 资料云, 挂载回执, core-engine |
| Source | scan |
| Path | packages/core-engine/src/adapter/mock.ts |
| Updated | 2026-09-14T06:47:12.894Z |

## Neo4jGraphStore

| Field | Value |
|-------|-------|
| Summary | core-engine 模块中的图存储工具 Neo4jGraphStore，位于 packages/core-engine/src/retrieve/neo4j.ts，负责封装 Neo4j 图数据库的连接与图数据读写，为 retrieve（检索）链路提供图存储能力 |
| When to use | 当需要在 Neo4j 图数据库中持久化或查询图结构数据（如代码资产关系、依赖图、知识图谱）时使用；属于 core-engine 的 retrieve（检索）子链路 |
| How to use | 暂无（未扫描到公开签名，请参考源码 packages/core-engine/src/retrieve/neo4j.ts 中 Neo4jGraphStore 的导出与初始化方式） |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | Neo4jGraphStore, Neo4j, core-engine, retrieve, graph, 图数据库, 图存储 |
| Source | refresh |
| Path | packages/core-engine/src/retrieve/neo4j.ts |
| Updated | 2026-09-15T06:17:11.777Z |

## newId

| Field | Value |
|-------|-------|
| Summary | 生成带前缀的短 ID（short prefixed id），用作 ledger（台账）业务主键 business key。 (newId) |
| When to use | 需要为 ledger 业务键、实体标识生成简短且带类型前缀的 ID 时使用，例如流水、任务等业务对象的唯一键。 |
| How to use | 调用 newId(prefix: string): string，传入业务前缀，返回拼接后的短 ID 字符串，可直接作为 ledger 的 business key 存储。 |
| Exports | newId |
| Related | 暂无 |
| Tags | newId, id, ledger, business key, prefix, 短ID, core-engine |
| Source | scan |
| Path | packages/core-engine/src/ids.ts |
| Updated | 2026-09-14T06:47:55.082Z |

## nodeRequestToDemo

| Field | Value |
|-------|-------|
| Summary | 将 Node.js IncomingMessage 请求解析为 DemoHttpRequest 的工具函数。内置手写 multipart 解析器（hand-rolled multipart parser，不引入新依赖），仅暴露 POST /api/jobs/upload 上传路由所需字段；同时提供结构化 Vite 插件形态 ViteMiddlewarePlugin，避免 core-engine 依赖 vite 包。 |
| When to use | 在 Node HTTP 服务中需要把原始请求（含 multipart/form-data 上传、boundary 提取、Content-Disposition 解析、MIME 推断）转换为 DemoHttpRequest 时使用；或需要以 ViteMiddlewarePlugin 形态挂载中间件并匹配 /api/ 与 /adapter/ 路径（isAdapterPath）时使用。 |
| How to use | 调用 nodeRequestToDemo(req: IncomingMessage): Promise<DemoHttpRequest> 完成请求解析；上传场景自动通过 isMultipartContentType 判断 content-type、extractBoundary 提取 boundary、parseContentDisposition 提取 name 与 fileName、guessMime 推断 MIME 类型，使 POST /api/jobs/upload 能拿到二进制文件字节。 |
| Exports | nodeRequestToDemo |
| Related | DemoHttpRequest, ViteMiddlewarePlugin, /api/jobs/upload, IncomingMessage |
| Tags | nodeRequestToDemo, DemoHttpRequest, multipart, boundary, IncomingMessage, ViteMiddlewarePlugin, /api/jobs/upload, isAdapterPath, guessMime, parseContentDisposition, HTTP解析, 文件上传, core-engine, configureServer, ServerResponse, startsWith, readContentType, isArray, isMultipartContentType, contentType, toLowerCase, extractBoundary, endsWith |
| Source | scan |
| Path | packages/core-engine/src/http/node.ts |
| Updated | 2026-09-14T06:47:55.083Z |

## NoOpenHitlError

| Field | Value |
|-------|-------|
| Summary | 表示不存在打开的 HITL（Human-in-the-loop，人机协同）会话的错误类，继承自 Error。用于 job-step-v1 步骤运行及 confirm-next 恢复 HITL 的编排场景。 |
| When to use | 在 job-step-orchestrator 编排中，当 confirm-next 尝试恢复 HITL 但当前没有打开的 HITL 会话时抛出；调用方捕获该错误以处理会话缺失。 |
| How to use | 在执行 job-step-v1 步骤或调用 confirm-next 恢复 HITL 的代码路径中 try/catch 捕获 NoOpenHitlError，据此识别无待恢复 HITL 会话的情况并做相应分支处理。 |
| Exports | NoOpenHitlError |
| Related | job-step-v1, confirm-next, HITL, job-step-orchestrator, Error |
| Tags | NoOpenHitlError, HITL, job-step-v1, confirm-next, job-step-orchestrator, Error, 人机协同, core-engine, NoOpenHitlErrorextends |
| Source | scan |
| Path | packages/core-engine/src/agent/job-step-orchestrator.ts |
| Updated | 2026-09-14T06:47:55.083Z |

## nowIso

| Field | Value |
|-------|-------|
| Summary | 生成当前时间的 ISO 格式字符串（nowIso(): string），用于构造带前缀的短 id，作为 ledger（台账）业务键。 |
| When to use | 需要为 ledger 业务键生成短前缀 id 或记录业务发生时间戳时，使用 nowIso。 |
| How to use | 直接调用 nowIso() 获取当前 ISO 时间字符串，通常在 ids.ts 相关流程中与前缀拼接生成业务主键。 |
| Exports | nowIso |
| Related | 暂无 |
| Tags | nowIso, iso, id, ledger, ids, core-engine, util, TypeScript |
| Source | scan |
| Path | packages/core-engine/src/ids.ts |
| Updated | 2026-09-14T06:48:37.027Z |

## ORCHESTRATED_STEPS

| Field | Value |
|-------|-------|
| Summary | 被编排步骤集合常量 ORCHESTRATED_STEPS：标记由 job-step-v1 执行、且需通过 confirm-next 恢复 HITL（人工在环）的步骤范围。 |
| When to use | 在 agent/job-step-orchestrator 中判断某步骤是否属于 job-step-v1 编排范围，或 confirm-next 需要恢复 HITL 流程时使用。 |
| How to use | 导入 ORCHESTRATED_STEPS 常量，用步骤名做成员判断（如 includes），据此决定走 job-step-v1 执行路径并挂接 confirm-next 的 HITL 恢复逻辑。 |
| Exports | ORCHESTRATED_STEPS |
| Related | 暂无 |
| Tags | ORCHESTRATED_STEPS, job-step-v1, confirm-next, HITL, orchestrator, agent, core-engine, TypeScript |
| Source | scan |
| Path | packages/core-engine/src/agent/job-step-orchestrator.ts |
| Updated | 2026-09-14T06:48:37.027Z |

## PACK_ID

| Field | Value |
|-------|-------|
| Summary | SLICE-1 种子数据中的检验批标识常量 PACK_ID：已发布 R1 required(编号) 与 R2 compare(日期A, ≤, 日期B) 规则，blocking=1；DocType 演示为 parent 编号/日期A、child 特殊批号 挂在 PACK_ID 上；Excel 演示为混凝土施工检验批 (GB 50204)，含 fixture xlsx 与 cell mappings。 |
| When to use | 初始化或校验 pipeline seed 数据、搭建 SLICE-1 演示场景（R1/R2 规则、DocType parent/child、GB 50204 Excel 用例）时引用 PACK_ID。 |
| How to use | 从 pipeline/seed 导入 PACK_ID，将 特殊批号 等 child 字段或 Excel cell mappings 关联到该检验批 id，完成种子填充与演示数据装配。 |
| Exports | PACK_ID |
| Related | 暂无 |
| Tags | PACK_ID, SLICE-1, R1, R2, required, compare, blocking, DocType, 特殊批号, GB 50204, 混凝土施工检验批, fixture xlsx, cell mappings, seed, pipeline, core-engine, SLICE |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-09-14T06:48:37.027Z |

## parseMultipartBody

| Field | Value |
|-------|-------|
| Summary | 手写的 multipart/form-data 解析器，从 Buffer 按 boundary 解析出表单字段与二进制文件字节，不引入新依赖；仅呈现 POST /api/jobs/upload 所需字段，返回 DemoHttpMultipart。 |
| When to use | 在 ViteMiddlewarePlugin.configureServer 挂载的 adapter 路由（isAdapterPath 判定 /api/ 或 /adapter/ 前缀）中，请求 Content-Type 为 multipart/form-data 且需要拿到文件原始字节时；典型场景是 POST /api/jobs/upload。 |
| How to use | 先用 isMultipartContentType 判断 Content-Type，调用 extractBoundary 从 header 提取 boundary，再调用 parseMultipartBody(raw: Buffer, boundary: string): DemoHttpMultipart 得到字段与文件；字段名/文件名由 parseContentDisposition 解析 Content-Disposition 获得，MIME 由 guessMime 按扩展名兜底。 |
| Exports | parseMultipartBody, DemoHttpMultipart |
| Related | POST /api/jobs/upload, ViteMiddlewarePlugin, isAdapterPath, isMultipartContentType, extractBoundary, parseContentDisposition, guessMime |
| Tags | parseMultipartBody, multipart, form-data, boundary, Buffer, upload, /api/jobs/upload, DemoHttpMultipart, extractBoundary, guessMime, IncomingMessage, core-engine, ViteMiddlewarePlugin, configureServer, ServerResponse, isAdapterPath, startsWith, readContentType, isArray, isMultipartContentType, contentType, toLowerCase, endsWith, parseContentDisposition |
| Source | scan |
| Path | packages/core-engine/src/http/node.ts |
| Updated | 2026-09-14T06:49:22.480Z |

## parseOcrFields

| Field | Value |
|-------|-------|
| Summary | 硬解析 OCR 全文为 编号/日期A/日期B 三个字段，使 Job 能投影到 FieldBox；不发明缺失键，也不在日期倒置时为 DSL compare 悄悄对调。 |
| When to use | 拿到 OCR 全文后需要提取 编号、日期A、日期B 并写入 FieldBox 时；要求键不缺造、倒置日期保持原样供 DSL compare 判断时。 |
| How to use | 调用 parseOcrFields(text: string): Record<string, string>，传入 OCR 全文，返回含 编号/日期A/日期B 的键值映射；随后由 Job 投影到 FieldBox，再交给 DSL compare 比对。 |
| Exports | parseOcrFields |
| Related | FieldBox, Job, DSL compare, OCR |
| Tags | parseOcrFields, OCR, FieldBox, 编号, 日期A, 日期B, DSL compare, Job, extract, core-engine, DSL |
| Source | scan |
| Path | packages/core-engine/src/extract/ocr-fields.ts |
| Updated | 2026-09-14T06:49:22.480Z |

## PostgresLedger

| Field | Value |
|-------|-------|
| Summary | PostgresLedger 是 core-engine 模块中基于 PostgreSQL 的持久化台账（ledger）存储实现，源码位于 packages/core-engine/src/persistence/pg-store.ts，负责台账数据的落库与读取。该类的 javadoc 与方法签名（signatures）暂无，具体 API 以源码为准。 |
| When to use | 当需要在 core-engine 中将台账（ledger）类数据持久化到 PostgreSQL 数据库，或从 PostgreSQL 中读取台账数据时，使用 PostgresLedger。 |
| How to use | 暂无公开签名说明。请直接查看 packages/core-engine/src/persistence/pg-store.ts 源码，确认 PostgresLedger 的构造参数（如 PostgreSQL 连接配置）及可调用方法后再集成；引入路径形如 core-engine/persistence/pg-store。 |
| Exports | PostgresLedger |
| Related | 暂无 |
| Tags | PostgresLedger, PostgreSQL, pg-store, persistence, ledger, 台账, 持久化, storage, core-engine, util |
| Source | refresh |
| Path | packages/core-engine/src/persistence/pg-store.ts |
| Updated | 2026-09-15T05:41:52.042Z |

## QdrantVectorStore

| Field | Value |
|-------|-------|
| Summary | 基于 Qdrant 的向量存储封装 QdrantVectorStore，位于 core-engine 模块的 retrieve（检索）目录（packages/core-engine/src/retrieve/qdrant.ts），用于向量数据存取与检索。详细说明暂无。 |
| When to use | 在前端 scope 下需要通过 QdrantVectorStore 进行向量存储、相似度检索或为 retrieve 检索链路提供向量数据源时使用。具体触发场景说明暂无。 |
| How to use | 从 packages/core-engine/src/retrieve/qdrant.ts 引入 QdrantVectorStore 后按其导出接口调用。由于暂无 signatures 与 javadoc，具体方法调用方式暂无，请参考源码文件确认初始化参数与 API。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | QdrantVectorStore, Qdrant, vector, VectorStore, 向量存储, 向量检索, retrieve, core-engine, frontend |
| Source | refresh |
| Path | packages/core-engine/src/retrieve/qdrant.ts |
| Updated | 2026-09-19T09:09:51.976Z |

## R1_DSL

| Field | Value |
|-------|-------|
| Summary | SLICE-1 seed 中的规则 R1_DSL：required(编号) 必填校验，published 状态，blocking=1（阻断级）。与 R2_DSL 同存于 pipeline/seed.ts，配套 DocType demo（parent 编号/日期A，child 特殊批号 on PACK_ID）与 Excel demo（混凝土施工检验批 GB 50204，fixture xlsx + cell mappings）。 |
| When to use | 需要为规则引擎 pipeline 注入 SLICE-1 种子规则（required 类校验、编号必填、blocking=1），或复用 DocType/Excel demo 数据做端到端验证时使用。 |
| How to use | 从 packages/core-engine/src/pipeline/seed.ts 导入 R1_DSL，随 SLICE-1 seed 一并发布；通常与 R2_DSL（compare(日期A, ≤, 日期B)）组合用于验证规则解析与执行链路。 |
| Exports | R1_DSL |
| Related | R2_DSL, packages/core-engine/src/pipeline/seed.ts |
| Tags | R1_DSL, R2_DSL, SLICE-1, seed, required, blocking=1, PACK_ID, GB 50204, DSL, 规则引擎, Excel fixture, cell mappings, DocType, SLICE |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-09-14T06:50:22.149Z |

## R2_DSL

| Field | Value |
|-------|-------|
| Summary | SLICE-1 seed 中的规则 R2_DSL：compare(日期A, ≤, 日期B) 比较校验，published 状态，blocking=1（阻断级）。与 R1_DSL（required(编号)）同存于 pipeline/seed.ts，配套 DocType demo（parent 编号/日期A，child 特殊批号 on PACK_ID）与 Excel demo（混凝土施工检验批 GB 50204，fixture xlsx + cell mappings）。 |
| When to use | 需要为规则引擎 pipeline 注入 SLICE-1 种子规则（日期比较类校验、blocking=1），或验证 compare 型 DSL 规则解析与执行时使用。 |
| How to use | 从 packages/core-engine/src/pipeline/seed.ts 导入 R2_DSL，随 SLICE-1 seed 一并发布；通常与 R1_DSL（required(编号)）组合作为规则引擎的最小验证集。 |
| Exports | R2_DSL |
| Related | R1_DSL, packages/core-engine/src/pipeline/seed.ts |
| Tags | R2_DSL, R1_DSL, SLICE-1, seed, compare, blocking=1, PACK_ID, GB 50204, DSL, 规则引擎, Excel fixture, cell mappings, DocType, SLICE |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-09-14T06:50:22.149Z |

## readNodeBody

| Field | Value |
|-------|-------|
| Summary | Node 原生 HTTP 请求体读取 util：readNodeBody(req: IncomingMessage): Promise<unknown>。内置手写 multipart/form-data 解析器（不引入新依赖），支持 extractBoundary 提取 boundary、parseContentDisposition 解析 Content-Disposition、guessMime 按文件名推断 MIME（jpg/jpeg/png/pdf），供 POST /api/jobs/upload 等上传路由获取二进制文件 bytes。另定义结构化 ViteMiddlewarePlugin 接口（name + configureServer(middlewares.use)），使 core-engine 不依赖 vite 包。 |
| When to use | 在 Vite configureServer 中间件或 Node http 服务中解析 JSON 请求体、multipart/form-data 上传（如 POST /api/jobs/upload），或需 /api/ 与 /adapter/ 路径判断（isAdapterPath）时使用。 |
| How to use | await readNodeBody(req) 获取解析后的 body；multipart 请求经 extractBoundary + parseContentDisposition 拆分 part，返回文件 bytes、fileName 及 guessMime 推断的 contentType（默认 application/octet-stream）。仅暴露 POST /api/jobs/upload 所需字段。 |
| Exports | readNodeBody |
| Related | ViteMiddlewarePlugin, configureServer, isAdapterPath, POST /api/jobs/upload, packages/core-engine/src/http/node.ts |
| Tags | readNodeBody, multipart/form-data, boundary, Content-Disposition, guessMime, extractBoundary, parseContentDisposition, ViteMiddlewarePlugin, configureServer, isAdapterPath, IncomingMessage, POST /api/jobs/upload, http, util, ServerResponse, startsWith, readContentType, isArray, isMultipartContentType, contentType, toLowerCase, endsWith, fileName |
| Source | scan |
| Path | packages/core-engine/src/http/node.ts |
| Updated | 2026-09-14T06:50:22.149Z |

## readRawBody

| Field | Value |
|-------|-------|
| Summary | Node 原生 HTTP 工具集：readRawBody(req: IncomingMessage) 将请求体聚合为 Promise<Buffer>；同文件内置手写 multipart 解析器（isMultipartContentType / extractBoundary / parseContentDisposition / guessMime），使上传路由无需新增依赖即可拿到二进制文件字节，仅暴露 POST /api/jobs/upload 所需字段；另提供结构化 ViteMiddlewarePlugin 形状（configureServer + middlewares.use）避免 core-engine 依赖 vite 包，isAdapterPath 判定 /api/ 与 /adapter/ 前缀。 |
| When to use | 需要在 Node 原生 http（IncomingMessage）上读取原始请求体 Buffer 时；需要解析 multipart/form-data 上传（从 content-type 提取 boundary、从 content-disposition 提取 name/filename、guessMime 推断 MIME）时；在 Vite dev server 中通过 configureServer + middlewares.use 挂载 demo HTTP adapter 时；需要 isAdapterPath 判断 /api/ 或 /adapter/ 前缀时。 |
| How to use | 从 packages/core-engine/src/http/node.ts 导入 readRawBody：`const body: Buffer = await readRawBody(req)`。上传场景先用 readContentType / isMultipartContentType 确认 content-type，再用 extractBoundary(contentType) 取 boundary、parseContentDisposition(header) 取 name/filename，最后 guessMime(fileName, partContentType) 推断 MIME（默认 application/octet-stream）。中间件挂载实现 ViteMiddlewarePlugin 的 configureServer(server.middlewares.use(fn))。 |
| Exports | readRawBody |
| Related | 暂无 |
| Tags | readRawBody, Buffer, IncomingMessage, ServerResponse, multipart/form-data, extractBoundary, parseContentDisposition, guessMime, isMultipartContentType, readContentType, isAdapterPath, ViteMiddlewarePlugin, configureServer, middlewares, /api/, /adapter/, POST /api/jobs/upload, content-type, boundary, MIME, http, node, upload, core-engine, TypeScript, startsWith, isArray, contentType, toLowerCase, endsWith, fileName |
| Source | scan |
| Path | packages/core-engine/src/http/node.ts |
| Updated | 2026-09-14T06:51:37.261Z |

## registerStepChatTools

| Field | Value |
|-------|-------|
| Summary | 将 step chat 的 agent 工具注册进 ToolRegistry：registerStepChatTools(registry, pipeline) 以 JobPipeline 为执行上下文，为 chat/step 流程挂载可调用工具（javadoc 暂无，行为以签名为准）。 |
| When to use | 初始化 agent 工具集、需要向 ToolRegistry 批量注册 step chat 工具时；希望把 JobPipeline 的能力以 tool 形式暴露给 chat 流程时。 |
| How to use | 在 agent 初始化处调用 registerStepChatTools(toolRegistry, jobPipeline)；确保传入的 ToolRegistry 与 JobPipeline 已构建完成；注册后 chat/step 请求即可通过 registry 查找并执行对应工具（细节暂无）。 |
| Exports | registerStepChatTools |
| Related | 暂无 |
| Tags | registerStepChatTools, ToolRegistry, JobPipeline, agent, tools, chat, step, core-engine, TypeScript |
| Source | scan |
| Path | packages/core-engine/src/agent/tools.ts |
| Updated | 2026-09-14T06:51:37.261Z |

## replaceSharedSession

| Field | Value |
|-------|-------|
| Summary | 替换进程级共享 session：demo HTTP adapter 使用 process-local JobPipeline（DemoHttpSession）。JSON 出入采用 ledger/row snake_case 字段（job_id, trace_id, pack_id），请求体同时接受 camelCase 别名（jobId, packId 等）。replaceSharedSession(session) 用于替换当前共享的 DemoHttpSession 实例。 |
| When to use | 需要替换 demo HTTP adapter 当前持有的 JobPipeline / DemoHttpSession 时；单测中注入 mock session、热重载后重建 session 时；需要验证 snake_case（job_id, trace_id, pack_id）与 camelCase（jobId, packId）别名兼容逻辑时。 |
| How to use | 从 packages/core-engine/src/http/session.ts 导入 replaceSharedSession；构造新的 DemoHttpSession 后调用 replaceSharedSession(newSession) 完成替换；替换后请求体可传 job_id 或 jobId（camelCase 别名），响应输出统一为 snake_case 字段（job_id, trace_id, pack_id）。 |
| Exports | replaceSharedSession |
| Related | 暂无 |
| Tags | replaceSharedSession, DemoHttpSession, JobPipeline, snake_case, camelCase, job_id, trace_id, pack_id, jobId, packId, demo HTTP adapter, session, http, core-engine, TypeScript, HTTP, JSON |
| Source | scan |
| Path | packages/core-engine/src/http/session.ts |
| Updated | 2026-09-14T06:51:37.262Z |

## resetAdapterWrites

| Field | Value |
|-------|-------|
| Summary | 重置 C4 mock adapter 的写入状态。mock 语义：pending-mount 返回 receipt_id；未携带 receipt 的写入调用会失败且不持久化（writes without receipt fail and do not persist）。resetAdapterWrites() 清空已记录的写入，用于测试间隔离。 |
| When to use | adapter 单测 setup/teardown 中清理写入记录时；需要验证『无 receipt 写入失败』语义（writes without receipt fail）时；跨用例重置 mock adapter 状态、避免写入残留串扰时。 |
| How to use | 在测试前后调用 resetAdapterWrites() 清空 mock 写入记录；写入前先通过 pending-mount 获取 receipt_id，再携带 receipt 执行写入；无 receipt 的写入预期失败，可随后用 resetAdapterWrites 验证其未被持久化。 |
| Exports | resetAdapterWrites |
| Related | 暂无 |
| Tags | resetAdapterWrites, C4, mock, adapter, pending-mount, receipt_id, receipt, writes, core-engine, TypeScript |
| Source | scan |
| Path | packages/core-engine/src/adapter/mock.ts |
| Updated | 2026-09-14T06:51:37.262Z |

## resolveEffectiveBoxes

| Field | Value |
|-------|-------|
| Summary | 合并类型层 FieldDef 行与模板层 FieldBox 行，生成抽取（extract）用的 EffectiveFieldBox。调用方需沿 DocType 祖先链扁平化 fieldDefs，重复 key 时子级覆盖父级（child wins）。 |
| When to use | 文档抽取流程中需要把 DocType 继承链上的字段定义（FieldDefRow）与具体模板的字段框（FieldBoxRow）合并成最终 EffectiveFieldBox 列表时使用。 |
| How to use | 先沿 DocType 祖先链扁平化得到 FieldDefRow[]（child wins on duplicate keys），再连同模板的 FieldBoxRow[] 调用 resolveEffectiveBoxes(fieldDefs, templateBoxes)，返回 EffectiveFieldBox[] 供抽取引擎使用。 |
| Exports | resolveEffectiveBoxes, EffectiveFieldBox |
| Related | resolveEffectiveExcelMappings |
| Tags | core-engine, extract, resolveEffectiveBoxes, FieldDefRow, FieldBoxRow, EffectiveFieldBox, fieldDefs, DocType, 模板合并, 字段定义, templateBoxes, FieldDef, FieldBox |
| Source | scan |
| Path | packages/core-engine/src/extract/effective-boxes.ts |
| Updated | 2026-09-14T06:52:15.286Z |

## resolveEffectiveExcelMappings

| Field | Value |
|-------|-------|
| Summary | 将 DocType 祖先链的 FieldDefs 与模板 ExcelCellMappings 合并用于填表（fill）；当同一 field_key 同时存在时，模板单元格映射的 sheet/cell/value_type/signature_role 覆盖类型层定义。 |
| When to use | Excel 填表流程需要按 docTypeId + templateId 计算最终 EffectiveExcelMapping（含 sheet、cell、value_type、signature_role）时使用。 |
| How to use | 调用 resolveEffectiveExcelMappings(docTypeId, templateId, store)，传入实现 ExcelMappingStore 的存储实例，返回 Promise<EffectiveExcelMapping[]>；同一 field_key 存在时以模板的 sheet/cell/value_type/signature_role 为准。 |
| Exports | resolveEffectiveExcelMappings, EffectiveExcelMapping |
| Related | resolveEffectiveBoxes |
| Tags | core-engine, excel, fill, resolveEffectiveExcelMappings, ExcelCellMappings, EffectiveExcelMapping, ExcelMappingStore, field_key, value_type, signature_role, DocType, sheet, cell, docTypeId, templateId, FieldDefs |
| Source | scan |
| Path | packages/core-engine/src/excel/effective-mappings.ts |
| Updated | 2026-09-14T06:52:15.287Z |

## resolveEngineMode

| Field | Value |
|-------|-------|
| Summary | 根据环境变量选择 memory 还是 live（Postgres/Qdrant/Neo4j）存储模式；环境变量只设置一部分时必须 fail-fast，避免运维误以为已运行在 live Postgres/Qdrant/Neo4j 模式。 (resolveEngineMode, NodeJS, ProcessEnv, EngineMode) |
| When to use | 持久化层（persistence）初始化时需要决定使用内存存储还是 live Postgres/Qdrant/Neo4j 存储；或需要检测半配置状态并快速失败时使用。 |
| How to use | 调用 resolveEngineMode(env)（默认读取 process.env），返回 EngineMode 表示当前模式；部署时确保环境变量要么全部配置、要么全部不配，部分配置会 fail-fast 抛错阻止启动。 |
| Exports | resolveEngineMode, EngineMode |
| Related | 暂无 |
| Tags | core-engine, persistence, resolveEngineMode, EngineMode, fail-fast, Postgres, Qdrant, Neo4j, memory, live, env, 环境变量, NodeJS, ProcessEnv |
| Source | scan |
| Path | packages/core-engine/src/persistence/live-env.ts |
| Updated | 2026-09-14T06:52:15.287Z |

## resolveRepoRoot

| Field | Value |
|-------|-------|
| Summary | 定位 monorepo 根目录，使 `.apt/agent-runtime.llm.json` 等仓库根配置在 Vite cwd 位于 apps/web 时也能正确解析。 (resolveRepoRoot, startDir) |
| When to use | agent 运行时需要加载位于仓库根的 `.apt/agent-runtime.llm.json` 等配置文件，而当前进程 cwd 可能在 apps/web 等子包目录时使用。 |
| How to use | 调用 resolveRepoRoot(startDir)（默认 process.cwd()）从起始目录向上查找 monorepo 根，返回根目录路径字符串，再拼接 `.apt/agent-runtime.llm.json` 等相对路径读取配置。 |
| Exports | resolveRepoRoot |
| Related | 暂无 |
| Tags | core-engine, agent, resolveRepoRoot, monorepo, repo-root, agent-runtime.llm.json, .apt, Vite, apps/web, cwd, startDir |
| Source | scan |
| Path | packages/core-engine/src/agent/repo-root.ts |
| Updated | 2026-09-14T06:52:15.287Z |

## ReviewDesk

| Field | Value |
|-------|-------|
| Summary | 人工复核台 ReviewDesk：cognition 只写入 pending Proposal，人工 confirm 后才写 Receipt；checkWording 是 cognition 端口（确定性 wording fixture，不接真实 LLM）。 |
| When to use | 需要将 cognition 结果与人工确认分离为两阶段审计时；需要用 checkWording 做确定性 wording 校验（fixture，无 live LLM）时；需要区分 pending Proposal 与最终 Receipt 状态时。 |
| How to use | 实例化 ReviewDesk；通过 createCheckWordingToolHandler(desk) 创建工具处理器并挂接到 cognition 流程；cognition 阶段只允许写入 pending Proposal，人工 confirm 后由 ReviewDesk 写入 Receipt。 |
| Exports | createCheckWordingToolHandler, ReviewDesk |
| Related | 暂无 |
| Tags | ReviewDesk, checkWording, createCheckWordingToolHandler, Proposal, Receipt, cognition, human-in-the-loop, 人工复核, core-engine, pipeline, LLM |
| Source | scan |
| Path | packages/core-engine/src/pipeline/review.ts |
| Updated | 2026-09-14T06:52:58.477Z |

## RULE_R1_ID

| Field | Value |
|-------|-------|
| Summary | SLICE-1 seed 规则标识 RULE_R1_ID：published 规则 R1 required(编号)，blocking=1；配套规则 R2 compare(日期A, ≤, 日期B)。DocType demo：parent 编号/日期A，child 特殊批号 on PACK_ID。Excel demo：混凝土施工检验批 (GB 50204)，fixture xlsx + cell mappings。 |
| When to use | 初始化 SLICE-1 种子规则数据时；需要引用 R1（required 编号）规则 ID 做查询或校验其 published / blocking=1 状态时。 |
| How to use | 导入 RULE_R1_ID 作为规则主键，用于在 seed 数据中检索 R1 required(编号) 规则；与 fixture xlsx、cell mappings 及 RULE_R2_ID、RULE_R1_VERSION_ID 配合构成 SLICE-1 演示集。 |
| Exports | 暂无 |
| Related | RULE_R2_ID, RULE_R1_VERSION_ID |
| Tags | RULE_R1_ID, RULE_R1_VERSION_ID, R1, required, 编号, blocking, published, SLICE-1, seed, PACK_ID, 混凝土施工检验批, GB 50204, xlsx, cell mappings, DocType, SLICE |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-09-14T06:52:58.477Z |

## RULE_R1_VERSION_ID

| Field | Value |
|-------|-------|
| Summary | SLICE-1 seed 中 R1 规则的版本标识 RULE_R1_VERSION_ID：published 规则 R1 required(编号)，blocking=1；配套规则 R2 compare(日期A, ≤, 日期B)。DocType demo：parent 编号/日期A，child 特殊批号 on PACK_ID。Excel demo：混凝土施工检验批 (GB 50204)，fixture xlsx + cell mappings。 |
| When to use | 需要引用 R1 规则的具体版本 ID（RULE_R1_VERSION_ID）做版本级查询或追溯时；初始化 SLICE-1 种子数据并关联规则版本时。 |
| How to use | 导入 RULE_R1_VERSION_ID 作为 R1 规则的版本主键，与 RULE_R1_ID 配合定位 published 版本（blocking=1）；与 fixture xlsx、cell mappings 及 RULE_R2_ID 一起构成 SLICE-1 演示集。 |
| Exports | 暂无 |
| Related | RULE_R1_ID, RULE_R2_ID |
| Tags | RULE_R1_VERSION_ID, RULE_R1_ID, R1, required, 编号, version, blocking, published, SLICE-1, seed, PACK_ID, 混凝土施工检验批, GB 50204, xlsx, cell mappings, DocType, SLICE |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-09-14T06:52:58.477Z |

## RULE_R2_ID

| Field | Value |
|-------|-------|
| Summary | SLICE-1 seed 规则标识 RULE_R2_ID：published 规则 R2 compare(日期A, ≤, 日期B)，blocking=1；配套规则 R1 required(编号)。DocType demo：parent 编号/日期A，child 特殊批号 on PACK_ID。Excel demo：混凝土施工检验批 (GB 50204)，fixture xlsx + cell mappings。 |
| When to use | 初始化 SLICE-1 种子规则数据时；需要引用 R2 compare(日期A, ≤, 日期B) 规则 ID 做查询或校验其 published / blocking=1 状态时。 |
| How to use | 导入 RULE_R2_ID 作为规则主键，用于在 seed 数据中检索 R2 compare(日期A, ≤, 日期B) 规则；与 fixture xlsx、cell mappings 及 RULE_R1_ID、RULE_R1_VERSION_ID 配合构成 SLICE-1 演示集。 |
| Exports | 暂无 |
| Related | RULE_R1_ID, RULE_R1_VERSION_ID |
| Tags | RULE_R2_ID, R2, compare, 日期A, 日期B, ≤, blocking, published, SLICE-1, seed, PACK_ID, 混凝土施工检验批, GB 50204, xlsx, cell mappings, DocType, SLICE |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-09-14T06:52:58.477Z |

## RULE_R2_VERSION_ID

| Field | Value |
|-------|-------|
| Summary | SLICE-1 种子规则版本标识：R1 为 required(编号)，R2 为 compare(日期A, ≤, 日期B)，blocking=1。配套 DocType demo：parent 编号/日期A，child 特殊批号挂 PACK_ID；Excel demo：混凝土施工检验批 (GB 50204)，含 fixture xlsx 与 cell mappings。 |
| When to use | 需要在 pipeline seed 中引用 R2 规则版本 ID、初始化 SLICE-1 已发布规则（R1/R2），或构造 GB 50204 混凝土施工检验批 fixture 数据与 cell mappings 时使用。 |
| How to use | 从 packages/core-engine/src/pipeline/seed.ts 导入 RULE_R2_VERSION_ID 常量，配合 seed 流程发布 R1 required(编号) 与 R2 compare(日期A, ≤, 日期B) 规则；在 DocType（PACK_ID 特殊批号）与 Excel cell mappings 校验中保持 blocking=1 语义。 |
| Exports | RULE_R2_VERSION_ID |
| Related | RuleInterpreter, RulePublisher, runMigration |
| Tags | core-engine, seed, RULE_R2_VERSION_ID, R1, R2, SLICE-1, blocking, PACK_ID, GB 50204, fixture, cell mappings, DocType, required, compare, SLICE |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-09-14T06:53:41.280Z |

## RuleInterpreter

| Field | Value |
|-------|-------|
| Summary | 规则解释器，实现 sourceDoc §4.3 的 DSL 操作符全集：all \| any \| required \| exists \| compare \| regex \| eq。非法或不支持的 DSL 输出 fail finding，绝不 throw。 |
| When to use | 需要对规则 DSL（all/any/required/exists/compare/regex/eq）做求值解释，且要求坏输入安全降级为 fail finding 而非抛异常时使用。 |
| How to use | import { RuleInterpreter } from 'packages/core-engine/src/rules/interpreter'；实例化后传入规则 DSL 与数据上下文执行求值，结果以 findings 返回（非法 DSL 得到 fail finding），调用方无需 try/catch。 |
| Exports | RuleInterpreter |
| Related | RulePublisher, RULE_R2_VERSION_ID |
| Tags | core-engine, RuleInterpreter, DSL, all, any, required, exists, compare, regex, eq, fail finding, interpreter, 规则引擎, sourceDoc |
| Source | scan |
| Path | packages/core-engine/src/rules/interpreter.ts |
| Updated | 2026-09-14T06:53:41.280Z |

## RulePublisher

| Field | Value |
|-------|-------|
| Summary | 规则草稿保存 + fixture 发布门禁（publish gate）：新草稿必须通过 ≥1 pass 与 ≥1 fail fixture 才可发布。种子规则 R1/R2 通过 seedPublishedRules 保持已发布状态，本模块不回填该路径。 |
| When to use | 需要保存规则草稿、执行 fixture 发布门禁校验，或确认已发布规则（如种子 R1/R2）与 seedPublishedRules 的职责边界时使用。 |
| How to use | import { RulePublisher } from 'packages/core-engine/src/rules/publish'；将草稿规则连同 ≥1 pass 与 ≥1 fail 的 fixture 提交发布，门禁不通过则阻止发布；不要用本模块回填 seedPublishedRules 已发布的 R1/R2。 |
| Exports | RulePublisher |
| Related | RuleInterpreter, RULE_R2_VERSION_ID, seedPublishedRules |
| Tags | core-engine, RulePublisher, publish gate, draft, fixture, R1, R2, seedPublishedRules, 发布门禁, 规则发布 |
| Source | scan |
| Path | packages/core-engine/src/rules/publish.ts |
| Updated | 2026-09-14T06:53:41.280Z |

## runMigration

| Field | Value |
|-------|-------|
| Summary | SQLite 迁移入口：创建 walking-skeleton ledger 表（SLICE-1..6，含 standard library）。生产契约仍以 docs/schema/generated/core-engine-migration.sql（PostgreSQL）为准。 |
| When to use | 需要在本地 SQLite 上建立 walking-skeleton ledger 表（SLICE-1..6）用于测试/演示，或需要理解生产 PostgreSQL 契约 core-engine-migration.sql 对应的可执行实现时使用。 |
| How to use | 传文件路径：runMigration(dbPath): Promise<void>，打开/新建 SQLite 库并执行迁移；已有连接时改用 runMigrationOnDb(db: Database.Database): void 在现有 db 上执行。生产环境仍使用 PostgreSQL 版 core-engine-migration.sql。 |
| Exports | runMigration, runMigrationOnDb |
| Related | RulePublisher, RULE_R2_VERSION_ID |
| Tags | core-engine, runMigration, runMigrationOnDb, SQLite, PostgreSQL, migration, ledger, walking-skeleton, SLICE-1..6, standard library, core-engine-migration.sql, dbPath, SLICE |
| Source | scan |
| Path | packages/core-engine/src/persistence/migrate.ts |
| Updated | 2026-09-14T06:53:41.280Z |

## runMigrationOnDb

| Field | Value |
|-------|-------|
| Summary | core-engine 持久化层的数据库迁移执行工具 runMigrationOnDb（位于 packages/core-engine/src/persistence/migrate.ts）：对指定数据库实例按序执行迁移脚本，将 schema 升级到最新版本。javadoc 与函数签名信息暂无，参数与返回值以 migrate.ts 源码为准。 |
| When to use | 在应用启动或初始化持久化（persistence）层时，需要对数据库执行 migration、把 schema 升级到最新版本时使用 runMigrationOnDb。 |
| How to use | 暂无（签名与调用示例缺失），具体调用方式请参见 packages/core-engine/src/persistence/migrate.ts 中 runMigrationOnDb 的定义。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | runMigrationOnDb, migration, migrate.ts, persistence, 数据库迁移, schema, core-engine, util |
| Source | refresh |
| Path | packages/core-engine/src/persistence/migrate.ts |
| Updated | 2026-09-15T05:43:30.947Z |

## runPgMigration

| Field | Value |
|-------|-------|
| Summary | PostgreSQL 数据库迁移执行工具函数 runPgMigration，位于 core-engine 的 persistence 持久化层（packages/core-engine/src/persistence/pg-migrate.ts），用于执行 / 同步 pg-migrate 数据库 schema 迁移脚本。 |
| When to use | 当需要在 core-engine 模块中对 PostgreSQL 数据库执行 schema 变更、版本升级或初始化建表时使用 runPgMigration；涉及 persistence 持久化层的数据库迁移（migration）场景。 |
| How to use | 暂无具体签名文档。可从 pg-migrate.ts 导入 runPgMigration 后调用；具体参数与返回值请查阅 packages/core-engine/src/persistence/pg-migrate.ts 源码实现。 |
| Exports | runPgMigration |
| Related | 暂无 |
| Tags | runPgMigration, pg-migrate, PostgreSQL, migration, 数据库迁移, persistence, core-engine, util |
| Source | refresh |
| Path | packages/core-engine/src/persistence/pg-migrate.ts |
| Updated | 2026-09-15T05:43:26.120Z |

## safeName

| Field | Value |
|-------|-------|
| Summary | MinIO blob 存储工具函数 safeName（文件名安全化）：MinIO 客户端的构造入参（endpoint/keys）由调用方显式传入，无需读取 .env；MinIO 凭据保持本地，该存储不是资料云 / pending-mount 适配器。 |
| When to use | 需要把 fileName 规范化为 MinIO 对象键安全名称，或在 packages/core-engine/src/blob/minio.ts 中构造 MinIO 客户端并显式传 endpoint/keys（不读 .env）时。 |
| How to use | import { safeName } from 'packages/core-engine/src/blob/minio'；调用 const key = safeName(fileName)，签名 (fileName: string): string，返回安全化后的对象名。 |
| Exports | safeName |
| Related | 暂无 |
| Tags | MinIO, safeName, fileName, endpoint, keys, .env, blob, pending-mount, 资料云 |
| Source | scan |
| Path | packages/core-engine/src/blob/minio.ts |
| Updated | 2026-09-14T06:54:25.578Z |

## SEED_PACK_PROJECT_ID

| Field | Value |
|-------|-------|
| Summary | SLICE-1 种子常量 SEED_PACK_PROJECT_ID：预置已发布规则 R1 required(编号) 与 R2 compare(日期A, ≤, 日期B)，blocking=1；DocType 演示：parent 编号/日期A，child 特殊批号 挂在 PACK_ID；Excel 演示：混凝土施工检验批 (GB 50204)，带 fixture xlsx + cell mappings（单元格映射）。 |
| When to use | 初始化 SLICE-1 walking-skeleton 种子数据、演示 DocType 父子规则（parent 编号/日期A、child 特殊批号 on PACK_ID），或运行 GB 50204 混凝土施工检验批的 fixture xlsx 解析示例时。 |
| How to use | 从 packages/core-engine/src/pipeline/seed.ts 导入 SEED_PACK_PROJECT_ID，以它作为种子项目的项目 ID 标识，再执行 seed 流程装载 R1/R2 规则（blocking=1）与 fixture xlsx + cell mappings 数据。 |
| Exports | SEED_PACK_PROJECT_ID |
| Related | 暂无 |
| Tags | SLICE-1, SEED_PACK_PROJECT_ID, seed, R1, R2, blocking=1, PACK_ID, DocType, GB 50204, 混凝土施工检验批, fixture xlsx, cell mappings, 编号, 日期A, 日期B, 特殊批号, SLICE |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-09-14T06:54:25.578Z |

## seedConcreteInspectionBatchExcelDemo

| Field | Value |
|-------|-------|
| Summary | SLICE-1 演示数据播种（异步版）：写入 published R1 required(编号) 与 R2 compare(日期A, ≤, 日期B)，blocking=1；DocType demo 父级字段为 编号/日期A，子级 特殊批号 挂载在 PACK_ID 上；Excel demo 为 混凝土施工检验批 (GB 50204)，使用 fixture xlsx + cell mappings 进行单元格映射。 |
| When to use | 需要异步方式（基于 ConcreteExcelSeedStore）初始化 混凝土施工检验批 (GB 50204) Excel 演示台账时；或需验证 R1 required(编号)、R2 compare(日期A, ≤, 日期B) 规则与 fixture xlsx cell mappings 是否生效时。 |
| How to use | 从 packages/core-engine/src/pipeline/seed.ts 导入 seedConcreteInspectionBatchExcelDemo，构造实现 ConcreteExcelSeedStore 接口的存储实例，传入 SeedConcreteInspectionBatchInput（含 packId），await 该 Promise 获取 SeedConcreteInspectionBatchResult。 |
| Exports | seedConcreteInspectionBatchExcelDemo, ConcreteExcelSeedStore, SeedConcreteInspectionBatchInput, SeedConcreteInspectionBatchResult |
| Related | seedConcreteInspectionBatchLedger, seedDemoDocTypes |
| Tags | core-engine, seed, SLICE-1, R1, R2, required(编号), compare(日期A, ≤, 日期B), blocking=1, DocType, PACK_ID, 特殊批号, 混凝土施工检验批, GB 50204, fixture xlsx, cell mappings, ConcreteExcelSeedStore, packId, seedConcreteInspectionBatchExcelDemo, SeedConcreteInspectionBatchInput, SeedConcreteInspectionBatchResult, SLICE |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-09-14T06:55:10.428Z |

## seedConcreteInspectionBatchLedger

| Field | Value |
|-------|-------|
| Summary | SLICE-1 演示数据播种（同步版）：写入 published R1 required(编号) 与 R2 compare(日期A, ≤, 日期B)，blocking=1；DocType demo 父级字段为 编号/日期A，子级 特殊批号 挂载在 PACK_ID 上；Excel demo 为 混凝土施工检验批 (GB 50204)，使用 fixture xlsx + cell mappings。输入仅需 packId。 |
| When to use | 在同步上下文中（基于 SyncConcreteExcelSeedStore）快速播种 混凝土施工检验批 台账，且仅需指定 packId、不需要异步初始化流程时。 |
| How to use | 从 packages/core-engine/src/pipeline/seed.ts 导入 seedConcreteInspectionBatchLedger，传入实现 SyncConcreteExcelSeedStore 接口的存储与 { packId }（类型为 Pick<SeedConcreteInspectionBatchInput, "packId">），同步返回 SeedConcreteInspectionBatchResult。 |
| Exports | seedConcreteInspectionBatchLedger, SyncConcreteExcelSeedStore, SeedConcreteInspectionBatchInput, SeedConcreteInspectionBatchResult |
| Related | seedConcreteInspectionBatchExcelDemo, seedDemoDocTypes |
| Tags | core-engine, seed, SLICE-1, R1, R2, required(编号), compare(日期A, ≤, 日期B), blocking=1, DocType, PACK_ID, 特殊批号, 混凝土施工检验批, GB 50204, fixture xlsx, cell mappings, SyncConcreteExcelSeedStore, packId, 同步, seedConcreteInspectionBatchLedger, SeedConcreteInspectionBatchInput, SeedConcreteInspectionBatchResult, SLICE |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-09-14T06:55:10.428Z |

## seedDemoDocTypes

| Field | Value |
|-------|-------|
| Summary | SLICE-1 演示 DocType 播种（同步、无返回值）：创建父级 DocType 字段 编号/日期A，子级 特殊批号 挂载在 PACK_ID 上，并配置 published R1 required(编号) 与 R2 compare(日期A, ≤, 日期B)、blocking=1 规则；配套 Excel demo 为 混凝土施工检验批 (GB 50204)。 |
| When to use | 需要为演示环境初始化 DocType 结构（父级 编号/日期A、子级 特殊批号 on PACK_ID）及其 R1/R2 校验规则时；通常与 seedConcreteInspectionBatchExcelDemo / seedConcreteInspectionBatchLedger 配合使用。 |
| How to use | 从 packages/core-engine/src/pipeline/seed.ts 导入 seedDemoDocTypes，传入实现 SyncDocTypeSeedStore 接口的存储与 SeedDemoDocTypesInput，函数同步执行、返回 void。 |
| Exports | seedDemoDocTypes, SyncDocTypeSeedStore, SeedDemoDocTypesInput |
| Related | seedConcreteInspectionBatchExcelDemo, seedConcreteInspectionBatchLedger |
| Tags | core-engine, seed, SLICE-1, DocType, R1, R2, required(编号), compare(日期A, ≤, 日期B), blocking=1, PACK_ID, 特殊批号, 混凝土施工检验批, GB 50204, SyncDocTypeSeedStore, seedDemoDocTypes, SeedDemoDocTypesInput, SLICE |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-09-14T06:55:10.428Z |

## shouldDraftWording

| Field | Value |
|-------|-------|
| Summary | Agent 提示词辅助函数：判断当前 step 是否属于允许运行 check_wording Tool（措辞检查）的步骤；check_wording Tool 永远不写 Receipt。 |
| When to use | 在 Agent pipeline 中控制 check_wording Tool 的可用范围时；或在需要根据 step 类型判断是否允许草稿措辞检查（draft wording）时。 |
| How to use | 从 packages/core-engine/src/agent/prompts.ts 导入 shouldDraftWording，传入当前 step 标识，返回布尔值；返回 true 时该 step 才可调用 check_wording Tool，且调用结果不产生 Receipt。 |
| Exports | shouldDraftWording |
| Related | check_wording, Receipt |
| Tags | core-engine, agent, prompts, shouldDraftWording, check_wording, Receipt, Tool, step, draft wording, 措辞检查 |
| Source | scan |
| Path | packages/core-engine/src/agent/prompts.ts |
| Updated | 2026-09-14T06:55:10.428Z |

## shouldSearchClause

| Field | Value |
|-------|-------|
| Summary | shouldSearchClause 是 core-engine 中 agent 提示词模块（packages/core-engine/src/agent/prompts.ts）的工具函数，用于判断构建 agent prompt 时是否需要生成搜索子句（search clause / clause 检索触发条件）。该函数 javadoc 暂无，具体签名信息缺失。 |
| When to use | 在 agent 编排或 prompt 组装流程中，需要依据上下文判断是否触发 clause 搜索步骤时使用 shouldSearchClause；在扩展或调整 core-engine 的 agent prompts 检索触发逻辑时参考此函数。 |
| How to use | 从 packages/core-engine/src/agent/prompts.ts 导入 shouldSearchClause，在构建 agent prompt 前调用以获得是否执行 search clause 的布尔判断。由于签名信息暂无，请以源码中 shouldSearchClause 的实际入参与返回值为准。 |
| Exports | shouldSearchClause |
| Related | 暂无 |
| Tags | core-engine, agent, prompts, shouldSearchClause, search clause, TypeScript, util, prompt 构建, 检索判断 |
| Source | refresh |
| Path | packages/core-engine/src/agent/prompts.ts |
| Updated | 2026-09-17T03:28:59.631Z |

## splitClauses

| Field | Value |
|-------|-------|
| Summary | 按条款标题（第N条 / N.N 两种格式）切分标准文本，返回 SplitClause[] 数组；是按条款结构切分，不是固定 token 窗口切分。 |
| When to use | 当需要把标准/规范类文本按条款标题（第N条 或 N.N）拆分为检索单元（clause 粒度），而不是按固定 token 窗口切块时使用。 |
| How to use | 调用 splitClauses(text) 传入标准全文，得到 SplitClause[]，每项对应一个以条款标题（第N条 / N.N）为边界的文本片段；通常在 retrieve 阶段入库（ingest）前调用。位于 packages/core-engine/src/retrieve/split.ts。 |
| Exports | splitClauses |
| Related | 暂无 |
| Tags | TypeScript, core-engine, retrieve, splitClauses, SplitClause, 第N条, N.N, clause, 条款切分, chunking |
| Source | scan |
| Path | packages/core-engine/src/retrieve/split.ts |
| Updated | 2026-09-14T06:55:58.268Z |

## SqliteLedger

| Field | Value |
|-------|-------|
| Summary | 基于 better-sqlite3 的同步 ledger 存储，实现 LedgerStore 接口。设计动机（WHY）：生产用异步的 Postgres，测试保留 better-sqlite3；单一接口防止静默双 ledger（silent dual ledgers）。LedgerStore 方法与 CoreEngineStore 公开方法一一对应，每个方法返回 Promise<T>；SqliteLedger 内部用 Promise.resolve 包装同步存储，不引入 deasync，也不建第二套 schema。 |
| When to use | 当测试或本地环境需要单机、同步的 ledger 持久化，且要求与生产 Postgres 实现共享同一 LedgerStore 接口、避免出现双 ledger 时使用。 |
| How to use | 按 LedgerStore 接口注入 SqliteLedger 实例；其方法集合与 CoreEngineStore 公开方法一致，全部返回 Promise<T>，因此调用方在测试（SqliteLedger）与生产（Postgres 实现）之间切换无需改动代码。位于 packages/core-engine/src/persistence/ledger.ts。 |
| Exports | SqliteLedger |
| Related | 暂无 |
| Tags | TypeScript, core-engine, persistence, ledger, 台账, SqliteLedger, LedgerStore, CoreEngineStore, better-sqlite3, Postgres, Promise.resolve, deasync, SqliteLedgerimplements, WHY |
| Source | scan |
| Path | packages/core-engine/src/persistence/ledger.ts |
| Updated | 2026-09-14T06:55:58.268Z |

## StandardLibrary

| Field | Value |
|-------|-------|
| Summary | core-engine 前端核心引擎中的标准库工具 StandardLibrary，源码位于 packages/core-engine/src/retrieve/library.ts，服务于 retrieve（检索）链路，提供标准化的库（library）能力。原始 javadoc 暂无，扫描未获取到具体方法签名。 |
| When to use | 在 frontend 范围内的 core-engine 模块中需要 StandardLibrary 标准库能力，或开发、维护 retrieve（检索）相关逻辑时使用。 |
| How to use | 从 packages/core-engine/src/retrieve/library.ts 导入 StandardLibrary 后按需调用其导出的方法；本次扫描 signatures 为空、javadoc 暂无，具体 API 用法请以该源码文件为准。 |
| Exports | StandardLibrary |
| Related | 暂无 |
| Tags | StandardLibrary, core-engine, frontend, util, retrieve, library, standard library |
| Source | refresh |
| Path | packages/core-engine/src/retrieve/library.ts |
| Updated | 2026-09-19T09:11:08.180Z |

## StepChatBridge

| Field | Value |
|-------|-------|
| Summary | StepChatBridge 是 core-engine 中 agent 目录下的桥接（bridge）工具，用于在 Agent 的分步执行（step）与聊天（chat）会话之间建立双向通道，把 step 执行过程中的事件/状态转发到 chat 消息流，或将 chat 输入接入 step 推进逻辑。详细 API 签名暂无（javadoc 暂无）。 |
| When to use | 当需要在 agent 执行流程中实现 step 与 chat 的联动时使用，例如：step 执行进度需要实时推送到 chat 会话、chat 中的用户输入需要驱动下一步 step 执行、或需要统一管理 step 级消息与 chat 级消息的转发时，使用 StepChatBridge。 |
| How to use | 从 packages/core-engine/src/agent/step-chat-bridge.ts 导入 StepChatBridge，在 agent 执行器初始化时实例化并挂接到 step 执行循环与 chat 消息通道上。具体方法签名暂无（signatures 为空），请参考源码 packages/core-engine/src/agent/step-chat-bridge.ts 确认实例化参数与挂接方式。 |
| Exports | StepChatBridge |
| Related | 暂无 |
| Tags | StepChatBridge, core-engine, agent, step, chat, bridge, bridge模式, 消息桥接, TypeScript, packages/core-engine |
| Source | refresh |
| Path | packages/core-engine/src/agent/step-chat-bridge.ts |
| Updated | 2026-09-17T03:30:08.127Z |

## stepSystemPrompt

| Field | Value |
|-------|-------|
| Summary | core-engine 模块 agent 提示词层的工具函数 stepSystemPrompt，位于 packages/core-engine/src/agent/prompts.ts，推测用于为 agent 执行的某个 step（步骤）生成或组装 system prompt（系统提示词）。该文件暂无 javadoc，signatures 为空，具体入参与返回值以源码实现为准。 |
| When to use | 在 agent 工作流中需要为某个 step 构建、定制或复用系统提示词（system prompt），或需要在 core-engine 中集中维护提示词模板时使用。 |
| How to use | 暂无（signatures 与 javadoc 缺失，建议直接查看 packages/core-engine/src/agent/prompts.ts 中 stepSystemPrompt 的实现及调用点，确认入参与返回结构后再接入）。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | TypeScript, core-engine, agent, stepSystemPrompt, step, system prompt, prompt, prompts.ts, LLM |
| Source | refresh |
| Path | packages/core-engine/src/agent/prompts.ts |
| Updated | 2026-09-17T03:29:17.516Z |

## uploadDocument

| Field | Value |
|-------|-------|
| Summary | C4 mock adapter 的 uploadDocument：pending-mount 阶段返回 receipt_id；无 receipt 的写入直接失败且不持久化。 |
| When to use | 本地开发或测试中模拟资料上传与 pending-mount 收据流程、不接真实存储适配器时；需要验证「无 receipt 写入必须失败」语义时。 |
| How to use | 传入 UploadDocumentInput 调用 uploadDocument，得到 UploadDocumentResult（含 receipt_id）；后续写入操作必须携带该 receipt 才会持久化，否则失败。 |
| Exports | uploadDocument |
| Related | 暂无 |
| Tags | uploadDocument, UploadDocumentInput, UploadDocumentResult, receipt_id, pending-mount, C4 mock adapter, mock, adapter, core-engine |
| Source | scan |
| Path | packages/core-engine/src/adapter/mock.ts |
| Updated | 2026-09-14T06:56:44.705Z |

## uploadObjectKey

| Field | Value |
|-------|-------|
| Summary | MinIO blob 存储的对象键生成（uploadObjectKey），由 jobId 与 fileName 拼出 object key；构造入参允许调用方直接传 endpoint/keys 而无需读取 .env，MinIO 凭据保持本地。 |
| When to use | 需要为上传文件生成 MinIO object key，或构建不依赖 .env 的本地 MinIO 存储实例时；注意本 store 不是资料云 / pending-mount adapter。 |
| How to use | 调用 uploadObjectKey(jobId, fileName) 得到对象键字符串用于 MinIO 上传定位；构造 store 时通过入参注入 endpoint 与访问密钥。 |
| Exports | uploadObjectKey |
| Related | 暂无 |
| Tags | uploadObjectKey, MinIO, blob, object key, jobId, fileName, endpoint, .env, pending-mount, 资料云, storage, core-engine |
| Source | scan |
| Path | packages/core-engine/src/blob/minio.ts |
| Updated | 2026-09-14T06:56:44.705Z |

## UploadServiceUnavailableError

| Field | Value |
|-------|-------|
| Summary | HTTP 会话层错误类 UploadServiceUnavailableError（extends Error）：在上传依赖服务不可用时抛出，用于 demo HTTP adapter 的统一错误语义。所在模块为进程内（process-local）JobPipeline；JSON 输入输出使用 ledger/row 的 snake_case 字段（job_id、trace_id、pack_id）。 |
| When to use | 需要在 session/HTTP 层表达「上传服务不可用（503 语义）」错误时；或在该 demo HTTP adapter 中处理请求体时，需要同时兼容 snake_case（job_id、trace_id、pack_id）与 camelCase 别名（jobId、packId）的解析约定时参考本模块。 |
| How to use | import { UploadServiceUnavailableError } from 'packages/core-engine/src/http/session'；当上传后端服务不可达时 throw new UploadServiceUnavailableError(...)，由 HTTP 层捕获并映射为 503 响应；请求体解析按 ledger/row snake_case（job_id、trace_id、pack_id）为准，并接受 camelCase 别名（jobId、packId）。 |
| Exports | UploadServiceUnavailableError |
| Related | 暂无 |
| Tags | TypeScript, Error, HTTP, session, UploadServiceUnavailableError, JobPipeline, job_id, trace_id, pack_id, jobId, packId, snake_case, camelCase, 503, demo HTTP adapter, UploadServiceUnavailableErrorextends, JSON |
| Source | scan |
| Path | packages/core-engine/src/http/session.ts |
| Updated | 2026-09-14T06:57:52.599Z |

## UploadValidationError

| Field | Value |
|-------|-------|
| Summary | job-pipeline 中的上传校验错误类 UploadValidationError（extends Error），属于 walking-skeleton 流水线（fixture upload → extract JSON → R1/R2 → findings + audit）的 fixture upload 校验环节。注意：Chat 为 HITL-only，仅持久化 messages，不修改 job.status，不写 Receipt。 |
| When to use | 当 fixture upload 输入未通过校验、需要在进入 extract JSON / R1/R2 之前中断流水线时抛出；用于向上层区分「上传参数非法」与服务不可用等其它失败类型。 |
| How to use | import { UploadValidationError } from 'packages/core-engine/src/pipeline/job-pipeline'；校验失败时（如由 validateUploadInput 判定）throw 该错误；上层 HTTP adapter 捕获后返回 4xx 校验失败响应；Chat 交互保持 HITL-only，不触碰 job.status、不写 Receipt。 |
| Exports | UploadValidationError |
| Related | validateUploadInput |
| Tags | TypeScript, Error, job-pipeline, UploadValidationError, walking-skeleton, fixture upload, extract JSON, R1, R2, findings, audit, HITL, job.status, Receipt, Chat, UploadValidationErrorextends, JSON |
| Source | scan |
| Path | packages/core-engine/src/pipeline/job-pipeline.ts |
| Updated | 2026-09-14T06:57:52.599Z |

## validateUploadInput

| Field | Value |
|-------|-------|
| Summary | job-pipeline 中的上传输入校验函数 validateUploadInput，签名：validateUploadInput(input: Pick<OpenUploadJobInput, "mime" \| "bytes">): void。是 walking-skeleton 流水线（fixture upload → extract JSON → R1/R2 → findings + audit）中 fixture upload 的入口校验步骤；Chat 为 HITL-only。 |
| When to use | 在 fixture upload 进入流水线前，校验 OpenUploadJobInput 的 mime 与 bytes 字段，提前拦截非法上传，避免无效数据流入 extract JSON / R1/R2 阶段。 |
| How to use | import { validateUploadInput } from 'packages/core-engine/src/pipeline/job-pipeline'；调用 validateUploadInput({ mime, bytes })，返回 void，校验失败时抛出 UploadValidationError；字段约定与 OpenUploadJobInput 的 mime/bytes 保持一致。 |
| Exports | validateUploadInput |
| Related | UploadValidationError |
| Tags | TypeScript, validator, job-pipeline, validateUploadInput, OpenUploadJobInput, mime, bytes, fixture upload, walking-skeleton, R1, R2, HITL, Receipt, JSON |
| Source | scan |
| Path | packages/core-engine/src/pipeline/job-pipeline.ts |
| Updated | 2026-09-14T06:57:52.599Z |

## VolumeDesk

| Field | Value |
|-------|-------|
| Summary | Volume preview desk（工程量预览台）VolumeDesk：仅提供嵌套分组快照（nested grouping snapshot）。tree.submitted 恒为 false；从不写 Receipt；从不将 job 标记为 submitted。分组键 groupKeys 来自 spec pack，而非行业预设（公路/水利/房建）。 |
| When to use | 需要展示工程量（Volume）的嵌套分组预览快照、且不得产生任何提交副作用（不写 Receipt、不置 job submitted）时；或分组维度必须由 spec pack 的 groupKeys 驱动、而非公路/水利/房建等行业预设时。 |
| How to use | import { VolumeDesk } from 'packages/core-engine/src/pipeline/volume'；实例化 VolumeDesk 后调用其预览方法获取嵌套分组快照并读取 tree（tree.submitted 恒为 false）；分组键取自 spec pack 的 groupKeys；该结果仅用于预览，严禁用于真正的提交动作。 |
| Exports | VolumeDesk |
| Related | 暂无 |
| Tags | TypeScript, VolumeDesk, Volume, preview, desk, nested grouping, snapshot, tree.submitted, Receipt, groupKeys, spec pack, 公路, 水利, 房建, 工程量 |
| Source | scan |
| Path | packages/core-engine/src/pipeline/volume.ts |
| Updated | 2026-09-14T06:57:52.599Z |

## WORDING_STEPS

| Field | Value |
|-------|-------|
| Summary | 定义 check_wording Tool 允许运行的步骤（step）集合常量 WORDING_STEPS；在这些步骤中 check_wording 只做措辞检查，从不写入 Receipt。 |
| When to use | 在 agent 流程中需要判断当前 step 是否属于措辞检查阶段（check_wording 可运行、不产生 Receipt）时，用 WORDING_STEPS 做集合判定。 |
| How to use | 从 packages/core-engine/src/agent/prompts.ts 导入 WORDING_STEPS，将当前步骤与集合成员做比对，决定是否允许 check_wording Tool 执行；执行结果不写 Receipt。 |
| Exports | WORDING_STEPS |
| Related | 暂无 |
| Tags | WORDING_STEPS, check_wording, Receipt, agent, prompts, core-engine, step |
| Source | scan |
| Path | packages/core-engine/src/agent/prompts.ts |
| Updated | 2026-09-14T06:58:30.388Z |

## writeDemoJson

| Field | Value |
|-------|-------|
| Summary | 在 Node ServerResponse 上写入 demo JSON 响应的工具函数 writeDemoJson；所在文件还定义了结构化的 ViteMiddlewarePlugin 接口（避免 core-engine 依赖 vite 包）、isAdapterPath（识别 /api/ 与 /adapter/ 前缀）、以及手写 multipart 解析器（isMultipartContentType、extractBoundary、parseContentDisposition、guessMime），供 POST /api/jobs/upload 上传路由获取二进制文件字节且不引入新依赖。 |
| When to use | 需要在 core-engine 的 Node HTTP 层输出 JSON 响应时使用 writeDemoJson；需要解析 multipart/form-data 上传（POST /api/jobs/upload）、解析 content-type boundary 或 content-disposition 中的 name/filename、按扩展名 guessMime 时使用同文件的解析工具；以 Vite 中间件方式挂载 HTTP 服务时参考 ViteMiddlewarePlugin 结构。 |
| How to use | 从 packages/core-engine/src/http/node.ts 导入 writeDemoJson(res, status, body) 直接写入 JSON；上传路由先用 isAdapterPath 判定 /api/ 或 /adapter/ 路径，再经 isMultipartContentType 识别 multipart/form-data，用 extractBoundary 取 boundary、parseContentDisposition 取 name 与 fileName，最后用 guessMime 推断文件 MIME 类型。 |
| Exports | writeDemoJson |
| Related | 暂无 |
| Tags | writeDemoJson, multipart, ViteMiddlewarePlugin, isAdapterPath, isMultipartContentType, extractBoundary, parseContentDisposition, guessMime, /api/jobs/upload, ServerResponse, node http, core-engine, configureServer, IncomingMessage, startsWith, readContentType, isArray, contentType, toLowerCase, endsWith, fileName |
| Source | scan |
| Path | packages/core-engine/src/http/node.ts |
| Updated | 2026-09-14T06:58:30.388Z |

## ZhipuPrequery

| Field | Value |
|-------|-------|
| Summary | ZhipuPrequery（智谱预查询）：core-engine 模块中 retrieve 检索链路的预查询（prequery）工具，用于在正式检索前执行预处理查询。javadoc 与 signatures 暂无，具体内部逻辑请参见源文件 prequery.ts。 |
| When to use | 当需要在检索流程开始前调用 ZhipuPrequery 做预查询/预处理时使用；详细适用场景文档暂无，可结合 retrieve 目录下其他检索工具一起使用。 |
| How to use | 从 packages/core-engine/src/retrieve/prequery.ts 引入 ZhipuPrequery 后在检索链路中调用；具体 API 签名与调用示例暂无，请以源码为准。 |
| Exports | ZhipuPrequery |
| Related | 暂无 |
| Tags | ZhipuPrequery, prequery, retrieve, core-engine, frontend, 智谱预查询, 检索, util |
| Source | refresh |
| Path | packages/core-engine/src/retrieve/prequery.ts |
| Updated | 2026-09-19T11:03:24.165Z |

## readPaddleOcrEnv

| Field | Value |
|-------|-------|
| Summary | 读取 PaddleOCR 相关环境变量配置的工具函数 readPaddleOcrEnv，位于 core-engine 的 ocr/env 模块，用于获取 OCR 运行所需的环境参数 |
| When to use | 需要在 core-engine 中初始化 OCR 能力、读取 PaddleOCR 环境变量（env）配置时使用 |
| How to use | 暂无（源码未提供签名与文档，可参考 ocr/env.ts 中 readPaddleOcrEnv 的定义） |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | readPaddleOcrEnv, PaddleOCR, OCR, env, 环境变量, core-engine, TypeScript, util |
| Source | refresh |
| Path | packages/core-engine/src/ocr/env.ts |
| Updated | 2026-09-14T11:32:18.170Z |

## OcrPort

| Field | Value |
|-------|-------|
| Summary | OcrPort：core-engine 模块中的 OCR 端口（port）定义，位于 packages/core-engine/src/ocr/port.ts，按端口-适配器（ports & adapters）模式隔离 OCR（光学字符识别）能力与具体实现。 |
| When to use | 当 core-engine 内其他代码需要使用 OCR 能力但不应依赖具体实现时，依赖 OcrPort 抽象；实现适配器时也以 OcrPort 为契约进行注入。 |
| How to use | 暂无（javadoc 与 signatures 为空，建议补充 OcrPort 接口方法签名及依赖注入示例）。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | OcrPort, OCR, port, core-engine, 端口-适配器, frontend |
| Source | refresh |
| Path | packages/core-engine/src/ocr/port.ts |
| Updated | 2026-09-15T03:42:29.038Z |

## PaddleOcr

| Field | Value |
|-------|-------|
| Summary | PaddleOcr 是前端 core-engine 模块中基于 PaddleOCR（百度飞桨 OCR 光学字符识别引擎）的工具封装，源码位于 packages/core-engine/src/ocr/paddleocr.ts，用于在浏览器端发起图像文字识别（OCR）处理。 |
| When to use | 当前端 core-engine 需要对图片进行 OCR 文字识别（例如截图、扫描件、票据等图像的文本提取），且希望统一通过 PaddleOcr 工具封装调用 PaddleOCR 能力时使用。 |
| How to use | 暂无（公开方法签名未扫描到，具体调用方式请参考 packages/core-engine/src/ocr/paddleocr.ts 源码中的 PaddleOcr 导出） |
| Exports | PaddleOcr |
| Related | 暂无 |
| Tags | PaddleOcr, PaddleOCR, OCR, 文字识别, core-engine, util, TypeScript, frontend |
| Source | refresh |
| Path | packages/core-engine/src/ocr/paddleocr.ts |
| Updated | 2026-09-15T08:36:42.070Z |

## flattenOcrMarkdown

| Field | Value |
|-------|-------|
| Summary | flattenOcrMarkdown 是 core-engine 模块中的工具函数，位于 packages/core-engine/src/ocr/pdf-text.ts，用于将 OCR（光学字符识别）产出的 markdown 结构拍平（flatten）处理。该函数服务于 PDF 文本提取（pdf-text）链路，把层级化的 OCR markdown 内容转换为扁平结构，便于下游统一消费。javadoc 暂无，具体行为以源码为准。 |
| When to use | 当需要处理 PDF OCR（光学字符识别）识别结果中的 markdown 文本，并将其扁平化（flatten）为单一层级结构时使用，例如：OCR 结果后处理、pdf-text 提取流程中的文本规整、markdown 层级结构展平等场景。 |
| How to use | 从 packages/core-engine/src/ocr/pdf-text.ts 导入 flattenOcrMarkdown，传入 OCR 生成的 markdown 内容即可获得拍平后的结果。函数签名暂无（signatures 为空），请以源码 packages/core-engine/src/ocr/pdf-text.ts 中的实际参数与返回值定义为准。 |
| Exports | flattenOcrMarkdown |
| Related | 暂无 |
| Tags | flattenOcrMarkdown, OCR, markdown, flatten, pdf, pdf-text, core-engine, TypeScript, util, 文本提取 |
| Source | refresh |
| Path | packages/core-engine/src/ocr/pdf-text.ts |
| Updated | 2026-09-14T13:03:24.359Z |

## pdf-text

| Field | Value |
|-------|-------|
| Summary | pdf-text 工具：位于 packages/core-engine/src/ocr/pdf-text.ts，属于 core-engine 模块的 ocr（光学字符识别）子目录，用于 PDF 文本提取相关处理。具体 API 细节暂无（源码中缺少 javadoc 与签名信息）。 |
| When to use | 当需要在 core-engine 的 ocr 流程中对 PDF 文件进行文本提取（pdf-text）处理时使用。 |
| How to use | 暂无（未扫描到公开签名，请参考源码 packages/core-engine/src/ocr/pdf-text.ts）。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | pdf-text, pdf, ocr, core-engine, PDF文本提取, util, 文本抽取 |
| Source | refresh |
| Path | packages/core-engine/src/ocr/pdf-text.ts |
| Updated | 2026-09-14T17:15:11.518Z |

## hasUsablePdfTextLayer

| Field | Value |
|-------|-------|
| Summary | 判断 PDF 是否含有可用的文本层（text layer）。该工具函数位于 packages/core-engine/src/ocr/pdf-text.ts，通常在 OCR 流程前调用：若 PDF 已具备可用文本层则可直接提取文字，否则回退到 OCR 识别。 |
| When to use | 在 OCR 流水线中需要决定对 PDF 采用文本直接抽取还是 OCR 识别时使用；即任何需要检测 PDF 文本层是否可用（hasUsablePdfTextLayer）的分支判断场景。 |
| How to use | 从 packages/core-engine/src/ocr/pdf-text.ts 导入 hasUsablePdfTextLayer，传入 PDF 文档数据或解析后的文档对象，返回布尔值表示是否存在可用文本层。由于签名信息暂无，具体入参类型以源码为准。 |
| Exports | hasUsablePdfTextLayer |
| Related | 暂无 |
| Tags | core-engine, OCR, PDF, text layer, hasUsablePdfTextLayer, pdf-text.ts, util |
| Source | refresh |
| Path | packages/core-engine/src/ocr/pdf-text.ts |
| Updated | 2026-09-14T13:23:00.299Z |

## extractPdfUnicodeText

| Field | Value |
|-------|-------|
| Summary | extractPdfUnicodeText（PDF Unicode 文本抽取工具）：从 PDF 文档中提取 Unicode 编码的文本内容，属于 core-engine 模块的 OCR 文本处理能力，源码位于 packages/core-engine/src/ocr/pdf-text.ts。可用于获取 PDF 文本层信息，供 OCR 或下游检索流程使用。 |
| When to use | 当需要解析 PDF 文件并抽取其内嵌 Unicode 文本层（而非走图片 OCR 识别）时使用；典型场景：core-engine 中对 PDF 附件做文本预处理、为 OCR 流水线提供文本输入、或从 pdf-text.ts 的 extractPdfUnicodeText 获取可检索文本。 |
| How to use | 从 packages/core-engine/src/ocr/pdf-text.ts 导入 extractPdfUnicodeText，传入 PDF 数据源后获得提取出的 Unicode 文本；该函数的参数与返回值签名暂无，接入前请先查看源码确认入参格式（如 Buffer / Uint8Array / 文件路径）。 |
| Exports | extractPdfUnicodeText |
| Related | 暂无 |
| Tags | extractPdfUnicodeText, PDF, Unicode, OCR, core-engine, pdf-text, text-extraction, 文本抽取, TypeScript |
| Source | refresh |
| Path | packages/core-engine/src/ocr/pdf-text.ts |
| Updated | 2026-09-14T15:37:49.817Z |

## index

| Field | Value |
|-------|-------|
| Summary | core-engine 包的入口 index 文件（packages/core-engine/src/index.ts），作为 core-engine 模块的统一导出出口，聚合并对外暴露该包的公共 API。具体导出成员与签名暂无（signatures 为空）。 |
| When to use | 当其他模块需要使用 core-engine 的能力时，应从此 index 入口导入，而不是直接引用包内部的深层文件路径，以保持模块边界清晰、便于重构。 |
| How to use | 通过 import { ... } from 'core-engine' 或相对路径 packages/core-engine/src/index.ts 导入所需的导出成员；具体导出列表暂无，请查看源文件确认。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | core-engine, index, entry, entry-point, barrel, frontend, util, packages/core-engine/src/index.ts |
| Source | refresh |
| Path | packages/core-engine/src/index.ts |
| Updated | 2026-09-19T09:09:47.397Z |

## port

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | 暂无 |
| Source | refresh |
| Path | packages/core-engine/src/ocr/port.ts |
| Updated | 2026-09-14T17:14:57.011Z |

## job-pipeline

| Field | Value |
|-------|-------|
| Summary | core-engine 模块的 job-pipeline（作业流水线）工具，源码位于 packages/core-engine/src/pipeline/job-pipeline.ts。暂无文档注释与签名信息，具体职责待补充。 |
| When to use | 当需要在 frontend 的 core-engine 模块中复用 job-pipeline（作业流水线）相关逻辑时使用；暂无更详细的使用场景说明。 |
| How to use | 暂无 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | frontend, core-engine, job-pipeline, pipeline, util, TypeScript |
| Source | refresh |
| Path | packages/core-engine/src/pipeline/job-pipeline.ts |
| Updated | 2026-09-15T09:06:44.345Z |

## session

| Field | Value |
|-------|-------|
| Summary | core-engine 前端核心引擎中的 HTTP session（会话）工具，位于 packages/core-engine/src/http/session.ts，用于处理前端请求相关的会话状态管理。本次扫描未获取到该文件的 javadoc 与导出签名，细节以源码为准。 |
| When to use | 在前端 core-engine 模块中发起 HTTP 请求、需要读取或维护 session（会话）状态时使用。具体适用 API 暂无。 |
| How to use | 暂无（未扫描到导出签名或使用示例，请参考 packages/core-engine/src/http/session.ts 源码确认调用方式）。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | core-engine, session, http, util, 前端, 会话 |
| Source | refresh |
| Path | packages/core-engine/src/http/session.ts |
| Updated | 2026-09-14T17:15:05.215Z |

## env

| Field | Value |
|-------|-------|
| Summary | core-engine 模块 OCR 子目录（packages/core-engine/src/ocr/env.ts）下的环境（env）相关工具，推测用于读取或封装运行环境信息；因缺少 javadoc 与 signatures，具体公开 API 暂无。 |
| When to use | 在 OCR 相关流程中需要获取或判断运行环境（env）配置时使用；更具体的适用场景细节暂无。 |
| How to use | 暂无（未扫描到导出的函数签名或使用示例）。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | env, ocr, core-engine, util, TypeScript, frontend |
| Source | refresh |
| Path | packages/core-engine/src/ocr/env.ts |
| Updated | 2026-09-14T17:15:09.163Z |

## paddleocr

| Field | Value |
|-------|-------|
| Summary | core-engine 中的 PaddleOCR（飞桨 OCR）封装工具，位于 src/ocr/paddleocr.ts，用于图片文字识别（OCR）能力封装。 |
| When to use | 当需要在 core-engine 流程中对图片执行 OCR 文字识别（如提取图片文本、调用 PaddleOCR 识别能力）时使用 paddleocr。 |
| How to use | 暂无（signatures 为空），具体 API 用法请参考 packages/core-engine/src/ocr/paddleocr.ts 源码。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | paddleocr, PaddleOCR, ocr, OCR, 文字识别, 图像识别, core-engine, util, TypeScript |
| Source | refresh |
| Path | packages/core-engine/src/ocr/paddleocr.ts |
| Updated | 2026-09-14T17:15:09.827Z |

## handle-request

| Field | Value |
|-------|-------|
| Summary | core-engine 模块中的 HTTP 请求处理工具 handle-request，位于 packages/core-engine/src/http/handle-request.ts，用于统一处理前端 http 请求流程；暂无 Javadoc 与函数签名（signatures）说明。 |
| When to use | 前端需要通过 core-engine 统一发起、拦截或封装 http 请求处理逻辑时使用 handle-request；适用于请求收口、统一错误处理等场景。 |
| How to use | 从 packages/core-engine/src/http/handle-request.ts 导入 handle-request 并调用；因 signatures 暂无，具体入参与返回值请以源码为准。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | frontend, core-engine, http, handle-request, util, request-handler, 请求处理 |
| Source | refresh |
| Path | packages/core-engine/src/http/handle-request.ts |
| Updated | 2026-09-14T17:16:48.376Z |

## fake

| Field | Value |
|-------|-------|
| Summary | core-engine 模块中 ocr（OCR 识别）目录下的 fake（假实现/Mock）工具，源码位于 packages/core-engine/src/ocr/fake.ts。通常用于在无真实 OCR 依赖的场景下提供模拟/占位实现，便于前端流程联调与测试。该资产的 javadoc 与导出签名暂无。 |
| When to use | 在开发或测试 core-engine 中 ocr 相关流程、但不需要真实 OCR 识别能力时使用；或作为 ocr 模块的 mock（假实现）/回退实现，用于本地联调、单元测试与演示场景。 |
| How to use | 具体调用方式暂无（未提取到 signatures）。可从 packages/core-engine/src/ocr/fake.ts 按导出方式引入 fake 使用；在接入真实 OCR 识别前可用其作为占位实现。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | fake, mock, ocr, util, 工具, core-engine, frontend, packages/core-engine/src/ocr/fake.ts |
| Source | refresh |
| Path | packages/core-engine/src/ocr/fake.ts |
| Updated | 2026-09-14T17:16:49.156Z |

## RetrieveHit

| Field | Value |
|-------|-------|
| Summary | RetrieveHit（检索命中结果）类型定义：表示一次 retrieve（检索）操作返回的单条命中记录，位于 core-engine 的 retrieve/ports.ts 端口（ports）定义文件中。 |
| When to use | 在 core-engine 中实现或消费 retrieve（检索）相关端口（ports）、需要处理单条检索命中结果 RetrieveHit 时使用。 |
| How to use | 暂无详细用法说明（javadoc 与 signatures 均为空）；可查看 packages/core-engine/src/retrieve/ports.ts 中 RetrieveHit 的类型定义了解具体字段结构。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | RetrieveHit, retrieve, ports, core-engine, TypeScript, 检索命中, 端口定义 |
| Source | refresh |
| Path | packages/core-engine/src/retrieve/ports.ts |
| Updated | 2026-09-19T06:36:28.115Z |

## LedgerStore

| Field | Value |
|-------|-------|
| Summary | core-engine 模块的 ledger（账本）持久化工具 LedgerStore，源码位于 packages/core-engine/src/persistence/ledger.ts，用于 ledger 数据的存储与读写；javadoc 与 signatures 均为空，具体 API 细节暂无。 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | LedgerStore, ledger, persistence, core-engine, util, 账本, 持久化 |
| Source | refresh |
| Path | packages/core-engine/src/persistence/ledger.ts |
| Updated | 2026-09-15T05:42:45.053Z |

## LayoutUnitRow

| Field | Value |
|-------|-------|
| Summary | core-engine 模块下的 LayoutUnitRow（布局单元行）工具，位于自动生成的 schema 文件 core-engine-rows.ts 中，用于表示布局单元（LayoutUnit）的行级数据结构。 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | LayoutUnitRow, util, core-engine, frontend, schema, generated, core-engine-rows, 布局单元行 |
| Source | refresh |
| Path | docs/schema/generated/core-engine-rows.ts |
| Updated | 2026-09-15T05:44:01.470Z |

## types

| Field | Value |
|-------|-------|
| Summary | core-engine 模块的 TypeScript 类型定义文件（packages/core-engine/src/types.ts），集中声明 core-engine 在 frontend 内共享的类型（type / interface）。javadoc 暂无，具体导出成员暂无。 |
| When to use | 当需要引用 core-engine 的公共类型定义（如状态、配置、数据结构相关的 interface / type），或为 core-engine 扩展新类型时，统一在本文件中声明与导入，避免类型重复定义。 |
| How to use | 通过相对路径 packages/core-engine/src/types.ts 导入所需类型，仅用于编译期类型检查，不产生运行时代码；新增类型时在文件内追加 type / interface 声明并导出。具体导入写法与成员列表暂无。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | TypeScript, types, core-engine, frontend, 类型定义, interface, type |
| Source | refresh |
| Path | packages/core-engine/src/types.ts |
| Updated | 2026-09-15T05:44:09.548Z |

## assertVectorPayload

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | 暂无 |
| Source | refresh |
| Path | packages/core-engine/src/retrieve/payload.ts |
| Updated | 2026-09-15T06:01:33.116Z |

## splitLayoutUnits

| Field | Value |
|-------|-------|
| Summary | core-engine 包中的工具函数 splitLayoutUnits（位于 packages/core-engine/src/retrieve/layout-split.ts），用于在检索（retrieve）流程中将内容切分为布局单元（layout units），供后续布局排版使用。暂无 javadoc，签名信息暂无。 |
| When to use | 当需要在 core-engine 的 retrieve 环节按 layout-split 规则将结果集切分为多个布局单元（layout units）时使用；具体边界条件暂无文档。 |
| How to use | 从 packages/core-engine/src/retrieve/layout-split.ts 导入 splitLayoutUnits 后调用。因 signatures 为空，具体入参与返回结构暂无，请参考源码 layout-split.ts 确认。 |
| Exports | splitLayoutUnits |
| Related | 暂无 |
| Tags | util, core-engine, splitLayoutUnits, layout-split, layout units, retrieve, 布局切分, 布局单元 |
| Source | refresh |
| Path | packages/core-engine/src/retrieve/layout-split.ts |
| Updated | 2026-09-15T06:54:29.065Z |

## extractPdfUnicodePages

| Field | Value |
|-------|-------|
| Summary | extractPdfUnicodePages（PDF Unicode 文本按页提取）：从 PDF 文档中按页提取 Unicode 文本内容，位于 core-engine 的 OCR 模块（pdf-text.ts），通常作为 OCR 识别流程中读取 PDF 原生文本层的工具函数。 |
| When to use | 当需要处理 PDF 文档的文本提取，或在 OCR 流程中优先读取 PDF 自带文本层（而非对图像做 OCR 识别）时使用；扫描版 PDF 无文本层时仍需走 OCR 流程。 |
| How to use | 暂无（未提供签名信息，请直接查看 extractPdfUnicodePages 源码确认入参与返回值格式）。 |
| Exports | extractPdfUnicodePages |
| Related | 暂无 |
| Tags | extractPdfUnicodePages, PDF, Unicode, OCR, pdf-text, core-engine, 文本提取, 文字识别 |
| Source | refresh |
| Path | packages/core-engine/src/ocr/pdf-text.ts |
| Updated | 2026-09-15T08:38:06.027Z |

## renderPdfPagePng

| Field | Value |
|-------|-------|
| Summary | 将 PDF 文档的单个页面栅格化（raster）渲染为 PNG 图像，位于 packages/core-engine/src/ocr/pdf-raster.ts，主要服务于 OCR 文字识别前的页面图像转换环节。 |
| When to use | 当需要把 PDF 页面转成 PNG 位图，用于 OCR 识别、页面预览或图像处理流程时使用 renderPdfPagePng。 |
| How to use | 暂无签名信息（signatures 为空）。请参考 packages/core-engine/src/ocr/pdf-raster.ts 源码确认 renderPdfPagePng 的入参（如 PDF 文档对象与页码）与返回值（PNG 图像数据）后再调用。 |
| Exports | renderPdfPagePng |
| Related | 暂无 |
| Tags | renderPdfPagePng, pdf-raster, PDF, PNG, OCR, raster, rasterize, core-engine, util, TypeScript |
| Source | refresh |
| Path | packages/core-engine/src/ocr/pdf-raster.ts |
| Updated | 2026-09-15T09:05:34.036Z |

## DemoHttpAdapter

| Field | Value |
|-------|-------|
| Summary | DemoHttpAdapter：core-engine 包中的 HTTP 请求处理适配器（util），源码位于 packages/core-engine/src/http/handle-request.ts，用于封装/适配 demo 场景下的 HTTP 请求（handle-request）处理逻辑。javadoc 暂无。 |
| When to use | 当需要在 core-engine 中为 demo 场景接入 HTTP 请求适配层、统一处理请求入口（handle-request）时使用；更具体的使用时机暂无（javadoc 缺失）。 |
| How to use | 暂无（signatures 为空，请参考源码 packages/core-engine/src/http/handle-request.ts 中的 DemoHttpAdapter 实现）。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | frontend, TypeScript, core-engine, util, DemoHttpAdapter, http, handle-request, adapter, request-handler, HTTP适配器 |
| Source | refresh |
| Path | packages/core-engine/src/http/handle-request.ts |
| Updated | 2026-09-15T09:05:40.804Z |

## StandardIngestWorker

| Field | Value |
|-------|-------|
| Summary | StandardIngestWorker（标准摄取 Worker）：core-engine 检索模块（retrieve）中的数据入库处理器，位于 packages/core-engine/src/retrieve/ingest-worker.ts，负责将内容摄取（ingest）进检索索引。该类暂无 Javadoc 与公开方法签名信息。 |
| When to use | 需要将文档或数据通过 StandardIngestWorker 批量/异步摄取（ingest）进 core-engine 的检索（retrieve）索引时使用。 |
| How to use | 暂无（未提取到公开方法签名与示例）；请参考源文件 packages/core-engine/src/retrieve/ingest-worker.ts 了解 StandardIngestWorker 的实例化与调用方式。 |
| Exports | StandardIngestWorker |
| Related | 暂无 |
| Tags | StandardIngestWorker, ingest, worker, retrieve, core-engine, ingest-worker.ts, TypeScript |
| Source | refresh |
| Path | packages/core-engine/src/retrieve/ingest-worker.ts |
| Updated | 2026-09-19T09:12:18.610Z |

## live-rag-ingest.test

| Field | Value |
|-------|-------|
| Summary | live-rag-ingest（RAG ingest 实时摄取链路的真实环境测试），位于 core-engine 模块的 test 目录下，用于端到端验证 RAG（Retrieval-Augmented Generation，检索增强生成）ingest（文档摄取/入库）链路在真实环境下的行为。javadoc 暂无。 |
| When to use | 需要验证 core-engine 中 RAG ingest 摄取链路的端到端正确性时；修改 live-rag-ingest 相关的 ingest 流程后回归验证时；排查 RAG 知识库摄取结果不符合预期的线上问题时。 |
| How to use | 在 packages/core-engine/test/live-rag-ingest.test.ts 所在包内运行测试命令（如测试框架默认的 run/test 脚本）执行该 live 测试；因属 live（真实环境）测试，运行前需确认目标环境与依赖服务可用。暂无更详细的运行说明。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | test, live-rag-ingest, RAG, ingest, core-engine, 真实环境测试, 检索增强生成 |
| Source | refresh |
| Path | packages/core-engine/test/live-rag-ingest.test.ts |
| Updated | 2026-09-15T09:57:15.925Z |

## isRetrieveChatStep

| Field | Value |
|-------|-------|
| Summary | 判断 agent 对话步骤是否为 RetrieveChatStep（检索聊天步骤）的布尔工具函数，位于 packages/core-engine/src/agent/prompts.ts 中，服务于 core-engine 的 agent prompt 构建流程。 |
| When to use | 在 agent 编排中需要区分检索型步骤（RetrieveChatStep）与生成型步骤时使用，例如构建 prompt、路由分支或统计 chat step 类型前调用 isRetrieveChatStep 进行类型判断。 |
| How to use | 暂无（未提供签名与文档）。按命名惯例可推断为布尔谓词 isRetrieveChatStep(step)，入参为 chat step 对象，返回 boolean；具体用法以 packages/core-engine/src/agent/prompts.ts 源码为准。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | util, isRetrieveChatStep, RetrieveChatStep, agent, prompts, core-engine, chat-step, 检索步骤, TypeScript |
| Source | refresh |
| Path | packages/core-engine/src/agent/prompts.ts |
| Updated | 2026-09-17T03:29:01.431Z |

## formatRetrieveHitsForPrompt

| Field | Value |
|-------|-------|
| Summary | 工具函数 formatRetrieveHitsForPrompt：位于 packages/core-engine/src/agent/context.ts，负责将检索命中结果（retrieve hits）格式化为可注入 Agent / LLM prompt 的文本片段，属于 agent 上下文（context）构建链路。javadoc 与 signatures 暂无，具体参数以源码为准。 |
| When to use | 在 Agent 组装上下文时，需要把检索（retrieval / RAG）返回的 hits 结果整理成结构化文本并拼入 prompt 前使用。 |
| How to use | 从 packages/core-engine/src/agent/context.ts 导入 formatRetrieveHitsForPrompt，传入检索返回的 hits 数据，得到格式化后的 prompt 片段文本。因 signatures 暂无，请以 packages/core-engine/src/agent/context.ts 源码中的函数签名为准。 |
| Exports | formatRetrieveHitsForPrompt |
| Related | 暂无 |
| Tags | formatRetrieveHitsForPrompt, TypeScript, core-engine, Agent, context, prompt, retrieval, RAG, hits |
| Source | refresh |
| Path | packages/core-engine/src/agent/context.ts |
| Updated | 2026-09-19T06:37:03.607Z |

## packChatTraceId

| Field | Value |
|-------|-------|
| Summary | packChatTraceId（聊天链路追踪标识打包函数）：将 chatId 与 traceId 打包生成 chatTraceId，用于在 agent 上下文（context）中唯一串联一次对话的链路追踪信息。源文件位于 packages/core-engine/src/agent/context.ts，属于 frontend/core-engine 模块的工具函数（util）。函数签名与文档注释暂无。 |
| When to use | 需要在 agent 请求链路中生成、传递或解析 chatTraceId 时使用，例如：日志打点、跨服务链路追踪、对话上下文还原等场景；当需要把 chatId 与 traceId 组合成统一标识时调用 packChatTraceId。 |
| How to use | 从 packages/core-engine/src/agent/context.ts 导入 packChatTraceId，传入 chatId 与 traceId 获得打包后的 chatTraceId 字符串；具体入参出参签名暂无，以源码为准。 |
| Exports | packChatTraceId |
| Related | 暂无 |
| Tags | frontend, core-engine, util, packChatTraceId, chatTraceId, traceId, chatId, agent, context, trace, 链路追踪 |
| Source | refresh |
| Path | packages/core-engine/src/agent/context.ts |
| Updated | 2026-09-17T03:29:56.899Z |

## prepareStepChat

| Field | Value |
|-------|-------|
| Summary | core-engine agent 模块下的工具函数 prepareStepChat，位于 step-chat-bridge.ts（step 与 chat 的桥接层），用于在 agent 的 step 执行流程与 chat 会话之间做前置数据准备/转换。javadoc 与 signatures 信息暂无，具体行为以源码为准。 |
| When to use | 暂无（javadoc 缺失；推测：在 agent step 执行前需要构造或预处理 chat 会话上下文时调用 prepareStepChat） |
| How to use | 暂无（javadoc 与 signatures 缺失；请参考 packages/core-engine/src/agent/step-chat-bridge.ts 中 prepareStepChat 的定义及其调用点确认入参与返回值） |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | prepareStepChat, step-chat-bridge, core-engine, agent, step, chat, bridge, util, frontend |
| Source | refresh |
| Path | packages/core-engine/src/agent/step-chat-bridge.ts |
| Updated | 2026-09-17T03:31:02.692Z |

## normalizeChatStep

| Field | Value |
|-------|-------|
| Summary | 对聊天步骤（chat step）数据进行规范化处理的工具函数，定义于 core-engine 模块的 prompts.ts（agent 提示词相关代码）。javadoc 暂无，具体入参与返回结构以源码实现为准。 |
| When to use | 在 core-engine 的 agent 流程中，需要将不同来源或格式的 chat step 数据统一为标准结构、或在拼接 agent 提示词（prompts）前做规范化时使用。 |
| How to use | 暂无详细用法说明；请阅读 packages/core-engine/src/agent/prompts.ts 中 normalizeChatStep 的实现确认其入参、返回值及是否为导出成员后再接入。 |
| Exports | normalizeChatStep |
| Related | 暂无 |
| Tags | normalizeChatStep, chat step, core-engine, agent, prompts.ts, normalize, util |
| Source | refresh |
| Path | packages/core-engine/src/agent/prompts.ts |
| Updated | 2026-09-17T03:31:58.013Z |

## ingest-worker

| Field | Value |
|-------|-------|
| Summary | core-engine 模块下的 ingest-worker（数据摄取工作器），位于 packages/core-engine/src/retrieve/ingest-worker.ts，属于检索（retrieve）链路的数据摄取处理单元。javadoc 与 signatures 均为暂无。 |
| When to use | 需要在 core-engine 的检索（retrieve）链路中执行数据摄取（ingest）相关任务时使用；具体触发条件因源码无 javadoc/signatures，暂无。 |
| How to use | 暂无 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | ingest-worker, ingest, worker, retrieve, core-engine, util, 摄取, 检索 |
| Source | refresh |
| Path | packages/core-engine/src/retrieve/ingest-worker.ts |
| Updated | 2026-09-17T12:34:13.777Z |

## embeddings

| Field | Value |
|-------|-------|
| Summary | embeddings（向量嵌入）工具，位于 core-engine 的 retrieve（检索）子目录（packages/core-engine/src/retrieve/embeddings.ts），用于向量嵌入的生成或处理以支撑语义检索。javadoc 与函数签名暂缺，具体能力以源码为准。 |
| When to use | 在 core-engine 中需要使用 embeddings（向量嵌入）进行 retrieve（检索）/语义匹配相关计算时使用。 |
| How to use | 暂无（signatures 为空，未提取到可导出的方法签名；请查阅 packages/core-engine/src/retrieve/embeddings.ts 源码确认导入方式与调用约定）。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | embeddings, retrieve, core-engine, 向量嵌入, 语义检索, frontend, TypeScript |
| Source | refresh |
| Path | packages/core-engine/src/retrieve/embeddings.ts |
| Updated | 2026-09-19T08:03:29.339Z |

## live-ports

| Field | Value |
|-------|-------|
| Summary | 暂无 javadoc 与 signatures 信息。根据路径 packages/core-engine/src/retrieve/live-ports.ts，这是 core-engine 模块中 retrieve（检索）子目录下的工具模块 live-ports，推测与检索流程所需的 live-ports（活跃端口/实时端口）的获取与维护相关。 |
| When to use | 暂无。当需要处理或查询 core-engine 中 retrieve 流程相关的 live-ports 数据时可参考本模块；具体触发条件因文档缺失暂无，请以源码为准。 |
| How to use | 暂无。可从 packages/core-engine/src/retrieve/live-ports.ts 导入；由于未扫描到导出签名，具体 API 用法请直接查阅该源码文件确认。 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | live-ports, retrieve, core-engine, util, TypeScript, frontend |
| Source | refresh |
| Path | packages/core-engine/src/retrieve/live-ports.ts |
| Updated | 2026-09-19T08:04:00.874Z |

## DashScopeEmbeddings

| Field | Value |
|-------|-------|
| Summary | DashScopeEmbeddings：基于 DashScope（阿里云灵积模型服务）的文本 embeddings 工具，位于 packages/core-engine/src/retrieve/embeddings.ts，为 core-engine 的 retrieve（检索/RAG）流程生成文本向量。 |
| When to use | 需要在 core-engine 的 retrieve（检索增强/RAG）流程中将文本转换为 embedding 向量时使用；该资产的公开接口签名（signatures）与 javadoc 均暂缺，具体适用方法待补充。 |
| How to use | 暂无（未扫描到公开签名，请参考 packages/core-engine/src/retrieve/embeddings.ts 源码确认 DashScopeEmbeddings 的构造方式与调用方法）。 |
| Exports | DashScopeEmbeddings |
| Related | 暂无 |
| Tags | DashScopeEmbeddings, DashScope, embeddings, embedding, vector, retrieve, RAG, core-engine, TypeScript |
| Source | refresh |
| Path | packages/core-engine/src/retrieve/embeddings.ts |
| Updated | 2026-09-19T09:10:37.591Z |

## Embeddings

| Field | Value |
|-------|-------|
| Summary | core-engine 的检索（retrieve）端口定义，位于 packages/core-engine/src/retrieve/ports.ts，声明 Embeddings（向量嵌入）能力边界，供检索流程按端口注入具体向量嵌入实现。javadoc 暂无，具体签名以源文件为准。 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | Embeddings |
| Related | 暂无 |
| Tags | Embeddings, embedding, retrieve, ports, core-engine, 向量嵌入, 检索, TypeScript |
| Source | refresh |
| Path | packages/core-engine/src/retrieve/ports.ts |
| Updated | 2026-09-19T09:11:48.868Z |





