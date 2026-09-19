# SLICE-3 Rule Publish Gate Plan

> spec: `docs/superpowers/specs/2026-08-26-slice-3-rule-publish-gate.md`  
> schema: `docs/schema/generated/core-engine-migration.sql`（`t_rule_fixture`）  
> 契约：`RuleRow` / `RuleVersionRow` / `RuleFixtureRow`

## 包

只改 `packages/core-engine`。禁止改 `packages/agent-runtime`。禁止 Vue / Qdrant / Neo4j。

## 任务

1. **SQLite**  
   `sqlite-slice1.sql` 增加 `t_rule_fixture` + `idx_t_rule_fixture_version_id`。`LEDGER_TABLES` 纳入该表。`types.ts` re-export `RuleFixtureRow`（及尚未导出的 `RuleRow`）。

2. **DSL 子集**  
   扩展 `rules/interpreter.ts`：`all`/`any`（递归 `args`）、`exists`、`regex`、`eq`；保留 SLICE-1 的 `required`/`compare`。非法/不支持 op → finding `fail`，不 throw。补最小单测：`all` 与 `eq` 各一条即可，闸门测试为主。

3. **发布闸门**  
   新建薄模块（如 `rules/publish.ts` 或 `pipeline/rule-editor.ts`）：  
   `saveDraft` / `addFixture` / `runFixtures` / `canPublish` / `publish`。  
   `publish` 在缺反例或 `runFixtures` 后反例 `last_result` 不是 `fail` 时拒绝（throw 或返回 `{ ok:false }`，**status 仍 draft**）。

4. **Job 接线**  
   `listPublishedRuleVersions` 继续只返回 `published`。draft 不得进入 Job 检查。

5. **测试**  
   - A3：draft + 仅正例（或正例跑通但无反例）→ `canPublish===false` 且 `publish` 失败、status=`draft`；补上反例并 `runFixtures` 后才能 published  
   - 对话：`appendChat({ step: "rule_editor" })` 后 version 仍 draft  
   - 回归：现有 6 测仍绿  
   `npm test -w core-engine` PASS；`npx tsc -p packages/core-engine --noEmit` PASS。

6. **闭环**  
   `refresh_asset` 必须 `module=core-engine`；新导出类型 `register_contract`。HTTP 可选。

## 完成定义

A3 红灯路径（无反例）覆盖；不宣称 connect done、不宣称产品整体 verify 完成。
