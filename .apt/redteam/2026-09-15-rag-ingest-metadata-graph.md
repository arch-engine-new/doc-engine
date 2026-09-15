# Spec 红队 round 1 — rag-ingest-metadata-graph

> findings 原文，派发方不得增删。

## A. 实质发现清单

- [形状≠行为] 攻击：M3 只验 Neo4j 能查出 SUPPORTS，不锁 searchStandard/attachHit 必须走表展开；现网 searchSemantic 对每个 neighbor 做 getClause(item.id)，表 unit 不在 t_clause 即静默丢弃，M2/M4 可在纯条款路径假绿。
  依据：spec 验收 M3（夹具表 SUPPORTS≥2 + Neo4j 可查路径）；packages/core-engine/src/retrieve/library.ts:301-327（getClause(item.id) 失败则 continue）；同文件 366-372 toHit 只从 ClauseRow 构造、无 chunk_kind；对比架构段「vector 命中 LayoutUnit(table) → 沿 SUPPORTS 展开」。
  严重度：high

- [形状≠行为] 攻击：M7 要求扫描页 OCR 保留表 markdown，测试却允许 spy/分包证明 ingest 不调用 flattenOcrMarkdown；架构同时依赖会在 recognize 内拍平竖线的 OcrPort/PaddleOcr。R3 的 `|` 夹具走 JSON ingest，OCR 生产路径仍会拆表。
  依据：spec Testing「flattenOcrMarkdown 不出现在标准 ingest 路径（测试 spy 或分包边界）」+ M7 + 方案 B 依赖 OcrPort/PaddleOcr；packages/core-engine/src/ocr/paddleocr.ts:183-189（成功路径必 flattenOcrMarkdown）；packages/core-engine/src/ocr/pdf-text.ts:18-34（`|`→空格）；packages/core-engine/src/ocr/port.ts:25-27（recognize 无 raw-markdown 出口）。
  严重度：high

- [YAGNI 反向] 攻击：对照表把「跨标准」图多跳写成用户本轮必须做，CITES 规则又改成只连本 pack 生效库，把明示跨标准降成 pack 内正则。
  依据：spec「工程化 RAG 对照」第 5 行：用户本轮「图多跳（表↔条款、条↔条、跨标准）」且本片「必须做」；同文件图规则 CITES「目标 unit 已在本 pack 生效库」；追问轮次 2 S2 把跨册未入库写成不建边，未恢复「两边都已入库但不在同一 pack」的跨标准路径。
  严重度：medium

- [用户意图错位] 攻击：用户要的是表对多法规可作为检查依据；本片把 1:N 停在图边上，符合度 Finding 仍是单 clause_id，attach 只取 hits[0]，表的多条款支撑进不了审计结论。
  依据：spec Goal/R4/M3「一张表可图连接多条法规」vs attachHit「只允许 chunk_kind=clause」且 Finding.detail 仅「可含」source；docs/schema/generated/core-engine-rows.ts:194-204 FindingRow.clause_id 单列；packages/core-engine/src/retrieve/library.ts:218-236 attachStandardFitFinding 取 hits[0]；冻结 A11（docs/superpowers/specs/2026-08-27-slice-6-standard-rag.md:17）Finding 只挂一个 clause_id。
  严重度：high

- [机制空转] 攻击：操作员最可能的表号问句会被预查询打成 exact 条款号，走 listClauses 精确匹配，永不命中 table unit，SUPPORTS 展开与 payload 门禁对这条检索路径不存在。
  依据：packages/core-engine/src/retrieve/prequery.ts:8 EXACT_RE=`(\\d+(?:\\.\\d+)+|第.+条)`，21-23 命中则 intent=exact；packages/core-engine/src/retrieve/library.ts:187-197、289-298 searchExact 只扫 t_clause；spec 架构「vector 命中 table → SUPPORTS 展开」无 prequery 改写例外。可复现：对「表 8.5.1-1」exec EXACT_RE 得到 clauseNo=8.5.1。
  严重度：high

- [契约击穿] 攻击：表 payload.clause_id 允许 null、unit_id 才是主键，但现网 Qdrant 会把缺失的 clause_id 回填成 point.id，RetrieveHit/UI 视图仍强制 string clause_id；表命中只能把 unit_id 打扮成 clause_id，A11/M4 的 t_clause 存在性检查会被绕成「先造一个能 getClause 的 id」。
  依据：spec 向量 payload「条款时 unit_id 等于 clause_id；表可为 null」+ M4「attachHit 拒绝 table unit_id」；packages/core-engine/src/retrieve/qdrant.ts:21-23 originalPointId 优先 payload.clause_id，64-65 `clause_id: point.payload?.clause_id ?? point.id`；packages/core-engine/src/retrieve/ports.ts:105-111 RetrieveHit.clause_id: string；apps/web/src/services/types.ts:177-178 RetrieveHitView.clause_id: string；packages/core-engine/test/standard-rag.test.ts:91 `qdrant_point_id === clause_id`；冻结 spec 2026-08-27-slice-6-standard-rag.md:33 collection `clauses`、point id=`clause_id`。
  严重度：high

