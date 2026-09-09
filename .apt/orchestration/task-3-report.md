# Task 3 Report
## Status
DONE
## Commits
5087db79cd563528730594b3b7db43cf959d4678 feat(core-engine): register read-only search_clause tool
## Tests
- `npm test -w agent-runtime -- submit-tool-ban` — PASS (3 tests, 1 file)
- `npm test -w core-engine -- agent-connect` — PASS (4 tests, 1 file)
## Changes
- `query_contract` name=`StandardLibrary` confirmed `createSearchClauseToolHandler(library)` wraps `searchStandard` only (returns `RetrieveHit[]`; never `attachHit` / submit).
- `registerStepChatTools` now registers `search_clause`: input `{ packId, query, jobId? }`, output `array` of objects; handler = `createSearchClauseToolHandler(pipeline.library)`.
- Description: read-only `StandardLibrary.searchStandard`; never attach Finding / never submit. Why-comment on registration: cite retrieved `clause_id` in chat; Finding/submit belong to review.
- Kept `get_job_context` and `check_wording`. Did not register `attachStandardFitFinding` or `submit_*`.
- Did not touch step-chat-bridge / node-executors.
