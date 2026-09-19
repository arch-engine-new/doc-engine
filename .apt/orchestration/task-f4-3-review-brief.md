# Task F4-3 Review Brief

review-tier: full

- Brief: `.apt/orchestration/task-f4-3-brief.md`
- Report: `.apt/orchestration/task-f4-3-report.md`
- BASE_SHA: `cb785c5ae0f6d85acbc5a396e90158159fabaaa9`
- HEAD: `b0fec81`
- Review output: `.apt/orchestration/task-f4-3-review.md`

## 约束

live rerank = HttpReranker；禁止 IndependentReranker 装配与 embed/llm 注入；prequery 仍 ZhipuPrequery；改写 F-2/F-3 共用 embed 绿条；白名单仅 live-ports.ts + 两测试；无关脏文件不得进 commit。
