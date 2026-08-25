# Task 8 Brief

## Title
EventLog + control plane API

## Description
Event append/getTrace; compileGraph/startRun/getRun/cancelRun/resumeHitl/getTrace. Optional minimal HTTP adapter. AC-5/AC-7.

## Files whitelist ONLY
- packages/agent-runtime/src/obs/event-log.ts
- packages/agent-runtime/src/obs/otel-hooks.ts
- packages/agent-runtime/src/api/control.ts
- packages/agent-runtime/src/api/http.ts
- packages/agent-runtime/src/index.ts
- packages/agent-runtime/test/control-api.test.ts

## Verify
cd D:\software\doc-engine
npm test -w agent-runtime -- control-api
npx tsc -p packages/agent-runtime --noEmit

## Commit message
feat(agent-runtime): event log and control API (task 8)

## Report
Write D:\software\doc-engine\.apt\orchestration\task-8-report.md
Status DONE|BLOCKED, commit sha, test summary

## Rules
- Public exports need JSDoc (why)
- Do not implement other tasks beyond this scope
- May edit listed runtime files to integrate