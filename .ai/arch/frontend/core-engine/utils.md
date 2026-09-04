# Utils

## AgentRuntimeFactory

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export class AgentRuntimeFactory, export type AgentRuntimeFactoryOptions |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/agent/agent-runtime-factory.ts |
| Updated | 2026-08-29T16:03:18.069Z |

## BaiduOcr

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function fromEnv(env: NodeJS.ProcessEnv = process.env): BaiduOcr \| null, export class BaiduOcrimplements OcrPort |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/ocr/baidu.ts |
| Updated | 2026-08-29T16:03:18.069Z |

## blobObjectUri

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function blobObjectUri(bucket: string, key: string): string |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/blob/minio.ts |
| Updated | 2026-08-29T16:03:18.069Z |

## buildAutoWording

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function buildAutoWording(jobId: string, blocking: FindingRow[]): string |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/agent/prompts.ts |
| Updated | 2026-08-29T16:03:18.069Z |

## buildJobContext

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function buildJobContext(   pipeline: JobPipeline,   traceId: string,   step: string, ): Promise<JobContextSnapshot> |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/agent/context.ts |
| Updated | 2026-08-29T16:03:18.069Z |

## buildJobStepGraphDefinition

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function buildJobStepGraphDefinition(   pipeline: JobPipeline,   _registry: ToolRegistry, ): GraphDefinition |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/agent/job-step-orchestrator.ts |
| Updated | 2026-08-29T16:03:18.069Z |

## buildPreviewTree

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function buildPreviewTree(   leaves: VolumeLeaf[],   groupKeys: string[] \| null \| undefined,   orderKey: string \| null, ): VolumePreviewTree |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/pipeline/volume.ts |
| Updated | 2026-08-29T16:03:18.069Z |

## buildStepChatGraphDefinition

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function buildStepChatGraphDefinition(   pipeline: JobPipeline,   registry: ToolRegistry, ): GraphDefinition |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/agent/step-chat-bridge.ts |
| Updated | 2026-08-29T16:03:18.069Z |

## CHECK_WORDING_FIXTURE

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export const CHECK_WORDING_FIXTURE |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/pipeline/review.ts |
| Updated | 2026-08-29T16:03:18.069Z |

## commitAdapterWrite

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/adapter/mock.ts |
| Updated | 2026-08-29T16:03:18.069Z |

## CONCRETE_DOC_TYPE_ID

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-08-29T16:03:18.069Z |

## CONCRETE_FIXTURE_MAPPING_JSON

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function loadConcreteFixtureMapping(   jsonPath: string = CONCRETE_FIXTURE_MAPPING_JSON, ): ConcreteFixtureMapping |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-08-29T16:03:18.069Z |

## CONCRETE_FIXTURE_XLSX

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-08-29T16:03:18.069Z |

## CONCRETE_TEMPLATE_NAME

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-08-29T16:03:18.069Z |

## CONCRETE_TEMPLATE_XLSX_FILE

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-08-29T16:03:18.069Z |

## concreteCellMappingsFromFixture

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function concreteCellMappingsFromFixture(fixture: ConcreteFixtureMapping): ConcreteCellMappingWrite[] |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-08-29T16:03:18.069Z |

## concreteCompletenessRules

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function concreteCompletenessRules(docTypeId: string): ConcreteCompletenessRuleWrite[] |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-08-29T16:03:18.069Z |

## concreteFieldDefsFromFixture

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function concreteFieldDefsFromFixture(   fixture: ConcreteFixtureMapping, ): Array< |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-08-29T16:03:18.069Z |

## concreteFillRulesFromFixture

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function concreteFillRulesFromFixture(fixture: ConcreteFixtureMapping): ConcreteFillRuleWrite[] |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-08-29T16:03:18.069Z |

## CONFIRM_NEXT

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export const CONFIRM_NEXT |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/pipeline/job-pipeline.ts |
| Updated | 2026-08-29T16:03:18.069Z |

## CORE_ENGINE_VERSION

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export const CORE_ENGINE_VERSION |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/index.ts |
| Updated | 2026-08-29T16:03:18.069Z |

## coreEngineHttpPlugin

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function coreEngineHttpPlugin(): ViteMiddlewarePlugin |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/http/node.ts |
| Updated | 2026-08-29T16:03:18.069Z |

## CoreEngineStore

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export class CoreEngineStore |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/persistence/store.ts |
| Updated | 2026-08-29T16:03:18.069Z |

