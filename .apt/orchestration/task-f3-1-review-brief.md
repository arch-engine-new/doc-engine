# Task F3-1 Review Brief

review-tier: full

- **Implementer brief:** `.apt/orchestration/task-f3-1-brief.md`
- **Implementer report:** `.apt/orchestration/task-f3-1-report.md`
- **BASE_SHA:** `17fee66b1494f3f4da4850c5df971a1de8acc386`
- **HEAD_SHA:** `cf22716`（subject: wire liveRetrievePorts prequery to ZhipuPrequery）
- **Review output:** `.apt/orchestration/task-f3-1-review.md`

## 范围

3 files: `live-ports.ts`、`live-zhipu-prequery.test.ts`（新）、`dashscope-embeddings.test.ts`。

## Global 约束

- live prequery = ZhipuPrequery，禁止 FakePrequery 静默回退
- 缺 LLM throw（Unconfigured/Fake）
- 单测仍可 FakePrequery
- 禁止 chat-as-rerank
- 禁止密钥明文
- 白名单外不得改

## 请按 reviewer prompt 输出 Spec Compliance / Strengths / Issues / Assessment
