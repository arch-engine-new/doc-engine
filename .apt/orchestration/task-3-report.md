# Task 3 Report — DocType HTTP API + Adapter Tests

## Status
DONE

## What was implemented

### `job-pipeline.ts`
- Public DocType/FieldDef API: `listDocTypesByPack`, `createDocType`, `updateDocType`, `deleteDocType`, `listFieldDefs`, `saveFieldDefs`.
- `getEffectiveBoxes(templateId)` — ancestor FieldDef ∪ template FieldBox merge for HTTP preview.
- `openUploadJob` requires `doc_type_id` or `template_id` (`UploadValidationError` → 400).

### `handle-request.ts`
- `GET /api/packs/:packId/doc-types` → `{ docTypes }`
- `POST /api/doc-types` `{ packId, name, parentDocTypeId? }` → `{ docType }`
- `PATCH /api/doc-types/:id` `{ name? }` → `{ docType }`
- `DELETE /api/doc-types/:id` → `{ docType }` (409 via `LedgerConflictError` when children/templates/jobs)
- `GET /api/doc-types/:id/field-defs` → `{ defs }`
- `PUT /api/doc-types/:id/field-defs` `{ defs: [...] }` → `{ defs }`
- `GET /api/templates/:id/effective-boxes` → `{ boxes }` (inherited flag)
- `POST /api/jobs/upload` multipart accepts `doc_type_id` / `docTypeId`; 400 if neither doc_type nor template
- `LedgerConflictError` → 409, `UploadValidationError` → 400 (existing `errorStatus`)

### `http-adapter.test.ts`
- DocType CRUD + field-defs round-trip + delete-with-children 409
- AC-2: child template `effective-boxes` returns 3 keys (`编号`, `日期A`, `特殊批号`)
- AC-3: upload with `doc_type_id` binds child type; extraction `fields_json` has inherited + extension keys
- Existing upload tests updated for required doc/template binding

### `upload-ocr.test.ts`
- Regression: `baseInput` supplies `doc_type_id` for pipeline upload gate

## Verify output

```
npm test -w core-engine -- http-adapter
# 30 passed

npm test -w core-engine
# 89 passed | 4 skipped
```

## Files changed
- `packages/core-engine/src/pipeline/job-pipeline.ts`
- `packages/core-engine/src/http/handle-request.ts`
- `packages/core-engine/test/http-adapter.test.ts`
- `packages/core-engine/test/upload-ocr.test.ts`

## Concerns
None. Vue pages unchanged (Task 4).
