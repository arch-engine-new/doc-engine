---
title: 工程化 RAG：可信源（文件/页）+ 版式单元（条款/表）+ 图关联
date: 2026-09-15
status: draft
risk: high
phase: spec_pending_approval
topic: rag-ingest-metadata-graph
mode: apt-auto-brainstorm
feature: core-engine
parentSpec: docs/superpowers/specs/2026-08-27-slice-6-standard-rag.md
pages:
  - standard_lib
redteam:
  rounds: 3
  material: 15
  resolved: 15
  user: 0
  unresolved: 0
---

# Design Spec: 工程化 RAG（可信源 + 表/条款图）

## Goal

把标准库从「能切条款、能向量召回」补成可审计的工程化 RAG：

1. **可信源**：每条向量与每次检索命中都能回到「哪份文件、哪一页、哪一单元」，而不是只给 `clause_id`。
2. **版式单元**：法律法规正文按条款切；**表格（及附录块）作为独立知识单元**入库，一张表可图连接到多条法规。
3. **图不只是手点边**：入库自动写层级/归属/表支撑；引用边只连**库内已存在**的目标，禁止 LLM 发明条款号。
4. 操作员把自己的 PDF（含仓库 `rules/` 公路评定标准）从**标准库页**入库。不把公路条文写进 seed。

成功标准见需求锁定表 R1–R12、R16–R25 与验收 M1–M12。

## 红队 round 1 设计 delta（写入正文，禁止口头化解）

对照 `.apt/redteam/2026-09-15-rag-ingest-metadata-graph.md` 11 条原文，本片做如下条款级修改（[a] 结案）：

| # | finding | delta |
|---|---------|--------|
| D1 | M3 不锁检索、`getClause` 丢表 | `searchSemantic` **先** `getLayoutUnit(point.payload.unit_id)`，禁止只 `getClause(item.id)`。M3 必须断言 `searchStandard` 返回 `chunk_kind=table` 且 `supported_clause_ids` 含两条条款。仅 Neo4j 有边不算过。 |
| D2 | `recognize` 必 flatten | 标准入库 **禁止** 调用 `OcrPort.recognize`。新增 `OcrPort.recognizeLayout` → 返回未拍平的 VL `markdown.text`。Job 检查链路继续 `recognize`+`flattenOcrMarkdown`。 |
| D3 | 跨标准被降成本 pack | `CITES`/`SUPPORTS` 目标 = **同一 project 下任意 pack 已入库且 effective 的条款**。未入库仍禁止幽灵节点。无第二份文件时用**第二 pack 夹具**测跨标准，不靠公路第二册 PDF。 |
| D4 | 1:N 进不了 Finding | `attachStandardFitFinding` 在表命中时对每条 SUPPORTS 条款 **各写一条 Finding**（上限 20），每条 `clause_id ∈ t_clause`（满足 A11 单列），`detail.source` 同一张表。返回 `FindingRow[]`。禁止只 `hits[0]` 丢其余条款。 |
| D5 | 「表 8.5.1-1」被打成 exact | `Prequery`：问句匹配 `表`/`附表`/`见表` → `intent=semantic`（或 `layout`），**不得**把表号收成条款号走 `searchExact`。`FakePrequery` 与实挂同一规则。 |
| D6 | Qdrant 把表 id 回填成 clause_id | payload **必填** `unit_id`；`chunk_kind=table` 时 **禁止** 写 `clause_id` 或写 `null` 且 `originalPointId` **只认** `unit_id`。`RetrieveHit.clause_id` 对表命中为 `null`；UI 用 `unit_id`。`attachHit` 收到表 `unit_id` 当 clause_id 必须抛错。 |
| D7 | Graph 只 MERGE Clause；A13 被 PARENT_OF 污染 | `GraphStore.upsertNode(label, id, props)`；`upsertEdge` 按端点 label 连接，禁止把 LayoutUnit MERGE 成 `:Clause`。`searchGraph` / A13 **必须带 `kind`**（CITES/SUPERSEDES/…），默认查询排除 `PARENT_OF`。HTTP `/api/standards/edges` 与 dict 增加 `SUPPORTS`/`PARENT_OF`/`BELONGS_TO`。demo reset 同时删 `:LayoutUnit`。 |
| D8 | M3 夹具 cell_ref 假绿、OCR 后 1:1 | 已被 **D12** 取代：禁止自动 proximity；M3 只用 recognizeLayout 竖线 + caption/cell_ref≥2。 |
| D9 | 202 无消费者 | 实现 `packages/core-engine/src/retrieve/ingest-worker.ts`。`POST /api/standards/ingest-pdf` → 202 + `ingest_run_id`（只建 run 与 `t_ingest_page` pending）。消费方式：**pull tick**（非 Temporal）：`POST /api/standards/ingest-runs/:id/tick` 每次最多 1 页。M8 必须用 **≥2 页**夹具且第 2 页注入失败，断言第 1 页仍在库；禁止 1 页同步成功冒充续跑。 |
| D10 | 直接改 vue 绕开 refine | **切片 0（门禁）**：`$apt-create --refine` 更新 `designs/v0/standard_lib/page.logic.md` 与 `_pages.md` 该页 `approved=no`。在此之前 **不得** 把 `index.vue` 列入可提交实现。M2 依赖 refine 后的列定义。 |
| D11 | 绕开 Job 后仍整本 OCR | 新增 `packages/core-engine/src/ocr/pdf-raster.ts`：`renderPdfPagePng(bytes, pageNo)`。无文字层页把 **单页 PNG** 交给 `recognizeLayout`。禁止把整本 PDF bytes 交给 Paddle（50MB 闸按页图，不按全书）。有文字层走 `extractPdfUnicodePages`，禁止本路径 `mergePages:true`。M6/M10 之外增加 M11：单测断言 Paddle/OCR 入参不是原 PDF 全书。 |
| D12 | 脏 OCR + proximity 冒充 1:N | **禁止自动 proximity SUPPORTS。** caption/cell_ref 失败的表入库为 `tables_unlinked`，只允许 `manual` 边。本片不宣称扫描脏文本自动 1:N；那是 R15（LLM 建议边，nice）。M3 仍要求 `recognizeLayout` 保留 `\|` 且 caption/cell_ref≥2。 |
| D13 | rerank 把表打成条款再 hits[0] | 对照表 #8 改为：`RerankCandidate` **只接受 chunk_kind=clause**（`clause_id: string` 不变）。table unit **不进 rerank**。`searchSemantic` 返回 `tableHits`（按向量分）+ `clauseHits`（rerank 后）。`attachStandardFitFinding`：topK 内若存在 tableHit，用向量分最高的那张表走 N 条 Finding；否则用 rerank 后首条条款。M13：ingest VL 表后，对表题 query 调 `attachStandardFitFinding`，返回数组 length≥2 且 id 互异（全链，禁止合成 tableHit）。 |
| D14 | index_error 不在枚举 | `t_ingest_page.status` = `pending` \| `ok` \| `ocr_error` \| `index_error`。向量/图写入失败用 `index_error`，禁止记成 `ocr_error` 或 `ok`。 |
| D15 | 跨 pack 边建了检索丢 | `searchGraph` 与 CITES/SUPPORTS 展开用 `resolveProjectEffectiveVersionIds(projectId)`，不得用单 pack `versionIds` 丢掉跨 pack 目标。M12 增加：从 packA 查询能 `retrieve_path=graph` 命中 packB 条款。 |

