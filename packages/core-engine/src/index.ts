export const CORE_ENGINE_VERSION = "0.1.0";

export type {
  AuditColumns,
  AuditEventRow,
  ClauseRow,
  ConversationMessageRow,
  ConversationThreadRow,
  DocumentRow,
  ExtractionRow,
  FieldBoxRow,
  FindingRow,
  JobRow,
  JsonValue,
  ProjectRow,
  ProposalRow,
  ReceiptRow,
  RuleFixtureRow,
  RuleRow,
  RuleVersionRow,
  SpecPackRow,
  StandardDocRow,
  StandardEdgeRow,
  StandardVersionRow,
  TemplateRow,
  VolumePreviewRow,
} from "./types.js";

export {
  evaluate,
  RuleInterpreter,
} from "./rules/interpreter.js";
export type {
  EvaluableRule,
  EvaluatedFinding,
  ExtractionFields,
  RuleDsl,
} from "./rules/interpreter.js";

export { RulePublisher } from "./rules/publish.js";
export type {
  AddFixtureInput,
  PublishResult,
  RuleFixtureKind,
  SaveDraftInput,
  SaveDraftResult,
} from "./rules/publish.js";

export { extractByTemplate } from "./extract/field-box.js";
export type { FieldBoxKey } from "./extract/field-box.js";

export { CONFIRM_NEXT, JobPipeline } from "./pipeline/job-pipeline.js";
export type {
  AppendChatInput,
  AppendChatResult,
  CreateSpecPackInput,
  CreateTemplateInput,
  FixtureJobResult,
  OpenJobForPackInput,
  RunFixtureJobInput,
} from "./pipeline/job-pipeline.js";

export {
  StandardLibrary,
  createSearchClauseToolHandler,
  defaultRetrievePorts,
} from "./retrieve/library.js";
export type {
  AddStandardEdgeInput,
  AttachStandardFitInput,
  IngestStandardInput,
  IngestStandardResult,
  SearchStandardInput,
} from "./retrieve/library.js";
export { splitClauses } from "./retrieve/split.js";
export type { SplitClause } from "./retrieve/split.js";
export { HashEmbeddings, FixtureEmbeddings } from "./retrieve/embeddings.js";
export { MemoryVectorStore } from "./retrieve/memory-vector.js";
export { MemoryGraphStore } from "./retrieve/memory-graph.js";
export { QdrantVectorStore } from "./retrieve/qdrant.js";
export { Neo4jGraphStore } from "./retrieve/neo4j.js";
export { IndependentReranker } from "./retrieve/rerank.js";
export { FakePrequery, ZhipuPrequery } from "./retrieve/prequery.js";
export type {
  ChatComplete,
  ClauseSpan,
  EdgeKind,
  Embeddings,
  GraphEdge,
  GraphStore,
  Prequery,
  PrequeryResult,
  RetrieveHit,
  RetrievePath,
  RetrievePorts,
  RerankCandidate,
  Reranker,
  SearchHit,
  VectorHit,
  VectorStore,
} from "./retrieve/ports.js";

export {
  mockPendingMount,
  commitAdapterWrite,
  listCommittedAdapterWrites,
  resetAdapterWrites,
} from "./adapter/mock.js";
export type { AdapterReceipt, CommittedAdapterWrite } from "./adapter/mock.js";

export {
  CHECK_WORDING_FIXTURE,
  ReviewDesk,
  createCheckWordingToolHandler,
} from "./pipeline/review.js";
export type {
  CheckWordingInput,
  ConfirmProposalResult,
} from "./pipeline/review.js";

export { VolumeDesk, buildPreviewTree } from "./pipeline/volume.js";
export type {
  PreviewVolumeResult,
  VolumeGroupNode,
  VolumeLeaf,
  VolumeLeafNode,
  VolumePreviewNode,
  VolumePreviewTree,
} from "./pipeline/volume.js";

export {
  EMPTY_PACK_NAME,
  EMPTY_PACK_VERSION,
  FIXTURE_OK,
  FIXTURE_REVERSED,
  PACK_ID,
  R1_DSL,
  R2_DSL,
  RULE_R1_ID,
  RULE_R1_VERSION_ID,
  RULE_R2_ID,
  RULE_R2_VERSION_ID,
  SEED_PACK_PROJECT_ID,
  fieldsForKind,
} from "./pipeline/seed.js";
export type { FixtureKind } from "./pipeline/seed.js";

export { runMigration, runMigrationOnDb, isMigrated, LEDGER_TABLES, SLICE1_TABLES } from "./persistence/migrate.js";
export { CoreEngineStore } from "./persistence/store.js";
export type { FieldBoxWrite } from "./persistence/store.js";
export { SqliteLedger } from "./persistence/ledger.js";
export type { LedgerStore } from "./persistence/ledger.js";
