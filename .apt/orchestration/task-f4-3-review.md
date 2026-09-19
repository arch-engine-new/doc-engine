# Task F4-3 Review — liveRetrievePorts 换 HttpReranker + 改写 F-2/F-3 绿条

review-tier: full
projectType: component（跳过 B2 `designs/v0/*/test-cases.md` 门禁；非页面 Task，跳过数据防御抽检；本片无新公开 export，公开方法注释抽检针对既有 `liveRetrievePorts` 注释更新）
Plan: `docs/apt/plans/2026-09-19-live-http-rerank-plan.md` Task 3
Spec: `docs/superpowers/specs/2026-09-19-live-http-rerank-design.md`（Rn：R1/R3/R7/R9；T5）
Brief: `.apt/orchestration/task-f4-3-brief.md` / `.apt/orchestration/task-f4-3-review-brief.md`
Report: `.apt/orchestration/task-f4-3-report.md`
BASE_SHA: `cb785c5ae0f6d85acbc5a396e90158159fabaaa9`（F4-2 DONE：`feat(retrieve): add HttpReranker for independent HTTP rerank`）
HEAD: `b0fec81485f006a2c75c433bdbdfe87df194b49f`（subject: `feat(retrieve): assemble liveRetrievePorts with HttpReranker`；parent = BASE_SHA）
Status (implementer): `DONE`
Verify（implementer 已报；审查方未重跑）：**PASS** `Test Files  3 passed (3)` / `Tests  20 passed (20)`，cwd `packages/core-engine`，`npx vitest run test/live-zhipu-prequery.test.ts test/dashscope-embeddings.test.ts test/http-rerank.test.ts`。

审查范围：只审 `git diff cb785c5ae0f6d85acbc5a396e90158159fabaaa9..HEAD`。工作区其它未提交文件（含 report）不计入本 Task。审查方只读：未改代码、未 commit、未重跑 vitest。gstack review 不可用，已跳过。

MCP（审查方只读复查）：
- `query_contract liveRetrievePorts` 命中 `packages/core-engine/src/retrieve/live-ports.ts`。description 已改为 HttpReranker（dedicated HTTP `/reranks`，不是 IndependentReranker，不共享 embed/llm）；prequery 仍 ZhipuPrequery；缺 DASHSCOPE / Unconfigured LLM throw。`tsContent` 与 HEAD 源码一致：`rerank: new HttpReranker()`，无 `IndependentReranker` import。
- `query_contract ZhipuPrequery` 命中 `prequery.ts`：glm rewrite，must not be used as rerank。本 commit **未改** `prequery.ts`。
- `query_contract IndependentReranker` 仍指向 `rerank.ts`（余弦 + `lexicalScore`）。本 commit **未改** `rerank.ts`。
- `query_contract HttpReranker` missing（brief / plan 允许留给 Task 5 `register_contract`；审查方**未** `report_missing` 停工）。
- `query_arch frontend/core-engine/util#liveretrieveports` 仍为泛化摘要（「暂无 javadoc / signatures」），Updated `2026-09-19T13:22:36.787Z` = commit `21:22 +0800`，与 report `refresh_asset live-ports.ts` 时间对齐。禁止 `audit_arch_changes`，未手工改 `.ai/`。
- `query_contract DashScopeEmbeddings` 仍写「liveRetrievePorts injects the same instance into IndependentReranker」（F-2 旧描述）。本片白名单不含 embeddings.ts / 该 contract，留给后续知识库债，不阻断源码验收。

### Spec Compliance
- ✅ Spec compliant

相对 plan Task 3、brief（live `rerank: new HttpReranker()`；禁止 `?? new IndependentReranker()`；禁止把 embed/llm 传入 rerank；prequery 仍 ZhipuPrequery；改写 F-2/F-3 共用 embed 绿条；白名单仅 live-ports.ts + 两测试；Verify 20 passed）与编码规范（导出「为什么」、明确 return type、函数 ≤80 行）：**无 Missing / Extra（白名单外）/ Misunderstood**。

