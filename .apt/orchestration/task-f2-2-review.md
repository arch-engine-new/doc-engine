# Task F2-2 Review — DashScopeEmbeddings + liveRetrievePorts 缺 key 失败 + 共用 rerank

review-tier: full
projectType: component（跳过 B2 `designs/v0/*/test-cases.md` 门禁；非页面 Task，跳过数据防御抽检）
Plan: `docs/apt/plans/2026-09-19-dashscope-text-embedding-v3-plan.md` Task 2
Spec: `docs/superpowers/specs/2026-09-19-dashscope-text-embedding-v3-design.md`（Rn：R1 / R2 / R3 / R6 / R9）
Brief: `.apt/orchestration/task-f2-2-brief.md` / `.apt/orchestration/task-f2-2-review-brief.md`
Report: `.apt/orchestration/task-f2-2-report.md`
HEAD: `6361de75400ccf36e6d0fd29237af693ddea5f3e`
Parent / BASE_SHA: `bcce1e2e22155568467b02551731c58bce848e01`
Status (implementer): `DONE_WITH_CONCERNS`
Verify（implementer 已报；审查方未重跑）：TDD RED `Test Files 1 failed (1)` / `Tests 8 failed (8)`（`DashScopeEmbeddings is not a constructor`；缺 key 时仍抛 `Qdrant URL not configured`）→ GREEN `Test Files 2 passed (2)` / `Tests 11 passed (11)`

审查范围：只审 `git diff bcce1e2..6361de7`。工作区其它未提交文件（含 report）不计入本 Task。审查方只读：未改代码、未 commit、未重跑 vitest。gstack review 不可用，已跳过。

MCP（审查方只读复查）：`query_contract DashScopeEmbeddings` 已登记，`tsFilePath=packages/core-engine/src/retrieve/embeddings.ts`，描述含 v3 / dim 1024 / 缺 key throw / 不回退 Hash / 注入同一实例。`query_contract liveRetrievePorts` 的 **description 仍写 HashEmbeddings**（`registeredAt=2026-08-28`），但 `tsContent` 已是本片源码。`query_arch frontend/core-engine/util#embeddings` / `#live-ports` 为本次 `refresh_asset`（Updated `2026-09-19T08:03–08:04Z`，摘要仍「暂无」导出/签名）。既有 `frontend/packages/util#embeddings` Updated 仍为 Task 1 的 `2026-09-19T07:47Z`。

### Spec Compliance
- ✅ Spec compliant

相对 plan Task 2、brief（live embed = 兼容模式 text-embedding-v3；只读 `DASHSCOPE_API_KEY`；缺 key throw；禁止 Hash 回退；rerank 同一实例；放 `embeddings.ts`）与 R1/R2/R3/R6/R9：**无 Missing / Extra（白名单外）/ Misunderstood**。

