# 验收案例 — job_upload

真源：`designs/v0/job_upload/page.logic.md`

| ID | RP | kind | 来源（logic） | 步骤 | 期望 | 状态 |
|----|----|------|---------------|------|------|------|
| C-01 | RP-01 | view_load | /jobs | 打开任务页 | 标题「上传与任务」、表格可见 | [x] |
| C-02 | RP-02 | dropdown | listDocTypes | 打开文档类型 | 选项非空（reset 后） | [x] |
| C-03 | RP-03 | dropdown | listTemplates | 选类型后 | 模板提示或模板下拉 | [x] |
| C-04 | RP-04 | validation | 未选类型禁止上传 | 不选类型点上传 | 「请先选择文档类型」 | [!] |
| C-05 | RP-05 | upload | examples PDF | 选类型后逐份上传 examples/*.pdf | 列表新增 Job；失败则页面红字说明 | [x] |
| C-06 | RP-06 | upload | rules 全书 | 选类型后上传 rules/ 85.7MB PDF | 页面展示超 4MB 校验错误，不插 Job | [x] |
| C-07 | RP-07 | action | listJobs | 看表 | file_name / 状态 / trace_id | [x] |
| C-08 | RP-08 | action | openFindings | 点「检查结果」 | 进入 /jobs/:id/findings | [!] |
| C-09 | RP-09 | action | openStepChat | 任务页 | StepChat 输入框可见 | [x] |
| C-10 | RP-10 | action | confirmNext | 选中可推进 Job 点同意下一步 | 状态变化或按钮 disabled | [x] |
| C-11 | RP-11 | dropdown | 状态筛选 | 打开状态 select | 选项来自 job_status 字典 | [x] |
| C-12 | RP-12 | state | Job.status | 上传后 | 状态标签可见 | [x] |
