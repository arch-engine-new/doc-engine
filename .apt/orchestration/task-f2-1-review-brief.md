# Task F2-1 Review Brief

review-tier: full
projectType: component（跳过 B2 test-cases 门禁）

- **brief:** `.apt/orchestration/task-f2-1-brief.md`
- **report:** `.apt/orchestration/task-f2-1-report.md`
- **BASE_SHA:** `fa80d3221c23858bf79a55c77f948d54d8a60f4c`
- **HEAD_SHA:** `bcce1e2e22155568467b02551731c58bce848e01`
- **Diff:** `git diff fa80d3221c23858bf79a55c77f948d54d8a60f4c..bcce1e2e22155568467b02551731c58bce848e01`
- **Output:** `.apt/orchestration/task-f2-1-review.md`

## Part 1 / 约束

- 只允许改 Embeddings 签名为 async 兼容；Hash 仍 48 维；rerank await embed。
- 禁止 DashScope / live-ports / Qdrant / Vue / apiKey。
- 白名单外文件 = Critical。
- 新增/签名变更的 export 须有「为什么」注释。
- Verify 已报 22 passed；有疑点再定点复跑，勿无故全量重跑。

## 审查重点

1. Spec 合规：embed 签名、Hash 48、rerank await。
2. 白名单：5 文件均在 brief 白名单内。
3. 公开方法注释抽检。
4. Micro-closeout 是否与 diff 一致。
5. 非页面 Task，跳过数据防御抽检。
