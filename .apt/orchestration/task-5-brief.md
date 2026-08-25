# Task 5 Brief

## Title
Checkpoint crash recovery

## Description
Write checkpoint at node boundaries; resume from latest seq; test simulates crash by stopping mid-run and resuming. AC-2.

## Files whitelist ONLY
- packages/agent-runtime/src/runtime/checkpoint-service.ts
- packages/agent-runtime/src/runtime/run-manager.ts
- packages/agent-runtime/src/runtime/scheduler.ts
- packages/agent-runtime/test/checkpoint-recovery.test.ts
- packages/agent-runtime/src/index.ts

## Verify
cd D:\software\doc-engine
npm test -w agent-runtime -- checkpoint-recovery
npx tsc -p packages/agent-runtime --noEmit

## Commit message
feat(agent-runtime): checkpoint crash recovery (task 5)

## Report
Write D:\software\doc-engine\.apt\orchestration\task-5-report.md
Status DONE|BLOCKED, commit sha, test summary

## Rules
- Public exports need JSDoc (why)
- Do not implement other tasks beyond this scope
- May edit listed runtime files to integrate