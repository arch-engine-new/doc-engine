# APT 批量队列（$apt-intake 生成）
> 生成：2026-09-19T15:25:00+08:00｜共 1 项（P1 0 / P2 1 / P3 0）｜截图归档 .apt/batch/screenshots/
> 旧批归档：.apt/batch/archive/2026-09-19-f1-hit-detail/ ；goal 归档 .apt/goal-archive/2026-09-19-batch-f1.md
> ID 接续：F-2（F-1 已 loopDone，不回收）

## F-2
- 类型：需求
- 优先级：P2
- 标题：live 标准检索改用百炼 text-embedding-v3，替换 HashEmbeddings
- 收敛记录：
  - 所属页：standard_lib（检索入库/召回面；实现主改 `packages/core-engine` retrieve）
  - 目的：Qdrant 里的条款向量用大模型 embedding 计算，让问句与条文在语义空间对齐，不再用 48 维哈希冒充生产召回。
  - 边界：
    - 做：live `RetrievePorts.embed` 接 DashScope 兼容模式 `text-embedding-v3`（`baseUrl=https://dashscope.aliyuncs.com/compatible-mode/v1`，密钥只读环境变量 `DASHSCOPE_API_KEY`，禁止写进源码/队列/PRD）；允许把 `Embeddings.embed` 改为 async；维度与现网 48 维不兼容则**重建** Qdrant collection `clauses` 并从 Postgres 条款账本重嵌入现有点；live rerank 与入库共用同一 embedding 端口，避免和 Qdrant 向量空间不一致。
    - 不做：不用聊天补全当 embedding/rerank；不把 APT `.ai/arch/vectors.db` 当业务库；不改检索路由算法（exact/graph 仍可用）；不改 DSL 硬规则；不发明条款号；CI 单测默认仍可用 `HashEmbeddings`；不改其它 8 页交互。
  - 验收：
    1. live 入库后 Qdrant `clauses` 点向量维度等于 v3 返回维度（非 48），payload 仍含 `unit_id`/`file_name`/`chunk_kind`
    2. 用自然语言问句（如「事假要提前吗」）与条款号「1.1」都能命中同一 `clause_id`（A12 语义）
    3. 源码与 git 中不含百炼 apiKey；缺 `DASHSCOPE_API_KEY` 时 live 显式失败，不静默回退 Hash
- 截图：无
- 分流：全链
- 测试策略：accept-batch（批末统一，默认）
- 验收：待验收
- 验收标准摘要：live Qdrant 维度=v3；语义问句与「1.1」命中同一 clause_id；密钥不入库且缺 key 不回退 Hash
- 确认：已确认（用户原文 `/apt-intake` 指定百炼 compatible-mode + `text-embedding-v3`）
- 泊车：无
- 依赖：无
- mergedFrom：本轮用户口述「将 embedding 转成大模型 embedding」
