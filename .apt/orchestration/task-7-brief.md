# Task 7 Brief

## Title
HITL + resume API

## Description
waiting_hitl status, one-time token, resumeHitl idempotent, optional expiry. AC-3.

## Files whitelist ONLY
- packages/agent-runtime/src/hitl/gateway.ts
- packages/agent-runtime/src/runtime/run-manager.ts
- packages/agent-runtime/test/hitl.test.ts
- packages/agent-runtime/src/index.ts

## Verify
cd D:\software\doc-engine
npm test -w agent-runtime -- hitl
npx tsc -p packages/agent-runtime --noEmit

## Commit message
feat(agent-runtime): HITL gateway and resume (task 7)

## Report
Write D:\software\doc-engine\.apt\orchestration\task-7-report.md
Status DONE|BLOCKED, commit sha, test summary

## Rules
- Public exports need JSDoc (why)
- Do not implement other tasks beyond this scope
- May edit listed runtime files to integrate