| 检查项 | 结果 | 证据 |
|--------|------|------|
| `liveRetrievePorts().rerank` 为 `HttpReranker`，`not.toBeInstanceOf(IndependentReranker)` | **YES** | `live-ports.ts`：去掉 `IndependentReranker` import；`rerank: new HttpReranker()`（无 options）。两测试均 `toBeInstanceOf(HttpReranker)` + `not.toBeInstanceOf(IndependentReranker)` |
| 禁止 `?? new IndependentReranker()`；禁止把 embed / llm 传入 rerank | **YES** | 构造零参。`embed` 只进 return 的 `embed` 字段；`llm` 只进 `new ZhipuPrequery(llm)`。无 `{ embed }` / `{ llm }` 传给 HttpReranker |
| prequery 仍 `ZhipuPrequery` + `requireConfiguredLlm`；不回退 FakePrequery | **YES** | 装配未改 prequery 路径。`live-zhipu-prequery.test.ts` 仍断言 `ZhipuPrequery` / 缺 LLM throw / 单测可 FakePrequery；T5 改写用例额外 `expect(ports.prequery).toBeInstanceOf(ZhipuPrequery)` |
| embed 继续 `DashScopeEmbeddings`，非 HashEmbeddings | **YES** | `const embed = new DashScopeEmbeddings()`。dashscope 用例 `toBeInstanceOf(DashScopeEmbeddings)` + `not.toBeInstanceOf(HashEmbeddings)` |
| T5：调用 `rerank` 时 spy `ports.embed.embed` 次数 = 0 | **YES** | 两文件均把 `ports.embed.embed` 换成 spy 后 `rerank("query", [{ clause_id, text }])`，`toHaveBeenCalledTimes(0)`。旧断言 `toBeGreaterThan(0)` 已删 |
| stub `globalThis.fetch`：`/reranks` 返回精排 results；URL 不含 `chat/completions`、不以 `/embeddings` 作为精排 path | **YES** | mock 对含 `/reranks` 的 URL 返回 `{ results: [{ index: 0, relevance_score: 0.9 }] }`；`not.toContain` / `not.toMatch` `chat/completions`；rerank URL `endsWith("/embeddings")` 为 false；`rerankCalls` length = 1 |
| 删除「shares one DashScopeEmbeddings instance with IndependentReranker」 | **YES** | 工作区 grep 无该标题。改为 `does not call embed when live rerank uses HttpReranker` |
| 改写「keeps IndependentReranker on embed only…」 | **YES** | 改为 `assembles HttpReranker, not IndependentReranker, and never embeds or chat-completes`。旧 `toBeInstanceOf(IndependentReranker)` 与 embeddings 形 mock 已删 |
| 更新过时注释「Live retrieve must share one v3 embedder with rerank」 | **YES** | 改为：live embed 仍 DashScope v3；live rerank 是独立 HTTP ranker；共用 v3 embedder 给 IndependentReranker 会冒充独立模型 |
| 未改 `rerank.ts` / `library.ts` / `http-rerank.ts` / Vue / job-pipeline | **YES** | diff 无名这些文件。`http-rerank.test.ts` 无 diff（8 tests 回归） |
| mock fetch；夹具仅 `test-key`；无真实 HTTP / 真实密钥 | **YES** | `TEST_KEY = "test-key"`。llm.json `apiKey: TEST_KEY`。无 `sk-`、无 Bearer 明文。未 `audit_arch_changes` |
| 白名单 / 单 commit | **YES** | 仅 3 文件：`live-ports.ts`（+3/−3 净改装配）、`dashscope-embeddings.test.ts`、`live-zhipu-prequery.test.ts`。report 未进 commit。未捎 PdfTickPanel.vue / job-pipeline.ts。subject=`feat(retrieve): assemble liveRetrievePorts with HttpReranker` |
| `register_contract liveRetrievePorts` | **YES** | MCP description 已写 HttpReranker，不再写共用 embed。`HttpReranker` 契约仍未登记，符合「留给 Task 5」 |
| component：不查 test-cases.md | **YES** | 未查 |
| 非页面：跳过数据防御 | **YES** | 未抽检 |

**Missing：** 无。plan Task 3 的装配切换、禁止回退 IndependentReranker、禁止 embed/llm 注入 rerank、T5 行为（实例类型 + embed spy=0 + `/reranks` 非 chat/embeddings）、F-2/F-3 两条绿条改写、prequery 保持 ZhipuPrequery、微闭环更新 `liveRetrievePorts` description，均已落地。`http-rerank.test.ts` 未改且 implementer 报仍绿。

**Extra（白名单外）：** 无。commit 只有白名单三文件。测试里对 `RERANK_URL` / `RERANK_MODEL` / `RERANK_API_KEY` 做 snapshot + `delete` 是为钉死默认 `/reranks` 路径，不是范围外文件。未改 `http-rerank.ts` / `rerank.ts` / `library.ts` / `index.ts` / Vue / `.ai/` / `.env`。

**Misunderstood：** 无。未静默 `?? new IndependentReranker()`；未把同一 `DashScopeEmbeddings` 实例交给 rerank；未把 `llm` / `ZhipuPrequery` 当精排；未用 `/embeddings` 或 `chat/completions` 冒充 `/reranks`。旧绿条「共用 embed 被调用」已翻转成「embed 次数 = 0」。CI 端口未在本片改动（T7/T8 属 Task 4）。