## 工程化 RAG 对照（标准要求 vs 用户要求 vs 现网）

对照业界工程化 RAG 的常见硬能力（Microsoft Azure AI Search / LlamaIndex production patterns / GraphRAG：citation、structure-aware chunking、metadata filters、grounding、versioning、eval），以及本仓冻结验收 A11–A14。

| # | 工程化能力 | 用户本轮 | 现网（查证） | 本片 |
|---|------------|----------|--------------|------|
| 1 | 向量召回 | 要，但不够 | `searchSemantic` + Hash 48 维 | 保留端口；**不换 embedding** |
| 2 | **Citation / 可信源**（文件、页、单元 id） | **明示必须** | `RetrieveHit` 仅 `clause_id` + `standard_version_id` + 字符 `span`；Qdrant payload 仅 `{clause_id, versionId}` | **必须做** |
| 3 | 结构感知切分（非 512 token 窗） | 法规条款 | `splitClauses` 行首 `第N条`/`N.N` | 保留条款切，并加表/附录单元 |
| 4 | **表格/多模态块** | **明示**：表可能对应多条法规 | OCR 资料链路 `flattenOcrMarkdown` **拆掉表格竖线**；标准 ingest 无表单元 | **必须做**（表为独立单元 + 图 1:N） |
| 5 | 图多跳（表↔条款、条↔条、跨标准） | **明示要图** | Neo4j 仅 `Clause`；边靠 UI；`PARENT_OF` 不入库 | **必须做**自动层级/归属/SUPPORTS；CITES 目标为同 project 已入库生效条款（跨 pack 可以，未入库不行） |
| 6 | 只引用库内 id（grounding） | 与 A11 一致 | `attachHit` 拒发明 `clause_id` | **保持**；表 id **不得**写入 `Finding.clause_id` |
| 7 | 生效版本 / 废止 | A14 已有 | `bindEffectiveVersion` | 保持 |
| 8 | 预查询 + 独立 rerank | A12 | FakePrequery + IndependentReranker（禁 chat complete） | 条款候选才 rerank；**table 不进 `RerankCandidate`**；符合度优先最高分 tableHit 写 N 条 Finding |
| 9 | 混合检索 BM25 + dense | 未要求 | 无 | **本片不做**（Hash 维下 BM25 更有意义，但与可信源正交） |
| 10 | 生产 embedding / 交叉编码器 | 未作为本轮阻塞 | HashEmbeddings | **本片不做**（见方案「为何不选最贵机制」） |
| 11 | 入库谱系 / 断点续跑 | 85MB 扫描件隐含 | 无 `ingest_run` / 页状态 | **必须做**按页状态，失败页不丢已成功页 |
| 12 | ACL / 多租户 | 未要求 | 无 | 不做 |
| 13 | RAGAS 离线评测集 | 未要求 | 单测 A11–A14 | 本片用探针断言 payload/图/UI 列，不上评测平台 |
| 14 | 插图/CAD | 「其它」 | 无 | 附录块 `annex` 可入库 markdown；CAD 仍冻结不做 |

结论：用户要的不是「再做一个向量库」，而是 **citation-first RAG + 版式异构单元 + 图上的多对多**。现网 SLICE-6 只覆盖了条款账本与端口形状。

