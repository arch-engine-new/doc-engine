review-tier: full
BASE_SHA: c01b4e2717a906c8e98f17245ec79d03fd871ca5
slice: B-3
task: 1

# Task Review Brief — B-3-1 进页即挂载 StepChat

## 输入

- brief: `.apt/orchestration/task-b3-1-brief.md`
- report: `.apt/orchestration/task-b3-1-report.md`
- plan: `docs/apt/plans/2026-09-17-b3-standard-lib-stepchat-on-load-plan.md`
- BASE_SHA: `c01b4e2717a906c8e98f17245ec79d03fd871ca5`（批次禁 commit，对照工作区 uncommitted diff，勿要求 HEAD 前进）
- 实现子 Agent: [B-3 implementer](fc309224-c54b-4a83-bf28-4943c44a8f2c)

## Part 1 约束

- 进页未检索即渲染 StepChat；hits.length===0 不卸载
- 不绑 /api/jobs[0]；trace = pack:${packId}
- 不改 designs/v0/standard_lib；不实现 F-1
- 白名单仅 vue + on-load 测试（及冲突时的 stepchat 测试）

## 审查

只读，不改代码。对照 brief：Missing / Extra / Misunderstood。写 `.apt/orchestration/task-b3-1-review.md`。
Assessment: Approved | Needs fixes。
