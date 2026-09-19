# Task 2 Review Brief

review-tier: full
BASE_SHA: c01b4e2717a906c8e98f17245ec79d03fd871ca5
implementer: .apt/orchestration/task-2-report.md
brief: .apt/orchestration/task-2-brief.md
report-out: .apt/orchestration/task-2-review.md

## Diff（未 commit）
```
git diff -- packages/core-engine/src/agent/prompts.ts packages/core-engine/src/agent/context.ts packages/core-engine/src/agent/step-chat-bridge.ts packages/core-engine/src/http/handle-request.ts packages/core-engine/src/pipeline/job-pipeline.ts packages/core-engine/test/agent-connect.test.ts packages/core-engine/test/standard-lib-stepchat.test.ts apps/web/src/views/standard_lib/index.vue apps/web/src/components/StepChat.vue
```
新文件：`packages/core-engine/test/standard-lib-stepchat.test.ts`

## 主 Agent mini
- vitest 10/10 PASS（cwd packages/core-engine 三文件）
- tsc --noEmit exit 0

## 审查要点
- retrieve 对齐 standard_lib
- loadPack 不再 /api/jobs[0]
- context 无 fixture-reversed.json / 无关 findings；有 hits 或未命中
- 白名单、export 注释
- 禁止 F-1 详情 UI、禁止改 page.logic
- Vue v-for :key="i" 若是本次引入可记 Minor
- refresh_asset 路径问题记 Important 不阻断

只读。写 `.apt/orchestration/task-2-review.md`。