## 范围

- 扩展 `StandardLibrary.ingest`：必写 provenance；自动图边。
- 新增版式切分：`clause` / `table` / `annex`。
- 检索命中与标准库 UI 展示文件名、页码、单元类型。
- 标准 PDF 入库通道（不走资料 Job 4MB）。
- `rules/` 操作员文件可 ingest；无第二份公路 PDF 时只入这一本。
- 含 UI：只改冻结页 `standard_lib`，不加第 10 页。**切片 0 未完成 refine 前禁止改 `index.vue`。**

## 非目标

- 智谱/OpenAI embedding、真 rerank HTTP、BM25 混合检索。
- 把公路/水利/房建条文写入 `demo/reset` seed。
- 放开资料 Job `MAX_UPLOAD_BYTES=4MB` 去传全书。
- 用聊天模型抽边或发明 `clause_id` / 表–条款关系。
- 从互联网抓取《公路法》等受版权全文。
- 发明 Paddle job DELETE；把 85MB 一次 POST 给 OCR jobs。
- 资料检查链路改回保留 VL 表格竖线（`flattenOcrMarkdown` 仍只服务 `parseOcrFields`）。
- Temporal、资料云实挂、CAD。

## 现网缺口（查证，禁止凭记忆）

| 点 | 证据 | 缺口 |
|----|------|------|
| ingest 入参 | `IngestStandardInput` = `packId, title, fileUri, text`（`query_contract StandardLibrary`） | 无页、无文件名列、无 PDF bytes |
| 向量 payload | `library.ts` upsert `{ clause_id, versionId }`；`QdrantVectorStore` 原样写入 | 无 `file_name` / `page_*` / `chunk_kind` |
| 命中契约 | `RetrieveHit`：`clause_id, standard_version_id, span, retrieve_path, path?` | 无可信源字段；`span` 为字符偏移 |
| UI | `apps/web/src/views/standard_lib/index.vue` textarea + `POST /api/standards/ingest`；命中表四列无文件/页 | page.logic 已写 `uploadDoc`，实现缺失 |
| 切分 | `splitClauses` 只认行首条款号 | 表格并进相邻条款 body 或丢失 |
| 图 | `EdgeKind` = CITES\|SUPERSEDES\|APPLIES_TO\|REQUIRES；`Neo4jGraphStore.upsertEdge` 只 MERGE `:Clause` | 无表节点；无自动 PARENT_OF |
| OCR 表 | `flattenOcrMarkdown` 把 `\|` 换成空格 | **不得**用于标准入库 |
| PDF 页 | `extractPdfUnicodeText` `mergePages: true` | 无页码 |
| HTTP | 仅 `/api/standards/ingest` JSON text | 无 PDF 通道 |
| 体积 | Job 4MB；`rules/` 公路册约 85.7MB 且汉字文字层为 0 | 必须按页 OCR，且不走 Job |

`query_design(page=standard_lib)`：操作含 `uploadDoc` / `indexGraph`；`blockingGaps: no-implementation-ref`。设计意图已有，实现未接。

## 方案（≥2 机制类）

### 方案 A — 静态闸门（payload 门禁）

入库仍按条款切。`VectorStore.upsert` **拒绝**缺少 `file_name`、`page_start` 的 point。检索 UI 加两列，数据从 PG 补。

- 优点：改动面相对小，测试夹具可造 `file_name=fixture://leave`、`page=1`。
- 缺点：表格问题原样存在；图仍手点。
- 隐藏成本：门禁一上，旧 live Qdrant 点会检索不到或 upsert 失败，要迁移或重建。
- 失败模式：表被拼进条款 body，检索「表 8.5.1-1」命中错误条，无法 1:N。
- 依赖：现有 `StandardLibrary.ingest`、`RetrieveHit` 扩展。
- 机制类：**静态闸门**。

### 方案 B — 流程重组（版式单元流水线 + 自动图）**【推荐】**

PDF/文本 → 按页保留 markdown → 切 `clause`/`table`/`annex` → PG 账本 + Qdrant（完整 payload）+ Neo4j（条款节点、表节点、自动边）。表命中经 `SUPPORTS` 展开为条款再挂 Finding。

- 优点：对齐用户「可信源 + 表对多条法规 + 图」；与 A11「Finding 只挂条款」不冲突。
- 缺点：图式、切分、HTTP、UI 都要动，文件数 > 8。
- 隐藏成本：armed 页须 refine；全书 OCR 时长与 Paddle 限流；切分规则对扫描件版式敏感。
- 失败模式：表标题/单元格识别失败 → **0 条 SUPPORTS**，`tables_unlinked`，等手补；不得自动连页内最近条款。
- 依赖：`OcrPort`/`PaddleOcr`（按页）、`unpdf` 按页、`GraphStore` 扩展节点标签、`LedgerStore` 增表/增列。查证：`OcrPort`、`extractPdfUnicodeText`、`Neo4jGraphStore` 均已存在。
- 机制类：**流程重组**（辅以方案 A 的 upsert 门禁）。

### 方案 C — 行为证据（LLM 抽实体与边）

全书 OCR 后丢给 glm 抽条款/表/CITES/SUPPORTS。

