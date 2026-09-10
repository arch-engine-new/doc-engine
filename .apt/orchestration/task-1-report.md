# Task 1 Report

## Status
DONE

## Changes
- MCP：`query_contract` ExcelFillService / FieldFillRuleWrite / LedgerStore / BlobStore / DocumentPipeline；`search_arch` `seedConcreteInspectionBatchExcelDemo ConcreteExcelSeedStore`。未读 `.ai/`。
- `excel/fill-service.ts`：`ExcelFillTemplate` 扩为 `string | Buffer | Uint8Array`；`load` 走独立 `ArrayBuffer`（不把 `Buffer<ArrayBufferLike>` 交给 exceljs）。返回仍 `Buffer.from(out)`。
- `http/handle-request.ts`：`min_num` / `max_num` 空或缺省 → `null`，否则 `String(...)`，对齐 `FieldFillRuleWrite`。
- `pipeline/seed.ts`：导出 `MaybeAsync<T>`；`DocTypeSeedStore` / `ConcreteExcelSeedStore` 方法返回 `T | Promise<T>`；async 路径继续 `await Promise.resolve(...)`。sqlite `seedPublishedRules` 仍走同步 `SyncSeedStore` 视图，未改出表语义。
- `uploadConcreteTemplateBytes`：去掉 `as { bucket: string }`，鸭类型读取 `bucket`，否则 `"docengine"`。
- `session.ts` / `pg-store.ts` / `store.ts` / `document-pipeline.ts` / 测试：**未改**（类型对齐后即可编译）。

## Tests
```
npx tsc -p packages/core-engine --noEmit
→ exit 0

npm test -w core-engine -- excel-fill-service seed-concrete-excel
→ Test Files 2 passed; Tests 7 passed (vitest 3.2.7)
```

## Commits
`fix(core-engine): make package tsc pass without changing fill semantics`

## APT Micro-closeout
- ContractsRegistered: `MaybeAsync` → `packages/core-engine/src/pipeline/seed.ts`
- AssetsRefreshed: `packages/core-engine/src/excel/fill-service.ts`, `packages/core-engine/src/http/handle-request.ts`, `packages/core-engine/src/pipeline/seed.ts`
- AssetsRemoved: none
- `audit_arch_changes`: not called

## Concerns
无。Fill 语义与 C4 无回执不得写入未改。
