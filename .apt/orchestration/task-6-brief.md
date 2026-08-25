# Task 6 Brief

## Title
ToolRuntime + idempotency + retry

## Description
Tool registry, schema validation (simple zod or manual), timeout, RetryPolicy, idempotency_key persistence via store if available. AC-4.

## Files whitelist ONLY
- packages/agent-runtime/src/tools/registry.ts
- packages/agent-runtime/src/tools/runtime.ts
- packages/agent-runtime/src/runtime/node-executors.ts
- packages/agent-runtime/test/tool-runtime.test.ts
- packages/agent-runtime/src/index.ts

## Verify
cd D:\software\doc-engine
npm test -w agent-runtime -- tool-runtime
npx tsc -p packages/agent-runtime --noEmit

## Commit message
feat(agent-runtime): tool runtime retry and idempotency (task 6)

## Report
Write D:\software\doc-engine\.apt\orchestration\task-6-report.md
Status DONE|BLOCKED, commit sha, test summary

## Rules
- Public exports need JSDoc (why)
- Do not implement other tasks beyond this scope
- May edit listed runtime files to integrate