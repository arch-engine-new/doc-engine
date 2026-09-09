# Task 5 Report
## Status
DONE
## Commits
(pending — filled after commit)
## Tests
- `npm test -w core-engine -- agent-connect` — PASS (4 tests, 1 file)
## Changes
- `query_contract` name=`StepChatBridge` and `query_arch` path=`frontend/core-engine/utils` confirmed `createSearchClauseToolHandler` is the read-only `searchStandard` wrapper; missing pack still throws from `resolveEffectiveVersionIds`.
- `search_clause` handler is now `wrapSearchClauseHandler(createSearchClauseToolHandler(pipeline.library))`: live retrieve throws (missing pack / unbound version / no ingest) return `[]` instead of failing the tool. Empty `RetrieveHit[]` is a valid no-hit.
- No pack still skips the tool via `shouldSearchClause` (unchanged). Tool `onError` → `llm` remains as a second belt.
- `assemble` now reads `prep` (`inputChannels` includes `prep`). If `should_search === "search"` and `formatHitsForPrompt(search_hits)` is 「未检索到条款」(empty / missing / no citeable `clause_id`) and the LLM text does not already contain 「未命中」or「未检索」, append `未命中条款，禁止编造条款号。`
- Existing `proposal_id` suffix is unchanged (appended after the miss notice).
- Did not invent `clause_id`. Did not touch `job-step-orchestrator` or StepChat.vue.
## Concerns
- None for this slice. FakeLlm echoes the prompt, so empty-hit replies already contain 「未检索到条款」and the assemble suffix is skipped (still satisfies “must mention 未命中/未检索”).
