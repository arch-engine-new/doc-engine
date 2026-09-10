# Task 2 Report

## Status
DONE

## Changes
- MCP：`query_contract` `uploadDocument`（`packages/core-engine/src/adapter/mock.ts`：pending-mount 发 `receipt_id`；无回执写入失败且不落库；`uploadDocument` 必带 `receipt_id` + `document_id`）。`search_arch` `adapter-openapi pending-mount` 命中 `mockPendingMount` / `commitAdapterWrite`（同源 mock）。未读 `.ai/`。
- `packages/core-engine/package.json`：新增脚本 `test:adapter-openapi` → `vitest run adapter-mock`。复用已有 `test/adapter-mock.test.ts`（读 `docs/schema/generated/adapter-openapi.yaml`），**未**新写第二套 mock，**未**改测试文件。
- OpenAPI 草稿只读确认仍含 `/adapter/pending-mount`（L7）与 `/adapter/documents/upload`（L25）。未改 yaml。
- 未改 fill-service / seed / handle-request / agent-runtime；未写 `.apt/verify/latest.md`。

## Tests
```
npm test -w core-engine -- adapter-mock
→ exit 0; Test Files 1 passed; Tests 5 passed (vitest 3.2.7)

npm run test:adapter-openapi -w core-engine
→ exit 0; 同上（同一套件：adapter-mock.test.ts 5 tests）

Select-String /adapter/pending-mount|/adapter/documents/upload
→ docs/schema/generated/adapter-openapi.yaml L7, L25 仍在
```

## Commits
`chore(core-engine): add adapter-openapi harness npm script`

## APT Micro-closeout
- ContractsRegistered: none（无新类型；跳过 `register_contract`）
- AssetsRefreshed: none（仅 `package.json` 脚本）
- AssetsRemoved: none
- `audit_arch_changes`: not called

## Concerns
无。Harness 脚本已钉死到现有 C4 mock 套件；`/verify` §5.6 写 `## Harness` 真实行留给 Task 3 / 最终 verify。