- 优点：复杂引用、跨册「见表×」理论上更能覆盖。
- 缺点：与 A11/A16「禁止发明条款号」冲突；扫描件幻觉不可审计；85MB 成本高。
- 隐藏成本：要人工审边队列，否则错误边进入检查 Finding。
- 失败模式：模型编造未入库的 JTG 3650 条款号并写成 CITES。
- 依赖：`ZhipuLlmProvider`；本仓明确禁止聊天模型当 rerank / 发明条款。
- 机制类：**行为证据**（最贵真机制）。

**最强反方（打推荐 B）**：没有真 embedding 和 LLM 抽边，所谓「工程化 RAG」仍是哈希向量 + 正则图，公路评定书检索会语义不准。

**回应**：用户本轮阻塞项是 **citation 与表的多对多图**，不是召回模型。A12 已要求独立 rerank、禁止 chat 当 rerank。Hash 不准时，exact 条款号与图路径仍可用；embedding 单独立项。B 被攻后仍成立，因成功标准可在 Hash 下用夹具判定（文件名/页/SUPPORTS），不依赖语义模型质量。

**为何最贵机制 C 不是默认**：法律依据链必须可复现。LLM 边无法在 `t_clause` 存在性上自证，且与冻结「禁止发明条款号」同向冲突。C 的抽边最多作为**以后**「建议边、默认不生效」的可选层，本片不入库自动生效。

**锁定推荐：B + A 的 upsert 门禁。**

## 设计

### Architecture

```
operator PDF / 文本夹具
        │
        ▼
 StandardIngest (独立于 JobPipeline 4MB)
        │  POST ingest-pdf → 202 + ingest_run_id（只登记页）
        │  tick 每次 1 页：
        │    Unicode 文字层 → extractPdfUnicodePages(page)  （禁止 mergePages:true）
        │    无文字层 → pdf-raster.renderPdfPagePng → OcrPort.recognizeLayout
        │               （禁止 recognize / flattenOcrMarkdown / 整本 PDF bytes）
        ▼
 LayoutSplit：clause | table | annex
        │
        ├─► PostgreSQL  t_standard_doc / t_standard_version / t_clause
        │               t_layout_unit / t_layout_edge / t_ingest_page
        ├─► Qdrant collection `clauses`（历史名保留；身份字段 unit_id）
        │               payload 门禁：file_name, page_start, page_end, chunk_kind, unit_id
        └─► Neo4j  (:Clause) (:LayoutUnit {kind}) (:StandardDoc) (:StandardVersion)
                    PARENT_OF / BELONGS_TO / SUPPORTS / CITES(同 project 已入库)

检索：prequery（见表/表号 → semantic，禁止收成 exact 条款号）
      → exact | vector | graph(kind 必填，按 project 生效版本)
  vector：getLayoutUnit(unit_id) → tableHits（不 rerank）+ clauseHits（IndependentReranker）
  attachStandardFitFinding：优先最高分 tableHit → N 条 Finding
```

资料 Job 与标准入库隔离。Agent `search_clause` 仍只读 `searchStandard`，响应带 provenance，仍不 `attachHit`。

### Components

| 组件 | 职责 |
|------|------|
| `extractPdfUnicodePages` | 新：`unpdf` **按页**抽字（禁止本路径 `mergePages:true`） |
| `renderPdfPagePng` | 新文件 `ocr/pdf-raster.ts`：单页光栅化，入参给 `recognizeLayout` |
| `OcrPort.recognizeLayout` | 新：返回未拍平 markdown；Job 仍用 `recognize` |
| `ingest-worker.ts` | tick 每次最多 1 页；无 Temporal |
| `splitLayoutUnits` | 条款沿用 `splitClauses` 思路；GFM/VL 表块切 `table` |
| `assertVectorPayload` | upsert 静态闸门；表点禁止回填 clause_id |
| `Prequery` | 见表类问句不得 exact |
| `GraphStore.upsertNode` | LayoutUnit 不得 MERGE 成 Clause |
| `searchStandard` | 先 layout unit；表带 `supported_clause_ids` |
| `attachStandardFitFinding` | 表命中写 N 条 Finding，返回数组 |
| HTTP ingest-pdf / tick | 202 + pull 消费 |
| `standard_lib` UI | **仅切片 0 refine 之后** |

### 数据模型

#### 向量 payload（每个 Qdrant point **必填**，缺一 upsert 失败）

| 字段 | 说明 |
|------|------|
| `unit_id` | 稳定主键；条款时等于 `clause_id`；**回读身份只认此字段** |
| `chunk_kind` | `clause` \| `table` \| `annex` |
| `clause_id` | `chunk_kind=clause` 必填且等于 `unit_id`；**`table`/`annex` 禁止出现此键或必须为 JSON null，实现不得用 point.id 回填** |
| `versionId` | 已有 |
| `file_name` | 原文件名，非空 |
| `page_start` / `page_end` | 1-based 闭区间，`page_start ≥ 1` 且 `page_end ≥ page_start` |
| `clause_no` / `heading` / `caption` | 条款号或表题 |
| `doc_title` / `pack_id` / `source_uri` | 标准名、包、对象位置 |
| `ingest_run_id` | 本次入库 |
| `link_method` | 表边：`caption` \| `cell_ref` \| `manual`（**无** `proximity`） |

#### PostgreSQL

