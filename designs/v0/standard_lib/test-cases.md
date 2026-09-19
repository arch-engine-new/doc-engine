# 测试用例 — standard_lib（F-1 命中详情）

规划来源：`designs/v0/standard_lib/page.logic.md`（openHitDetail / A18）与 spec R1–R7。不替代 DSL 硬规则，不改检索算法。

## 业务测试（来自 page.logic.md）

| ID | 场景 | 输入 | 预期 | 来源 |
|----|------|------|------|------|
| T1 | 检索条款命中可见标题正文 | 入库请假夹具后检索「1.1」 | 命中 heading 含「1.1 事假须提前申请」，body 含「须在休假前」 | §操作 searchSemantic / A18 |
| T2 | 打开命中详情 | 点击一条命中行 | 详情面板 open，展示该条 heading + body；未点击为 closed（`HitDetailPanel` v-if selectedHit） | §操作 openHitDetail |
| T3 | 出处列仍在 | 有命中的检索表 | 列仍为 file_name / 页 / unit_id / clause_id / 路径；无全文列 | §检索命中列 |
| T4 | 表/附件身份 | chunk_kind=table 或 annex | clause_id 显示 —；详情用 caption/单元格文本 | §检索命中列 |
| T5 | 本步对话引用正文 | 命中后本步对话 | prompt/上下文含 heading 与 body 片段，不得只报 clause_id | §操作 openStepChat |
| T6 | 无命中 | 检索无结果 | 表空态；详情 closed；对话「未命中」 | §状态 |
| T7 | 无正文 | 账本 body 空 | 详情「无正文」，禁止模型编造 | §openHitDetail |

## 接口测试

| ID | 接口 | 场景 | 预期 |
|----|------|------|------|
| T8 | POST /api/standards/search | 夹具「1.1」 | hits[] 含 heading/body |
| T9 | POST /api/chat | body 带 hits heading/body | parse 不丢字段；回复可引用正文 |
