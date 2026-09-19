# APT accept 台账

F-3 → F-3 → live prequery 为 ZhipuPrequery；缺 LLM 配置显式失败不静默 Fake；单测仍可用 FakePrequery → 无 → pending-acceptance（AI 自答）
F-4 → F-4 → live rerank 调用独立 rerank HTTP 服务；失败显式；测试可继续 IndependentReranker → 无 → pending-acceptance（AI 自答）
F-5 → F-5 → openLiveFromEnv 无 Paddle 时失败且源码不再 ?? new FakeOcr()；live 扫描页不得假 OCR；测试仍可显式注入 FakeOcr → packages/core-engine/src/pipeline/job-pipeline.ts:270 FakeOcr 回退；片内先红后绿 → pending-acceptance（AI 自答）
F-6 → F-6 → live 上传 minioFromEnv 可用；health 对 MinIO 失败即 BLOCKED 不 skip → 无 → pending-acceptance（AI 自答）
F-7 → F-7 → 登记成功后「处理全部页」串行 tick 至无 pending；单次 tick ≤1 页；ocr_error/index_error 不中断其余 pending → apps/web/src/views/standard_lib/PdfTickPanel.vue 仅处理一页；designs/v0/standard_lib/page.logic.md A17 → pending-acceptance
F-8 → F-8 → 纯文字层 tick 入库且不调 OCR；无文字层经栅格+OCR 入库失败为 ocr_error；混排 PDF 两页分别 ok 可检索；单次 tick ≤1 页 → 无 → pending-acceptance