`t_clause` **显式列**（不要只塞 `span_json`）：`file_name`, `page_start`, `page_end`。`span_json` 可继续存字符偏移作辅助。

新建：

- `t_layout_unit`：`unit_id`, `version_id`, `chunk_kind`, `clause_id` (nullable), `file_name`, `page_start`, `page_end`, `heading`, `body_markdown`, `qdrant_point_id`
- `t_layout_edge`：`from_unit_id`, `to_unit_id`, `kind`, `link_method`, `confidence`（正则/邻近用固定值如 1.0 / 0.5，**不用 LLM 分**）
- `t_ingest_page`：`ingest_run_id`, `doc_id`, `page_no`, `status` (`pending`/`ok`/`ocr_error`/`index_error`), `error`

`t_standard_edge` 仍服务条款–条款手补边（CITES 等），与 `t_layout_edge` 并存。自动 PARENT_OF 写 Neo4j + `t_layout_edge`（from 子条款 unit → to 父条款 unit 或反向须在实现里固定一种，测试锁死 **父 `PARENT_OF` 子**）。

#### 图

节点：

- `(:StandardDoc {doc_id, file_name, title})`
- `(:StandardVersion {version_id, status})-[:OF_DOC]->(:StandardDoc)`
- `(:Clause {id, clause_no, file_name, page_start, page_end, versionId})`
- `(:LayoutUnit {id, kind, file_name, page_start, page_end, versionId})`

边（入库自动，允许随后手补）：

| 关系 | 规则 |
|------|------|
| `BELONGS_TO` | Clause/LayoutUnit → StandardVersion |
| `PARENT_OF` | 条款号层级 `8.5.1` 的父 `8.5` |
| `SUPPORTS` | **表 → 多条款**（用户核心场景） |
| `CITES` | 正文/表单元格匹配「第 X 条 / X.X / 本标准第…」且目标条款已在 **同一 project** 入库且 status=effective（允许跨 pack）；禁止幽灵节点 |
| `SUPERSEDES` / `REQUIRES` / `APPLIES_TO` | 仍可手补；本片不自动猜 |

`GraphStore.queryPath(from, kind)` 的 `kind` **必填**（A13 回归传 `SUPERSEDES`/`CITES`）。无 kind 的重载若保留，**不得**被 `searchGraph` 使用。层级浏览另走 `queryPath(from, "PARENT_OF")`。

表连条款的确定性顺序（禁止 LLM）：

1. 表题/表号 `表 8.5.1-1` → 条款 `8.5.1`（`caption`）
2. 单元格出现已入库条款号（`cell_ref`），**一条表可连多条**
3. **不自动 proximity。** caption/cell_ref 都失败 → 表入库、无 SUPPORTS、状态/计数 `tables_unlinked`，等 `manual`。
4. 操作员 UI 手补（`manual`）

#### `RetrieveHit`（加法）

| 字段 | 条款命中 | 表命中 |
|------|----------|--------|
| `unit_id` | = clause_id | 表 unit |
| `chunk_kind` | `clause` | `table` |
| `clause_id` | string | **`null`**（禁止把 unit_id 填进来） |
| `supported_clause_ids` | 可省略 | SUPPORTS 目标列表 |
| `file_name` `page_start` `page_end` | 必填 | 必填 |
| 旧字段 span / retrieve_path / path | 保留 | 保留 |

`attachHit(clause_id)`：id 必须存在于 `t_clause`。传入 table `unit_id` → 抛错（M4）。

`attachStandardFitFinding`：先看本次 `searchStandard` 的 **tableHits**（vector 分排序）。若非空，取最高分表，对 `supported_clause_ids` 逐条 `attachHit`，返回数组（上限 20），`detail.source` 复制该表 provenance。若 tableHits 为空，再用 `clauseHits[0]`（rerank 后）写 1 条。禁止把 table `unit_id` 放进 `RerankCandidate.clause_id`。M13 覆盖此全链。

现有只返回单个 `FindingRow` 的调用方改为处理数组。

### Data flow

1. `POST /api/standards/ingest`（JSON text）继续给请假夹具 / 单测。必须写入 provenance；无 PDF 时 `file_name` = URI basename，`page_start=page_end=1`，夹具中的 GFM 表仍走 `splitLayoutUnits`。
2. `POST /api/standards/ingest-pdf`（multipart：`file` + `packId` + `title`）：落 MinIO（memory 可跳过 blob）；**只创建** `ingest_run` 与每页 `pending`，返回 **202** `{ ingest_run_id }`。随后 UI/测试反复 `POST /api/standards/ingest-runs/:id/tick`，每次处理 ≤1 页（文字层抽字或光栅化+`recognizeLayout`）。全程不把全书 PDF 交给 Paddle。
3. 每页成功：切单元 → upsert PG/Qdrant/Neo4j。向量失败则该页 `index_error`，已成功页保留。
4. 检索：见表问句走 semantic；**graph / SUPPORTS / CITES 展开按 project 生效版本**，不得用单 pack 列表丢掉跨 pack 目标。UI（refine 后）与 `search_clause` 结果含文件名+页；表命中 `clause_id=null`。
5. 标准符合度：tableHits 非空则 N 条 Finding；0 条 SUPPORTS 的表不写、不编造。

### Error handling

