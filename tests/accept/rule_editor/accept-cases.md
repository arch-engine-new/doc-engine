# 验收案例 — rule_editor

真源：`designs/v0/rule_editor/page.logic.md`

| ID | RP | kind | 来源（logic） | 步骤 | 期望 | 状态 |
|----|----|------|---------------|------|------|------|
| C-01 | RP-01 | view_load | /packs/:id/rules | 打开规则页 | 标题「规则编辑与发布」 | [x] |
| C-02 | RP-02 | action | saveDraft | 点「保存草稿」 | version_id 出现或错误文案 | [x] |
| C-03 | RP-03 | action | runFixtures | 添加正反例后「跑夹具」 | last_result 更新 | [x] |
| C-04 | RP-04 | action | publish | 闸门通过后「发布 published」 | published 标签或按钮仍 disabled | [x] |
| C-05 | RP-05 | state | draft/published | 看状态 tag | 字典标签可见 | [x] |
| C-06 | RP-06 | action | openStepChat | 本页 | StepChat 可见；发布钮不由对话触发 | [x] |
