# Task 3 Report — DocumentPipeline + Adapter mock + HTTP

## Status
**Completed**

## Summary
Implemented Excel document generation pipeline with mock adapter upload, signature task workflow, and REST/adapter HTTP routes. End-to-end integration test covers AC-4, AC-5, AC-7.

## Changes

### `packages/core-engine/src/adapter/mock.ts`
- Added `uploadDocument(input)` returning `{ receipt_id, document_id, status }`
- Uses `commitAdapterWrite`; persists upload payload for audit

### `packages/core-engine/src/pipeline/document-pipeline.ts` (new)
- `generateArtifact` — resolve excel template, `ExcelFillService.fill`, save xlsx to BlobStore, insert `DocumentArtifact`, audit `document_generated`
- `uploadArtifact` — mock `uploadDocument`, insert Receipt (`payload_json.artifact_id`), update artifact `status=uploaded`, audit `document_uploaded`, auto `createSignatureTasks`
- `createSignatureTasks` — from mappings with `signature_role`
- `confirmSignatureTask` — Receipt + task `signed`, audit `signature_confirmed`

### `packages/core-engine/src/http/session.ts`
- `ledger()`, `getDocumentPipeline()`, `uploadExcelTemplate()` wiring with shared MemoryBlobStore

### `packages/core-engine/src/http/handle-request.ts`
- `POST /api/templates/:id/excel-template` (multipart)
- `GET/PUT /api/templates/:id/excel-mappings`
- `GET/PUT /api/doc-types/:id/fill-rules`
- `POST /api/projects/:projectId/documents/generate`
- `POST /api/projects/:projectId/documents/:artifactId/upload`
- `GET /api/pending/signatures`
- `POST /api/signature-tasks/:id/confirm`
- `POST /adapter/documents/upload`

### `docs/schema/generated/adapter-openapi.yaml`
- Added `POST /adapter/documents/upload` + `UploadDocumentResult` schema

### Tests
- `http-adapter.test.ts` — full excel flow with concrete fixture xlsx
- `adapter-mock.test.ts` — uploadDocument + OpenAPI path assertion

### `packages/core-engine/src/index.ts`
- Exported `DocumentPipeline`, `uploadDocument`, related types

## Verify
```bash
npm test -w core-engine -- http-adapter   # 27 passed
npm test -w core-engine                   # 92 passed, 4 skipped
```

## Acceptance
| AC | Result |
|----|--------|
| AC-4 mock upload + Receipt | uploadArtifact creates Receipt with `payload_json.artifact_id` |
| AC-5 pending signatures + confirm | `GET /api/pending/signatures`, `POST confirm` → signed + Receipt |
| AC-7 trace events | `document_generated`, `document_uploaded`, `signature_confirmed` on trace |

## Notes
- Artifact-only Receipts use `job_id=""`; artifact linkage via `payload_json`
- Task 4 seed (混凝土演示数据) not included — per scope boundary