| 情况 | 行为 |
|------|------|
| payload 缺 `file_name` 或页码非法 | upsert 抛错，该单元不入 Qdrant |
| 页 OCR 失败 | 记 `t_ingest_page.status=ocr_error`，继续其它页 |
| Paddle 10010/429 | 与现网一致：提示队列繁忙，不静默 FakeOcr |
| 引用指向未入库条款 | **不建边**，可把原文记入 unit 的 `unresolved_refs`（可选 JSON），禁止幽灵 `clause_id` |
| 表 0 条 caption/cell_ref SUPPORTS | **不**自动 proximity；表可检索；不 attach；计入 `tables_unlinked` |
| 向量/图写入失败 | `t_ingest_page.status=index_error`，不得记 `ocr_error`/`ok` |
| 缺 Paddle token 的扫描标准 PDF | tick 该页 `ocr_error`；禁止 FakeOcr 入库 |
| tick 时传入整本 PDF 给 OCR | 实现错误；M11 覆盖 |

### Testing

- 单元：请假 JSON 夹具含 GFM 表，单元格 `1.1` 与 `2.1` → table unit + 两条 SUPPORTS；**并且** `searchStandard("见表")` 命中该表（不得只查 Neo4j）。
- 单元：VL markdown 夹具（含 `\|` 表）走 `recognizeLayout` **不得**经过 flatten；M3 用此夹具，不用 proximity。
- 单元：问句 `表 8.5.1-1` 的 FakePrequery intent ≠ exact。
- 单元：两页 tick；第 2 页失败；第 1 页向量仍在（M8）。
- 闸门：table payload 若被写成 `clause_id=unit_id` 则 upsert 失败。
- 回归 A11–A14、A16：每条 Finding.clause_id ∈ `t_clause`；一次表 attach 产生 ≥2 Finding。
- A13：`searchGraph` 传 kind=SUPERSEDES，命中不被 PARENT_OF 末跳替换。
- Job 4MB 回归。
- M11：recognizeLayout/Paddle 入参 size < 原 PDF；mime 为图像。
- **禁止**「spy ingest 不调用 flatten」作为 M7 唯一证据。

## 验收

| ID | 通过标准 |
|----|----------|
| M1 | 任意新 upsert 的向量 payload 含非空 `file_name`、`page_start≥1`、`chunk_kind`、`unit_id`；table 点无回填 `clause_id` |
| M2 | `searchStandard` JSON 含 `file_name`+页+`unit_id`；表命中 `clause_id=null`（不依赖 vue） |
| M2b | 切片 0 refine 完成后：标准库表展示与 M2 相同列 |
| M3 | `recognizeLayout` 保留 `\|` 的表 + caption/cell_ref 使 `searchStandard` 返回 table 且 `supported_clause_ids.length≥2`；**禁止**仅 Neo4j 或仅 proximity |
| M4 | `attachHit` 拒绝 table `unit_id`；表符合度改为 N 条 Finding 且每条 `clause_id∈t_clause` |
| M5 | 入库自动 `PARENT_OF`；A13 `searchGraph(kind=SUPERSEDES)` 不被 PARENT_OF 末跳替换 |
| M6 | JSON ingest 仍绿；PDF 通道不经过 Job 4MB |
| M7 | 标准入库调用 `recognizeLayout` 不经过 flatten；Job 仍 flatten |
| M8 | ≥2 页 tick；第 2 页失败；第 1 页向量仍在（禁止 1 页同步冒充） |
| M9 | 不预置公路 seed；只 ingest 操作员文件 |
| M10 | 资料 Job 仍拒 85MB |
| M11 | OCR/Paddle 入参为单页图，不是原 PDF 全书 |
| M12 | 问句「表 8.5.1-1」prequery intent ≠ exact；同 project 第二 pack 夹具可建 CITES **且**从 packA `searchGraph` 命中 packB 条款 |
| M13 | ingest VL 表后，对表题调用 `attachStandardFitFinding`，返回 ≥2 条互异 `clause_id`（经 searchSemantic，禁止手工合成 tableHit） |

## 拟改动文件（>8 → high）

切片 0（必须先于 vue）：`designs/v0/standard_lib/page.logic.md`、`designs/v0/_pages.md`（经 `$apt-create --refine`）。

引擎：`ports.ts`（含 `recognizeLayout`、`RetrieveHit.clause_id` 可空、`GraphStore.upsertNode`），`library.ts`，`prequery.ts`，`layout-split.ts`，`qdrant.ts`（`originalPointId`），`neo4j.ts`，`memory-*`，`pdf-text.ts`（按页），**`ocr/pdf-raster.ts`**，**`retrieve/ingest-worker.ts`**，`paddleocr.ts`（只给 recognizeLayout 未拍平分支，Job 路径不动 flatten），`handle-request.ts`（ingest-pdf + tick），ledger/migrate/schema/rows，dicts，session reset cypher，retrieve 测试。

`index.vue` / `types.ts`：**不在切片 0 完成前提交。**

## Ontology detection

