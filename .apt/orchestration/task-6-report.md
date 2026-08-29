# Task 6 Report — pending_review 资料待签 Tab

## Status
DONE

## Plan
`docs/apt/plans/2026-08-29-excel-gap-fill-plan.md` — Task 6

## Changes

### `apps/web/src/services/types.ts`
- 新增 `SignatureTaskView`（`task_id`, `artifact_id`, `role`, `assignee_label`, `status`, `signer_name`, `trace_id`, `receipt_id`）

### `apps/web/src/services/http.ts`
- `fetchPendingSignatures()` → `GET /api/pending/signatures`
- `confirmSignatureTask(taskId, signerName)` → `POST /api/signature-tasks/:id/confirm`

### `apps/web/src/views/pending_review/index.vue`
- 顶栏 Tab：**措辞待审** / **资料待签**
- 措辞待审：保留原 Proposal 表格、改措辞、确认 Receipt 流程
- 资料待签：卡片展示 role、签认人（assignee_label）、资料 artifact_id + 审计链接、状态
- 「确认签字」弹窗填写 `signerName` 后提交；成功后刷新待签列表并展示 Receipt
- StepChat trace 随当前 Tab 切换（措辞→选中 Job；待签→首条任务 trace）

## Verify
```
npx tsc -p apps/web --noEmit
```
Exit code: 0

## Commit
`feat(web): pending_review signature tasks tab (task 6)`

## Concerns
- API 仅返回 `SignatureTaskRow`，artifact 摘要暂以 `artifact_id` 展示；项目/DocType/下载链接待 Task 7 生成入口完善后可增强。
