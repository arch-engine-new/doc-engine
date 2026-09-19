## Task F-1-2 Report
**Status:** DONE_WITH_CONCERNS
### Tests
- Command: `npx vitest run test/standard-lib-stepchat.test.ts`（cwd: `packages/core-engine`）。
- TDD RED（只改测试、未改 context/handle-request）：`Test Files  1 failed (1)` / `Tests  5 failed | 6 passed (11)`。Duration 7.59s。空列表用例已绿（既有「未命中」）。失败断言：

```
FAIL  formatRetrieveHitsForPrompt includes heading and body, not only clause_id
AssertionError: expected '- clause_id=ver:1.1 unit_id=unit-leave-1-1 file_name=leave.txt' to contain '1.1 事假须提前申请'

FAIL  formatRetrieveHitsForPrompt truncates body over 800 chars with …
AssertionError: expected '... file_name=leave.txt' to contain '…'

FAIL  formatRetrieveHitsForPrompt uses 无标题 and 无正文 for empty strings
AssertionError: expected '... file_name=leave.txt' to contain '无标题'

FAIL  buildJobContext retrieve prompt includes hit heading and body
AssertionError: retrieve_hits 行仍只有 clause_id/unit_id/file_name

FAIL  POST /api/chat parseRetrieveHits keeps heading and body in FakeLlm prompt
AssertionError: FakeLlm echo 的 retrieve_hits 仍无 heading/body（「检索条款」为「未检索到条款」，证明不是 search 水合）
```

- TDD GREEN：`formatRetrieveHitsForPrompt` 每行含 heading + body（空 heading→「无标题」，空 body→「无正文」；单条 body 最多 800 字符，超出加 `…`，截断只用于 prompt）。`parseRetrieveHits` 对 string 类型 heading/body 透传（含空串）。`Test Files  1 passed (1)` / `Tests  11 passed (11)`。Duration 4.77s。
### APT Micro-closeout
- ContractsRegistered: 无。`JobContextSnapshot` 导出形状未变（仍为 `retrieve_hits_summary?: string`），未 `register_contract`。
- AssetsRefreshed: `packages/core-engine/src/agent/context.ts`（MCP `refresh_asset` → `frontend/packages/util/context` action=created）；`packages/core-engine/src/http/handle-request.ts`（→ `frontend/packages/util/handle-request` action=created）。
- AssetsRemoved: 无
- 禁止 `audit_arch_changes`；未手工改 `.ai/`。
### FilesChanged
- `packages/core-engine/src/agent/context.ts`
- `packages/core-engine/src/http/handle-request.ts`
- `packages/core-engine/test/standard-lib-stepchat.test.ts`
- `.apt/orchestration/task-f1-2-report.md`
### Commits
- `feat(retrieve): include hit heading and body in step-chat prompt`（仅白名单 4 文件；未 push）
### Blockers / Concerns
- 开始前只读 MCP：`query_contract JobContextSnapshot` 的 `formatRetrieveHitsForPrompt` 只拼 `clause_id`/`unit_id`/`file_name`；`query_arch frontend/core-engine/util#formatretrievehitsforprompt` 指向 `packages/core-engine/src/agent/context.ts`；`query_contract DemoHttpAdapter` 的 `parseRetrieveHits` 丢 heading/body。
- `refresh_asset` 再次新建 `frontend/packages/util/context` 与 `frontend/packages/util/handle-request`，未覆盖既有 `frontend/core-engine` 条目（同 Task 1，留给 PB-5）。禁止 audit，未手工改索引。
- 未改 StepChat.vue、prequery/rerank、其它页、goal.md。详情全文展示留给 Task 3。
