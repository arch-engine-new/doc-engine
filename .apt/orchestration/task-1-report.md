# Task 1 Report
## Status
DONE
## Commits
00de24e820037c8a89795876122c321c630082d7 feat(agent-runtime): ToolExecutor inputFrom uses channel object as tool args
## Tests
`npm test -w agent-runtime -- tool-runtime` — PASS (29 tests, 1 file)
## Changes
- `query_arch` path=`frontend/agent-runtime/utils` confirmed `ToolExecutor.execute` built `{ [ch]: getChannel(...) }` from `inputChannels`.
- `ToolExecutor`: when `config.inputFrom` is a string, that channel's non-null object is passed directly as `runtime.execute` input; missing/array/non-object throws with the node id (no silent fallback).
- Unset `inputFrom` keeps wrapping via `inputChannels` (default `["input"]`).
- Tests: `inputFrom: "search_args"` delivers `{ packId, query }`; without `inputFrom`, `inputChannels: ["search_args"]` still wraps as `{ search_args: {...} }`.
- No new public types; skipped `register_contract`.
- Other executors (`LLM` / `HITL` / `Subgraph`) were not changed.
## Concerns
Plan brief allowed falling back to `inputChannels` when the `inputFrom` value is not an object. Implementation throws instead, matching the orchestrator spec so graphs fail loud.
