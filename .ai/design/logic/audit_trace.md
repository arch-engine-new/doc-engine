# page.logic — 审计追踪

## 元信息
- pageId: audit_trace
- feature: core-engine
- title: 审计追踪
- route: /audit/:traceId
- pageType: timeline

## 操作明细
| 操作 | 触发 | 结果 |
|------|------|------|
| getTrace | 进入 | AuditEvent[] 按 trace_id |
| listStepChats | 进入 | 各 step 对话摘要（只读） |

## 主流程
1. 用 trace_id 串联 Job、Extraction、RuleVersion、Finding、Proposal、Receipt、ConversationThread。
2. 无 Receipt 的写入不展示为已落库。
3. 审计页不发送会改变结论的对话。

## 主流程
1. 用 trace_id 串联 Job、Extraction、RuleVersion、Finding、Proposal、Receipt。
2. 无 Receipt 的写入不展示为已落库。

## 状态
ready / not_found

## 依赖
- 实体：AuditEvent
- 验收：A9