### Strengths
- 切片锁得住：一条 commit、白名单三文件、实现就是把 `new IndependentReranker({ embed })` 换成 `new HttpReranker()`，测试从「必须打 embed」改成「禁止打 embed」。
- T5 是行为证据，不是只 grep 类名：实例类型 + embed spy=0 + fetch 过滤 `/reranks` + 禁止 chat/embeddings path。误把 IndependentReranker 装回去会同时打绿 embed spy 与类型断言。
- F-2 / F-3 两条会把本片目标测反的绿条都改写了，且保留 DashScope 缺 key、ZhipuPrequery 装配、缺 LLM throw、单测 FakePrequery。
- 密钥与网络闭合：夹具只有 `test-key`；`RERANK_*` 在用例内 delete，避免本机 env 把精排打到别的 URL；mock `fetch`，未打真实百炼。
- report 诚实：Neo4j 构造会异步 version check，因此不把 fetch 总次数钉死为 1，只断言精排 path。审查方同意这是既有副作用，不是精排回归缺口。

### Issues
#### Critical (Must Fix)
- 无。live rerank 已装配 HttpReranker，embed/llm 未注入 rerank，prequery 仍 ZhipuPrequery，F-2/F-3 绿条已改写，commit 仅白名单三文件。

#### Important (Should Fix)
- 无。`query_contract HttpReranker` missing 与 `DashScopeEmbeddings` contract 仍写「注入 IndependentReranker」是 Task 5 / 知识库债，**不阻断本片源码验收**。禁止本 Task `audit_arch_changes` / 手工改 `.ai/`。

#### Minor (Nice to Have)
- `dashscope-embeddings.test.ts` 的 T5 用例未再断言 `prequery instanceof ZhipuPrequery`（R7 在 `live-zhipu-prequery.test.ts` 覆盖）。重复断言非必须。
- T5 不钉死默认 URL `compatible-api/v1/reranks`（只要求含 `/reranks`、非 embeddings、非 chat）。默认 URL 已由未改的 T1 锁定；`new HttpReranker()` 无 url 覆盖。
- `query_arch` 自动摘要仍无 HttpReranker / 签名（与 F-3 同型 refresh 质量问题）。Updated 时间与本 commit 对齐，说明 refresh 已跑。
- Neo4j 构造副作用使 `globalThis.fetch` 可能被非精排调用；implementer 已用 `/reranks` 过滤而非 `toHaveBeenCalledTimes(1)`，可接受。

### Quality
**公开方法注释抽检：PASS（Approved）**

本片无新 `export`。既有公开入口 `liveRetrievePorts(): RetrievePorts` 注释从「必须与 rerank 共用 v3 embedder」改为说明为什么不能共用（会冒充独立模型），以及 embed / prequery 不变量仍在。`requireConfiguredLlm` 非导出，原「为什么」注释保留。无无意义 TODO。

函数均有明确 return type：`liveRetrievePorts(): RetrievePorts`、`requireConfiguredLlm(): ReturnType<typeof createLlmProvider>`。函数体均 ≤80 行（装配约 10 行）。文件约 48 行。

测试验的是实例类型、embed 调用次数、精排 HTTP path，不是只 grep 构造字符串。错误处理：本片未改 throw 路径；夹具 Error 不含密钥。

**白名单 / 密钥：** commit 仅 `packages/core-engine/src/retrieve/live-ports.ts`、`packages/core-engine/test/dashscope-embeddings.test.ts`、`packages/core-engine/test/live-zhipu-prequery.test.ts`。无 `.env`、无 `sk-`、夹具 apiKey 只有 `test-key`。未 push。未改 `.ai/`。未改 `http-rerank.ts` / `rerank.ts` / `library.ts` / Vue / job-pipeline。

**APT Micro-closeout vs diff：** `ContractsRegistered: liveRetrievePorts` 与 MCP（description 已写 HttpReranker、不再共用 embed）一致。`AssetsRefreshed: live-ports.ts` 与 `query_arch` Updated 时间一致。`HttpReranker` 仍未登记，符合 plan Task 5。diff 未改 `.ai/`。禁止 `audit_arch_changes`，未手工改知识库。

### Assessment
**Task quality:** Approved
**Reasoning:** live `RetrievePorts.rerank` 已装配 `new HttpReranker()`，未回退 IndependentReranker，也未把 embed/llm 传入 rerank。embed 仍 DashScopeEmbeddings，prequery 仍 ZhipuPrequery。F-2/F-3 把「共用 embed 当绿」的测试已改成 T5：HttpReranker、embed.embed=0、`/reranks` 且非 chat/embeddings。单 commit 仅白名单三文件。知识库 `HttpReranker` 登记留给 Task 5，不构成本片 Critical。