- [数据模型自相矛盾] 攻击：同一条设计要 LayoutUnit 节点 + t_layout_edge + 保留 collection 名 clauses，同时又扩展 EdgeKind 走现网只 MERGE :Clause 的 upsertEdge；自动 PARENT_OF 与 A13 共用 queryPath（无 kind 则返回全部出边，searchGraph 取最后一条当命中）。t_standard_edge 两端仍是 NOT NULL clause_id，手补 SUPPORTS 字典/HTTP 只有四类边。
  依据：spec 架构 `(:LayoutUnit)` / `t_layout_edge` 与 `t_standard_edge` 并存、collection `clauses` 历史名保留、测试锁死父 PARENT_OF 子；packages/core-engine/src/retrieve/neo4j.ts:9-13 EDGE_KINDS 仅 CITES|SUPERSEDES|APPLIES_TO|REQUIRES，46-48 MERGE (a:Clause) MERGE (b:Clause)，85-91 MATCH 只 :Clause；packages/core-engine/src/retrieve/library.ts:345-351 queryPath 结果当路径、last.to 当 hit；packages/core-engine/test/standard-rag.test.ts:156-166 A13 SUPERSEDES；packages/core-engine/src/persistence/sqlite-slice1.sql:464-467 t_standard_edge from_clause_id/to_clause_id NOT NULL；packages/core-engine/src/http/dicts.ts:29-34 无 SUPPORTS/PARENT_OF；packages/core-engine/src/http/handle-request.ts:633-639 kind 四类断言；packages/core-engine/src/http/session.ts:474 `MATCH (c:Clause) DETACH DELETE c`。
  严重度：high

- [机制类多样性/最贵机制] 攻击：推荐 B 声称解决表 1:N，确定性链在 caption/cell_ref 失败后强制 proximity 至少连 1 条；叠加现网 OCR 拆掉表格竖线后，live 扫描件只会得到页内最近条款 1:1。M3 用 markdown 单元格 1.1/2.1 绿的是夹具 cell_ref，不是用户 85MB 公路册。拒 C 之后没有另一套能在 OCR 脏文本上成立的 1:N 机制。
  依据：spec 表连条款顺序 1 caption → 2 cell_ref「一条表可连多条」→ 3 proximity 至少 1 条；Error handling「表 0 条 SUPPORTS 则强制 proximity」；Testing 请假夹具单元格写 1.1 与 2.1；paddleocr.ts:188 + pdf-text.ts:33 生产 OCR 无 `|`；方案 C 因 A11/A16 被否，回应把成功标准收成 Hash 下夹具判定。
  严重度：high

- [异步/续跑] 攻击：ingest-pdf 202 + t_ingest_page 在文档里存在，仓库没有队列消费者：现网标准入库是同步 HTTP 200，Paddle recognize 在请求内轮询；非目标又排除 Temporal。验收允许 ≤3 页夹具同步完成，M8 可在无后台续跑的情况下绿。85MB 全书还撞上 Paddle 本地 50MB 闸，且拟改文件没有 PDF→页图/拆页字节的落点。
  依据：spec Data flow 第 2 步 202+ingest_run_id、「小夹具 PDF（≤3 页）测试可同步完成」、非目标 Temporal；packages/core-engine/src/http/handle-request.ts:614-623 POST /api/standards/ingest 同步 json(200)，无 ingest-pdf 路由；packages/core-engine/src/ocr/paddleocr.ts:155-157、183-189 轮询留在 recognize 以维持 HTTP 同步契约；同文件 6、192-196 MAX_LOCAL_FILE_BYTES=50MB；packages/core-engine/src/ocr/pdf-text.ts:43-52 extractPdfUnicodeText mergePages:true（整本抽字，无页图）；core-engine 内无 ingest worker（queue 仅 memory-graph.ts BFS）。
  严重度：high

- [armed/UI] 攻击：项目已 armed，standard_lib 的 logic/_pages 仍是条款四列与四类手点边；spec 把 refine 写在范围和风险里，实现切片 1 与拟改文件清单仍直接改 index.vue 做 M2 列，开发链会绕过「先 refine、_pages.md approved=no」。
  依据：designs/v0/_pages.md:10 standard_lib approved=yes、handoff=done（armed 兜底文件存在）；designs/v0/standard_lib/page.logic.md:14-21 uploadDoc 已有但 indexVectors「键=clause_id」、search 返回 Clause[]、indexGraph 仅 CITES/SUPERSEDES/APPLIES_TO/REQUIRES、主流程第 5 步只要 clause_id+版本+span；apps/web/src/views/standard_lib/index.vue:63-88、160-162、200-216 textarea + POST /api/standards/ingest、命中表四列无文件/页/kind；spec 范围「实现 UI 前须 $apt-create --refine」、风险「否则 logic-sync 可能 FAIL」、建议实现切片 1「RetrieveHit UI（文本夹具）」+ 拟改动文件列出 index.vue。
  严重度：high

- [册外] 攻击：Job 4MB 被「独立通道」绕开后，标准 PDF 仍要进同一个会 flatten、整文件 50MB、按页闸门函数却是整本 mergePages 的 OcrPort/pdf-text；M6/M10 只证明不走 Job，不证明 85MB 扫描件能按页保留表结构入库。
  依据：spec R7/M6/M10「不走 Job 4MB」；packages/core-engine/src/pipeline/job-pipeline.ts:131 MAX_UPLOAD_BYTES=4MB，943-944 超限拒 Job，974-984 recognizeUploadText 整本 extractPdfUnicodeText + hasUsablePdfTextLayer 失败才 ocr.recognize(整文件 bytes)；packages/core-engine/src/ocr/paddleocr.ts:6 50MB；spec 拟改动文件无光栅化/拆页模块。
  严重度：medium
