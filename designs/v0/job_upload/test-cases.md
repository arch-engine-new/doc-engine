# 测试用例 — job_upload

规划来源：冻结 `designs/v0/job_upload/page.logic.md`（双轨 Skill/legacy、R27、A20）。T1–T3 编号锁定，供 Task 16 自动化。不替代引擎 M1–M16 HTTP 测。资料链不得调 `searchStandard` / `search_clause`；`POST /api/standards/search` 与 `standard_lib` 检索保持。

## 业务测试（来自 page.logic.md）

| ID | 场景 | 输入 | 预期 | 来源 |
|----|------|------|------|------|
| T1 | 主按钮「确认完成并处理」无摘要时禁用；直调 confirm-skill 拒绝 | 已 `uploadSkill`，引擎三块摘要未齐；主按钮或直接 `POST /api/jobs/:id/confirm-skill` | 主按钮 **disabled**；直接 POST → **409**（M3） | §校验 |
| T2 | 引擎人话三块摘要齐才启用主按钮；禁止模型口述解锁 | 草稿须同时含：表名/别名、≥1 条检查项、≥1 句会怎么修；尝试用对话口述「可以确认了」 | 三块齐才启用主按钮（`ready_to_confirm`）；引擎从草稿 JSON **渲染**摘要，禁止模型口述解锁（M4） | §校验 / 主流程 5 |
| T3 | 主上传不依赖 DocType | 未选 DocType；主按钮上传 PDF/图片/xlsx（请求无 `doc_type_id`） | `canUpload` **不**绑 DocType；上传成功且 `GET job` 含非空 `skill_draft_id`（M12 / A20） | §校验 Skill 轨 |
| T5 | Skill 轨允许 PDF / 图片 / xlsx | 分别上传 PDF、图片、xlsx | 三种均允许；xlsx **读单元格、不走 OCR** | §校验 |
| T6 | Skill OCR 只用 recognizeLayout | 无文本层 PDF/图片需 OCR | 只用 `recognizeLayout`；**禁止** flatten `recognize` | §校验 |
| T7 | 多候选未点选不得确认 | 索引匹配多条，未 `selectCandidate` | 不得确认；`POST confirm-skill` → **409** | §校验 / selectCandidate |
| T8 | Skill Job 禁止同意下一步 | `track=skill` 的 Job 点「同意下一步」或 `POST confirm-next` | **409** | §校验 / confirmNext |
| T9 | 旧夹具仍要 DocType | 合规/颠倒夹具区未选 DocType | 夹具上传 **禁用**；不得创建 `track=legacy` Job | §校验 Legacy |
| T10 | uploadSkill 两路失败（坏件） | 抽字失败且 `recognizeLayout` 失败（或 xlsx 不可读） | 台账仅原件 + 结论不过 + 无修后件 + **不生成 Skill**；状态 `unreadable` | §操作明细 uploadSkill |
| T11 | sendUtterance 只改草稿 | 右侧本步对话输入 | 只更新 SkillDraft + 引擎渲染摘要；**不写索引、不修、不改台账**；对话不能代替确认 | §操作明细 sendUtterance |
| T12 | selectCandidate 匹配与点选 | 名称下拉 / 点选：>5 字可匹配，≤5 须全等，多条必点选 | 选定 canonical；未点选不得确认 | §操作明细 selectCandidate |
| T13 | dryRun 不污染 | 点「试跑」GhostButton | `POST /api/jobs/:id/skill-dry-run`：匹配+检查+拟修预览；**不写**索引/台账/修后件 | §操作明细 dryRun |
| T14 | confirmSkill 才写索引并处理 | 三块齐（多候选已点选）；点「确认完成并处理」 | `POST confirm-skill`：commit 本 pack 索引（覆盖同 `canonical_name`）+ 处理本文件 + 台账（原件+修后件）；进索引的检查项即该表生产规则（R27 / A20） | §操作明细 confirmSkill |
| T15 | listJobs 本页双轨；findings 默认 legacy | 进入本页；findings/pending 调 `GET /api/jobs` | 本页列出 skill **与** legacy；给 findings/pending 的 GET **默认 `track=legacy`** | §操作明细 listJobs |
| T16 | openFindings 仅 legacy 行 | 点击 skill 行 vs legacy 行 | **仅** legacy 行 → `/jobs/:id/findings` | §操作明细 openFindings |
| T17 | listDocTypes 旧夹具区 | 切换到旧夹具区 | 加载 DocType[] | §操作明细 listDocTypes |
| T18 | uploadLegacy 已选 DocType | 合规/颠倒夹具且已选 DocType | Job `track=legacy` | §操作明细 uploadLegacy |
| T19 | confirmNext 推进 legacy 状态机 | 旧夹具「同意下一步」 | 中台推进：uploaded → inspecting → extracting → checking → pending/previewed/failed | §操作明细 confirmNext |
| T20 | openStepChat | 每条 Job（skill 或 legacy） | 打开 `trace_id`+`step` 对话 | §操作明细 openStepChat |
| T21 | Skill 态 drafting | 有草稿 / 摘要未齐 | `drafting`；主按钮 disabled | §状态 |
| T22 | Skill 态 ready_to_confirm | 三块摘要齐 | `ready_to_confirm`；主按钮 enabled | §状态 |
| T23 | Skill 态 processed | 已 confirm-skill | `processed` | §状态 |
| T24 | Skill 态 unreadable | 坏件两路失败 | `unreadable` | §状态 |
| T25 | Legacy 上传区 no_doc_type | 旧夹具区未选 DocType | 上传区 `no_doc_type`；夹具上传禁用 | §状态 |
| T26 | Legacy 上传区 ready_to_upload | 旧夹具区已选 DocType | 上传区 `ready_to_upload` | §状态 |
| T27 | 唯一命中仍须确认 | 索引唯一命中并拷入草稿 | **仍须** `confirmSkill`；本期无免确认自动跑 | §主流程 3 / confirmSkill |

## 接口测试

| ID | 接口 | 场景 | 预期 |
|----|------|------|------|
| T4 | POST /api/jobs/upload | 无 `doc_type_id` | 200 + 非空 `skill_draft_id`；`Job.track=skill` |
| T28 | POST /api/jobs/:id/confirm-skill | 无摘要（三块未齐） | **409** |
| T29 | POST /api/jobs/:id/skill-dry-run | 已有草稿 | 200 预览；索引/台账/修后件无新增 |
| T30 | POST /api/jobs/:id/confirm-next | `track=skill` 的 Job | **409** |
| T31 | POST /api/chat | 本步对话 | 只改 SkillDraft + 引擎摘要；不写索引 / 不修 / 不改台账 |
| T32 | POST /api/standards/search | 与 `standard_lib` 相同检索夹具 | **200** 可命中（保持，非本页改检索） |
