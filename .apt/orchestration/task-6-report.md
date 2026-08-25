# Task 6 Report: ToolRuntime + Idempotency + Retry

## Status
✅ **COMPLETED**

## Commit SHA
`91dcd7c`

## Summary
Implemented the ToolRuntime system with full support for:
- Tool registration with JSON schema validation
- Input/output validation against schemas
- Configurable timeout enforcement
- Retry policy with exponential backoff and optional jitter
- Idempotency key support with persistent storage (SQLite)

## Files Created
1. `packages/agent-runtime/src/tools/registry.ts` - ToolRegistry class
2. `packages/agent-runtime/src/tools/runtime.ts` - ToolRuntime class with validation, timeout, retry, idempotency
3. `packages/agent-runtime/test/tool-runtime.test.ts` - Comprehensive test suite (27 tests)

## Files Modified
1. `packages/agent-runtime/src/index.ts` - Added exports for new tools module
2. `packages/agent-runtime/src/runtime/node-executors.ts` - Enhanced ToolExecutor to use ToolRuntime
3. `packages/agent-runtime/src/runtime/state.ts` - Extended ExecutionContext with runId, threadId, nodeExecutionId, attempt
4. `packages/agent-runtime/src/runtime/scheduler.ts` - Updated context creation and executeWithRetry to propagate attempt number
5. `packages/agent-runtime/src/runtime/run-manager.ts` - Fixed context creation in resume path

## Test Results
All 86 tests pass (including 27 new tests for tool-runtime):
- ✅ ToolRegistry: register, get, list, has, remove, clear, getAll
- ✅ ToolRuntime basic execution: success, NOT_FOUND, input validation, output validation
- ✅ Timeout: times out on slow handlers, completes on fast handlers
- ✅ Retry: retries on transient failure, exhausts retries, no retry on validation error, retries on timeout, exponential backoff with jitter
- ✅ Idempotency: cached results for same key, different keys not cached, no cache without store, failed attempts not cached, persists tool call records
- ✅ AC-4: retry config + idempotency key persistence verified

## Key Features Implemented

### ToolRegistry
- `register(name, schema, handler, description?)` - Register tools with input/output JSON schemas
- `get(name)` - Retrieve registered tool
- `list()` - List all tool names
- `has(name)` - Check if tool exists
- `remove(name)` - Remove a tool
- `getAll()` - Get all registered tools
- `clear()` - Clear all tools
- Default singleton registry via `getDefaultRegistry()` / `setDefaultRegistry()`

### ToolRuntime
- `execute(name, input, options)` - Execute tool with full validation, timeout, retry, idempotency
- Options:
  - `idempotencyKey` - Optional key for deduplication
  - `timeoutMs` - Optional timeout (default 30000ms)
  - `retryPolicy` - Optional RetryPolicy (maxAttempts, backoffMs, jitter)
  - `runId` / `nodeExecutionId` - Required for idempotency persistence
- Returns `ToolExecutionResult` with output, durationMs, attempts, fromCache
- Throws `ToolExecutionError` with code: VALIDATION_ERROR, TIMEOUT, HANDLER_ERROR, NOT_FOUND

### ToolExecutor (Enhanced)
- Now uses ToolRuntime internally
- Config options: toolName, inputChannels, outputChannel, idempotencyKey (with template substitution), retry, timeoutMs
- Template variables: `{{runId}}`, `{{threadId}}`, `{{nodeId}}`, `{{attempt}}`

### Idempotency Persistence
- Uses SQLiteStateStore's `t_agent_tool_call` table
- On first execution: creates tool call record with status "pending"
- On success: updates with responseJson, status "success", durationMs
- On failure: updates with errorJson, status "failed"
- Subsequent calls with same idempotencyKey return cached result (fromCache: true)

## Verification
```bash
npm test -w agent-runtime -- tool-runtime  # ✅ 27 tests pass
npm test -w agent-runtime                   # ✅ All 86 tests pass
npx tsc -p packages/agent-runtime --noEmit  # ✅ TypeScript compiles without errors
```