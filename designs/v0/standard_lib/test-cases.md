# 测试用例 — standard_lib（F-1 命中详情 + F-9 扩一跳）

规划来源：`designs/v0/standard_lib/page.logic.md`（openHitDetail / expandOneHop / A18 / A19）。不替代 DSL 硬规则。不修「第X条引用哪条」正则。

## 业务测试（来自 page.logic.md）

| ID | 场景 | 输入 | 预期 | 来源 |
|----|------|------|------|------|
| T1 | 检索条款命中可见标题正文 | 入库请假夹具后检索「1.1」 | 命中 heading 含「1.1 事假须提前申请」，body 含「须在休假前」 | §操作 searchSemantic / A18 |
| T2 | 打开命中详情 | 点击一条命中行 | 详情面板 open，展示该条 heading + body；未点击为 closed（`HitDetailPanel` v-if selectedHit） | §操作 openHitDetail |
| T3 | 出处列仍在 | 有命中的检索表 | 列仍为 file_name / 页 / unit_id / clause_id / 路径；无全文列 | §检索命中列 |
| T4 | 表/附件身份 | chunk_kind=table 或 annex | clause_id 显示 —；详情用 caption/单元格文本 | §检索命中列 |
| T5 | 本步对话引用正文 | 命中后本步对话 | prompt/上下文含 heading 与 body 片段，不得只报 clause_id | §操作 openStepChat |
| T6 | 无命中 | 检索无结果 | 表空态；详情 closed；对话「未命中」；**不出现图扩展行** | §状态 / A19 |
| T7 | 无正文 | 账本 body 空 | 详情「无正文」，禁止模型编造 | §openHitDetail |
| T10 | 不问引用也见图邻接 | 问句「事假」（不含引用/替代），1.1 有 CITES 邻接 1.2 | 结果含 1.1 路径=向量，且含 1.2 路径=图谱 | §expandOneHop / A19 |
| T11 | 0 命中不扩图 | 问句「不存在」 | 命中表空，无图谱行 | §expandOneHop / A19 |
| T12 | 同一条款不重复 | 邻接条款已在向量结果中 | 该 clause_id 只一行 | §expandOneHop / A19 |
| T13 | 只扩一跳 | 1.1→1.2→更远条款 | 命中表不含二跳以外条款 | §expandOneHop / A19 |

备注：T10 引擎测在用例内 seed `1.1 -[:CITES]-> 1.2` 出边，不改共享 seedPack。

## 接口测试

| ID | 接口 | 场景 | 预期 |
|----|------|------|------|
| T8 | POST /api/standards/search | 夹具「1.1」 | hits[] 含 heading/body |
| T9 | POST /api/chat | body 带 hits heading/body | parse 不丢字段；回复可引用正文 |
| T14 | POST /api/standards/search | 「事假」无引用词，图中有 CITES | hits 同时含 vector 与 graph 路径 |
