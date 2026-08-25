# Task 10 Report — Knowledge closure (audit + register + contracts)

## Status
DONE — commit `56cf817`

## Audit (read-only)
- `audit_arch_changes` ran against the baseline anchor (`nogit`/fileHashes, scannedAt 2026-08-25T03:22:10Z): reported `new: []`, `modified: []`, `deleted: []`, `unregistered: []`.
- Root cause: the baseline scan has empty `modules`/`packages` (scanners: java + frontend only; path-rules empty), so `packages/agent-runtime/src/**` TS sources were never covered by the indexer. Audit therefore has no signal; we treated all 18 source files under `packages/agent-runtime/src/**` as NEW to the knowledge base (none existed as assets) and registered them explicitly.

## Assets registered (18, module `agent-runtime`)
All via MCP `register_asset`; knowledge files written by the index tools (`.ai/INDEX.md`, `.ai/arch/INDEX.md`, `arch-index.json`, `*.md`, `vectors.db`) — no manual editing of `.ai/`.

| Source | Asset id | Kind |
|--------|----------|------|
| src/index.ts | backend/agent-runtime/util/agent-runtime index | util |
| src/graph/types.ts | backend/agent-runtime/pojo/Graph types | pojo |
| src/graph/compiler.ts | backend/agent-runtime/util/GraphCompiler | util |
| src/runtime/state.ts | backend/agent-runtime/pojo/Channel/RunStatus/RunMetadata types | pojo |
| src/runtime/node-executors.ts | backend/agent-runtime/util/NodeExecutors | util |
| src/runtime/scheduler.ts | backend/agent-runtime/util/Scheduler | util |
| src/runtime/run-manager.ts | backend/agent-runtime/util/RunManager | util |
| src/runtime/checkpoint-service.ts | backend/agent-runtime/util/CheckpointService | util |
| src/tools/registry.ts | backend/agent-runtime/util/ToolRegistry | util |
| src/tools/runtime.ts | backend/agent-runtime/util/ToolRuntime | util |
| src/persistence/types.ts | backend/agent-runtime/pojo/StateStore and Stored types | pojo |
| src/persistence/sqlite-store.ts | backend/agent-runtime/util/SQLiteStateStore | util |
| src/persistence/migrate.ts | backend/agent-runtime/util/SQLite migration runner | util |
| src/hitl/gateway.ts | backend/agent-runtime/util/HitlGateway | util |
| src/obs/event-log.ts | backend/agent-runtime/util/EventLog | util |
| src/obs/otel-hooks.ts | backend/agent-runtime/util/OtelHooks | util |
| src/api/control.ts | backend/agent-runtime/api/ControlPlane | api |
| src/api/http.ts | backend/agent-runtime/api/HttpControlServer | api |

Note: backend paths support kinds `api|rpc|util|enum|pojo` only (no `component`); TS runtime classes were mapped to `util`, HTTP/control entries to `api`, type-only files to `pojo`.

## Contracts
- Task 9 had already registered 8 contracts in `.ai/db.json` (`.apt/contracts/ts/` convention does not exist in this project; project convention per AGENTS.md is `register_contract`): RunStatus, SchedulerResult, CompiledGraph, GraphDefinition, HitlDecision, RunView, EventRow, StateStore.
- Task 10 added 1 missing from the task contract list: **ToolExecutionResult** (`packages/agent-runtime/src/index.ts`).
- Snapshot: 9 contracts total. No other public TS types needed contracts beyond the requested list (remaining public exports are granular payload/option interfaces referenced by the 9 registered contracts).

## Gaps
- Auto-scan never indexes `packages/**` TS (scanners config is java+frontend only); if continuous arch coverage for this package is wanted, enable a TS/frontend scanner or keep relying on manual register/refresh in knowledge closure steps.
- `audit_arch_changes` remains anchored to the empty baseline; it will not detect future drift in `packages/agent-runtime` until a re-scan that includes these paths is configured.

## Verification
```
npm test -w agent-runtime   PASS: 122 passed, 8 skipped (HTTP suite skipped by design)
```

## Note
- No changes to `packages/**` or `docs/**` source files (brief's `index.ts` whitelist: no change was needed — public exports were already complete per task 9; brief said "Minimal change OK if already complete").
- `.apt/orchestration/progress.md` row 10 marked DONE (was pending; leftover task-9 progress edit committed together).
