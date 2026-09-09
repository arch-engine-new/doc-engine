# Task 4 Report
## Status
DONE_WITH_CONCERNS
## Commits
`feat(core-engine): rebuild step-chat-v1 with native llm/tool/branch nodes`
## Tests
- `npm test -w core-engine -- agent-connect` — PASS (4 tests, 1 file)
- `npx tsc -p packages/core-engine --noEmit` — FAIL (pre-existing, outside whitelist; `step-chat-bridge.ts` has 0 errors)
## Changes
- `query_contract` name=`StepChatBridge` confirmed prior graph was `start → handle(fn) → end` (LLM + optional `check_wording` inside one inlineFn). `reply()` still reads `result.output.{reply,proposalId}`.
- `query_arch` path=`frontend/agent-runtime/utils` confirmed `LLMExecutor.promptTemplate(channels)`, `ToolExecutor.inputFrom`, `BranchExecutor.condition` + edge `condition`, `GraphEdge.onError`.
- Replaced `handle` with native `step-chat-v1` nodes: `prepare` → `map_search` → `branch_search` → (`call_search` | skip) → `llm` → `map_wording` → `branch_draft` → (`call_wording` | skip) → `assemble` → `end`.
- `prepare` uses `buildJobContext` / `formatJobContextForPrompt` / `stepSystemPrompt` / `shouldSearchClause` / `shouldDraftWording`; writes `prep` plus nested `search_args`.
- `map_search` copies `search_args` for `call_search` (`toolName: search_clause`, `inputFrom: search_args`, `idempotencyKey: {{runId}}-search_clause`).
- `llm` `promptTemplate` stitches system + job context + hits (`clause_id` lines, or 「未检索到条款」) + user message. FakeLlm still echoes `[fake-llm`.
- `map_wording` builds `{ jobId, wording: llm_text trim/cap 500, agentRunId: runId }` for `call_wording` (`check_wording`, `inputFrom: wording_args`).
- `assemble` writes `output` `{ reply, proposalId }`; proposal appendix still contains `proposal_id=`.
- `call_search` `onError` → `llm` so retrieve throws do not fail the run (checking + 「这条 blocking 是什么意思？」).
- Kahn XOR-join workaround: unused branch arms are throw stubs (`skip_search` / `skip_draft`) whose `onError` edges join `llm` / `assemble`. Normal skip→join edges would leave in-degree 1 and never schedule the join. Documented in-file.
- `StepChatBridge` class / `reply()` unchanged. Did not touch `job-step-orchestrator` or StepChat.vue.
## Concerns
- Package `tsc --noEmit` fails on pre-existing errors in `excel/fill-service.ts`, `http/handle-request.ts`, `http/session.ts`, `persistence/pg-store.ts`, `pipeline/seed.ts` — same set as Task 2, not introduced here.
- Extra adapter nodes `map_search` / `skip_search` / `skip_draft` are required by single-channel `FnExecutor` and Kahn exclusive-join; logical graph matches the brief.
