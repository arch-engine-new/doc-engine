# Task 9 Brief

## Title
Contracts + example + docs

## Description
Write src/contracts/agent-runtime.ts with public API types. Example crash-recovery. README minimal usage. All tests green.

## Files whitelist ONLY
- src/contracts/agent-runtime.ts
- packages/agent-runtime/examples/crash-recovery/main.ts
- packages/agent-runtime/README.md
- packages/agent-runtime/src/index.ts

## Verify
cd D:\software\doc-engine
npm test -w agent-runtime && npx tsc -p packages/agent-runtime --noEmit
npx tsc -p packages/agent-runtime --noEmit

## Commit message
feat(agent-runtime): public contracts example and README (task 9)

## Report
Write D:\software\doc-engine\.apt\orchestration\task-9-report.md
Status DONE|BLOCKED, commit sha, test summary

## Rules
- Public exports need JSDoc (why)
- Do not implement other tasks beyond this scope
- May edit listed runtime files to integrate