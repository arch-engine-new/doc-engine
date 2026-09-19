# Task F4-2 Review Brief

review-tier: full

- Implementer brief: `.apt/orchestration/task-f4-2-brief.md`
- Report: `.apt/orchestration/task-f4-2-report.md`
- BASE_SHA: `8c8ea79`
- HEAD: `cb785c5`（feat(retrieve): add HttpReranker for independent HTTP rerank）
- Review output: `.apt/orchestration/task-f4-2-review.md`

## 范围

仅 2 文件：`http-rerank.ts`（新）、`index.ts` re-export。未改 `live-ports.ts`（留给 Task 3）。

## 约束

- HttpReranker 独立 HTTP；禁止 chat-as-rerank / 本地余弦 / 复用 compatible-mode embeddings URL
- 缺密钥 throw；Error 不含密钥值
- 测试 8 passed（implementer 已报）
- 白名单外不得改
