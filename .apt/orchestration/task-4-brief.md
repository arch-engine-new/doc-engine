# Task 4 Brief

## Title
SQLite StateStore + migration

## Description
StateStore interface + better-sqlite3. Apply docs/schema/generated/agent-runtime-migration.sql (copy or read from that path). Run/Checkpoint CRUD. Add better-sqlite3 dependency to package.json (allowed for this task).

## Files whitelist ONLY
- packages/agent-runtime/src/persistence/types.ts
- packages/agent-runtime/src/persistence/sqlite-store.ts
- packages/agent-runtime/src/persistence/migrate.ts
- packages/agent-runtime/test/sqlite-store.test.ts
- packages/agent-runtime/package.json
- packages/agent-runtime/src/index.ts

## Verify
cd D:\software\doc-engine
npm test -w agent-runtime -- sqlite-store
npx tsc -p packages/agent-runtime --noEmit

## Commit message
feat(agent-runtime): sqlite state store and migration (task 4)

## Report
Write D:\software\doc-engine\.apt\orchestration\task-4-report.md
Status DONE|BLOCKED, commit sha, test summary

## Rules
- Public exports need JSDoc (why)
- Do not implement other tasks beyond this scope
- May edit listed runtime files to integrate