## createCheckWordingToolHandler

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function createCheckWordingToolHandler(desk: ReviewDesk) |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/pipeline/review.ts |
| Updated | 2026-08-29T16:03:18.069Z |

## createDemoHttpServer

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function createDemoHttpServer(port = 8787): Server |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/http/node.ts |
| Updated | 2026-08-29T16:03:18.069Z |

## createSearchClauseToolHandler

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function createSearchClauseToolHandler(library: StandardLibrary) |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/retrieve/library.ts |
| Updated | 2026-08-29T16:03:18.069Z |

## createStepChatRegistry

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function createStepChatRegistry(pipeline: JobPipeline): ToolRegistry |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/agent/tools.ts |
| Updated | 2026-08-29T16:03:18.069Z |

## DEFAULT_BAIDU_OCR_API

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export const DEFAULT_BAIDU_OCR_API |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/ocr/env.ts |
| Updated | 2026-08-29T16:03:18.069Z |

## DEFAULT_FAKE_OCR_TEXT

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export const DEFAULT_FAKE_OCR_TEXT |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/ocr/fake.ts |
| Updated | 2026-08-29T16:03:18.069Z |

## defaultRetrievePorts

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/retrieve/library.ts |
| Updated | 2026-08-29T16:03:18.069Z |

## DEMO_DICTS

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export const DEMO_DICTS |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/http/dicts.ts |
| Updated | 2026-08-29T16:03:18.069Z |

## DemoHttpSession

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function getSharedSession(): Promise<DemoHttpSession>, export function replaceSharedSession(session: DemoHttpSession): void, export class DemoHttpSession |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/http/session.ts |
| Updated | 2026-08-29T16:03:18.069Z |

## DOC_TYPE_CHILD_ID

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-08-29T16:03:55.532Z |

## DOC_TYPE_PARENT_ID

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-08-29T16:03:55.532Z |

## DocumentPipeline

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export class DocumentPipeline |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/pipeline/document-pipeline.ts |
| Updated | 2026-08-29T16:03:55.532Z |

## EMPTY_PACK_NAME

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export const EMPTY_PACK_NAME |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-08-29T16:03:55.532Z |

## EMPTY_PACK_VERSION

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-08-29T16:03:55.532Z |

## evaluate

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function evaluate(fields: ExtractionFields, rules: EvaluableRule[]): EvaluatedFinding[] |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/rules/interpreter.ts |
| Updated | 2026-08-29T16:03:55.532Z |

## ExcelFillService

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export class ExcelFillService |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/excel/fill-service.ts |
| Updated | 2026-08-29T16:03:55.532Z |

## extractByTemplate

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function extractByTemplate(   fields: Record<string, unknown>,   boxes: FieldBoxKey[], ): Record<string, unknown> |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/extract/field-box.ts |
| Updated | 2026-08-29T16:03:55.532Z |

## extractOcrByTemplate

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function extractOcrByTemplate(   text: string,   boxes: FieldBoxKey[], ): Record<string, unknown> |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/extract/ocr-fields.ts |
| Updated | 2026-08-29T16:03:55.532Z |

## FakeOcr

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export class FakeOcrimplements OcrPort |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/ocr/fake.ts |
| Updated | 2026-08-29T16:03:55.532Z |

## FakePrequery

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export class FakePrequeryimplements Prequery |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/retrieve/prequery.ts |
| Updated | 2026-08-29T16:03:55.532Z |

## fieldsForKind

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-08-29T16:03:55.532Z |

## FIXTURE_OK

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-08-29T16:03:55.532Z |

## FIXTURE_REVERSED

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-08-29T16:03:55.532Z |

## FixtureEmbeddings

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export class FixtureEmbeddingsimplements Embeddings |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/retrieve/embeddings.ts |
| Updated | 2026-08-29T16:03:55.532Z |

## formatJobContextForPrompt

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function formatJobContextForPrompt(ctx: JobContextSnapshot): string |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/agent/context.ts |
| Updated | 2026-08-29T16:03:55.532Z |

## fromEnv

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function fromEnv(env: NodeJS.ProcessEnv = process.env): MinioBlobStore \| null |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/blob/minio.ts |
| Updated | 2026-08-29T16:03:55.532Z |

## fromEnv

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function fromEnv(env: NodeJS.ProcessEnv = process.env): BaiduOcr \| null |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/ocr/baidu.ts |
| Updated | 2026-08-29T16:03:55.532Z |

