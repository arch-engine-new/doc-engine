# RAG 本轮录入清单

- 时间：2026-09-19T04:35:34.636Z
- 引擎：**live**（http://127.0.0.1:5173）pack `pack_e978697d85124f75`
- 现行绑定：`sver_545924f5b96e4b20` 《员工请假说明 APT-ACCEPT-LIVE-20260919》
- Docker 对账：Postgres `t_clause`=4；Qdrant `clauses` points_count=4；Neo4j `:Clause`=4

## 文档

| 标题 | 来源 | 条款数 | version_id | 存储 |
|------|------|--------|------------|------|
| 员工请假说明 APT-ACCEPT-LIVE-20260919 | POST /api/standards/ingest `fixture://leave-accept-live` | 3 | `sver_545924f5b96e4b20`（现行绑定） | PG + Qdrant + Neo4j |
| accept-pdf APT-ACCEPT-LIVE-20260919 | POST /api/standards/ingest-pdf + tick | 1 | `sver_6b6d8c796608483d` | PG + Qdrant + Neo4j |

## Docker 向量库（Qdrant `http://127.0.0.1:6333` collection `clauses`）

| unit_id | file_name | chunk_kind |
|---------|-----------|------------|
| sver_545924f5b96e4b20:1.1 | leave-accept-live | clause |
| sver_545924f5b96e4b20:1.2 | leave-accept-live | clause |
| sver_545924f5b96e4b20:2.1 | leave-accept-live | clause |
| sver_6b6d8c796608483d:1.1 | accept-live.pdf | clause |

## Docker 图库（Neo4j bolt 7687）

- `:Clause` 节点：上述 4 个 id
- 边：`CITES` `sver_545924f5b96e4b20:1.2` → `sver_545924f5b96e4b20:1.1`

## 检索抽查（绑定请假说明后）

- **1.1** → 1 条 `exact`（页面路径标签「精确」）
- **事假** → 3 条 `vector`
- **APT-ACCEPT-LIVE-20260919** → 3 条 `vector`
- **1.2引用哪条** → 1 条 `graph`（命中 1.1）
