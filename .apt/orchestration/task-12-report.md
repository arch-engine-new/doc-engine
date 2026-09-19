# Task 12 Report — Docker live 冒烟（非 CI 强制）

## Status
DONE

## SHA
`9f584e7987786bd48fa0cdc39addc923739c1410`

## Commits
`9f584e7987786bd48fa0cdc39addc923739c1410` test(retrieve): skip live RAG ingest smoke without DATABASE_URL

BASE_SHA: `08657a3533b6564a00514641ff466d4e73b9c7de`

未读 `.ai/`。未调用 `audit_arch_changes`。未改 `live-ports.ts`。未改 seed / 未公路预置。未涨 Job 4MB。未 push。

## Changes
MCP 只读：
- `query_project_status` → `projectType=component`，无 blockers。
- `query_contract` name=`liveRetrievePorts` → `packages/core-engine/src/retrieve/live-ports.ts`（`QdrantVectorStore` + `Neo4jGraphStore`；缺 env 抛错，不回落 memory）。

新测 `packages/core-engine/test/live-rag-ingest.test.ts`：
- `describe.skipIf(!DATABASE_URL || !QDRANT_URL || !NEO4J_URI)`，与 live-triple-store 一致。
- 无 Docker / 无 env → skip，CI 仍绿。
- 有 live：JSON ingest 请假夹具；`liveRetrievePorts()` + `JobPipeline.openLiveFromEnv()`；抽查 Qdrant `clauses` 任一点 `payload.file_name` 非空。
- 全书 OCR / tick `rules/` 不是门禁（JSON 夹具即可证明 payload 闸门）。

## Tests / Verify
```
npx vitest run packages/core-engine/test/live-rag-ingest.test.ts
```

Exit 0（本机无 DATABASE_URL）：

```
↓ packages/core-engine/test/live-rag-ingest.test.ts (1 test | 1 skipped)
Test Files  1 skipped (1)
Tests  1 skipped (1)
Duration  3.29s
```

vitest 3.2.7。

Rn: R1 / R10（live 点 `file_name` 非空；无公路 seed）。

## APT Micro-closeout
- ContractsRegistered: none（无新导出；`liveRetrievePorts` 已在 `packages/core-engine/src/retrieve/live-ports.ts`）
- AssetsRefreshed:
  - `packages/core-engine/test/live-rag-ingest.test.ts` → `frontend/core-engine/util/live-rag-ingest.test`（created）
- `audit_arch_changes`: not called（brief 禁止）

## Concerns
- `refresh_asset` 未拒绝，但把测试文件登记为 `frontend/core-engine/util/live-rag-ingest.test`（kind=util）；`.ai/` 索引未纳入本 commit。
- 本机无 live env，未实际打到 Qdrant；有 `DATABASE_URL`+`QDRANT_URL`+`NEO4J_URI` 时才会跑 ingest 抽查。
- 工作区另有与本 Task 无关的脏文件。本 Task 只提交了白名单测试文件。
