# Task 2 Brief

## Title
graph-core 类型与 GraphCompiler

## Steps
- 定义 Node/Edge/Graph/RetryPolicy 类型
- 实现 compile 校验（缺终端、非法边、未知类型）
- 单测覆盖

## Files whitelist ONLY
- packages/agent-runtime/src/graph/types.ts
- packages/agent-runtime/src/graph/compiler.ts
- packages/agent-runtime/test/graph-compiler.test.ts
- packages/agent-runtime/src/index.ts (re-export public graph API only)

## Verify
cd D:\software\doc-engine
npm test -w agent-runtime -- graph-compiler
npx tsc -p packages/agent-runtime --noEmit

## Public API
Export compileGraph / types with meaningful JSDoc (why).

## Report
Write .apt/orchestration/task-2-report.md Status DONE|BLOCKED, commit sha, test summary

## Commit
feat(agent-runtime): graph types and compiler (task 2)