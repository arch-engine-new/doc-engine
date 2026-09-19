# Task F3-1 Review — liveRetrievePorts 装配 ZhipuPrequery

review-tier: full
projectType: component（跳过 B2 `designs/v0/*/test-cases.md` 门禁；非页面 Task，跳过数据防御抽检；公开方法注释必须抽检）
Plan: `docs/apt/plans/2026-09-19-f3-zhipu-prequery-plan.md` Task 1
Brief: `.apt/orchestration/task-f3-1-brief.md` / `.apt/orchestration/task-f3-1-review-brief.md`
Report: `.apt/orchestration/task-f3-1-report.md`
BASE_SHA: `17fee66b1494f3f4da4850c5df971a1de8acc386`
HEAD: `cf22716`（subject: `wire liveRetrievePorts prequery to ZhipuPrequery`）
Status (implementer): `DONE`
Verify（implementer 已报；审查方未重跑）：`Test Files  3 passed (3)` / `Tests  27 passed (27)`，cwd `packages/core-engine`。TDD RED 报 2 failed / 2 passed（装配仍为 FakePrequery、缺 LLM 未 throw），GREEN 后同上 27 passed。

审查范围：只审 `git diff 17fee66..cf22716`。审查方只读：未改代码、未 commit、未重跑 vitest。

MCP（审查方只读复查）：
- `query_contract ZhipuPrequery` 已登记，`tsFilePath=packages/core-engine/src/retrieve/prequery.ts`；description 写明生产 glm prequery、测试 FakePrequery、不得当 rerank。本 commit **未改** `prequery.ts`（类已存在，仅补合同）。
- `query_contract liveRetrievePorts` description 已更新：prequery 为 ZhipuPrequery；IndependentReranker 只注入 embed；缺 DASHSCOPE 或 Unconfigured/Fake LLM throw；禁止 HashEmbeddings / FakePrequery 回退。`tsContent` 与 HEAD `live-ports.ts` 一致。
- `query_arch frontend/core-engine/util#liveRetrievePorts` 仍为泛化摘要（「暂无 javadoc / signatures」），Updated `2026-09-19T09:09:53Z`（早于本 commit `18:54 +0800`），**未**写入 ZhipuPrequery / 缺 LLM throw。`frontend/packages/util/live-ports` `query_arch` Path not found。与 report「refresh 落到 frontend/packages/util/live-ports（created）」一致；禁止 `audit_arch_changes`，未手工改 `.ai/`。

### Spec Compliance
- ✅ Spec compliant

相对 plan Task 1、brief 验收标准（live prequery = ZhipuPrequery；缺 LLM 显式失败；单测仍可 FakePrequery；禁止 chat-as-rerank；禁止密钥明文；白名单三文件）与编码规范（导出「为什么」、明确 return type、函数 ≤80 行）：**无 Missing / Extra（白名单外）/ Misunderstood**。

| 检查项 | 结果 | 证据 |
|--------|------|------|
| `liveRetrievePorts().prequery` 为 `ZhipuPrequery`，不是 `FakePrequery` | **YES** | `prequery: new ZhipuPrequery(llm)`。测试 `toBeInstanceOf(ZhipuPrequery)` 且 `not.toBeInstanceOf(FakePrequery)`。有配置时 `AGENT_RUNTIME_LLM_CONFIG` 临时 json（`provider: zhipu`、`apiKey: test-key`） |
| 缺 LLM 显式 throw，不静默 `new FakePrequery()` | **YES** | `requireConfiguredLlm()`：`createLlmProvider()` 若 `UnconfiguredLlmProvider` / `FakeLlmProvider` 则 throw（消息含 Unconfigured / LLM / llm.json）。缺配置夹具用缺失文件 + `APT_PROJECT_ROOT` 空临时目录，避免 arch chat 回落。`returned` 保持 undefined |
| 单测仍可 `new FakePrequery()`；`rewrite` 仍可用 | **YES** | 本片显式构造 + `rewrite("表 8.5.1-1")` 断言 semantic/原文。`standard-rag.test.ts` 未改，implementer 报仍绿 |
| `rerank` 仍为 `IndependentReranker({ embed })`，禁止 `new IndependentReranker(llm)` | **YES** | 装配只传 `{ embed }`。测试：`instanceof IndependentReranker`；`rerank()` 走 `ports.embed.embed` spy；`fetch` URL 不含 `chat/completions`。若误传 ChatComplete 位置参，rerank 会改用内部 HashEmbeddings，spy 次数会为 0 |
| 构造顺序：缺 DASHSCOPE 仍先失败 | **YES** | `new DashScopeEmbeddings()` 在 `requireConfiguredLlm()` 之前。既有 `dashscope-embeddings.test.ts` 缺 key 用例保留，成功路径补临时 llm.json |
| 无真实智谱 / DashScope HTTP；夹具仅 `test-key` | **YES** | 装配断言 + mock fetch；未调用 `ZhipuPrequery.rewrite`。三文件无 `sk-`、无真实密钥。throw 消息断言不含 `TEST_KEY` |
| 白名单 / 单 commit | **YES** | 仅 3 文件：`live-ports.ts`、`live-zhipu-prequery.test.ts`（新）、`dashscope-embeddings.test.ts`。report 未进 commit |
| 公开 export「为什么」注释 | **YES** | 见 Quality |
| component：不查 test-cases.md | **YES** | 未查 |
| 非页面：跳过数据防御 | **YES** | 未抽检 |

