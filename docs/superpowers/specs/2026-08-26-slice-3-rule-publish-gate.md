# SLICE-3 Rule Publish Gate Spec

**Slice:** 发布 the rule version with fixtures for Configurer  
**Pages:** `rule_editor`（本步对话壳）；不实现 Vue（无 design profile）  
**Contracts:** `RuleRow`, `RuleVersionRow`, `RuleFixtureRow` @ `docs/schema/generated/core-engine-rows.ts`  
**Reuse:** `packages/core-engine` RuleInterpreter / JobPipeline；禁止改 `packages/agent-runtime` 行为  
**Out:** Vue SPA、Qdrant/Neo4j、NL 编译器直发生产、循环引用/公式

## 目标

配置员以 **draft** 保存 DSL，绑定 **≥1 正例 + ≥1 反例** 并跑通后才能 `publish`。缺反例时 publish 失败、状态仍为 draft。口语/对话只允许落到草稿，不能把 version 标成 published。

Job 运行时仍只执行 `status=published` 的版本（SLICE-1/2 回归）。

## 验收（本片）

| ID | 通过标准 |
|----|----------|
| A3 | 仅有正例、无反例（或反例未跑通）时 `publish` 不可用/抛错，`status` 保持 `draft` |

回归：A1 / A2 / A4 / A5 / A9 / A15 仍 PASS。

## 行为

1. SQLite 增表 `t_rule_fixture`（同 PG 合同：`version_id`, `kind`, `payload_json`, `last_result`）。`kind` ∈ `pass` | `fail`（正例/反例）。
2. `saveDraft({ packId, title, dsl, blocking? })` → `t_rule` + `t_rule_version.status=draft`。
3. `addFixture({ versionId, kind, payload })`；`runFixtures(versionId)` 用解释器对每条 payload 求值，写回 `last_result`。正例期望 `pass`，反例期望 `fail`（规则在该 payload 上应失败）。
4. `canPublish(versionId)`：至少 1 条 `kind=pass` 且 `last_result=pass`，且至少 1 条 `kind=fail` 且 `last_result=fail`。否则 false。
5. `publish(versionId)`：`canPublish` 为 false 时 **不得** 改 status；为 true 时改为 `published`。
6. DSL 子集（sourceDoc §4.3）解释器补全：`all` / `any` / `required` / `exists` / `compare` / `regex` / `eq`。JSON 形态：`{ "op": "all"|"any", "args": RuleDsl[] }`；叶子 `{ "op": "required", "field" }`、`{ "op": "exists", "field" }`、`{ "op": "compare", "left", "operator", "right" }`、`{ "op": "regex", "field", "pattern" }`、`{ "op": "eq", "field", "literal" }`。
7. 本步对话 `step=rule_editor`：`appendChat` 不得调用 publish、不得改 `rule_version.status`。
8. 已 seed 的 R1/R2 可保持 published（Walking Skeleton）；**新** draft 必须走闸门。不要用 seed 路径绕过 A3。

## 非目标

Vue connect、口语自动编译 DSL、规则热更新到已在跑的 Job、行业规范包内容。