## getSharedSession

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function getSharedSession(): Promise<DemoHttpSession> |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/http/session.ts |
| Updated | 2026-08-29T16:03:55.532Z |

## handleDemoRequest

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function handleDemoRequest(   session: DemoHttpSession,   req: DemoHttpRequest, ): Promise<DemoHttpResponse> |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/http/handle-request.ts |
| Updated | 2026-08-29T16:03:55.532Z |

## HASH_EMBED_DIM

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export const HASH_EMBED_DIM |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/retrieve/embeddings.ts |
| Updated | 2026-08-29T16:03:55.532Z |

## HashEmbeddings

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export class HashEmbeddingsimplements Embeddings |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/retrieve/embeddings.ts |
| Updated | 2026-08-29T16:03:55.532Z |

## IndependentReranker

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export class IndependentRerankerimplements Reranker, export type IndependentRerankerOptions |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/retrieve/rerank.ts |
| Updated | 2026-08-29T16:03:55.532Z |

## isMigrated

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function isMigrated(dbPath: string): Promise<boolean> |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/persistence/migrate.ts |
| Updated | 2026-08-29T16:03:55.532Z |

## JobPipeline

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export class JobPipeline |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/pipeline/job-pipeline.ts |
| Updated | 2026-08-29T16:03:55.532Z |

## JobStepOrchestrator

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export class JobStepOrchestrator |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/agent/job-step-orchestrator.ts |
| Updated | 2026-08-29T16:03:55.532Z |

## LedgerConflictError

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export class LedgerConflictErrorextends Error |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/pipeline/job-pipeline.ts |
| Updated | 2026-08-29T16:03:55.532Z |

## listCommittedAdapterWrites

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function listCommittedAdapterWrites(): CommittedAdapterWrite[] |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/adapter/mock.ts |
| Updated | 2026-08-29T16:03:55.532Z |

## liveRetrievePorts

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function liveRetrievePorts(): RetrievePorts |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/retrieve/live-ports.ts |
| Updated | 2026-08-29T16:03:55.532Z |

## loadConcreteFixtureMapping

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function loadConcreteFixtureMapping(   jsonPath: string = CONCRETE_FIXTURE_MAPPING_JSON, ): ConcreteFixtureMapping |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-08-29T16:03:55.532Z |

## MAX_UPLOAD_BYTES

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export const MAX_UPLOAD_BYTES |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/pipeline/job-pipeline.ts |
| Updated | 2026-08-29T16:03:55.532Z |

## MemoryBlobStore

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export class MemoryBlobStoreimplements BlobStore |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/blob/memory.ts |
| Updated | 2026-08-29T16:03:55.532Z |

## MemoryGraphStore

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export class MemoryGraphStoreimplements GraphStore |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/retrieve/memory-graph.ts |
| Updated | 2026-08-29T16:04:23.611Z |

## MemoryVectorStore

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export class MemoryVectorStoreimplements VectorStore |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/retrieve/memory-vector.ts |
| Updated | 2026-08-29T16:04:23.611Z |

## MinioBlobStore

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function fromEnv(env: NodeJS.ProcessEnv = process.env): MinioBlobStore \| null, export class MinioBlobStoreimplements BlobStore, export type MinioBlobStoreOptions |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/blob/minio.ts |
| Updated | 2026-08-29T16:04:23.611Z |

## mockPendingMount

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/adapter/mock.ts |
| Updated | 2026-08-29T16:04:23.611Z |

## Neo4jGraphStore

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export class Neo4jGraphStoreimplements GraphStore |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/retrieve/neo4j.ts |
| Updated | 2026-08-29T16:04:23.611Z |

## newId

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function newId(prefix: string): string |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/ids.ts |
| Updated | 2026-08-29T16:04:23.611Z |

## nodeRequestToDemo

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function nodeRequestToDemo(req: IncomingMessage): Promise<DemoHttpRequest> |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/http/node.ts |
| Updated | 2026-08-29T16:04:23.611Z |

## NoOpenHitlError

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export class NoOpenHitlErrorextends Error |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/agent/job-step-orchestrator.ts |
| Updated | 2026-08-29T16:04:23.611Z |

## nowIso

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function nowIso(): string |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/ids.ts |
| Updated | 2026-08-29T16:04:23.611Z |

## ORCHESTRATED_STEPS

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export const ORCHESTRATED_STEPS |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/agent/job-step-orchestrator.ts |
| Updated | 2026-08-29T16:04:23.611Z |

