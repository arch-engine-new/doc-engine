# Task 3 Review Brief

review-tier: light
projectType: component

## Diff
`9219afb6616873e7f1b213b41b260722e924b6b7..6cb0bd8b7756382748ee88ca3c6d9de391b85520`

## 核对
- assertVectorPayload：缺 file_name/unit_id/非法 chunk_kind/非法页抛错；table/annex 非空 clause_id 抛错
- 禁止 point.id 回填 clause_id；qdrant 删除 `?? point.id`
- originalPointId 只认 unit_id
- MemoryVectorStore search id=unit_id
- 单测覆盖缺页 + table 不回填
- 未改 library.ts
- 公开函数有为什么注释；函数 ≤80 行

写入 `.apt/orchestration/task-3-review.md` Assessment PASS|FAIL。
