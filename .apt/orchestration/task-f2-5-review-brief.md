# Task F2-5 Review Brief

review-tier: full
projectType: component

- brief: `.apt/orchestration/task-f2-5-brief.md`
- report: `.apt/orchestration/task-f2-5-report.md`
- BASE_SHA: `1528f571b4362f34403d4c361370b5ce699950b3`
- HEAD_SHA: `17fee66b1494f3f4da4850c5df971a1de8acc386`
- Output: `.apt/orchestration/task-f2-5-review.md`

检查 ingest-worker await embed、live smoke skipIf 含 DASHSCOPE_API_KEY、有向量时 length!==48、仅白名单、无 apiKey、公开方法注释。
