# Task 5 Review Brief（RAG plan，非 paddleocr）

review-tier: full
projectType: component

Diff: `7da6130b6ff12434aca94fb0483918f020bb0352..f594629f36268bb9465331d784e9ee7d5aae194e`

核对：
- splitLayoutUnits 保留 `|`，不 flatten
- ingest provenance 页 1；闸门 payload；table 无 clause_id
- 父 PARENT_OF 子；caption/cell_ref SUPPORTS；禁止 proximity（unlinked 表 0 SUPPORTS）
- 第99.9条 0 CITES
- A11–A14 仍绿
- 公开方法有为什么注释；函数 ≤80 行
- index.ts 导出可记 nit，不因此 FAIL

写入 `.apt/orchestration/task-5-review.md` Assessment PASS|FAIL。
