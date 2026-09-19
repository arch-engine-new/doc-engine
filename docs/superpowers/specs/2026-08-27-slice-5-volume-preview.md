# SLICE-5 Volume Preview Spec

**Slice:** 预览 the volume grouping for Operator  
**Pages:** `volume_preview`（本步对话壳）；不实现 Vue（无 design profile，`report_design_gap` 已拦 UI）  
**Contracts:** `SpecPackRow`（`group_keys_json` / `order_key`）、`ExtractionRow`、`VolumePreviewRow` @ `docs/schema/generated/core-engine-rows.ts`  
**Reuse:** `packages/core-engine` JobPipeline / ReviewDesk；`packages/agent-runtime` `submit_*` 禁名单（本片不改 runtime 调度）  
**Out:** Vue SPA、资料云实挂、组卷提交成功、Qdrant/Neo4j、真实 LLM 必连

## 目标

配置员在规范包上写入**自定义** `groupKeys[]`（任意字段名）与可选 `orderKey`。引擎按这些 key 把 Job 下各抽取叶子聚成预览树，写入 `t_volume_preview.tree_json`。预览**不得**声称已提交；对话不能 submit；不向 agent-runtime 开放提交 Tool（A8 已禁 `submit_*`，本片保持）。

## 验收（本片）

| ID | 通过标准 |
|----|----------|
| A7 | 对用户给定的 `groupKeys`（非预置公路部位/工序键）分组；同组内按 `orderKey` 排序（可空则稳定序）；落库 `VolumePreview`；`tree_json` / API 结果 **`submitted` 恒为 `false`**，无「提交成功」字段或状态。 |

回归：A1 / A2 / A3 / A4 / A5 / A6 / A8 / A9 / A15 仍 PASS。

## 行为

1. SQLite 增表 `t_volume_preview`（字段对齐生成合同：`preview_id` / `job_id` / `tree_json` + 审计列）。`LEDGER_TABLES` 纳入。`types.ts` re-export `VolumePreviewRow`。
2. `setGroupKeys(packId, groupKeys: string[], orderKey?: string | null)` 写入 `t_spec_pack.group_keys_json`（JSON 数组）与 `order_key`。禁止默认塞入公路/水利/房建键名。
3. 叶子来源：同一 `job_id` 下**全部** `t_extraction` 行；每行 `fields_json` 解析为一个叶子。可提供 `attachExtraction(jobId, fields)` 以便测试挂多叶（不改既有 `runFixtureJob` 单抽取语义）。
4. `previewVolume(jobId)`：读 Job 的 `pack_id` → 规范包 `groupKeys` / `orderKey`；按 key **嵌套分组**；组内按 `orderKey` 字段值排序（缺 key 视为空串，排在前）；插入 `t_volume_preview`；audit `event_type=volume_preview`，带 `job.trace_id`。
5. `tree_json` 必须含 `submitted: false` 与所用 `groupKeys`。节点建议：`kind: "group" | "leaf"`；group 有 `key`/`value`/`children`；leaf 有 `extractionId` 与 `fields`。缺分组字段值用 `""`，不得发明行业默认卷名。
6. `appendChat(step=volume_preview)` 不得 submit、不得把预览改成已提交、不得写 Receipt。
7. **不实现**对认知层开放的 `submitVolume` / `submit_*`。若误加工作台提交方法，必须抛错或返回未提交，**禁止**写 `submitted: true` 或成功回执。

## 非目标

Vue connect、资料云解挂/重挂、组卷提交落库、标准 RAG（SLICE-6）、改 agent-runtime 调度器/HITL。
