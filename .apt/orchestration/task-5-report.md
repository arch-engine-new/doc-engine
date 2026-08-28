# Task 5 Report — PostgresLedger job / 待审 / 审计 / 对话表

## Status
DONE

## SHA
(pending commit)

## commits
- (pending) — `feat(core-engine): PostgresLedger job review audit chat tables`

## What was implemented
`PostgresLedger` in `packages/core-engine/src/persistence/pg-store.ts` now implements job / document / extraction / finding / proposal / receipt / volume_preview / audit_event / conversation_thread / conversation_message as an async `pg` clone of `CoreEngineStore`.

- `$n` params; TIMESTAMP → ISO string; JSONB → `JSON.stringify` / `asJsonString`; BIGINT `id`/`seq`/`blocking` → number
- `listJobs` `ORDER BY id DESC`; `getDocumentForJob` first doc; `getExtraction` / `getVolumePreview` latest by id DESC
- `listPendingProposals` optional `jobId` + `status = 'pending'`
- `appendAudit` `COALESCE(MAX(seq), 0) + 1` per `trace_id`, `listAudit` `ORDER BY seq ASC`
- Conversation: `listThreads`, `listMessagesByTrace`, `getThread(trace, step)`, `insertThread` (`hitl_token` NULL), `insertMessage`, `listMessages`
- `standard_doc` / version / clause / edge / `bindEffectiveVersion` still throw `not implemented until later triple-store task` (wipe is Task 6)

MCP: `query_contract` name=`ClauseRow`. File whitelist: `pg-store.ts` only.

## Test summary
```
npx tsc -p packages/core-engine --noEmit

exit 0 (no output)
```

## Files changed
- `packages/core-engine/src/persistence/pg-store.ts`

## Concerns
None. Standard library tables and `wipeLedger` remain for Task 6.