## PACK_ID

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-08-29T16:04:23.611Z |

## parseBaiduOcrApi

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function parseBaiduOcrApi(raw: string \| undefined): BaiduOcrApi |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/ocr/env.ts |
| Updated | 2026-08-29T16:04:23.611Z |

## parseMultipartBody

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function parseMultipartBody(raw: Buffer, boundary: string): DemoHttpMultipart |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/http/node.ts |
| Updated | 2026-08-29T16:04:23.611Z |

## parseOcrFields

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function parseOcrFields(text: string): Record<string, string> |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/extract/ocr-fields.ts |
| Updated | 2026-08-29T16:04:23.611Z |

## PostgresLedger

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export class PostgresLedgerimplements LedgerStore |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/persistence/pg-store.ts |
| Updated | 2026-08-29T16:04:23.611Z |

## QdrantVectorStore

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export class QdrantVectorStoreimplements VectorStore |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/retrieve/qdrant.ts |
| Updated | 2026-08-29T16:04:23.611Z |

## R1_DSL

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-08-29T16:04:23.611Z |

## R2_DSL

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-08-29T16:04:23.611Z |

## readBaiduOcrEnv

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function readBaiduOcrEnv(   env: NodeJS.ProcessEnv = process.env, ): BaiduOcrEnvConfig \| null |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/ocr/env.ts |
| Updated | 2026-08-29T16:04:23.611Z |

## readNodeBody

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function readNodeBody(req: IncomingMessage): Promise<unknown> |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/http/node.ts |
| Updated | 2026-08-29T16:04:23.611Z |

## readRawBody

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function readRawBody(req: IncomingMessage): Promise<Buffer> |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/http/node.ts |
| Updated | 2026-08-29T16:04:23.611Z |

## registerStepChatTools

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function registerStepChatTools(registry: ToolRegistry, pipeline: JobPipeline): void |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/agent/tools.ts |
| Updated | 2026-08-29T16:04:23.611Z |

## replaceSharedSession

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function replaceSharedSession(session: DemoHttpSession): void |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/http/session.ts |
| Updated | 2026-08-29T16:04:23.611Z |

## resetAdapterWrites

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function resetAdapterWrites(): void |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/adapter/mock.ts |
| Updated | 2026-08-29T16:04:23.611Z |

## resolveEffectiveBoxes

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function resolveEffectiveBoxes(   fieldDefs: FieldDefRow[],   templateBoxes: FieldBoxRow[], ): EffectiveFieldBox[] |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/extract/effective-boxes.ts |
| Updated | 2026-08-29T16:04:23.611Z |

## resolveEffectiveExcelMappings

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function resolveEffectiveExcelMappings(   docTypeId: string,   templateId: string,   store: ExcelMappingStore, ): Promise<EffectiveExcelMapping[]> |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/excel/effective-mappings.ts |
| Updated | 2026-08-29T16:04:23.611Z |

## resolveEngineMode

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function resolveEngineMode(env: NodeJS.ProcessEnv = process.env): EngineMode |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/persistence/live-env.ts |
| Updated | 2026-08-29T16:04:23.611Z |

## resolveRepoRoot

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function resolveRepoRoot(startDir = process.cwd()): string |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/agent/repo-root.ts |
| Updated | 2026-08-29T16:04:23.611Z |

## ReviewDesk

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function createCheckWordingToolHandler(desk: ReviewDesk), export class ReviewDesk |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/pipeline/review.ts |
| Updated | 2026-08-29T16:04:23.611Z |

## RULE_R1_ID

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-08-29T16:04:23.611Z |

## RULE_R1_VERSION_ID

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-08-29T16:04:23.611Z |

## RULE_R2_ID

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-08-29T16:04:23.611Z |

## RULE_R2_VERSION_ID

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-08-29T16:04:57.809Z |

## RuleInterpreter

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export class RuleInterpreter |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/rules/interpreter.ts |
| Updated | 2026-08-29T16:04:57.809Z |

## RulePublisher

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export class RulePublisher |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/rules/publish.ts |
| Updated | 2026-08-29T16:04:57.809Z |

## runMigration

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function runMigration(dbPath: string): Promise<void>, export function runMigrationOnDb(db: Database.Database): void |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/persistence/migrate.ts |
| Updated | 2026-08-29T16:04:57.809Z |

