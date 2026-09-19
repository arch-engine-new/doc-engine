# Task F4-2 Review — 实现 HttpReranker（后绿）

review-tier: full
projectType: component（跳过 B2 `designs/v0/*/test-cases.md` 门禁；非页面 Task，跳过数据防御抽检；本片有新公开 export，公开方法注释必须抽检）
Plan: `docs/apt/plans/2026-09-19-live-http-rerank-plan.md` Task 2
Spec: `docs/superpowers/specs/2026-09-19-live-http-rerank-design.md`（Rn：R2/R3/R4/R5/R8；T1–T4/T6/T8）
Brief: `.apt/orchestration/task-f4-2-brief.md` / `.apt/orchestration/task-f4-2-review-brief.md`
Report: `.apt/orchestration/task-f4-2-report.md`
BASE_SHA: `8c8ea79e5fb150ef7ba555be71006049816c2860`（F4-1 RED：`test: add failing HttpReranker cases for F-4`）
HEAD: `cb785c5ae0f6d85acbc5a396e90158159fabaaa9`（subject: `feat(retrieve): add HttpReranker for independent HTTP rerank`；parent = BASE_SHA）
Status (implementer): `DONE`
Verify（implementer 已报；审查方未重跑）：**PASS** `Test Files  1 passed (1)` / `Tests  8 passed (8)`，cwd `packages/core-engine`，`npx vitest run test/http-rerank.test.ts`。

审查范围：只审 `git diff 8c8ea79..cb785c5`。工作区其它未提交文件（含 report）不计入本 Task。审查方只读：未改代码、未 commit、未重跑 vitest。gstack review 不可用，已跳过。

MCP（审查方只读复查）：
- `query_contract HttpReranker` missing（brief 允许留给 Task 5 `register_contract`；审查方**未** `report_missing` 停工）。
- `query_contract DashScopeEmbeddings` 命中 `embeddings.ts`：注入样板为 `fetch` / `env` / 缺密钥 throw；`DASHSCOPE_DEFAULT_BASE_URL` = `https://dashscope.aliyuncs.com/compatible-mode/v1`（POST `/embeddings`）。本片**未 import** 该常量、未拼 `/reranks`。
- `query_contract ChatComplete` 在 `ports.ts`：`complete({ prompt })` — `http-rerank.ts` 未 import、未调用。
- `query_contract RetrievePorts` 含 `interface Reranker { rerank(query, candidates): Promise<string[]> | string[] }`。本片 `implements Reranker`，**未改签名**。
- `query_contract IndependentReranker` 仍指向 `rerank.ts`（余弦 + `lexicalScore`）。本 commit **未改** `rerank.ts`。
- `query_arch frontend/core-engine/util#HttpReranker` Section not found。`search_arch` `HttpReranker independent HTTP rerank compatible-api` 仍落到 `IndependentReranker` / `rerank.ts` / HashEmbeddings，无 HttpReranker 资产（`refresh_asset` 留给 Task 5）。

### Spec Compliance
- ✅ Spec compliant

相对 plan Task 2、brief（最小实现 `HttpReranker implements Reranker`；独立 HTTP；禁止 chat-as-rerank / 本地余弦 / 复用 compatible-mode embeddings URL；缺密钥 throw；Error 不含密钥；不改 `live-ports.ts`；白名单仅实现 + re-export；Verify 8 passed）与编码规范（导出「为什么」、明确 return type、函数 ≤80 行）：**无 Missing / Extra（白名单外）/ Misunderstood**。

