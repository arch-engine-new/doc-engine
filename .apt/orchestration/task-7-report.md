# Task 7 Report — project_home 生成并上传入口

## Status
DONE

## Plan
`docs/apt/plans/2026-08-29-excel-gap-fill-plan.md` — Task 7

## Changes

### `apps/web/src/services/types.ts`
- 新增 `DocumentArtifactView`（`artifact_id`, `status`, `trace_id`, `receipt_id` 等）

### `apps/web/src/services/http.ts`
- `generateDocument(projectId, input)` → `POST /api/projects/:projectId/documents/generate`
- `uploadDocumentArtifact(projectId, artifactId)` → `POST /api/projects/:projectId/documents/:artifactId/upload`

### `apps/web/src/views/project_home/useProjectHome.ts`
- `hasExcelTemplate` / `excelTemplateFor`：按 `layout_kind=excel` + `excel_template_uri` 识别可生成 DocType
- `generateInspectionBatch`：依次调用 generate → upload；更新 `traceId` 与 `artifactByDocType`
- 复用 `ensureSeed` 演示项目/空规范包流程（种子含「混凝土施工检验批」Excel 模板与填数规则）

### `apps/web/src/views/project_home/ProjectPackTable.vue`
- Excel DocType 行展示「生成检验批」按钮
- 生成后展示 artifact 状态（已生成/已上传）与 `/audit/:traceId` 链接

### `apps/web/src/views/project_home/index.vue`
- 接线新 props / 事件至 `ProjectPackTable`

## Verify
```
npx tsc -p apps/web --noEmit
```
Exit code: 0

## Commit
`feat(web): project_home excel document generate entry (task 7)`

## Manual E2E（可选）
1. 打开 `/projects`，展开「空规范包」→「文档类型」
2. 在「混凝土施工检验批」行点击「生成检验批」
3. 状态变为「已上传」，审计链接可跳转 `/audit/:traceId`
4. `/pending` 资料待签 Tab 应出现待签任务

## Concerns
- 无 `GET document-artifacts` 列表 API，artifact 状态仅会话内展示（刷新后需重新生成）；Task 8 gaps 可增强持久化展示。
