# page.logic — 上传与任务

## 元信息
- pageId: job_upload
- feature: core-engine
- title: 上传与任务
- route: /jobs
- pageType: list

## 校验
- 上传前须选择 DocType；未选时「上传资料」禁用，点击亦拦截并提示。
- `POST /api/jobs/upload` 须携带 `doc_type_id`（或 `template_id` 二选一）；缺则 400。
- 选中 DocType 后解析默认 `template_id`（单模板自动选中；多模板时额外下拉）。
- `doc_type_id` 与 `template_id`（若传）须归属同一 pack。

## 操作明细
| 操作 | 触发 | 结果 |
|------|------|------|
| listDocTypes | 进入 / 切换 pack | DocType[] |
| selectDocType | 上传区下拉 | 选定 doc_type_id；展示将使用的 template_id |
| upload | 选择 PDF 且已选 DocType | Job status=uploaded，写入 trace_id、doc_type_id |
| listJobs | 进入 | Job[]（含 doc_type_id） |
| openFindings | 行点击 | → /jobs/:id/findings |
| openStepChat | 每条 Job / 每步状态 | 打开 trace_id+step 对话 |
| sendUtterance | 自然语言 | HITL 消息；不改 Job.status |
| confirmNext | 用户同意下一步 | 中台推进状态机 |

## 主流程
1. 按当前 pack 加载 DocType 列表；用户先选文档类型，再上传夹具 PDF（允许文本层）。
2. multipart 携带 `doc_type_id`（及可选 `template_id`）；Job 绑定类型与模板。
3. 状态机 uploaded → inspecting → extracting → checking → pending/previewed/failed。
4. 抽取按 `resolveEffectiveBoxes` 合并字段投影；缺 OCR 值为 null。
5. **每步结果都可对话**；同意后才进入下一步。
6. Walking Skeleton 主入口（含本步对话壳）。

## 状态
与 Job.status 一致；上传区：no_doc_type / ready_to_upload

## 依赖
- 实体：Job, Document, DocType, Template
- API：`GET /api/packs/:packId/doc-types`；`POST /api/jobs/upload`（doc_type_id）
- 验收：A9 骨架（含 AC-3 类型绑定与继承字段抽取）
