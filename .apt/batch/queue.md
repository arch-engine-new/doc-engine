# APT 批量队列（$apt-intake 生成）
> 生成：2026-09-19T18:35:00+08:00｜共 6 项（P1 2 / P2 3 / P3 1）｜截图归档 .apt/batch/screenshots/
> 旧批归档：.apt/batch/archive/2026-09-19-f2-embedding/ ；goal 归档 .apt/goal-archive/2026-09-19-batch-f2.md
> ID 接续：F-3 起（F-2 已 loopDone，inbox 旧项保留原 ID）
> 验收：缺省 defer（未带 --accept）；台账全行 pending-acceptance

## F-3
- 类型：需求
- 优先级：P2
- 标题：live 检索 prequery 接 glm（ZhipuPrequery），禁止 FakePrequery
- 收敛记录：
  - 目的：生产检索改写/意图走 glm-5.3 类 ChatComplete，与 brief / A12 锁定一致
  - 边界：只改 `liveRetrievePorts()` 装配；测试继续 FakePrequery；禁止把 chat complete 当 rerank
  - 验收：live 模式 `prequery` 为 `ZhipuPrequery`；缺 LLM 配置显式失败（对齐 UnconfiguredLlm，不静默 Fake）；单测仍可用 Fake
- 截图：无
- 分流：轻链（§0.2 落痕）
- 测试策略：片内测试案例强制（无 accept）
- 验收：待验收
- 确认：AI 自答（证据: `packages/core-engine/src/retrieve/live-ports.ts` FakePrequery；`prequery.ts:50-70` ZhipuPrequery 已存在未接线）
- 泊车：无
- 依赖：无
- mergedFrom：inbox 2026-09-19 审计批
- Goal（§0.2）：live 检索 prequery 接 glm（ZhipuPrequery），禁止 FakePrequery（全自动自答，未经用户确认）
- 验收标准（§0.2）：
  1. `liveRetrievePorts().prequery` 为 `ZhipuPrequery`
  2. 缺 LLM 配置显式失败，不静默 FakePrequery
  3. 单测仍可注入 FakePrequery

## F-4
- 类型：需求
- 优先级：P2
- 标题：live 独立 rerank 接 HTTP（bge 或等价），禁止本地 Hash 余弦冒充独立模型
- 收敛记录：
  - 目的：rerank 必须独立于 embedding/chat（A12：chat-as-rerank 禁止）
  - 边界：`IndependentReranker` 可留作测试；live 装配独立 rerank HTTP；不把 glm chat 当 rerank
  - 验收：live `rerank` 调用独立 rerank 服务；失败显式；测试可继续本地 IndependentReranker
- 截图：无
- 分流：全链
- 测试策略：accept-batch（所属页 standard_lib）
- 验收：待验收
- 确认：AI 自答（证据: `packages/core-engine/src/retrieve/rerank.ts`；`live-ports.ts`）
- 泊车：无
- 依赖：依赖 F-2（已完成，向量空间已是 v3）
- mergedFrom：inbox 2026-09-19 审计批

## F-5
- 类型：bug
- 优先级：P2
- 标题：live JobPipeline 禁止静默 FakeOcr
- 收敛记录：
  - 复现：`JobPipeline.openLiveFromEnv()` 在无 Paddle token 时 `PaddleOcr.fromEnv() ?? new FakeOcr()`
  - 期望：live 未配置则失败，不静默假 OCR
  - 实际：ledger/检索可 live，OCR 路径仍可能假结果
  - 影响面：规范入库扫描页 / 上传抽条文
  - 所属页：job_upload / standard_lib
- 截图：无
- 分流：轻链（§0.2 落痕）
- 测试策略：accept-batch（所属页 job_upload）
- 验收：待验收
- 确认：AI 自答（证据: `job-pipeline.ts:270` vs `session.ts:287-292`）
- 泊车：无
- 依赖：无
- mergedFrom：inbox 2026-09-19 审计批
- Goal（§0.2）：live JobPipeline 禁止静默 FakeOcr（全自动自答，未经用户确认）
- 验收标准（§0.2）：
  1. 按收敛记录复现：`openLiveFromEnv` 无 Paddle 时失败，源码不再 `?? new FakeOcr()`
  2. live 扫描页不得产出假 OCR 文本
  3. 测试仍可显式注入 FakeOcr