| 调用 | 结果 | 复用决策 |
|------|------|----------|
| `query_ontology()` | core-engine retrieve 资产、`StandardLibrary`/`RetrieveHit`/`EdgeKind` 已登记 | 复用编排，不新起 RAG 包 |
| `query_ontology(retrieve)` | `splitClauses`、`liveRetrievePorts`、禁止静默 MemoryVector | **复用** live 端口；扩展 payload 而非换 collection 名 |
| `query_ontology(standard_lib)` | 设计页存在；实现缺口 | UI 在本页补，不新页 |
| `query_contract(StandardLibrary)` | ingest 无页码 | **扩展** ingest，保留 text 路径 |
| `query_contract(RetrieveHit/VectorPoint/EdgeKind)` | 无 provenance；边四种 | **加法**扩展 |
| `query_contract(ClauseRow)` | 无 file_name 列 | 增列 |
| `query_design(global)` | apt-skyline-clean；禁预置公路文案 | UI 用已有 PrimaryButton/DataTable/StatusTag |
| `query_design(standard_lib)` | uploadDoc 已在 logic | 实现应对齐 logic；armed 先 refine |
| S3 缺口 | `GraphStore` 只 Clause；`extractPdfUnicodeText` 合并页；无 `t_layout_unit` | 扩展端口与表；**不** `report_missing` 停工（资产存在但不够，属设计 delta） |

不复用：Job OCR 的 `flattenOcrMarkdown` 作标准入库；`.ai/arch/vectors.db` 当业务库。

## 追问记录

`.apt/goal.md` 存在 → 全自动自问自答。攻击册文件 `.apt/redteam-patterns.md` 与 `templates/_redteam-patterns.md` 均缺失，按技能降级：自产该问问题 + 步骤 5.5 独立红队。

### 步骤 3 需求初稿 v1

- 目的：法规知识可追溯入库（用户明示）
- 角色：操作员在标准库页导入自己的标准 PDF；检查员检索必须看到出处
- 边界：9 页冻结；不预置行业包；三库已有 Docker
- 非目标：换 embedding、涨 Job 4MB
- 成功：向量有文件名页码；知识关联进图

### 轮次 1

| 镜头 | 追问 | 结论 / 修订 |
|------|------|-------------|
| S1 场景 | 谁在什么路径用？ | 操作员 `standard_lib` 上传；检查对话 `search_clause` 展示出处；空库仍禁止编造条款号 |
| S2 破坏 | 只做向量元数据不做表图是否交差？ | 否。用户明确表对多法规。伪需求=本片上真 embedding |
| S3 可行 | 现契约能否支撑？ | `RetrieveHit`/`splitClauses`/`Neo4j` 均不够，须扩展；page.logic 已有 uploadDoc |
| S4 验收 | 如何判定？ | Qdrant payload 探针 + Neo4j SUPPORTS + UI 列 + attachHit 拒表 id |

**v1→v2**：增加独立 `table` 单元与 `SUPPORTS`；Finding 仍只挂条款。

### 轮次 2

| 镜头 | 追问 | 结论 / 修订 |
|------|------|-------------|
| S1 | 无表的请假夹具？ | 仍须 PARENT_OF + provenance 默认页 1 |
| S2 | 表写成 fake clause_id？ | 会击穿 A11。表必须独立 unit |
| S3 | `upsertEdge` 只 MERGE Clause | 必须扩 GraphStore；`t_standard_edge` 列名是 clause 对 clause，故新建 `t_layout_edge` |
| S4 | 表命中但展开 0 条款 | 不 attach；UI 仍显示表出处 |

**v2→v3**：`t_layout_unit`/`t_layout_edge`；ingest-pdf 202 异步；禁止 flatten 进标准库。

### 轮次 3

| 镜头 | 追问 | 结论 / 修订 |
|------|------|-------------|
| S1 | 全书中途失败 | `t_ingest_page` 续跑 |
| S2 | 跨册 CITES 到未入库 JTG 3650 | 不建幽灵节点 |
| S3 | 按页 unpdf 是否已有 | **没有**，`mergePages:true` 是缺口，本片加 `extractPdfUnicodePages` |
| S4 | live 85MB 何时算过 | 冒烟前 N 页 + 夹具测全量逻辑，不把「全书 OCR 完成」当 CI 必过 |

**v3→v4（曾标收敛）**：live 冒烟不等于全书完成；CI 用短夹具。

红队 round 1 引发需求修订 → **回卷一轮 S1–S4（轮次 4）**。

### 轮次 4（红队回卷）

| 镜头 | 追问 | 结论 / 修订 |
|------|------|-------------|
| S1 | 检查员点符合度时一张表对应多条怎么显示？ | 多条 Finding，同源表 provenance |
| S2 | 只把边写入 Neo4j 是否交差？ | 否；M3 锁 searchStandard |
| S3 | Job `recognize` 能否共用？ | 否；必须 `recognizeLayout` + 单页光栅 |
| S4 | 怎样证明不是假绿？ | 见表问句、VL 竖线夹具、2 页失败 tick、table payload 禁回填 |

**v4→v5**：D1–D11 写入正文。残留：全书 85MB live 完成度、真 embedding — 仍非 must。

### 需求修订 delta

- v1：文件名+页码+图边
- v2：表单元 + SUPPORTS 1:N + Finding 不挂表 id
- v3：异步按页、layout 表、引用不造幽灵
- v4：CI 夹具 / live 部分页冒烟
- v5：检索必回表、recognizeLayout、N 条 Finding、tick worker、pdf-raster、refine 门禁、跨 pack 已入库 CITES
- v6：禁 proximity 自动边；table 不 rerank；index_error 枚举；graph 按 project 检索

### 红队轮留痕

