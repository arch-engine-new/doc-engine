# Task F2-2 Review Brief

review-tier: full
projectType: component

- **brief:** `.apt/orchestration/task-f2-2-brief.md`
- **report:** `.apt/orchestration/task-f2-2-report.md`
- **BASE_SHA:** `bcce1e2e22155568467b02551731c58bce848e01`
- **HEAD_SHA:** `6361de75400ccf36e6d0fd29237af693ddea5f3e`
- **Diff:** `git diff bcce1e2e22155568467b02551731c58bce848e01..6361de75400ccf36e6d0fd29237af693ddea5f3e`
- **Output:** `.apt/orchestration/task-f2-2-review.md`

## 约束

- live embed = text-embedding-v3 兼容模式；缺 DASHSCOPE_API_KEY throw；不回退 Hash；rerank 同一实例。
- 禁止 apiKey 字面量、禁止 chat complete 当 embed、禁止越界改 qdrant/library/Vue。
- 白名单外文件 = Critical。
- 导出类/方法须有「为什么」注释。
