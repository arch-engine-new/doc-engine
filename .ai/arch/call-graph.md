# Call Graph

## Nodes (25)

### Frontend Components (25)

- `component:App`
  - apps/web/src/App.vue | module: web
- `component:demo-session`
  - apps/web/src/services/demo-session.ts | module: web
- `component:RouterLink`
- `component:RouterView`
- `component:main`
  - apps/web/src/main.ts | module: web
- `component:router`
  - apps/web/src/router.ts | module: web
- `component:global`
- `component:StepChat`
  - apps/web/src/components/StepChat.vue | module: web
- `component:http`
  - apps/web/src/services/http.ts | module: web
- `component:agent-runtime`
  - apps/web/src/services/agent-runtime.ts | module: web
- `component:types`
  - apps/web/src/services/types.ts | module: web
- `component:index`
  - apps/web/src/views/volume_preview/index.vue | module: web
- `component:UploadToolbar`
  - apps/web/src/views/job_upload/UploadToolbar.vue | module: web
- `component:DocumentGapsPanel`
  - apps/web/src/views/project_home/DocumentGapsPanel.vue | module: web
- `component:ProjectHomeDialogs`
  - apps/web/src/views/project_home/ProjectHomeDialogs.vue | module: web
- `component:ProjectPackTable`
  - apps/web/src/views/project_home/ProjectPackTable.vue | module: web
- `component:useProjectHome`
  - apps/web/src/views/project_home/useProjectHome.ts | module: web
- `component:SignatureConfirmDialog`
  - apps/web/src/views/pending_review/SignatureConfirmDialog.vue | module: web
- `component:SignatureReviewPanel`
  - apps/web/src/views/pending_review/SignatureReviewPanel.vue | module: web
- `component:WordingReviewPanel`
  - apps/web/src/views/pending_review/WordingReviewPanel.vue | module: web
- `component:ExcelCellMappingPanel`
  - apps/web/src/views/template_annotate/ExcelCellMappingPanel.vue | module: web
- `component:InheritedFieldsPanel`
  - apps/web/src/views/template_annotate/InheritedFieldsPanel.vue | module: web
- `component:useAnnotateCanvas`
  - apps/web/src/views/template_annotate/useAnnotateCanvas.ts | module: web
- `component:DraftBox`
- `component:EffectiveFieldBoxView`

## Edges (57)

### Imports (41)

- `component:App` -> `component:demo-session` (confidence: high)
- `component:main` -> `component:App` (confidence: high)
- `component:main` -> `component:router` (confidence: high)
- `component:main` -> `component:global` (confidence: high)
- `component:StepChat` -> `component:http` (confidence: high)
- `component:agent-runtime` -> `component:http` (confidence: high)
- `component:demo-session` -> `component:http` (confidence: high)
- `component:demo-session` -> `component:types` (confidence: high)
- `component:http` -> `component:types` (confidence: high)
- `component:index` -> `component:agent-runtime` (confidence: high)
- `component:index` -> `component:StepChat` (confidence: high)
- `component:index` -> `component:demo-session` (confidence: high)
- `component:index` -> `component:http` (confidence: high)
- `component:index` -> `component:types` (confidence: high)
- `component:index` -> `component:UploadToolbar` (confidence: high)
- `component:UploadToolbar` -> `component:types` (confidence: high)
- `component:DocumentGapsPanel` -> `component:types` (confidence: high)
- `component:index` -> `component:DocumentGapsPanel` (confidence: high)
- `component:index` -> `component:ProjectHomeDialogs` (confidence: high)
- `component:index` -> `component:ProjectPackTable` (confidence: high)
- `component:index` -> `component:useProjectHome` (confidence: high)
- `component:ProjectHomeDialogs` -> `component:types` (confidence: high)
- `component:ProjectHomeDialogs` -> `component:useProjectHome` (confidence: high)
- `component:ProjectPackTable` -> `component:types` (confidence: high)
- `component:useProjectHome` -> `component:demo-session` (confidence: high)
- `component:useProjectHome` -> `component:http` (confidence: high)
- `component:useProjectHome` -> `component:types` (confidence: high)
- `component:index` -> `component:SignatureConfirmDialog` (confidence: high)
- `component:index` -> `component:SignatureReviewPanel` (confidence: high)
- `component:index` -> `component:WordingReviewPanel` (confidence: high)
- `component:SignatureConfirmDialog` -> `component:types` (confidence: high)
- `component:SignatureReviewPanel` -> `component:types` (confidence: high)
- `component:WordingReviewPanel` -> `component:http` (confidence: high)
- `component:WordingReviewPanel` -> `component:types` (confidence: high)
- `component:ExcelCellMappingPanel` -> `component:http` (confidence: high)
- `component:ExcelCellMappingPanel` -> `component:types` (confidence: high)
- `component:index` -> `component:InheritedFieldsPanel` (confidence: high)
- `component:index` -> `component:ExcelCellMappingPanel` (confidence: high)
- `component:index` -> `component:useAnnotateCanvas` (confidence: high)
- `component:InheritedFieldsPanel` -> `component:types` (confidence: high)
- `component:useAnnotateCanvas` -> `component:types` (confidence: high)

### Template (16)

- `component:App` -> `component:RouterLink` (confidence: high)
- `component:App` -> `component:RouterView` (confidence: high)
- `component:index` -> `component:StepChat` (confidence: high)
- `component:index` -> `component:RouterLink` (confidence: high)
- `component:index` -> `component:UploadToolbar` (confidence: high)
- `component:index` -> `component:DocumentGapsPanel` (confidence: high)
- `component:index` -> `component:ProjectHomeDialogs` (confidence: high)
- `component:index` -> `component:ProjectPackTable` (confidence: high)
- `component:ProjectPackTable` -> `component:RouterLink` (confidence: high)
- `component:index` -> `component:SignatureConfirmDialog` (confidence: high)
- `component:index` -> `component:SignatureReviewPanel` (confidence: high)
- `component:index` -> `component:WordingReviewPanel` (confidence: high)
- `component:SignatureReviewPanel` -> `component:RouterLink` (confidence: high)
- `component:WordingReviewPanel` -> `component:RouterLink` (confidence: high)
- `component:index` -> `component:DraftBox` (confidence: high)
- `component:index` -> `component:EffectiveFieldBoxView` (confidence: high)
