# SLICE-6 Standard Library + Audit + Mock Adapter Spec

**Slice:** 检索 the standard library and audit trail for Operator  
**Pages:** `standard_lib` / `audit_trace` / `check_findings`（本步对话壳）；不实现 Vue（无 design profile）  
**Contracts:** `StandardDocRow` / `StandardVersionRow` / `ClauseRow` / `StandardEdgeRow` / `FindingRow` @ `docs/schema/generated/core-engine-rows.ts`；`JobPipeline` 复用  
**Reuse:** `packages/core-engine` 账本与 HITL `appendChat`；`packages/agent-runtime` 仅可加只读检索 Tool 工厂，**禁止**持有三库、禁止改调度/HITL  
**Out:** Vue SPA、资料云实挂、公路/水利/房建条文预置、用聊天模型当 rerank、用 `.ai/arch/vectors.db` 当业务标准库、connect done 宣称

## 目标

用户上传**自己的**标准文本 → **按条款切分**入库（PostgreSQL 表名 / 测试 SQLite 同表）→ 向量进 **Qdrant 端口**（键=`clause_id`）→ 引用/替代进 **Neo4j 端口**。检索：预查询（glm-5.3 端口）→ 向量召回 → **独立 rerank**（禁止 chat complete）→ 只把库中命中的 `clause_id` 挂到标准符合度 Finding。跨条走图。生效版本钉死。Mock 适配器无 `receipt_id` 不算写入。`trace_id` 贯穿检索事件。对话不能覆盖 blocking / submit / publish / 发明条款号。

## 验收（本片）

| ID | 通过标准 |
|----|----------|
| A11 | 条款切分入库（非纯 512 token 切）；标准符合度 Finding 的 `clause_id` **必须**来自检索/图命中且存在于 `t_clause`；手写/LLM 发明条款号必须拒绝。Finding 带 `standard_version_id` + span + `retrieve_path`（`vector` \| `graph` \| `exact`）。 |
| A12 | 预查询改写 + 向量召回 + **独立 rerank**（rerank 实现不得调用 `LlmProvider.complete` / 聊天补全）；同条两种问法命中同一 `clause_id`。 |
| A13 | `CITES` / `SUPERSEDES` 等图查询返回边路径 + 命中条款。 |
| A14 | `bindEffectiveVersion`；`revoked`/`superseded` 不得作现行依据（检索与挂 Finding 均拒）。 |
| A9 | `listAudit(trace_id)` 含 extraction / rule_version / finding；本片检索/挂条款须有 audit（如 `event_type=retrieve`）。 |
| A15 | `appendChat` 在 `standard_lib` / `check_findings` / `audit_trace` 等 step 可落消息。 |
| A16 | 对话不能取消 blocking、不能 submit、不能 publish、不能把发明的条款号写入 Finding。 |
| C4 | OpenAPI 草稿 + mock `POST /adapter/pending-mount` 返回 `{receipt_id,status}`；无 `receipt_id` 的写入函数必须失败且不落账。 |

回归：A1–A8、A7 组卷、既有 agent-runtime 测试仍绿。

## 行为

1. SQLite 增表（对齐生成合同）：`t_standard_doc`、`t_standard_version`、`t_clause`、`t_standard_edge`。`LEDGER_TABLES` 纳入。re-export 行类型。
2. **切分：** `ingestStandard({ packId, title, fileUri, text, versionId, status })` 按条款标题/编号切（如 `第N条` / `N.N` 行首），写入 Clause（`heading` 含父条、`body`、`span_json`、`qdrant_point_id=clause_id`）。禁止按固定 token 窗口切。夹具用非行业说明文，**禁止**预置公路/水利/房建条文。
3. **端口（不可降级，禁止只做 SQLite FTS 冒充 RAG）：**
   - `VectorStore`：upsert/search；生产实现走 Qdrant（collection `clauses`，point id = `clause_id`）；测试用内存实现，**同一接口**。
   - `GraphStore`：upsert 节点/边、路径查询；生产实现走 Neo4j；测试用内存图。
   - `Prequery`：改写、抽条款号/意图（`exact` \| `semantic` \| `graph`）；生产可接智谱 glm-5.3；测试用确定性 Fake，**不得**用 Fake 结果当 rerank 分数。
   - `Reranker`：对召回候选打分排序；**禁止**聊天模型冒充。测试可用向量余弦/词面分，不得 `complete()`。
4. **路由：** 抽出条款号 → 关系库精确查；单条语义 → 向量 + rerank；跨条/引用/替代用语 → 图。结果必含 `clause_id` + `standard_version_id` + span。只检索 **生效版本**。
5. **挂 Finding：** `attachStandardFitFinding({ jobId, query, ruleVersionId? })` 只写检索命中的 `clause_id`。未知 id 抛错。DSL 硬规则 Finding（R1/R2）本片仍可无 clause_id。
6. **A14：** `bindEffectiveVersion(packId, versionId)` 写 `t_spec_pack.effective_standard_version_id`。废止版条款不得检索为现行、不得挂符合度 Finding。
7. **C4：** `docs/schema/generated/adapter-openapi.yaml`（或同等路径）含 `POST /adapter/pending-mount`。`mockPendingMount` 返回非空 `receipt_id`。`commitAdapterWrite(body, receipt)` 无 receipt 则拒绝且不写内存/表。
8. **agent-runtime：** 可选 `createSearchClauseToolHandler`（只读，回调中台检索）。禁止 `submit_*`。三库客户端不进 runtime 包。
9. **对话：** 已有 `appendChat`；补 A15/A16 测。审计页 step 只读，不改结论。

## 非目标

Vue connect、资料云实挂、真实 Qdrant/Neo4j 联调作为 CI 必过（CI 用内存端口；生产 adapter 必须存在且可编译）、产品级 A10 connect `done` 宣称、预置行业标准包。