**Missing：** 无。`ZhipuPrequery` / `ChatComplete` / `createLlmProvider` 已存在，本片只改装配，符合 plan「只改 liveRetrievePorts()」。无效/空 json 与缺失文件同走 `loadLlmRuntimeConfig` → null → Unconfigured，brief 允许三选一，测缺失足够。

**Extra（白名单外）：** 无。commit 只有白名单三文件。未改 `job-pipeline.ts`、`prequery.ts` 实现、`rerank.ts`、Vue、`.ai/`。`agent-runtime` 已是 `core-engine` 依赖，无需改 `package.json`。

**Misunderstood：** 无。未把 Unconfigured 的 `complete()` 成功字符串当成 rewrite；未在 live 回退 FakePrequery；未把 ChatComplete 交给 IndependentReranker。缺 LLM 的 throw 发生在构造 Qdrant/Neo4j **之前**，失败路径不会先连 store。

### Strengths
- 失败闭合写在装配层：`UnconfiguredLlmProvider.complete()` 会返回「尚未配置…」看起来像成功 rewrite，`requireConfiguredLlm` 注释与 throw 对准这个不变量，而不是等第一次 `rewrite` 才暴露。
- 缺 LLM 测试隔离 `APT_PROJECT_ROOT`，避免本机 `.ai/arch/arch.config.json` chat 让用例非确定地绿。report 写明了原因。
- rerank 回归是行为断言（embed spy + 禁止 `chat/completions`），不是只 grep 构造参数；误用位置参 ChatComplete 会落到 HashEmbeddings，本断言能抓住。
- 切片干净：既有 DashScope 缺 key 用例不动；成功路径只补 llm.json；密钥字面量只有 `test-key`；env/tmpdir 在 `afterEach` 还原。
- TDD 记录具体：RED 两条失败断言与旧 `FakePrequery` 装配一一对应，可信。

### Issues
#### Critical (Must Fix)
- 无。

#### Important (Should Fix)
- `refresh_asset` 未更新既有 `frontend/core-engine/util#liveRetrievePorts`（仍「暂无 javadoc」；Updated 早于本 commit）。report 称落到新建 `frontend/packages/util/live-ports`，审查方 `query_arch` 该 path 不存在。`query_contract liveRetrievePorts` 已与源码一致。批次禁止 `audit_arch_changes` / 手工改 `.ai/`；留给后续 closeout，**不阻断本 Task 源码验收**（与 F2 同口径，非 Critical）。

#### Minor (Nice to Have)
- 缺 LLM 用例里 `returned instanceof FakePrequery` 在 throw 后恒为 false（`returned` 未赋值）。真正锁门的是「必须 throw + 消息匹配 + 非密钥」。
- `live-rag-ingest.test.ts` 的 `hasLiveEnv` 仍不含 LLM 配置（不在白名单）。有 DASHSCOPE/Qdrant/Neo4j 但无 llm.json 时，`skipIf` 为 false，`beforeAll` 的 `liveRetrievePorts()` 会按本片设计 throw。这是 fail-closed，不是静默 Fake；若后续要保留 live smoke skip，再把 LLM 配进 skip 条件即可。
- commit subject 清晰但未用仓库 `type(scope):` 格式（brief 只要求一条清晰 subject）。
- 成功装配用例未 mock `fetch`；Qdrant 构造可能对占位 URL 打 version 探测（report 已披露警告）。禁止项是真实智谱/DashScope HTTP，本片未打。

### Quality
**公开方法注释抽检：PASS（Approved）**

本片无新 export、无签名变更。既有公开入口 `liveRetrievePorts(): RetrievePorts` 保留并补了为什么：live prequery 走 glm，Unconfigured/Fake 必须 throw 而不是 FakePrequery。私有 `requireConfiguredLlm(): ReturnType<typeof createLlmProvider>` 也有为什么（Unconfigured `complete()` 像成功 rewrite）。两函数远小于 80 行，均有明确返回类型。

测试验的是 instanceof、缺配置 throw、FakePrequery 直构 rewrite、rerank 走 embed 且不 chat-complete，不是只 grep 类名。错误处理：无空 catch；无密钥回显；缺 DASHSCOPE 仍先于 LLM 检查失败。

**白名单 / 密钥：** commit 仅三文件。无 `.env`、无 `sk-`、无真实 apiKey。未改 Vue / `prequery.ts` / `rerank.ts` / `job-pipeline.ts`。

**APT Micro-closeout vs diff：** `ContractsRegistered` 与 MCP 一致（`ZhipuPrequery` registered；`liveRetrievePorts` updated），且 `liveRetrievePorts` 的 `tsContent` 等于 HEAD。`AssetsRefreshed` 的 sourcePath 是白名单 `live-ports.ts`，索引未落到既有 `frontend/core-engine` 条目（见 Important）。`AssetsRemoved` 无。diff 未改 `.ai/`。未 `refresh_asset` `prequery.ts`：该文件无 diff，brief 为「若 description 需同步」。

### Assessment
**Task quality:** Approved
**Reasoning:** live 装配已切到 `ZhipuPrequery`，Unconfigured/Fake LLM 在端口构造时 fail-closed，FakePrequery 仍可单测注入，rerank 只注入 embed。提交未越白名单、未写入真实密钥。`refresh_asset` 错挂属知识库债，不构成本片 Critical 源码必修项。
