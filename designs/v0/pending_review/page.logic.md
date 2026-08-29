# page.logic — 待审工作台

## 元信息
- pageId: pending_review
- feature: core-engine
- title: 待审工作台
- route: /pending
- pageType: list

## 操作明细
| 操作 | 触发 | 结果 |
|------|------|------|
| listProposals | 措辞待审 Tab / 进入 | Proposal[] status=pending |
| editWording | 改措辞 | Proposal 正文更新 |
| confirm | 确认措辞 | 中台写 Receipt；无回执不算落库 |
| listSignatureTasks | 资料待签 Tab | `GET /api/pending/signatures` → SignatureTask[] |
| confirmSignatureTask | 待签卡片「确认签字」 | `POST /api/signature-tasks/:id/confirm`；写 Receipt + audit |
| openStepChat | 进入 | 措辞 Tab 绑选中 Job trace；待签 Tab 绑首条任务 trace |

## 主流程
1. 顶栏 Tab：**措辞待审** / **资料待签**。
2. 措辞待审：展示 agent-runtime check_wording 产出的 Proposal；人可改措辞或在本步对话里改；确认后 Receipt。submit_* 不在本页 Tool 白名单。
3. 资料待签：展示 DocumentPipeline 上传后创建的 SignatureTask（role、assignee_label、artifact_id、trace）；弹窗填 signerName 后 confirmSignatureTask；成功后刷新待签列表并展示 Receipt。

## 状态
pending / confirmed / rejected

## 依赖
- 实体：Proposal, Receipt, SignatureTask, DocumentArtifact
- API：`GET /api/pending/signatures`；`POST /api/signature-tasks/:id/confirm`
- 验收：A6、A8、AC-5、AC-7
