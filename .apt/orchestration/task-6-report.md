# Task 6 Report
## Status
DONE
## Commits
`test(core-engine): native step-chat graph and search_clause`
## Tests
- `npm test -w core-engine -- agent-connect` — PASS (4 tests, 1 file)
- `npm test -w core-engine -- agent-native-graph` — PASS (2 tests, 1 file)
- `npm test -w agent-runtime` — PASS (146 tests, 10 files)
## Changes
- `query_contract` name=`ControlPlane` confirmed `getTrace(runId)` returns `EventRow[]` with `eventType` `tool_call` (`payload.toolName`) and `node_start` (`payload.nodeType`).
- New `packages/core-engine/test/agent-native-graph.test.ts` with `forceFakeLlm: true`. Pipeline matches `standard-rag.test.ts`: `JobPipeline.openStandardLibrary` + MemoryVectorStore / MemoryGraphStore / FakePrequery / IndependentReranker / HashEmbeddings. FakePrequery maps `"1.1"` and `"查条 1.1"` to exact clause `1.1`. LEAVE_TEXT copied from leave-request fixture.
- Case 1: createProject → createSpecPack → ingestStandard → openJobForPack; `StepChatBridge.reply` at `checking` with `查条 1.1`. Reply contains ingested `${version_id}:1.1`. After reply, `AgentRuntimeFactory.getOrCreate({ pipeline, forceFakeLlm: true })` then `factory.plane.getTrace(agentRunId)` has `tool_call` `search_clause` and `node_start` `nodeType === "llm"`.
- Case 2: same pack **without** ingest. Reply does not throw; `listFindings` length unchanged; reply matches `/未命中|未检索/`. Both cases assert `listReceipts` is empty and reply does not contain `第999条`.
- Did not modify `agent-connect.test.ts` (A15/A16/wording still green). Did not invent clause_id. Did not write Receipt.
## Concerns
- None for this slice. FakeLlm echoes the prompt, so ingest hits surface as `clause_id=` in the reply, and empty hits surface as 「未检索到条款」.
