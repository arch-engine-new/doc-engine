# Pojo

_No pojo discovered._

## AgentRuntimeSchemaSql

| Field | Value |
|-------|-------|
| Summary | SQLite DDL for graph agent runtime tables (7 tables) |
| When to use | Need persistence DDL for agent runs/checkpoints/tools/hitl |
| How to use | Apply docs/schema/generated/agent-runtime-migration.sql via better-sqlite3 or migrate runner |
| Exports | t_agent_graph, t_agent_run, t_agent_checkpoint |
| Related | 暂无 |
| Tags | schema, agent-runtime, sqlite |
| Source | register |
| Path | docs/schema/generated/agent-runtime-migration.sql |
| Updated | 2026-08-25T03:38:46.255Z |

## Channel/RunStatus/RunMetadata types

| Field | Value |
|-------|-------|
| Summary | Runtime state types (Channel, ChannelMap, RunStatus, RunMetadata, NodeExecutionRecord, ExecutionContext) plus channel helpers (createInitialChannels, mergeChannels, getChannel, serialize/deserializeChannels). |
| When to use | Need to type or manipulate run state: read/write channels, construct run metadata, or serialize channels for persistence/checkpoints. |
| How to use | Import types and helpers from agent-runtime; e.g. createInitialChannels(input) → ChannelMap, mergeChannels(channels, updates) then serializeChannels for storage. |
| Exports | RunStatus, RunMetadata, Channel, ChannelMap, NodeExecutionRecord, createInitialChannels, mergeChannels, getChannel, serializeChannels, deserializeChannels |
| Related | 暂无 |
| Tags | agent-runtime, state, channels, types |
| Source | register |
| Path | packages/agent-runtime/src/runtime/state.ts |
| Updated | 2026-08-25T10:42:00.013Z |

## Graph types

| Field | Value |
|-------|-------|
| Summary | Graph authoring/compile type surface: NodeType, GraphNode/GraphEdge/GraphDefinition (authoring input), CompiledGraph (scheduler input), RetryPolicy. |
| When to use | Need the public graph model to author definitions or type a compiled run input. |
| How to use | Import authoring types from agent-runtime to build GraphDefinition; pass to compileGraph. NODE_TYPES lists allowed node types. |
| Exports | GraphNode, GraphEdge, GraphDefinition, CompiledGraph, NodeType, RetryPolicy, NODE_TYPES |
| Related | 暂无 |
| Tags | agent-runtime, graph, types |
| Source | register |
| Path | packages/agent-runtime/src/graph/types.ts |
| Updated | 2026-08-25T10:42:36.213Z |

## StateStore and Stored types

| Field | Value |
|-------|-------|
| Summary | Persistence contract: StateStore interface (graph/run/node/checkpoint/toolCall/event/hitl CRUD + list) with row shapes and runtime↔stored converters. |
| When to use | Need to swap/implement a state store, describe DB rows, or map runtime records into stored rows. |
| How to use | Implement StateStore or consume via SQLiteStateStore; use Stored* records as the DB row shape; converters map runtime records to stored shapes. |
| Exports | StateStore, StoredGraph, StoredRun, StoredNodeExecution, StoredCheckpoint, StoredToolCall, StoredRunEvent, StoredHitlInterrupt, ListRunsOptions, runMetadataToStoredRun, nodeExecutionRecordToStored |
| Related | 暂无 |
| Tags | agent-runtime, persistence, statestore, types |
| Source | register |
| Path | packages/agent-runtime/src/persistence/types.ts |
| Updated | 2026-08-25T10:42:54.850Z |
