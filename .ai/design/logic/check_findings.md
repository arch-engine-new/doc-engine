# page.logic — 检查结果

## 元信息
- pageId: check_findings
- feature: core-engine
- title: 检查结果
- route: /jobs/:id/findings
- pageType: detail

## 操作明细
| 操作 | 触发 | 结果 |
|------|------|------|
| getFindings | 进入 | Finding[] + RuleVersion + 可选 clause_id |
| export | 导出 | 文件 |
| openStepChat | 进入本页 | 就本份抽取/Finding 提问 |
| confirmNext | 同意进入待审 | 中台改 status=pending；对话不能取消 blocking |

## 主流程
1. 展示抽取 JSON 与规则命中。
2. blocking=true 则 Job 不得自动通过。
3. 合规件无 R2 finding；颠倒件有 blocking。
4. **标准符合度** Finding 必须展示 `clause_id`、生效版本、原文 span、检索路径（vector | graph）。无 `clause_id` 不得展示为「不合某条」。LLM 生成的条款号丢弃。
5. 可就本结果自然语言追问「不合哪条 / 下一步做什么」。

## 状态
pass / blocked

## 依赖
- 实体：Finding, Extraction, RuleVersion, Clause
- 验收：A4, A5, A11
