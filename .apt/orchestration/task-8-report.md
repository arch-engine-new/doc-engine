# Task 8 Report — 缺表扫描 + CompletenessRule

## Summary

Implemented document completeness gap scanning (AC-8): backend compares `CompletenessRule` rows against `DocumentArtifact` records per project, exposes REST endpoints, seeds a concrete inspection batch rule, and surfaces missing docs on `project_home` with a「补表」action that triggers generate + upload.

## Backend

### `packages/core-engine/src/pipeline/document-pipeline.ts`
- Added `DocumentGap` / `DocumentGapsResult` types.
- Added `listDocumentGaps(projectId)` — walks project packs, required completeness rules, and existing artifacts; returns missing doc types.

### `packages/core-engine/src/http/handle-request.ts`
- `GET /api/projects/:projectId/document-gaps` → `{ missing: [{ doc_type_id, label, pack_id }] }`
- `GET /api/packs/:packId/completeness-rules`
- `PUT /api/packs/:packId/completeness-rules` (bulk replace)
- Added `completenessRulesFromBody` parser (snake_case + camelCase aliases).

### `packages/core-engine/src/pipeline/seed.ts`
- Extended `ConcreteExcelSeedStore` with `saveCompletenessRules`.
- Added `concreteCompletenessRules(docTypeId)` — required rule for「混凝土施工检验批质量验收记录」.
- Idempotent seed in `applyConcreteLedgerSeed` / `seedConcreteInspectionBatchLedger` (including existing-seed path).

### `packages/core-engine/test/document-gaps.test.ts`
- AC-8: gap present after reset for concrete rule; cleared after `documents/generate`.
- PUT completeness-rules replaces pack rules.

## Frontend

### `apps/web/src/services/http.ts` + `types.ts`
- `DocumentGapView` type and `fetchDocumentGaps(projectId)`.

### `apps/web/src/views/project_home/`
- `useProjectHome.ts`: loads gaps per project on `load()`, `fillDocumentGap` delegates to `generateInspectionBatch`, refreshes gaps after fill.
- `DocumentGapsPanel.vue`: per-project missing-doc list with「补表」button.
- `index.vue`: renders `DocumentGapsPanel` above pack table.

## Verify

| Command | Result |
|---------|--------|
| `npm test -w core-engine` | PASS (97 tests) |
| `npm test -w core-engine -- document-gaps` | PASS (2 tests) |
| `npx tsc -p apps/web --noEmit` | PASS |

## Commit

`feat: document gaps scan and completeness rules (task 8)`
