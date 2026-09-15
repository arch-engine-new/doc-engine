# 待审工作台

## 操作明细

| 操作 | 触发 | 结果 | 确认 | 角色 |
|------|------|------|------|------|
| listProposals | 点击「措辞待审」Tab / 进入页 | 加载 Proposal[]（status=pending），展示提案、Job、状态 | 无 | 全部登录用户 |
| editWording | 在建议措辞 textarea 中输入/修改 | Proposal 正文更新（本地暂存） | 无 | 全部登录用户 |
| saveWording | 点击「保存措辞」 | 保存修改后的措辞 | 无 | 全部登录用户 |
| confirm | 点击「确认并开 Receipt」 | 中台写 Receipt；无回执不算落库；状态变为 confirmed | 确认后开 Receipt，是否继续？ | 全部登录用户 |
| reject | 点击「退回」 | Proposal 状态置为 rejected | 退回该提案？ | 全部登录用户 |
| listSignatureTasks | 点击「资料待签」Tab | 调用 GET /api/pending/signatures → SignatureTask[]（role、assignee_label、artifact_id、trace） | 无 | 全部登录用户 |
| confirmSignatureTask | 待签卡片「确认签字」→ 填 signerName →「提交签字」 | 调用 POST /api/signature-tasks/:id/confirm；写 Receipt + audit；刷新待签列表 | 提交签字确认？ | 监理（assignee） |
| cancelSign | 签字弹窗「取消」 | 关闭弹窗，不提交 | 无 | 全部登录用户 |
| openStepChat | 进入页 | 措辞 Tab 绑选中 Job trace；待签 Tab 绑首条任务 trace | 无 | 全部登录用户 |
| switchJobLink | 点击 Job 链接（如 job_bad_002） | 跳转检查发现页（check_findings） | 无 | 全部登录用户 |
| openAuditTrace | 点击「审计」链接 | 跳转审计追踪页（audit_trace） | 无 | 全部登录用户 |

## 主流程

1. 进入页，加载措辞待审 Tab（listProposals，status=pending）。
2. 选中 Proposal，查看/修改建议措辞（editWording，可保存措辞）。
3. 点击「确认并开 Receipt」，中台写 Receipt，无回执不算落库；submit_* 不在本页 Tool 白名单。
4. 切换「资料待签」Tab，加载 SignatureTask 列表（GET /api/pending/signatures）。
5. 点击「确认签字」，弹窗填写 signerName，提交（confirmSignatureTask），写 Receipt + audit，刷新列表并展示 Receipt（示例 rec_pending_001 · confirmed）。

## 状态

- `loading`：列表加载中显示 Spinner / 骨架屏
- `empty`：无 pending Proposal 或无待签任务时显示 EmptyState（非权限问题）
- `forbidden`：非 assignee（如非监理）尝试签字时提示无权限操作
- `error`：listProposals / listSignatureTasks / confirm 失败可重试：Alert + 重试
- `success`：确认措辞或签字成功后 Toast 展示 Receipt（如 rec_pending_001 · confirmed）
- Proposal / 任务状态：pending / confirmed / rejected

## 字段与列

| name | 类型 | 必填 | 展示 | 语义组件（可选） |
|------|------|------|------|------------------|
| proposalId | string | no | 表格列 | DataTable 列 |
| jobId | string | no | 表格列（链接到 check_findings） | DataTable 列 |
| status | enum | no | 表格列（tag warn 等） | DataTable 列 |
| wording | string | yes | 表单（textarea，可改） | FormField |
| role | enum | no | 只读（如 监理） | 只读 |
| assigneeLabel | string | no | 只读（如 张监理） | 只读 |
| artifactId | string | no | 只读（mono，如 art_batch_001） | 只读 |
| traceId | string | no | 只读（绑 step-chat） | 只读 |
| signerName | string | yes | 表单（签字弹窗输入） | FormField |
| receiptId | string | no | 只读（Receipt 标识） | 只读 |

## 查询参数

| 参数名 | 含义 | 默认值 |
|--------|------|--------|
| tab | 当前 Tab（wording / signature） | wording |
| status | Proposal / 任务状态筛选 | pending |

## 选项数据源

（本页无下拉）

## 校验

| 规则 | 范围 | 说明 |
|------|------|------|
| required | signerName | 签字人姓名必填，提示「请填写签字人姓名」 |

## 权限

- 页级：登录即可；confirmSignatureTask 仅限任务 assignee 对应角色（如监理）

## 依赖

- API 意向名：listProposals, confirmProposalReceipt, listSignatureTasks, confirmSignatureTask（原型中为 `GET /api/pending/signatures` 与 `POST /api/signature-tasks/:id/confirm`；Phase B 经 query_contract 寻址）
- 语义组件 id：PageHeader, TabBar, DataTable, FormField, PrimaryButton, GhostButton, EmptyState, Tag, Modal
- 实体：Proposal, Receipt, SignatureTask, DocumentArtifact
- 验收：A6、A8、AC-5、AC-7

## Rules

1. agent-runtime check_wording 只生成 Proposal（pending），人确认后中台写 Receipt，本页无 submit Tool。
2. 原型已与已批准 page.logic.md / vue 对齐：保留 listProposals、editWording、confirm、listSignatureTasks、confirmSignatureTask、openStepChat 全部操作，并补充 schema L 各节。
