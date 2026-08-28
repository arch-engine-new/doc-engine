# Task 9 Report — 任务页上传控件

## Status
DONE

## SHA
`ac9b1a16f41586e98ddd43d353d573efe7bca6a9`

## BASE_SHA
`9ad9ea582d00a4b64409b0f409da04bfcca8d2c9`

## commits
- `ac9b1a16f41586e98ddd43d353d573efe7bca6a9` — `feat(web): add job upload file picker and multipart uploadJob helper`

## What was implemented
MCP:
- `query_design` page=`job_upload`
- `query_design` component=`PrimaryButton`

`apps/web/src/services/http.ts`:
- `uploadJob(file, fields?)` — `FormData` POST `/api/jobs/upload` with optional `project_id` / `pack_id` / `template_id`
- No JSON `Content-Type`; errors via existing `HttpError` / `errorMessage`

`apps/web/src/views/job_upload/index.vue`:
- Hidden `<input type="file" accept="image/jpeg,image/png,application/pdf">`
- Primary `button.btn`「上传资料」opens picker; on select uploads and refreshes job list
- Fixture buttons remain `button.btn.ghost`;「同意下一步」stays primary `btn`
- Upload success selects new job via `load(result.job.job_id)` + `rememberDemoNav`
- Styles use existing `--apt-*` tokens and `btn` / `btn ghost` only

Did not edit core-engine, routes, or new pages. Did not start Task 10.

## Verify
`npx tsc -p apps/web --noEmit`:

```
(exit 0)
```

## Files (whitelist commit)
- `apps/web/src/views/job_upload/index.vue`
- `apps/web/src/services/http.ts`
