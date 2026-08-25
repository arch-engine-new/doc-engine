# Task 8 Report — EventLog + Control Plane API

## Status
DONE — commit `116d410`

## What was implemented
- `src/obs/event-log.ts` — EventLog: append/getTrace/getEventsFrom/getLatestSeq/resetSeqCache with typed events (node_start, node_end, tool_call, checkpoint, hitl, run_started, run_completed, run_failed, run_cancelled). Per-runId append chain added to prevent UNIQUE(run_id, seq) race (async cache-check-then-insert could collide).
- `src/obs/otel-hooks.ts` — optional OTel tracer attach (try/catch based).
- `src/api/control.ts` — ControlPlane: compileGraph, startRun (non-blocking + HITL probe + terminal event/store handler), getRun, cancelRun, resumeHitl (delegates to RunManager for correct error ordering), getTrace, listRunsFromStore, deleteRun, clear, createControlPlane.
- `src/api/http.ts` — native Node http REST adapter (optional): /graphs, /runs, /runs/:id, cancel, resume, trace, health.
- `src/tools/runtime.ts` — added `onToolCall` observability hook (success/failure/cache-hit emission).
- ControlPlane wires a ToolExecutor with an emitting ToolRuntime so tool_call events land in the run trace.

## Verification
```
npx tsc -p packages/agent-runtime --noEmit   PASS (0 errors)
npm test -w agent-runtime                    122 passed, 8 skipped (HTTP suite skipped by design)
```

## Accept criteria coverage
- AC-5 (trace replay by runId): `controlPlane.getTrace(runId)` returns ordered event rows — test `getTrace (AC-5: trace replay by runId)`.
- AC-7 (public API types + tests): ControlPlane/EventLog types exported via index; 33-test control-api suite.

## Notes / fixes applied to subagent's leftover work
- startRun no longer blocks until completion; returns `running` (or `waiting_hitl` + interrupt) immediately.
- Run row is created in StateStore at start (`createRun`) — listRunsFromStore now returns rows.
- Terminal events/stores updated via promise-chain handler; cancel dedupes run_cancelled.
- resumeHitl error semantics: not-found / mismatched-runId / expired throw before run-status checks.
- AC-7 event-type test split into success / failed / cancelled scenarios (run_failed/run_cancelled cannot appear in a successful run trace).
