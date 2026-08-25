# Task 7 Report: HITL + Resume API

## Status
✅ **COMPLETED**

## Commit SHA
`0e05c1e2ef6c3bb04d6ef302816edea760c2de7d`

## Summary
Implemented Human-in-the-Loop (HITL) gateway and resume functionality for the agent-runtime package.

## Files Modified/Created

### New Files
- `packages/agent-runtime/src/hitl/gateway.ts` - HitlGateway class with create/get/resume/cleanup operations
- `packages/agent-runtime/test/hitl.test.ts` - Comprehensive test suite (11 tests)

### Modified Files
- `packages/agent-runtime/src/runtime/state.ts` - Added `"waiting_hitl"` to RunStatus type
- `packages/agent-runtime/src/runtime/scheduler.ts` - Added HITL node handling, pauses execution at HITL nodes
- `packages/agent-runtime/src/runtime/run-manager.ts` - Added `resumeHitl()` method, integrated HITL gateway
- `packages/agent-runtime/src/index.ts` - Exported HITL types and gateway

## Implementation Details

### HitlGateway (`gateway.ts`)
- `createInterrupt(runId, nodeId, payload, expiresAt?)` → returns UUID v4 token + interrupt row
- `getInterrupt(token)` → retrieves interrupt by token
- `resume(token, decision)` → idempotent resume, returns boolean
- `cleanupExpired()` → marks expired pending interrupts (stub)
- Persists to StateStore (SQLite)

### Scheduler Integration (`scheduler.ts`)
- Added `hitlGateway` and `onHitlInterrupt` to SchedulerOptions
- When HITL node encountered: creates interrupt, sets status `"waiting_hitl"`, returns with token
- Added `hitlInterrupt` field to SchedulerResult with token, nodeId, payload, expiresAt

### RunManager (`run-manager.ts`)
- Added `hitlGateway` to StartRunOptions
- Modified `startRun` to wait for scheduler when HITL gateway provided
- Added `resumeHitl(runId, token, decision)` method:
  - Verifies token/runId match
  - Marks interrupt resumed via gateway
  - Resumes scheduler from HITL node's successors via `runSchedulerFromNodes()`
  - Injects decision into channels for downstream nodes
  - Idempotent: returns cached result if interrupt already resumed

### Tests (`hitl.test.ts`)
All 11 tests passing:
1. HITL Gateway - create interrupt returns token
2. HITL Gateway - retrieve interrupt by token
3. HITL Gateway - resume interrupt idempotent
4. HITL Gateway - reject expired token
5. HITL Gateway - return false for non-existent token
6. RunManager - pause run at HITL node, return token
7. RunManager - resume with valid token completes
8. RunManager - idempotent resume (same token twice)
9. RunManager - reject expired token
10. AC-3: waiting_hitl → resume → terminal (completed)
11. RunManager - multiple HITL nodes in sequence

## Verification
```bash
cd D:\software\doc-engine
npm test -w agent-runtime -- hitl    # ✅ 11/11 tests pass
npx tsc -p packages/agent-runtime --noEmit  # ✅ TypeScript compiles
```