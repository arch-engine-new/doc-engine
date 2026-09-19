# 验收案例 — standard_lib

真源：`designs/v0/standard_lib/page.logic.md`  
环境：live `http://localhost:5173` pack `pack_88632d0869d7468c` version `sver_b2e66c52b1e749bb`  
法规来源：https://www.gov.cn/gongbao/content/2019/content_5468867.htm  
证据：`.apt/accept/evidence.json`

| ID | RP | kind | 来源（logic） | 步骤 | 期望 | 状态 |
|----|----|------|---------------|------|------|------|
| C-01 | RP-01 | view_load | 主视图 | 打开 /packs/pack_88632d0869d7468c/standards | 200 + `#app` | [x] |
| C-02 | RP-02 | upload | uploadDoc | POST ingest-pdf 最小 PDF | 202 + ingest_run_id `ing_79fc654db141401e` | [x] |
| C-03 | RP-03 | action | ingestClauses | POST ingest 《建设工程质量管理条例》全文 | 82 条 clause | [x] |
| C-04 | RP-04 | action | indexVectors | 查 Docker Qdrant `clauses` | points_count=88，vector_size=1024 | [x] |
| C-05 | RP-05 | dropdown | 边类型 | GET /api/dict/standard_edge_kind | CITES/SUPERSEDES/APPLIES_TO/REQUIRES 等 | [x] |
| C-06 | RP-06 | action | indexGraph | POST edges 第六十四条 CITES 第二十八条 | Neo4j 出现 CITES | [x] |
| C-07 | RP-07 | action | searchSemantic | 检索「偷工减料」 | 首条 vector → 第六十四条 | [x] |
| C-08 | RP-08 | action | bindEffectiveVersion | 绑定 sver_b2e66c52b1e749bb | pack.effective_standard_version_id 一致 | [x] |
| C-09 | RP-09 | action | openStepChat | POST /api/chat retrieve | 有 assistant_reply 且引用条款 | [x] |
| C-10 | RP-10 | state | indexed | 入库+绑定后 | 生效版为条例 version | [x] |
| C-11 | RP-11 | other | 出处列 | 检索「第二条」 | file_name/页/unit_id/clause_id/路径=exact | [x] |
| C-12 | RP-12 | action | tick | ingest-runs/.../tick | page_no=1 status=ok | [x] |
| C-13 | RP-13 | action | tickAll | 查 PdfTickPanel 是否有「处理全部页」 | PrimaryButton 循环 tick | [!] |
| C-14 | RP-14 | action | searchGraph | 检索「第六十四条 引用」 | graph 命中 第二十八条 | [x] |
| C-15 | RP-15 | action | openHitDetail | 检索「第二条」命中 | heading+body 可给详情面板 | [x] |
