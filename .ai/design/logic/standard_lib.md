# page.logic — 标准库

## 元信息
- pageId: standard_lib
- feature: core-engine
- title: 标准库
- route: /packs/:id/standards
- pageType: list
- 本期：生产级 RAG + 图检索（必做，不降为 D10 加分）

## 操作明细
| 操作 | 触发 | 结果 |
|------|------|------|
| uploadDoc | 上传 PDF | StandardDoc + StandardVersion |
| ingestClauses | 入库完成 | Clause[]（按条款切，含父条标题） |
| indexVectors | 切片完成 | Qdrant 向量，键 = clause_id |
| indexGraph | 关系抽取/确认 | StandardEdge（CITES / SUPERSEDES / APPLIES_TO / REQUIRES） |
| searchSemantic | 简单问句 | 预查询改写 → 向量召回 → rerank → Clause[] |
| searchGraph | 跨条/引用/替代 | 图查询路径 + 命中 Clause[] |
| bindEffectiveVersion | 项目绑定 | 生效版；废止版不可作现行依据 |
| openStepChat | 检索命中后 | 就条款/引用链提问 |

## 主流程
1. 上传用户自己的标准 PDF（不预置公路/水利条文）。
2. **按条款切分** 写入 PostgreSQL（Clause），禁止纯 512 token 切。
3. 条款向量写入 Qdrant；引用/替代/适用写入 Neo4j。
4. 路由器：有条款号走关系库精确查；单条语义走向量+rerank；跨条/引用/替代走图。
5. 返回结果必须带 `clause_id` + `standard_version` + 原文 span。
6. RAG **定位条款**，不替代 DSL 硬规则；agent-runtime 只调检索 Tool，不持有三库。

## 查询路由
- 预查询模型：智谱 glm-5.3（改写、抽标准号/条款号/专业）
- Rerank：独立精排模型，禁止聊天补全当 rerank
- 复杂/跨相似度 → `searchGraph`

## 状态
empty / ingesting / indexed / error

## 依赖
- 实体：StandardDoc, StandardVersion, Clause, Chunk, StandardEdge
- 存储：PostgreSQL + Qdrant + Neo4j
- 验收：A11–A14