## F-6
- 类型：需求
- 优先级：P3
- 标题：live 对象存储接 MinIO，health 探针不再默认 skip
- 收敛记录：
  - 目的：生产 blob 走 MinIO，与测试 MemoryBlobStore 分离
  - 边界：compose/health 把 MinIO 纳入 live 默认；不改测试 MemoryBlobStore
  - 验收：live 上传 `minioFromEnv()` 可用；health 对 MinIO 失败即 BLOCKED，不 skip 当绿
- 截图：无
- 分流：全链
- 测试策略：accept-batch（所属页 job_upload）
- 验收：待验收
- 确认：AI 自答（证据: `blob/port.ts`；`session.ts:287-292`）
- 泊车：无
- 依赖：无
- mergedFrom：inbox 2026-09-19 审计批

## F-7
- 类型：bug
- 优先级：P1
- 标题：标准库补上「处理全部页」tickAll，禁止只能手点一页
- 收敛记录：
  - 复现：`rules/`《公路工程质量检验评定标准 第一册》约 85.7MB / 259 页；标准库 PDF 登记后只有「处理一页」；page.logic 已锁定 tickAll
  - 期望：登记成功后 PrimaryButton「处理全部页」前端串行循环已有 tick，直到无 pending；单次 tick 仍 ≤1 页；ocr_error/index_error 不中断其余 pending、不回滚已 ok 页；不新增全书一次 OCR 接口
  - 实际：`PdfTickPanel.vue` 仅「处理一页」，A17 未落地
  - 影响面：standard_lib 规范 PDF 入库
  - 所属页：standard_lib
- 截图：无
- 分流：轻链（§0.2 落痕）
- 测试策略：accept-inline（P1）
- 验收：待验收
- 确认：已确认（用户原文：需要这么做 / 不能只靠手点一页）
- 泊车：无
- 依赖：无
- mergedFrom：无
- Goal（§0.2）：标准库补上「处理全部页」tickAll，禁止只能手点一页
- 验收标准（§0.2）：
  1. 按收敛记录复现：登记成功后可见「处理全部页」，前端串行循环已有 tick 直到无 pending
  2. 单次 tick 仍 ≤1 页；ocr_error/index_error 不中断其余 pending、不回滚已 ok 页
  3. 不新增全书一次 OCR 接口；`PdfTickPanel` 不再只有「处理一页」

## F-8
- 类型：需求
- 优先级：P1
- 标题：规范 PDF 文字层与扫描页两条路都要通（可混在同一本）
- 收敛记录：
  - 目的：用户规范既有可选中文字的 PDF，也有扫描件/图片页；同一 ingest-run 内按页分流，两条路都入库进 Qdrant
  - 边界：
    - 做：tick 对每一页先 `hasUsablePdfTextLayer` → 有则 Unicode 文字层，无则单页栅格 PNG + `OcrPort.recognizeLayout`；混排 PDF（部分页有字、部分页是图）按页各走各路；扫描全书（如 `rules/` 259 页无文字层）全程 OCR；文字层页不得改走整本 OCR；栅格失败 / OCR 失败记 `ocr_error`，索引失败记 `index_error`；live 扫描路径用真 Paddle，禁止 FakeOcr 冒充；标准库 ingest-pdf 不套任务页 4MB 闸门
    - 不做：不一次 OCR 全书；不把整本 PDF 字节丢给 Paddle；不改条款/表切片规则；不把 `rules/` 全书 OCR 当作本片手工验收（本片用小夹具：纯文字 PDF + 纯扫描页 + 混排各至少 1 页）
  - 验收：
    1. 纯文字层 PDF tick 后条款可检索，该页不调用 OCR
    2. 无文字层页 tick 后经栅格+OCR 入库可检索，失败为 ocr_error 而非假文本
    3. 同一 PDF 内一页有字一页无字：两页分别 ok，检索都能命中对应条文
    4. 单次 tick 仍 ≤1 页
- 截图：无
- 分流：全链
- 测试策略：accept-inline（P1）
- 验收：待验收
- 确认：已确认（用户原文：pdf 有的是文字，有的是图片，两条路都要能走通）
- 泊车：无
- 依赖：依赖 F-5（live 禁止 FakeOcr）；依赖 F-7（全书/多页靠 tickAll 循环，不靠手点）
- mergedFrom：无
