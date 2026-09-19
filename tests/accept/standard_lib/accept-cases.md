# 验收案例 — standard_lib

真源：`designs/v0/standard_lib/page.logic.md`  
环境：live `http://127.0.0.1:5173` pack `pack_e978697d85124f75` version `sver_545924f5b96e4b20`  
证据：`.apt/accept/evidence.json`、`screenshot-standards-live.png`

| ID | RP | kind | 来源（logic） | 步骤 | 期望 | 状态 |
|----|----|------|---------------|------|------|------|
| C-01 | RP-01 | view_load | 主视图 | 打开 /packs/pack_e978697d85124f75/standards | 标题「标准库」、摄入区/检索区可见 | [x] |
| C-02 | RP-02 | upload | uploadDoc | POST ingest-pdf 最小文字 PDF | 202 + ingest_run_id `ing_f2199156701244cc` | [x] |
| C-03 | RP-03 | action | ingestClauses | POST ingest 请假夹具（含 APT-ACCEPT-LIVE-20260919） | 3 条 clause_id | [x] |
| C-04 | RP-04 | action | indexVectors | 入库后查 Docker Qdrant `clauses` | points_count=4，payload.unit_id 含 `sver_545924f5b96e4b20:1.1` 等 | [x] |
| C-05 | RP-05 | dropdown | 边类型 | 打开边类型 select | CITES/SUPERSEDES/APPLIES_TO/REQUIRES 等，与 /api/dict/standard_edge_kind 一致 | [x] |
| C-06 | RP-06 | action | indexGraph | POST edges 1.2 CITES 1.1 | Neo4j 出现 CITES 边 | [x] |
| C-07 | RP-07 | action | searchSemantic | 检索「事假」 | 3 命中 retrieve_path=vector | [x] |
| C-08 | RP-08 | action | bindEffectiveVersion | 绑定 sver_545924f5b96e4b20 | UI「生效 sver_545924f5b96e4b20」 | [x] |
| C-09 | RP-09 | action | openStepChat | 进页 + 检索后 | 右侧本步对话可见；/api/chat 有回复 | [x] |
| C-10 | RP-10 | state | indexed | 入库+绑定后 | version 标签与生效版均可见 | [x] |
| C-11 | RP-11 | other | 出处列 | 检索 1.1 | 表列 file_name/页/unit_id/clause_id/路径=精确；API 含 standard_version_id + span | [x] |
| C-12 | RP-12 | action | tick | ingest-runs/.../tick | page_no=1 status=ok 单页 | [x] |
| C-13 | RP-13 | action | tickAll | 再 tick | done=true status=done 无 pending | [x] |
| C-14 | RP-14 | action | searchGraph | 检索「1.2引用哪条」 | 1 命中 retrieve_path=graph → 1.1 | [x] |