| 检查项 | 结果 | 证据 |
|--------|------|------|
| `HttpReranker implements Reranker`；独立 HTTP POST `/reranks` | **YES** | 新文件 `packages/core-engine/src/retrieve/http-rerank.ts`。仅 `import type` `RerankCandidate`/`Reranker` from `ports.js`。`rerank` 对非空候选 `fetchImpl(this.url, { method: "POST", ... })` |
| 默认 URL `compatible-api/v1/reranks`；**禁止**复用 `DASHSCOPE_DEFAULT_BASE_URL` / `compatible-mode` / `/embeddings` | **YES** | `DEFAULT_RERANK_URL = "https://dashscope.aliyuncs.com/compatible-api/v1/reranks"`。无 `from "./embeddings"`。源码仅在注释里出现 `compatible-mode` / `/embeddings`（说明禁止项）。T1 钉死该 URL 且 `not.toContain("compatible-mode")` / 不以 `/embeddings` 结尾 |
| 禁止 chat-as-rerank：不调用 `complete()` / 不走 `chat/completions` | **YES** | 无 `ChatComplete` / `complete(` import 或调用。T1 断言 URL `not.toContain("chat/completions")` |
| 禁止本地余弦 / `embed()` / import Hash/DashScope/IndependentReranker | **YES** | 无 `cosine` 函数、无点积、无 `embed(`。T4 `readFileSync` 源码 `not.toMatch(/IndependentReranker/)`（注释也避开该类名）。排序键是响应 `relevance_score ?? score` |
| POST `{ model, query, documents }`，不要 `top_n` | **YES** | `JSON.stringify` 仅三字段。T1 `body.top_n` undefined；T6 `Object.keys` 精确 `documents/model/query` |
| 缺 `RERANK_API_KEY` 且缺 `DASHSCOPE_API_KEY` 构造 throw；Error 不含密钥值 | **YES** | `(options.apiKey ?? env.RERANK_API_KEY ?? env.DASHSCOPE_API_KEY)?.trim()`；空 → `throw new Error("RERANK_API_KEY or DASHSCOPE_API_KEY is required")`。四处 throw 均为固定文案或 `Rerank HTTP ${status}`，无 secret 插值。T3 消息匹配变量名且 `not.toContain("test-key")` |
| 空候选不发网 | **YES** | `candidates.length === 0` → `[]`。T8 `fetch` 0 次 |
| 非 2xx → `Rerank HTTP <status>`；空 results throw | **YES** | `!response.ok` → `` `Rerank HTTP ${response.status}` ``。`results` 非数组或 length 0 → `"Rerank HTTP returned empty results"`。T4 覆盖 500 与 `results: []` |
| 分数降序输出 `clause_id`；缺席下标按原相对顺序追加；越界忽略、有效项 0 throw | **YES** | `rankByRemoteScores`：越界/非 number index skip；`seen` 去重；缺分数 skip；`scored.length === 0` throw；`sort` 降序；未出现下标按 `i=0..n-1` 追加。T2 覆盖降序；追加/越界无单测但实现与 plan 字面一致 |
| `index.ts` re-export `HttpReranker` | **YES** | `export { HttpReranker } from "./retrieve/http-rerank.js"`，紧挨 `IndependentReranker` |
| 未改 `live-ports.ts`（留给 Task 3） | **YES** | diff 无名该文件。HEAD 仍 `rerank: new IndependentReranker({ embed })` |
| 未改测试验收断言 | **YES** | `http-rerank.test.ts` 无 diff。T1–T4/T6/T8 八条均保留 |
| mock fetch；夹具仅 `test-key`；无真实 HTTP / 真实密钥 | **YES** | 实现可注入 `fetch`/`env`。commit 两文件无 `sk-`、无硬编码 Bearer。Error 不含密钥。未 `audit_arch_changes` |
| 白名单 / 单 commit | **YES** | 仅 2 文件：`http-rerank.ts`（新 +124）、`index.ts`（+1）。review-brief 白名单即此二文件。report 未进 commit。subject=`feat(retrieve): add HttpReranker for independent HTTP rerank` |
| T5 / live 装配 / `.env.example` / 契约登记 | **YES（刻意不做）** | T5 属 Task 3。`ContractsRegistered: 无` 符合 brief「可留给 Task 5」 |
| 公开 export「为什么」注释 | **YES** | 见 Quality |
| component：不查 test-cases.md | **YES** | 未查 |
| 非页面：跳过数据防御 | **YES** | 未抽检 |

**Missing：** 无。plan Task 2 构造密钥/URL/模型、POST 三字段、空候选、非 2xx、空 results、远程分数排序、re-export、不得 import 三类实现，均已落地。T1–T4/T6/T8 与实现对齐；未删验收断言。`register_contract` / `refresh_asset` 明确可留 Task 5，不算漏项。

**Extra（白名单外）：** 无。commit 只有白名单两文件。未改 `live-ports.ts` / `rerank.ts` / `library.ts` / Vue / 测试 / `.ai/` / `.env`。`body.output?.results`、重复 index skip、有效项 0 throw 是 plan/spec 解析规则，不是范围外文件。

**Misunderstood：** 无。未把 chat complete、embed 余弦或 `compatible-mode/v1` + `/embeddings` 当精排；未提前改 live 装配把测试混绿；未复用 `DASHSCOPE_DEFAULT_BASE_URL` 拼 `/reranks`；缺密钥是构造期 throw，不是 `?? new IndependentReranker()`。T8 第二 describe 仍证明 `defaultRetrievePorts().rerank instanceof IndependentReranker`，CI 端口未误切。

