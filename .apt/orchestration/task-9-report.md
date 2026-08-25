# Task 9 Report — Contracts + examples + docs

## Status
DONE — commit `2c406c6`

## What was implemented

### README.md (`packages/agent-runtime/README.md`)
New, usage-focused: install (Node 18+, TS-source package), quick start (compile → start → wait → trace), API surface table covering compileGraph/startRun/resumeHitl/cancelRun/getTrace plus persistence, HITL, tools, checkpoint resume, and examples. No fluff.

### Examples (`packages/agent-runtime/examples/`)
- `basic-agent.ts` — start → fn → end graph with inline fn; compile, start run, waitForRun, print status/output/event trace. Uses only public `agent-runtime` exports (self-referencing package import, so it mirrors real embedder usage).
- `hitl-agent.ts` — start → hitl → fn → end graph with SQLite store; starts run, asserts `waiting_hitl`, prints token/payload, resumes with a `HitlDecision`, prints final output.
- `tsconfig.json` — separate examples config (strict, NodeNext, noEmit). Main package tsconfig was NOT modified (its `include: ["src/**/*"]` and `rootDir` would conflict with examples outside src; a separate config typechecks examples against the package exactly as consumers would).

### Contracts
- `.apt/contracts/ts/` does NOT exist in this project (checked — directory absent) and the brief's `src/contracts/agent-runtime.ts` was explicitly outside the task's file whitelist, so no file was invented.
- Instead the project's actual contract convention (AGENTS.md: "新 TS 类型 → register_contract") was used: 8 contracts registered via MCP into `.ai/db.json` (+ `.ai/INDEX.md`): RunStatus, SchedulerResult, CompiledGraph, GraphDefinition, HitlDecision, RunView, EventRow, StateStore — all pointing at `packages/agent-runtime/src/index.ts`.

## Verification
```
npx tsc -p packages/agent-runtime --noEmit          PASS (0 errors)   # required verify
npx tsc -p packages/agent-runtime/examples --noEmit PASS (0 errors)   # examples typecheck
npm test -w agent-runtime                           122 passed, 8 skipped (HTTP suite skipped by design)
```

## Notes
- No runtime source changes; no Task 10 (knowledge closure / sync-changes) performed per instructions.
- `examples/tsconfig.json` is a whitelisted file; main tsconfig untouched.
