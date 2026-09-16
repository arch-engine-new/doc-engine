review-tier: full
task: 1
plan: docs/apt/plans/2026-09-15-verify-fix-design-audit-logic-sync-plan.md
BASE_SHA: 9f584e7987786bd48fa0cdc39addc923739c1410
HEAD_SHA: eca0561
projectType: component（跳过 B2 test-cases.md；公开方法注释抽检仍适用）

# Task 1 Review Brief

## 输入

- Brief: `.apt/orchestration/task-1-brief.md`
- Report: `.apt/orchestration/task-1-report.md`
- Diff: `git diff 9f584e7987786bd48fa0cdc39addc923739c1410..HEAD`
- 只读，不改代码、不改 git。

## Part 1 / 约束（≤10 行）

- 修 C2，不改 RAG / core-engine / vue。
- 禁止用简陋 html 覆盖：待签 API、缺表/生成检验批/DocType、excel 映射/继承基字段。
- logic 不得手改凑闸；须 reconcile MCP。
- Verify: check-logic-sync --base 4d42e0d9 三页无 C2。
- component：不查 test-cases.md。
- 公开方法注释：本 Task 无 TS export 则 N/A。

## 审查重点

1. Spec：三页 html 是否补齐到 logic；操作表是否被砍。
2. Extra：是否改了白名单外路径。
3. Concerns 是否可接受：openStepChat 从 project_home 操作表消失；manifest 未重生。
4. 写审查结论到 `.apt/orchestration/task-1-review.md`。
