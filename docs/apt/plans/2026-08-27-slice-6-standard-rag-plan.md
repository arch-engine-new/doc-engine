# SLICE-6 Standard RAG + Adapter Plan

> spec: `docs/superpowers/specs/2026-08-27-slice-6-standard-rag.md`  
> schema: `docs/schema/generated/core-engine-migration.sql`（`t_standard_*` / `t_clause` / `t_standard_edge`）  
> 契约：`ClauseRow` / `FindingRow` / `JobPipeline`

## 包

- `packages/core-engine`：条款账本、切分、检索路由、Qdrant/Neo4j **端口+生产 adapter+内存 adapter**、独立 rerank、mock 适配器。
- `packages/agent-runtime`：可选只读 `search_clause` Tool 工厂；**禁止**引入 qdrant/neo4j 依赖；禁止改调度器。
- 禁止 Vue。无 design profile，不做 connect。

## 任务

1. **SQLite 标准库四表**  
   `sqlite-slice1.sql` + `LEDGER_TABLES`：`t_standard_doc` / `t_standard_version` / `t_clause` / `t_standard_edge`（字段与生成合同一致，含 `qdrant_point_id`、边 `kind`）。  
   Store CRUD + `bindEffectiveVersion`。re-export 行类型。  
   `insertFinding` 增加可选 `clause_id` / `standard_version_id` / `retrieve_path`；默认仍 NULL，勿破坏 R1/R2 测。

2. **切分与入库**  
   `splitClauses(text)`：按条款标题切，单测证明不是 512-token 窗。  
   `StandardLibrary.ingest(...)` 写 PG 表 + 调 VectorStore.upsert（point=`clause_id`）+ GraphStore 节点。

3. **端口与生产 adapter（不可降级）**  
   - `VectorStore` / `GraphStore` / `Prequery` / `Reranker` / `Embeddings` 接口。  
   - `MemoryVectorStore` / `MemoryGraphStore` 供测试。  
   - `QdrantVectorStore`、`Neo4jGraphStore`：**真实客户端代码**（加 `@qdrant/js-client-rest` 与 `neo4j-driver` 依赖），无 env 时构造可抛「未配置」，但 **tsc 必须过**。禁止用 SQLite LIKE 冒充向量库。  
   - `IndependentReranker`：余弦或词面分；单元测试 spy 证明未调 `LlmProvider.complete`。  
   - `FakePrequery`：确定性改写/意图；`ZhipuPrequery` 可薄封装现有 llm 端口（仅预查询，不 rerank）。

4. **检索路由 `searchStandard`**  
   exact / semantic（向量+rerank）/ graph。过滤生效版本。返回路径边（A13）。audit `retrieve`。

5. **标准符合度 Finding**  
   只挂命中 `clause_id`。发明 id → 错误。废止版 → 错误。

6. **C4 mock 适配器**  
   OpenAPI + `mockPendingMount` + `commitAdapterWrite` 无回执失败。

7. **测试** `packages/core-engine/test/standard-rag.test.ts`（及 adapter / split 单测）  
   夹具：用户「请假/收货」级条款，**禁止**公路字样。覆盖 A11–A14、A9 retrieve、A15/A16、C4。  
   `npm test -w core-engine` 与 `npm test -w agent-runtime` 皆 PASS。  
   两包 `npx tsc -p … --noEmit` PASS。  
   PowerShell **不要用 `&&`**。

8. **闭环**  
   `refresh_asset` / `register_asset`：`module=core-engine`（及若改 runtime 则 `agent-runtime`），禁止 `frontend/packages`。  
   `register_contract`：`ClauseRow`、`StandardLibrary`、`SearchHit`、`AdapterReceipt` 等新导出。  
   摘要写明：三端口 + 独立 rerank + Finding 只挂库内 clause_id。

## 完成定义

A11–A14 + A9 本片增量 + A15/A16 + C4 覆盖。  
**不宣称** A10 connect `done`、不宣称产品整体 `/verify` 完成（Vue 未接）。本片 verify Overall 可 PASS，Notes 写明 A10 connect 未做。