## runMigrationOnDb

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function runMigrationOnDb(db: Database.Database): void |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/persistence/migrate.ts |
| Updated | 2026-08-29T16:04:57.809Z |

## runPgMigration

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function runPgMigration(databaseUrl: string): Promise<void> |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/persistence/pg-migrate.ts |
| Updated | 2026-08-29T16:04:57.809Z |

## safeName

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function safeName(fileName: string): string |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/blob/minio.ts |
| Updated | 2026-08-29T16:04:57.809Z |

## SEED_PACK_PROJECT_ID

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export const SEED_PACK_PROJECT_ID |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-08-29T16:04:57.809Z |

## seedConcreteInspectionBatchExcelDemo

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function seedConcreteInspectionBatchExcelDemo(   store: ConcreteExcelSeedStore,   input: SeedConcreteInspectionBatchInput, ): Promise<SeedConcreteInspectionBatchResult> |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-08-29T16:04:57.809Z |

## seedConcreteInspectionBatchLedger

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function seedConcreteInspectionBatchLedger(   store: ConcreteExcelSeedStore,   input: Pick<SeedConcreteInspectionBatchInput, "packId">, ): SeedConcreteInspectionBatchResult |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-08-29T16:04:57.809Z |

## seedDemoDocTypes

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function seedDemoDocTypes(store: DocTypeSeedStore, input: SeedDemoDocTypesInput): void |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/pipeline/seed.ts |
| Updated | 2026-08-29T16:04:57.809Z |

## shouldDraftWording

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | 暂无 |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/agent/prompts.ts |
| Updated | 2026-08-29T16:04:57.809Z |

## splitClauses

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function splitClauses(text: string): SplitClause[] |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/retrieve/split.ts |
| Updated | 2026-08-29T16:04:57.809Z |

## SqliteLedger

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export class SqliteLedgerimplements LedgerStore |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/persistence/ledger.ts |
| Updated | 2026-08-29T16:04:57.809Z |

## StandardLibrary

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function createSearchClauseToolHandler(library: StandardLibrary), export class StandardLibrary |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/retrieve/library.ts |
| Updated | 2026-08-29T16:04:57.809Z |

## StepChatBridge

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export class StepChatBridge, export type StepChatBridgeOptions= AgentRuntimeFactoryOptions |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/agent/step-chat-bridge.ts |
| Updated | 2026-08-29T16:04:57.809Z |

## stepSystemPrompt

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function stepSystemPrompt(step: string): string |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/agent/prompts.ts |
| Updated | 2026-08-29T16:04:57.809Z |

## uploadDocument

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function uploadDocument(input: UploadDocumentInput): UploadDocumentResult |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/adapter/mock.ts |
| Updated | 2026-08-29T16:04:57.809Z |

## uploadObjectKey

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function uploadObjectKey(jobId: string, fileName: string): string |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/blob/minio.ts |
| Updated | 2026-08-29T16:04:57.809Z |

## UploadServiceUnavailableError

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export class UploadServiceUnavailableErrorextends Error |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/http/session.ts |
| Updated | 2026-08-29T16:04:57.809Z |

## UploadValidationError

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export class UploadValidationErrorextends Error |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/pipeline/job-pipeline.ts |
| Updated | 2026-08-29T16:04:57.809Z |

## validateUploadInput

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function validateUploadInput(input: Pick<OpenUploadJobInput, "mime" \| "bytes">): void |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/pipeline/job-pipeline.ts |
| Updated | 2026-08-29T16:04:57.809Z |

## VolumeDesk

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export class VolumeDesk |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/pipeline/volume.ts |
| Updated | 2026-08-29T16:04:57.809Z |

## WORDING_STEPS

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export const WORDING_STEPS |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/agent/prompts.ts |
| Updated | 2026-08-29T16:04:57.809Z |

## writeDemoJson

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export function writeDemoJson(res: ServerResponse, status: number, body: unknown): void |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/http/node.ts |
| Updated | 2026-08-29T16:04:57.809Z |

## ZhipuPrequery

| Field | Value |
|-------|-------|
| Summary | 扫描失败，待人工补充 |
| When to use | 暂无 |
| How to use | 暂无 |
| Exports | export class ZhipuPrequeryimplements Prequery |
| Related | 暂无 |
| Tags | 暂无 |
| Source | scan |
| Path | packages/core-engine/src/retrieve/prequery.ts |
| Updated | 2026-08-29T16:04:57.809Z |
