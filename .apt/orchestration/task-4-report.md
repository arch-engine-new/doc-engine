# Task 4 Report — Seed 混凝土检验批 Excel 演示数据

## Status
**Completed**

## Summary
Extended `seed.ts` with idempotent concrete inspection batch (GB 50204) demo seed: DocType、excel 模板、`≥20` 单元格映射、基础 `FieldFillRule`，并将夹具 xlsx 上传到 BlobStore（test/dev 使用 `MemoryBlobStore`）。已接入 `seedPublishedRules`（`PACK_ID`）与 `DemoHttpSession.seedFixtures`（演示项目 pack）。

## Changes

### `packages/core-engine/src/pipeline/seed.ts`
- 导出常量：`CONCRETE_DOC_TYPE_ID`、`CONCRETE_TEMPLATE_NAME`、夹具路径
- `loadConcreteFixtureMapping` / `concreteCellMappingsFromFixture` / `concreteFillRulesFromFixture`
- `seedConcreteInspectionBatchLedger`（同步，供 SQLite `seedPublishedRules`）
- `seedConcreteInspectionBatchExcelDemo`（异步，含 blob 上传）
- 多 pack 安全：稳定 id 仅用于 `PACK_ID`；演示 pack 自动创建 pack-local DocType
- 幂等：已存在 ≥20 映射时跳过重复写入

### 集成
- `store.ts` / `pg-store.ts` — `seedPublishedRules` 调用 ledger seed
- `session.ts` — `seedFixtures` 调用 `seedConcreteInspectionBatchExcelDemo` + `MemoryBlobStore`
- `index.ts` — 导出新 seed API

### `packages/core-engine/test/seed-concrete-excel.test.ts` (new)
- 断言 `seedPublishedRules` 后映射数 ≥20
- 幂等性 + blob 上传

## Verify
```bash
npm test -w core-engine                  # 95 passed, 4 skipped
npm test -w core-engine -- seed-concrete # 3 passed
```

## Acceptance
| AC | Result |
|----|--------|
| AC-1 ≥20 excel-mappings | 夹具 27 字段全部写入 `t_excel_cell_mapping` |
| 夹具 SSOT | `docs/fixtures/excel/concrete-inspection-batch-*` |
| Fill rules | `acceptance_basis` literal `GB 50204-2015`；`project_name` → `project_field` |

## Notes
- UI Tasks 5–9 未实施（按范围边界）
- `http-adapter` 现有 excel e2e 用例仍手动建模板；reset 后演示 pack 已预置混凝土检验批数据可供后续简化测试