| 检查项 | 结果 | 证据 |
|--------|------|------|
| R1：兼容模式 `text-embedding-v3`，POST `{baseUrl}/embeddings` | **YES** | 默认 `https://dashscope.aliyuncs.com/compatible-mode/v1`；`embed` POST `${baseUrl}/embeddings`，body `model=text-embedding-v3`。单测断言完整 URL 与 model |
| R9：`dimensions=1024`、`encoding_format=float`；length≠1024 throw | **YES** | 请求钉 `DASHSCOPE_EMBED_DIM`；空向量 / 48 维 / 非 2xx 均 throw。单测覆盖 |
| R2：密钥只读 env；源码/测试无 apiKey / `sk-` 字面量 | **YES** | 构造读 `env.DASHSCOPE_API_KEY`；夹具仅 `TEST_KEY = "test-key"`。四文件 grep 无 `sk-`。Error 只含变量名 / HTTP status，不含 Bearer 值 |
| R3：缺 key 时 `liveRetrievePorts()` throw，禁止回退 Hash | **YES** | 工厂先 `new DashScopeEmbeddings()`（空白 key 构造即 throw）；已删除 `HashEmbeddings` import 与 `?? new HashEmbeddings()`。单测剥 key 后消息 `/DASHSCOPE_API_KEY/`，且不再落到 RED 时的 `Qdrant URL not configured` |
| R6：`ports.embed` 与注入 rerank 的 embed 同一对象 | **YES** | `const embed = new DashScopeEmbeddings(); rerank: new IndependentReranker({ embed }), embed`。单测替换 `ports.embed.embed` 后 `rerank()` 命中 spy（`IndependentReranker` 持有同一引用） |
| 不把 chat complete 当 embed | **YES** | 只打 `/embeddings`；未引用 `ZhipuLlmProvider` / `complete()`。常量注释写明 chat completions 不得当 embed |
| 实现放 `embeddings.ts`，`index.ts` re-export | **YES** | 未新开第 9 个实现文件 |
| 可注入 `{ fetch, env, baseUrl? }`；CI 不打网 | **YES** | 类单测注入 mock fetch。live 工厂无 DI，共用实例用例改 `globalThis.fetch`（见 Minor） |
| 白名单 / 单 commit / 未 push | **YES** | 仅 4 文件：`embeddings.ts`、`live-ports.ts`、`index.ts`、`dashscope-embeddings.test.ts`。subject=`feat(retrieve): switch live embed to DashScope text-embedding-v3` |
| `register_contract DashScopeEmbeddings` | **YES** | report + MCP 一致 |
| 公开 export 注释（为什么） | **YES** | 见 Quality |
| component：不查 test-cases.md | **YES** | 未查 |
| 非页面：跳过数据防御 | **YES** | 未抽检 |

**Missing：** 无。R4 collection 重建、R5 账本重嵌、R7 生产调用点 await / A12 分属 Task 3–5；brief 白名单不含 `qdrant.ts` / `library.ts` / Vue。`IndependentReranker` 未注入时仍默认 Hash（`rerank.ts` 不在白名单）；live 路径已注入。

**Extra（白名单外）：** 无。未改 qdrant / library reindex / Vue / DSL / `ports.ts`。导出常量 `DASHSCOPE_EMBED_*` 在 `embeddings.ts` 内，服务于钉死 1024 / 禁止聊天模型，不是越界文件。

**Misunderstood：** 无。未把 DASHSCOPE 并入 `resolveEngineMode` 四键；失败点在 `liveRetrievePorts()` / 构造期。未用聊天补全出向量。未静默回退 Hash。

### Strengths
- 装配顺序与 RED 证据同构：缺 key 必须在 Qdrant 构造之前失败。RED 抛的是 `Qdrant URL not configured`；GREEN 后同一用例匹配 `/DASHSCOPE_API_KEY/`，证明不是改测试迁就旧顺序。
- live 工厂与 spec 伪代码一致：`const embed = …; IndependentReranker({ embed })` 与 `ports.embed` 同一引用，禁止第二套 embed。
- 失败面钉在行为上：非 2xx / 空 embedding / 维数≠1024 均 throw；Error 单测明确不含 `test-key` 与 `Bearer `。
- 切片锁得住：DashScope 进既有 `embeddings.ts`，Hash/Fixture 未改维；未提前做 Qdrant 重建或 reindex。
- 诚实 `DONE_WITH_CONCERNS`：共用实例测试需临时 `QDRANT_URL`/`NEO4J_URI`、rerank 默认 Hash、MCP 可能改 `.ai/` 未进 commit，均写入 report。

### Issues
#### Critical (Must Fix)
- 无。

#### Important (Should Fix)
- `refresh_asset` 落到 `frontend/core-engine/util#embeddings` / `#live-ports`（路径比 Task 1 的 `frontend/packages/util` 更接近源码），但摘要仍是「javadoc 与函数签名暂缺 / Exports 暂无」，未写 v3、1024、缺 key throw、rerank 共用实例。既有 `frontend/packages/util#embeddings` Updated 仍为 Task 1。`query_contract liveRetrievePorts` 的 INDEX 描述仍是 `HashEmbeddings IndependentReranker`（2026-08-28）；brief 只要求登记 `DashScopeEmbeddings`，源码已换。批次禁止 `audit_arch_changes` / 手工改 `.ai/`；留给 PB-5 `finish_feature` closeout，**不阻断本 Task 源码验收**（与 F2-1 同口径，非 Critical）。

