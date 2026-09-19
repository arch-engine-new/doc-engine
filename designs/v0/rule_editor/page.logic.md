# page.logic — 规则编辑与发布

## 元信息
- pageId: rule_editor
- feature: core-engine
- title: 规则编辑与发布
- route: /packs/:id/rules
- pageType: form

## 操作明细
| 操作 | 触发 | 结果 |
|------|------|------|
| saveDraft | 保存 | RuleVersion status=draft |
| runFixtures | 跑夹具 | 正例+反例结果 |
| publish | 发布 | published；缺夹具则按钮 disabled |
| openStepChat | 进入 | 口语只生成 DSL 草稿，不能直接 publish |

## 主流程
1. 编辑 DSL（required/exists/compare/regex/eq + all/any）。
2. 绑定 ≥1 正例 + ≥1 反例。
3. 闸门通过才 publish。口语规则不得直上生产。

## 状态
draft / fixture_fail / publishable / published

## 依赖
- 实体：Rule, RuleVersion
- 验收：A3
