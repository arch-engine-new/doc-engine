# Task 2 Report
## Status
DONE_WITH_CONCERNS
## Commits
(pending until git commit) feat(core-engine): add pack_id to job context and shouldSearchClause
## Tests
- `npx tsc -p packages/core-engine --noEmit` — FAIL (pre-existing, outside whitelist; Task 2 files have 0 errors)
- `npm test -w core-engine -- agent-connect` — PASS (4 tests, 1 file)
## Changes
- `query_arch` path=`frontend/core-engine/util#buildjobcontext` confirmed snapshot previously omitted `pack_id`.
- `query_arch` path=`frontend/core-engine/util#shoulddraftwording` confirmed `shouldDraftWording` is `WORDING_STEPS` + keyword regex.
- `JobContextSnapshot.pack_id: string | null`; `buildJobContext` copies `job.pack_id`; `formatJobContextForPrompt` emits `pack_id=...` or `pack=(none)`.
- Exported `shouldSearchClause(step, userMessage, packId): boolean`: no pack (null/undefined/"") → false; keyword `/条款|规范|标准|查条|search_clause/` or step in `{checking, check_findings, standard_lib}` with pack → true.
- `stepSystemPrompt` base now forbids inventing clause numbers; only cite retrieved `clause_id`, else say 未命中. `standard_lib` per-step line aligned (was “不写条款号”).
- Tests: assertions next to `shouldDraftWording`; StepChatBridge expected strings unchanged (still `[fake-llm` / `proposal_id=`).
## Concerns
Package `tsc --noEmit` fails on pre-existing errors in `excel/fill-service.ts`, `http/handle-request.ts`, `http/session.ts`, `persistence/pg-store.ts`, `pipeline/seed.ts` — not in this Task whitelist, not introduced here. Agent-connect tests are green.