### Strengths
- 切片锁得住：一条 commit、两文件、live 仍是 IndependentReranker + 共用 embed，GREEN 只来自注入 mock fetch 的 HttpReranker，不是改装配或改测试。
- URL 与 embed 路径物理隔离：自有 `DEFAULT_RERANK_URL`（`compatible-api/v1/reranks`），不 import `DASHSCOPE_DEFAULT_BASE_URL`；T1 用行为钉死禁止 `compatible-mode` / `chat/completions` / `/embeddings`。
- 失败闭合：缺密钥、非 2xx、空/非数组 results、越界后有效项 0 均 throw；Error 只含变量名或 HTTP status，Bearer 只在 header。
- 排序键来自远程分数（`relevance_score ?? score`），实现内无余弦/点积/`embed()`；空候选短路避免空 `documents` POST。
- 编码规范对齐 F-2 `DashScopeEmbeddings` 注入样板（`fetch`/`env`/`apiKey`），函数拆成 `orderClauseIds` + `rankByRemoteScores`，均远小于 80 行。
- report 诚实：8 passed、未打网、未登记契约、未改 live-ports；T4 特意不在源码写 `IndependentReranker` 以免 grep 误伤。

### Issues
#### Critical (Must Fix)
- 无。独立 HTTP 精排已落地，测试未改且 implementer 报 8 passed；未越白名单、未改 live-ports、未回显密钥。

#### Important (Should Fix)
- 无。`query_contract HttpReranker` missing 与 `query_arch` 无资产，是 brief 允许的 Task 5 微闭环债，**不阻断本片源码验收**（与 F4-1 / F-2 知识库口径一致）。禁止本 Task `audit_arch_changes` / 手工改 `.ai/`。

#### Minor (Nice to Have)
- 缺席下标追加、`body.output?.results`、全部 index 越界 → `"Rerank HTTP returned no in-range results"` 无单测。plan 要求实现且代码正确；Task 1 红灯集未覆盖，本片未扩测试（brief 允许微调测试，未强制补）。
- `options.url ?? env.RERANK_URL ?? default` 对空字符串不回退默认 URL（`??` 语义，与 plan 字面一致）。生产若设 `RERANK_URL=` 会 POST 空串。
- 私有 `orderClauseIds` / `rankByRemoteScores` 无「为什么」注释；导出类与 `rerank` 已有。构造函数本身无独立 JSDoc（类级注释已覆盖独立 HTTP vs 余弦）。
- `RERANK_MODEL` / `options.model` 覆盖路径无测试（T1/T6 都走默认 `qwen3-rerank`）。实现顺序与 plan 一致。

### Quality
**公开方法注释抽检：PASS（Approved）**

新公开 export：`HttpReranker`、`HttpRerankerOptions`、`rerank()`。文件头与类注释写为什么：分数必须来自远程 ranker，不能用本地向量相似或 v3 embed 余弦。`rerank` 注释写为什么空候选不发网（零命中不 POST 空 documents）。options 字段注释写为什么可注入 fetch/env、为什么 URL 不得复用 compatible-mode base、为什么 apiKey 不进 Error。无无意义 TODO。

函数均有明确 return type：`rerank(...): Promise<string[]>`、`orderClauseIds(...): Promise<string[]>`、`rankByRemoteScores(...): string[]`。构造函数与 `DashScopeEmbeddings` 一样不标 return（TS constructor）。函数体均 ≤80 行（`rerank` ~16，`rankByRemoteScores` ~27）。文件 124 行。

测试（本 commit 未改，F4-1 已审）验的是 POST URL/body、分数序、缺密钥 throw、HTTP 500/空 results、URL 覆盖、空候选不发网，不是只 grep 类名。错误处理：无空 catch；throw 不夹密钥；`Authorization: Bearer ${this.secret}` 只在请求头。

**白名单 / 密钥：** commit 仅 `packages/core-engine/src/retrieve/http-rerank.ts`、`packages/core-engine/src/index.ts`。无 `.env`、无 `sk-`、无真实 apiKey。未 push。未改 `.ai/`。未改 `live-ports.ts` / `rerank.ts` / `library.ts` / Vue。

**APT Micro-closeout vs diff：** `ContractsRegistered: 无` 与 MCP（`HttpReranker` 未登记）一致。`AssetsRefreshed` / `AssetsRemoved` 无；`query_arch` 无 HttpReranker 锚点。diff 未改 `.ai/`。禁止 `audit_arch_changes`，未手工改知识库。符合 brief「可先实现，登记放 Task 5」。

### Assessment
**Task quality:** Approved
**Reasoning:** 本片最小实现 `HttpReranker`：独立 POST `compatible-api/v1/reranks`（或 `RERANK_URL`），body 仅 `{ model, query, documents }`，分数来自远程 `relevance_score`，缺密钥与非 2xx/空 results 显式 throw 且 Error 不含密钥。未 import Hash/DashScope/IndependentReranker，未调用 `embed()`/`complete()`，未复用 compatible-mode embeddings URL，未改 live-ports。白名单两文件 + index re-export；测试未删断言。知识库登记留给 Task 5，不构成本片 Critical。