- round 1：11 条原文 → [a] D1–D11。
- round 2：验证 D1–D11；#8 still_material + 3 条新 material → [a] D12–D15。
- round 3：r2 四条均 honored；findings=[]。残留文案 proximity 已删。R15（脏文本 LLM 建议边）保持 nice，待用户若要升级为 must。

## 呈递用户（risk=high，未批准不得 `/plan-from-spec`）

请审阅并回复 **「批准 spec」** 后再规划实现。请一并确认：

1. 本片 **不** 对扫描脏文本做自动表→多条款（无竖线/无表号则 `tables_unlinked` + 手补）。若要 LLM 建议边，把 R15 升为 must。
2. 标准库 UI 必须先 `$apt-create --refine`。
3. 真 embedding / BM25 仍为下一片（R13 nice）。

## 需求锁定表

| ID | 需求描述 | 来源 | 验收标准（可判定） | 优先级 |
|----|----------|------|--------------------|--------|
| R1 | 每条向量含文件名与页码 | 用户明示 | M1 | must |
| R2 | 检索命中展示文件名与页码 | 用户明示 | M2 | must |
| R3 | 表格作为独立单元 | 用户明示 | 夹具 `chunk_kind=table` 且 body 含 `\|` | must |
| R4 | 一表图连多条款 | 用户明示 | M3 | must |
| R5 | 条款层级入 Neo4j | 用户明示 + A13 | M5 | must |
| R6 | Finding 只挂库内条款 | 追问确认（A11 查证） | M4 + 既有 attachHit 测 | must |
| R7 | 标准 PDF 不走 Job 4MB | 追问确认（现网体积） | M6 M10 | must |
| R8 | 扫描页按页 OCR 且保留表 | 追问确认 | M7 | must |
| R9 | 失败页可续、不丢成功页 | 追问确认 | M8 | must |
| R10 | 不预置公路包 | 用户明示 + goal | M9 | must |
| R11 | 引用未入库目标不建边 | 追问确认 | 单测：正文含「第99.9条」无该条则 0 CITES | must |
| R12 | upsert 缺元数据失败 | 方案 A 门禁 | 单测抛错 | must |
| R13 | 真 embedding / BM25 | AI 假设未确认 | — | nice |
| R14 | 插图 bbox / CAD | AI 假设未确认 | — | nice |
| R15 | LLM 建议边人工确认队列 | AI 假设未确认 | — | nice |
| R16 | 检索不得丢弃 table unit | 追问确认（红队 D1） | M3 searchStandard | must |
| R17 | 标准 OCR 保留表 markdown | 追问确认（红队 D2） | M7 | must |
| R18 | 跨 pack 已入库可连边 | 追问确认（红队 D3） | M12 第二 pack 夹具 | must |
| R19 | 表符合度写 N 条 Finding | 追问确认（红队 D4） | M4 多 Finding | must |
| R20 | 表号问句不走 exact | 追问确认（红队 D5） | M12 prequery | must |
| R21 | 表向量不以 clause_id 回填 | 追问确认（红队 D6） | M1 | must |
| R22 | Graph 节点分 label；A13 带 kind | 追问确认（红队 D7） | M5 | must |
| R23 | M3 不用 proximity 充数 | 追问确认（红队 D8） | M3 | must |
| R24 | tick 消费 + 单页光栅 | 追问确认（红队 D9/D11） | M8 M11 | must |
| R25 | UI 前必须 refine | 追问确认（红队 D10） | 切片 0 产物 | must |
| R26 | 禁止自动 proximity 边 | 追问确认（红队 D12） | 无 caption/cell_ref 则 0 SUPPORTS | must |
| R27 | 表不进 rerank；符合度全链 N 条 | 追问确认（红队 D13） | M13 | must |
| R28 | 页状态含 index_error | 追问确认（红队 D14） | 向量失败 ≠ ocr_error | must |
| R29 | 跨 pack 检索不丢边目标 | 追问确认（红队 D15） | M12 searchGraph | must |

## 风险

- 85MB 无文字层：Paddle 限流；必须按页、可停。全书完成不是 CI 门禁。
- 扫描件条款号不在行首：切分漏条；失败页对人可见。
- 表号正则盖不住所有「见表」写法：计入 `tables_unlinked`，等 `manual`，**禁止**自动连最近条款。
- armed：**切片 0 refine 是实现门禁**，不是风险备注文案。
- 旧 Qdrant 点无新 payload：本片 ingest 幂等重建该 version 的点；不自动清无关 collection。
- tick 靠 UI 轮询：操作员离开页面则暂停；再打开进度页继续 tick。不引入 Temporal。

## 建议实现切片（获批后 `/plan-from-spec`）

0. **`$apt-create --refine`（standard_lib）** — 未完成不得改 vue
1. `recognizeLayout` + payload/`unit_id` 闸门 + `RetrieveHit` 可空 clause_id + prequery 见表规则（文本/VL markdown 夹具，无 UI）
2. `GraphStore.upsertNode` + PARENT_OF/BELONGS_TO/SUPPORTS + A13 kind
3. `searchStandard` 走 layout unit + 表 attach N 条 Finding
4. `pdf-raster` + `ingest-worker` tick + ingest-pdf 202
5. refine 完成后标准库 UI：PDF、tick 进度、命中列
6. Docker live：`rules/` 冒烟 N 页 tick