#### Minor (Nice to Have)
- 共用实例用例通过 `globalThis.fetch` 桩 + 占位 `QDRANT_URL`/`NEO4J_URI` 才能构造 live 工厂；Qdrant client 可能对 dummy URL 打 version-check（report 已披露）。`liveRetrievePorts()` 按 spec 无 DI，可接受，但会把存储构造带进 embed 单测。
- 缺 key 用例在 throw 后对 `undefined instanceof HashEmbeddings` 断言恒为 false；真正防回退的证据是错误消息从 Qdrant 换成 `DASHSCOPE_API_KEY`，以及 `live-ports.ts` 已无 Hash import。
- 共用实例用 `spy.mock.calls.length > 0`，未断言 query+candidate 两次，也未（也无法在不碰 private 字段时）`toBe` 比较 rerank 内部 embed。行为上已足够证明同一引用。
- `live-ports.ts` 文件头仍写「Qdrant + Neo4j」，函数 JSDoc 已说明 v3 / 缺 key / 禁 Hash。
- `index.ts` 仅 re-export，未纳入 `AssetsRefreshed`（brief 写「改动源文件」；符号注释在 `embeddings.ts`）。
- T2 措辞「断言未调用 Hash 路径」：实现从不实例化 Hash；单测断言 live `embed` 是 `DashScopeEmbeddings` 且不是 `HashEmbeddings`，未对类单测做 Hash 构造计数。

### Quality
**公开方法注释抽检：PASS（Approved）**

本片新增或行为变更的公开面：

- `DashScopeEmbeddings`：为何 live 必须用 v3 而非 Hash 48 维；为何缺 key 在构造失败（禁止静默装配 Hash）。
- `DashScopeEmbeddings.embed`：为何 async、为何钉 1024（避免与 Hash 48 混进 Qdrant）。返回 `Promise<number[]>`。
- `liveRetrievePorts`：为何与 rerank 共用同一 v3 实例；为何缺 key 失败点在此而非 `resolveEngineMode`（memory CI 仍可用）。返回 `RetrievePorts`。
- 导出常量 `DASHSCOPE_EMBED_DIM` / `DASHSCOPE_EMBED_MODEL` / `DASHSCOPE_DEFAULT_BASE_URL`：为何 1024、为何禁止 chat completions、为何走兼容模式 origin。
- `DashScopeEmbeddingsOptions` 字段：为何注入 fetch/env/baseUrl（CI 不打网、测试可剥 key、生产不改 host）。

均有明确 return type（构造函数除外）；`embed` / `parseDashScopeEmbedding` / `liveRetrievePorts` 均远小于 80 行。`parseDashScopeEmbedding` 未 export。既有 `HashEmbeddings.embed` / `FixtureEmbeddings.embed` 注释未回退。

测试验的是请求 URL/body、维数、缺 key 错误文案、rerank 是否打到同一 `embed` 方法，不是只 grep 模型名。错误处理：HTTP/空向量/错维 throw，无空 catch、无 Hash 回退；消息不含密钥。

**白名单 / 密钥：** commit 仅四文件。未含 `.ai/`、`.env`、token、`sk-`、真实 apiKey。未 push。未改 qdrant / library / Vue。

**APT Micro-closeout vs diff：** `ContractsRegistered=DashScopeEmbeddings` 与 MCP/源码一致。`AssetsRefreshed` 两个 `sourcePath` 与白名单源文件（除 `index.ts`）一致，索引摘要偏空（见 Important）。`AssetsRemoved` 无。diff 未改 `.ai/`（MCP 侧效应未进本 commit，与 report 一致）。

### Assessment
**Task quality:** Approved
**Reasoning:** live embed 已接到兼容模式 text-embedding-v3（1024），密钥只读 env，缺 key 在装配期显式失败且无 Hash 回退，rerank 注入同一实例；单测用 mock fetch 覆盖 R1/R2/R3/R6/R9，提交未越白名单、未泄漏密钥。`refresh_asset` 摘要空与 `liveRetrievePorts` 契约描述未刷新属知识库债，不构成本片 Critical/Important 源码必修项。
