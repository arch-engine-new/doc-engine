# Task F2-4 Review Brief

review-tier: full
projectType: component

- brief: `.apt/orchestration/task-f2-4-brief.md`
- report: `.apt/orchestration/task-f2-4-report.md`
- BASE_SHA: `3a5dcbea7c746d2865e8cff1f51435bad30599b5`
- HEAD_SHA: `1528f571b4362f34403d4c361370b5ce699950b3`
- Output: `.apt/orchestration/task-f2-4-review.md`

检查 reindex 走 LayoutUnit 全量、payload 三字段、table 无 clause_id、openLiveFromEnv 仅 live 调用、library embed 均 await、commit 仅白名单三文件、导出注释。工作区可能有 job-pipeline 未提交脏文件，审查以 commit diff 为准。
