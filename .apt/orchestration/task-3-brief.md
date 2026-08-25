# Task 3 Brief

## Title
内存 State + Scheduler + RunManager (M1)

## Description
Implement channel/reducer state, serial scheduler, run lifecycle. Support >=5 node graph in memory without persistence. Node executors for fn/branch at minimum; llm/tool/hitl can be stubs that call registered handlers. AC-1 memory path.

## Files whitelist ONLY
- packages/agent-runtime/src/runtime/state.ts
- packages/agent-runtime/src/runtime/scheduler.ts
- packages/agent-runtime/src/runtime/run-manager.ts
- packages/agent-runtime/src/runtime/node-executors.ts
- packages/agent-runtime/test/scheduler.test.ts
- packages/agent-runtime/src/index.ts

## Verify
cd D:\software\doc-engine
npm test -w agent-runtime -- scheduler
npx tsc -p packages/agent-runtime --noEmit

## Commit message
feat(agent-runtime): in-memory scheduler and run manager (task 3)

## Report
Write D:\software\doc-engine\.apt\orchestration\task-3-report.md
Status DONE|BLOCKED, commit sha, test summary

## Rules
- Public exports need JSDoc (why)
- Do not implement other tasks beyond this scope
- May edit listed runtime files to integrate