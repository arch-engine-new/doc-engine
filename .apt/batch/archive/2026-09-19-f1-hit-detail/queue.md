# APT 批量队列（$apt-intake 生成）
> 生成：2026-09-19T13:00:00+08:00｜共 1 项（P1 0 / P2 1 / P3 0）｜截图归档 .apt/batch/screenshots/
> 旧批归档：.apt/batch/archive/2026-09-19-b3-f1-parked/ ；goal 归档 .apt/goal-archive/2026-09-19-batch-b3.md
> ID 接续：回收 F-1（与本轮输入同根因，不新开 F-2）
> 略过：与 F-1 重复（检索有命中但看不到条文内容）

## F-1
- 类型：需求
- 优先级：P2
- 标题：检索命中可通过详情查看条款标题与正文
- 收敛记录：
  - 所属页：standard_lib
  - 目的：用户检索能命中后，必须能读到「查到了什么」（条款标题 + 正文），不能只看到 ID/出处。
  - 边界：
    - 做：命中行可打开详情（或等价展开），展示 heading + body；本步对话引用命中时须能带正文，不得只回 clause_id。
    - 不做：不改检索算法 / 不替代 DSL 硬规则；不把 table/annex 的 unit_id 塞进 clause_id。
  - 验收：
    1. 检索「1.1」或「事假」有命中后，详情可见该条 heading（如「1.1 事假须提前申请」）及正文片段
    2. 表格仍保留出处列 file_name / 页 / unit_id / clause_id / 路径
    3. 本步对话回答能引用命中正文，不得只报 clause_id 而声称看不到原文
  - 实际（查证）：
    - 页面命中表只有 file_name / 页 / unit_id / clause_id / 路径（`RetrieveHitsTable.vue`）
    - `page.logic.md` §检索命中列未列 heading/body
    - 契约 `RetrieveHit`（`packages/core-engine/src/retrieve/ports.ts`）无 heading/body；Postgres `t_clause` 已有 heading/body，检索 API 未带回
    - 对话 `formatRetrieveHitsForPrompt` 只拼 clause_id/unit_id/file_name
  - 影响面：向量库有数据也等于「查到了但看不懂」
- 截图：.apt/batch/screenshots/F-1/standard_lib-hits.png
- 分流：全链
- 测试策略：accept-batch（批末统一，默认）
- 验收：待验收
- 验收标准摘要：检索命中后详情可见 heading+body；出处列仍在；本步对话能引用命中正文
- 确认：已确认（2026-09-19 用户原文「批准」；先前 AI 自答证据: designs/v0/standard_lib/page.logic.md 检索命中列/openHitDetail；RetrieveHitsTable 出处列；RetrieveHit 无 heading/body）
- 泊车：无
- 依赖：无
- mergedFrom：本轮用户口述「不知道查到了什么 / 看不到内容」
