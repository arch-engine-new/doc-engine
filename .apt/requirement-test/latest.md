# Requirement test — F-3 ZhipuPrequery

来源：`docs/apt/plans/2026-09-19-f3-zhipu-prequery-plan.md`（§0.2 Goal/验收标准）
verifiedAt：2026-09-19T10:58:00Z

| id | passed | attempts |
|----|--------|----------|
| AC-1 liveRetrievePorts().prequery 为 ZhipuPrequery | true | 0 |
| AC-2 缺 LLM 配置显式失败，不静默 FakePrequery | true | 0 |
| AC-3 单测仍可注入 FakePrequery | true | 0 |

证据：`packages/core-engine` vitest `live-zhipu-prequery.test.ts` + `dashscope-embeddings.test.ts` + `standard-rag.test.ts` → 27 passed。TDD RED 2 failed → GREEN。commit `cf22716`。

资产同步：implementer 已 register_contract `ZhipuPrequery` / 更新 `liveRetrievePorts`；refresh `live-ports.ts`。本轮需求测试无额外代码修复。

下一步：`/verify`（playbook F-3 PB-2）。
