# Task 3 Review Brief — F-1 命中详情 UI

review-tier: full
commit: fa80d32
brief: .apt/orchestration/task-f1-3-brief.md
report: .apt/orchestration/task-f1-3-report.md
review-out: .apt/orchestration/task-f1-3-review.md

只审 `git show fa80d32`。页面类 Task：抽检数据防御（不要裸 as Type 当 decode）。projectType=component 跳过 test-cases Gate，但仍应确认源码测试覆盖 R2/R3/R5。

公开方法注释抽检。index.vue ≤300。出处五列、无全文 th。HitDetailPanel 点击才开。

refresh_asset 路径错挂记 Important。若 commit 把无关 B-3 大段塞进 index 且破坏 F-1 范围，升 Critical。
