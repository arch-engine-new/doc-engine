# 验收案例 — check_findings

真源：`designs/v0/check_findings/page.logic.md`

| ID | RP | kind | 来源（logic） | 步骤 | 期望 | 状态 |
|----|----|------|---------------|------|------|------|
| C-01 | RP-01 | view_load | /jobs/:id/findings | 从任务打开检查结果 | 标题「检查结果」 | [x] |
| C-02 | RP-02 | action | getFindings | 看抽取 JSON 与规则命中表 | 两块 card 可见 | [x] |
| C-03 | RP-03 | action | export | 点「导出 JSON」 | 触发下载，按钮可用 | [x] |
| C-04 | RP-04 | action | openStepChat | 本页 | StepChat 可见 | [x] |
| C-05 | RP-05 | action | confirmNext | Job=checking 时点「同意进入待审」 | 进 /pending 或按钮因非 checking disabled | [!] |
| C-06 | RP-06 | state | pass/blocked | 看本页状态标签 | pass 或 blocked | [x] |
| C-07 | RP-07 | other | blocking 不得自动通过 | 有 blocking fail 时 | 红色 banner | [x] |
| C-08 | RP-08 | other | clause_id | 「不合哪条」列 | 无条款号显示 — 而非「不合某条」 | [x] |
