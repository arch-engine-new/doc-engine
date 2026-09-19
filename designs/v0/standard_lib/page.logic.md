# page.logic — 标准库

## 元信息
- pageId: standard_lib
- feature: core-engine
- title: 标准库
- route: /packs/:id/standards
- pageType: list
- 本期：生产级 RAG + 图检索（必做，不降为 D10 加分）；命中必须带出处（file_name / 页码 / unit_id / chunk_kind）
- 2026-09-17 refine：新增 `tickAll`（处理全部页）= 前端循环已有 `tick`，禁止全书一次 OCR
- 2026-09-19 refine F-1：点击命中行打开详情，展示 heading + body；出处列不塞全文；本步对话须引用正文

## 操作明细
| 操作 | 触发 | 结果 |
|------|------|------|
| uploadDoc | 选择 PDF（`<input type="file" accept="application/pdf">`）→ `POST /api/standards/ingest-pdf`（FormData: file, packId, title） | 202 + `ingest_run_id`；各页 status=`pending`；StandardDoc + StandardVersion |
| tick | 「处理一页」→ `POST /api/standards/ingest-runs/:id/tick` | ≤1 页；页 status = pending / ok / ocr_error / index_error（`.tag` 展示） |
| tickAll | 「处理全部页」（PrimaryButton） | 前端串行循环 `tick`，直到没有 `pending`；不新增全书 OCR 接口；请求次数 ≥ 页数；单次 tick 仍 ≤1 页。某一页 `ocr_error` / `index_error` 时继续其余 pending，已成功页不回滚 |
| ingestClauses | JSON textarea 夹具入库完成 | Clause[]（按条款切，含父条标题）+ layoutUnits；`tables_unlinked` 计数 |
| indexVectors | 切片完成 | Qdrant 向量，键 = `unit_id`；payload 含 file_name / page_start / page_end / chunk_kind |
| indexGraph | 关系抽取/确认 | StandardEdge（CITES / SUPERSEDES / APPLIES_TO / REQUIRES）；自动 PARENT_OF / BELONGS_TO / SUPPORTS |
| searchSemantic | 简单问句 | 预查询改写 → 向量召回 → clauseHits rerank、tableHits 不 rerank → 混合 RetrieveHit[] |
| searchGraph | 跨条/引用/替代 | 图查询路径 + 命中 RetrieveHit[] |
| openHitDetail | 点击命中行 | 详情面板展示 heading + body（表/附件展示 caption/单元格可读文本）；表格行仍只列出出处 |
| bindEffectiveVersion | 项目绑定 | 生效版；废止版不可作现行依据 |
| openStepChat | 检索命中后 | 就条款/引用链提问；回答须引用当前详情的 heading + body，不得只回 `clause_id` |

## 检索命中列
| 列 | 来源 | 规则 |
|----|------|------|
| file_name | `RetrieveHit.file_name` | 必填出处 |
| 页 | `page_start`–`page_end` | 页码列；同页只显示一个号 |
| unit_id | `RetrieveHit.unit_id` | 表/附件以此为身份，不得塞进 clause_id |
| clause_id | `RetrieveHit.clause_id` | `chunk_kind` 为 table / annex 或 `clause_id=null` 时显示 — |
| 路径 | `retrieve_path` | 向量 / 图谱 / 精确（字典 `retrieve_path`） |

RetrieveHit：`unit_id`、`chunk_kind`、`file_name`、`page_start`、`page_end`、`supported_clause_ids?`；`clause_id: string \| null`；详情另读 `heading` + `body`（或表/附件可读文本）。禁止把全文塞进每一行表格。

## 主流程
1. 上传用户自己的标准 PDF（不预置行业规范包）。保留 JSON textarea 夹具入库。
2. PDF 走 ingest tick：202 只登记 pending 页。可点「处理一页」(`tick`)，或点「处理全部页」(`tickAll`) 循环 `tick` 至无 pending（OCR 失败 `ocr_error`，向量/图失败 `index_error`；失败不整本回滚）。
3. **按条款/表/附件切分** 写入 PostgreSQL；禁止纯 512 token 切。表是一等 chunk（`chunk_kind=table`）。
4. caption / cell_ref 才能写 SUPPORTS；失败计入 `tables_unlinked`，禁止 proximity 连最近条款。
5. 条款/表向量写入 Qdrant；引用/替代/适用/层级/支撑写入 Neo4j。
6. 路由器：有条款号走关系库精确查；单条语义走向量+rerank（tableHits 不进 rerank）；跨条/引用/替代走图。
7. 返回结果必须带 `file_name` + 页码 + `unit_id` + `chunk_kind` + `standard_version` + 原文 span；条款命中另带 `clause_id`。
8. 用户点击命中行打开详情，阅读 heading + body（A18）。本步对话引用该正文。
9. RAG **定位条款**，不替代 DSL 硬规则；agent-runtime 只调检索 Tool，不持有三库。

## 查询路由
- 预查询模型：智谱 glm-5.3（改写、抽标准号/条款号/专业）
- Rerank：独立精排模型，禁止聊天补全当 rerank；tableHits 跳过 rerank
- 复杂/跨相似度 → `searchGraph`

## 状态
- 库：empty / ingesting / indexed / error
- 页 tick：pending / ok / ocr_error / index_error
- tickAll 进行中：ingesting（仍按页推进，禁止一次吃完全书）
- 命中详情：closed / open（选中一行）

## 依赖
- 实体：StandardDoc, StandardVersion, Clause, Chunk, LayoutUnit, StandardEdge, IngestRun, IngestPage
- 存储：PostgreSQL + Qdrant + Neo4j
- 验收：A11–A14、A17、A18；出处列 M2b/R2/R25
