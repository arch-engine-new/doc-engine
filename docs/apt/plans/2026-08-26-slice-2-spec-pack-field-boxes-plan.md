# SLICE-2 Spec Pack + Field Boxes Plan

> spec: `docs/superpowers/specs/2026-08-26-slice-2-spec-pack-field-boxes.md`  
> schema: `docs/schema/generated/core-engine-migration.sql`（PG）；测试 SQLite 同表名，JSONB→TEXT、IDENTITY→AUTOINCREMENT、DECIMAL→TEXT  
> 契约：`SpecPackRow` / `TemplateRow` / `FieldBoxRow` @ `docs/schema/generated/core-engine-rows.ts`

## 包

只改 `packages/core-engine`。禁止改 `packages/agent-runtime` 行为。禁止 Vue / Qdrant / Neo4j。

## 任务

1. **SQLite 增表**  
   在 `sqlite-slice1.sql`（可改名为 slice 迁移文件，但须保持幂等 `CREATE TABLE IF NOT EXISTS`）增加：  
   `t_spec_pack`、`t_template`、`t_field_box`（字段与 PG 合同一致，类型按 SQLite 映射）。  
   更新 `SLICE1_TABLES`（或改名为 `LEDGER_TABLES`）使 `isMigrated` 覆盖新表。  
   `types.ts` re-export `SpecPackRow`、`TemplateRow`、`FieldBoxRow`。

2. **Configurer API（store + 薄封装）**  
   - `insertSpecPack` / `listSpecPacks(projectId)`  
   - `insertTemplate` / `saveFieldBoxes`（upsert by template_id+field_key） / `listFieldBoxes(templateId)`  
   - 空包不得写入行业预置内容。

3. **抽取读 FieldBox**  
   新增 `extractByTemplate(fields, boxes) → Record<string, unknown>`：每个 `field_key` 有值则拷贝，否则 `null`。  
   `JobPipeline.runFixtureJob`：若传入或已绑定 `template_id` 且有框，用投影后的 fields 写 `t_extraction`；无框则保持 SLICE-1 全量夹具字段。  
   缺框字段不得 throw、不得把 Job 标失败。

4. **接线 SLICE-1 seed**  
   `seedPublishedRules` 前确保存在对应 `t_spec_pack`（名称「空规范包」或既有 `PACK_ID` 的空壳，**禁止**公路字样）。Job 的 `pack_id` 指向该包。

5. **测试**（`packages/core-engine/test/`，可新文件或扩 walking-skeleton）  
   - A1：createProject + createSpecPack；`listSpecPacks` 的 name 不含「公路」「水利」「房建」  
   - A2：save 3 框（编号 string、日期A date、日期B date，任意合法坐标）→ `runFixtureJob` 带该 `template_id` → `JSON.parse(extraction.fields_json)` 含三 key  
   - 回归：原 A4/A5/A9/A15 仍绿  
   `npm test -w core-engine` 必须 PASS；`tsc -p packages/core-engine --noEmit` PASS。

6. **闭环**  
   `audit_arch_changes` → `refresh_asset`（`kind=util`/`pojo`，`module=core-engine`，避免误入 frontend）+ 新导出 `register_contract`。  
   HTTP 可选，本片可不做。

## 完成定义

A1/A2 + SLICE-1 回归全绿；不宣称 connect done、不宣称产品整体 verify 完成。
