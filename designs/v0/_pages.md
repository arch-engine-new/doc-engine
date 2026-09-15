# v0 页面冻结进度

开发维护的 SSOT。HTML 原型 + page.logic 已按 sourceDoc 手写补齐（DashScope 生成失败后的保底交付）。

| page-id | title | handoff | approved | synced | notes |
|---------|-------|---------|----------|--------|-------|
| project_home | 项目与规范包 | done | yes | yes | 2026-09-15 C2：原型补齐缺表/DocType/生成检验批后 reconcile 回流 |
| template_annotate | 模板标注 | done | yes | yes | 2026-09-15 C2：原型补齐继承基字段/Excel 映射后 reconcile 回流 |
| rule_editor | 规则编辑与发布 | done | yes | yes | 2026-08-27 design profile + page recipe |
| standard_lib | 标准库 | done | no | yes | PDF tick ingest + provenance columns（R2/R25）；重新打开设计闸 |
| job_upload | 上传与任务 | done | yes | yes | 2026-08-27 design profile + page recipe |
| pending_review | 待审工作台 | done | yes | yes | 2026-09-15 C2：原型补齐资料待签 Tab 后 reconcile 回流 |
| check_findings | 检查结果 | done | yes | yes | 2026-08-27 design profile + page recipe |
| volume_preview | 组卷预览 | done | yes | yes | 2026-08-27 design profile + page recipe |
| audit_trace | 审计追踪 | done | yes | yes | 2026-08-27 design profile + page recipe |

**列说明**

| 列 | 含义 |
|----|------|
| `page-id` | kebab-case，与 `page.manifest.json` 的 `id` 一致 |
| `title` | 中文标题 |
| `handoff` | `pending` | `wip` | `done` — 双文件是否写完 |
| `approved` | `no` | `yes` — 开发认定已按 PM 设计说清楚 |
| `synced` | `yes` | `yes` — 是否已 `design-sync --adapter v0` |
| `notes` | 待对文档、权限等待办 |
