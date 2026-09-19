# SLICE-5 Volume Preview Plan

> spec: `docs/superpowers/specs/2026-08-27-slice-5-volume-preview.md`  
> schema: `docs/schema/generated/core-engine-migration.sql`（`t_volume_preview`）  
> 契约：`VolumePreviewRow` / `SpecPackRow` / `JobPipeline`

## 包

- `packages/core-engine`：规范包 groupKeys、组卷预览树、`t_volume_preview`。
- `packages/agent-runtime`：**本片不改**（A8 `submit_*` 禁名单保持）。回归跑测试即可。
- 禁止 Vue / Qdrant / Neo4j / 真实 LLM。无 design profile，不做 connect。

## 任务

1. **SQLite**  
   `sqlite-slice1.sql` 增加 `t_volume_preview` 及合同索引 `uk_t_volume_preview_preview_id` / `idx_t_volume_preview_job_id`。`LEDGER_TABLES` 纳入。re-export `VolumePreviewRow`。

2. **规范包分组配置**  
   Store：`updateSpecPackGrouping(packId, groupKeys, orderKey)`。  
   `JobPipeline.setGroupKeys(...)` 薄包装。`group_keys_json` 存 JSON 数组字符串。

3. **VolumeDesk（中台）**  
   新模块（如 `pipeline/volume.ts`）：`attachExtraction` / `previewVolume` / `getVolumePreview`。  
   分组纯函数可测：`buildPreviewTree(leaves, groupKeys, orderKey)` → tree 对象，**强制 `submitted: false`**。  
   `JobPipeline` 薄包装。preview 写 audit `volume_preview`。不写 Receipt、不改 Job 为 submitted。

4. **对话**  
   `appendChat(step=volume_preview)` 后预览仍 `submitted: false`，无新 Receipt。

5. **测试** `packages/core-engine/test/volume-preview.test.ts`  
   - A7：自定义 keys（如 `["zone","process"]` + `orderKey="seq"`）挂 ≥3 叶，树按 key 嵌套、组内有序；落库 `preview_id`；解析 `tree_json.submitted === false`  
   - 分组键名/树节点值不含预置「公路」「水利」「房建」默认卷名（测试自备键）  
   - chat 不提交  
   - 回归：`npm test -w core-engine` 与 `npm test -w agent-runtime` 皆 PASS  
   - `npx tsc -p packages/core-engine --noEmit`（agent-runtime 本片未改则仍建议跑一次）  
   PowerShell **不要用 `&&`**，命令分开跑。

6. **闭环**  
   `refresh_asset` / `register_asset` 用 `module=core-engine`，禁止落入 `frontend/packages`。  
   `register_contract`：`VolumePreviewRow`（若尚未登记）、`VolumeDesk` / `PreviewVolumeResult` 等新导出。  
   摘要须写明：preview 只写快照、`submitted` 恒 false、不写 Receipt。

## 完成定义

A7 覆盖；不宣称 connect done、不宣称产品整体 `/verify` 完成（程序 5/6）。
