# page.logic — 上传与任务

## 元信息
- pageId: job_upload
- feature: core-engine
- title: 上传与任务
- route: /jobs
- pageType: list

## 操作明细
| 操作 | 触发 | 结果 |
|------|------|------|
| listDocTypes | 进入（按当前 pack） | DocType[] |
| listTemplates | 进入 | Template[]（含 doc_type_id） |
| upload | 选择文件 + 必选 DocType | Job status=checking（写入 trace_id、doc_type_id） |
| listJobs | 进入 | Job[] |
| openFindings | 行点击 | → /jobs/:id/findings |
| openStepChat | 每条 Job / 每步状态 | 打开 trace_id+step 对话 |
| sendUtterance | 自然语言 | HITL 消息；不改 Job.status |
| confirmNext | 用户同意下一步 | 中台推进状态机 |

## 主流程
1. 按当前规范包加载文档类型下拉；未选类型禁止上传。
2. 选中类型后展示关联模板（多模板时可选手动指定 template_id）。
3. 上传 PDF/图片 → 状态机 uploaded → inspecting → extracting → checking → pending/previewed/failed。
4. 抽取按绑定类型的有效字段集（FieldDef 继承 ∪ 模板 FieldBox）。
5. **每步结果都可对话**；同意后才进入下一步。

## 状态
与 Job.status 一致

## 依赖
- 实体：Job, Document, DocType, Template
- 验收：A9 骨架、AC-3、R5
