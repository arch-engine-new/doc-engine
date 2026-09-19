# SLICE-2 Spec Pack + Field Boxes Spec

**Slice:** 配置 the spec pack and field boxes for Configurer  
**Pages:** `project_home` + `template_annotate`（本步对话壳）；不实现 Vue 页（无 `.ai/design/profile.json`，本片不做 UI connect）  
**Contracts:** `SpecPackRow`, `TemplateRow`, `FieldBoxRow` @ `docs/schema/generated/core-engine-rows.ts`  
**Reuse:** `packages/core-engine` JobPipeline / SQLite 账本；`packages/agent-runtime` 不改行为  
**Out:** Qdrant/Neo4j、DSL 发布闸门、OCR 厂商、Vue SPA、Receipt

## 目标

配置员可建**空规范包**（无预置公路/水利/房建条文或包名），在模板上保存 **3 个 FieldBox**（编号 / 日期A / 日期B）。之后 Job 抽取 **按 FieldBox 读字段**：`fields_json` 含对应 key；某框在夹具中缺失则为 `null`，**不中断 Job**。

## 验收（本片）

| ID | 通过标准 |
|----|----------|
| A1 | `createProject` + `createSpecPack` 成功；列出的规范包名称/元数据不含预置「公路」「水利」「房建」字样；空包仅有用户给定 name/version |
| A2 | 同一模板保存 3 框后，对该模板跑抽取，`fields_json` 含 `编号`、`日期A`、`日期B` 三个 key |

回归（不得破坏 SLICE-1）：A4 / A5 / A9 / A15 仍 PASS。

## 行为

1. SQLite 增表（同 PG 合同表名）：`t_spec_pack`、`t_template`、`t_field_box`。行类型 re-export 生成文件，禁止另造字段名。`x/y/w/h` 在 SQLite 可用 TEXT 存 DECIMAL 字符串（与 `FieldBoxRow` 的 `string` 一致）。
2. `createSpecPack({ projectId, name, version })` 写入空壳；`group_keys_json` / `order_key` / `effective_standard_version_id` 本片可空。禁止 seed 任何行业规范包。
3. `createTemplate({ packId, name, pageImageUri? })`；`saveFieldBoxes(templateId, boxes)` 至少写入 3 框（field_key + value_type + page + x,y,w,h）。同一 template 的 `field_key` 唯一。
4. 抽取：若 Job 绑定 `template_id` 且该模板有 FieldBox，则 `fields_json` **只按框的 field_key 投影**夹具 JSON；缺 key → JSON `null`，Job 继续 extracting→checking。无模板时保持 SLICE-1 夹具全量字段（回归）。
5. 本步对话：`step=annotate` 或 `step=configure` 可 `appendChat`；不得因对话预置行业规则或改 Job.status。
6. 文案/seed：演示包名用「空规范包」或用户传入名；**禁止**默认包名或规则 title 含公路/水利/房建。

## 非目标

画布像素命中测试、表格线检测、跨页续表、Vue connect、规则 publish 闸门、标准 RAG。
