# Task 1 Review Brief — F-1 命中水合

review-tier: full
BASE_SHA: c01b4e2717a906c8e98f17245ec79d03fd871ca5
HEAD_SHA: 45a2a731ad99e0cf8421b2f512cff42e972c8127
implementer: 45a2a73
brief: .apt/orchestration/task-f1-1-brief.md
report: .apt/orchestration/task-f1-1-report.md
review-out: .apt/orchestration/task-f1-1-review.md

## 范围

只审 commit `45a2a73`（`git show 45a2a73`）。不要把工作区其它脏文件算进本 Task。

## 对照

- brief：水合 heading/body；table clause_id null；不改检索算法
- Rn：R1/R5/R6
- projectType: component（跳过 B2 test-cases 门禁；仍须公开方法注释抽检）

## 已知 implementer concern

refresh_asset 建了 `frontend/packages/util` 而非更新 `frontend/core-engine`。禁止 audit。请判定是否 Critical 还是可留给 PB-5 finish_feature。

## 输出

按 reviewer 模板写满 `.apt/orchestration/task-f1-1-review.md`，Assessment 必须是 Approved 或 Issues found。
