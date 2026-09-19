---
status: approved
feature: F-4 live 独立 HTTP rerank
slice: F-4
---

# F-4 live 独立 rerank 接 HTTP Implementation Plan

> **Spec:** `docs/superpowers/specs/2026-09-19-live-http-rerank-design.md`
> **Command:** `/plan-from-spec`
> **Status:** approved

**Goal:** live 标准库语义检索的条款精排必须调用独立 rerank HTTP（默认百炼 `qwen3-rerank` / `compatible-api/v1/reranks`，或 `RERANK_URL` 等价口）；禁止再用 `IndependentReranker` 余弦+词面、或与 v3 embed 共用实例冒充独立模型；禁止 chat-as-rerank；缺密钥或 HTTP 失败显式 throw；CI 继续 `IndependentReranker`。

**Architecture:** 新增 `HttpReranker implements Reranker`（可注入 `fetch` / `env` / `url` / `model` / `apiKey`，对齐 `DashScopeEmbeddings`）。`liveRetrievePorts` 装配 `rerank: new HttpReranker()`，**不再** `new IndependentReranker({ embed })`。embed / prequery 保持 F-2 / F-3：`DashScopeEmbeddings` + `ZhipuPrequery`；rerank 不接收 embed、不接收 llm。`defaultRetrievePorts` / 单测继续 `IndependentReranker`。分数只来自响应 `relevance_score|score`，实现内不算余弦、不调用 `embed()` / `complete()`。

> 全自动自答（`/apt-goal --continue` programMode 切片 F-4）。外层已授权夜间批量，Status=approved。相位机曾报 `loopDone=true` ——程序模式以切片为准，本批无 ACCEPT-BATCH。禁止改 `.apt/goal.md`。本 plan 不含真实密钥。

---

## Part 1 — 技术方案（APT 寻址）

### 1.1 范围与约束

**做：** live `RetrievePorts.rerank` = `HttpReranker`；默认 POST `https://dashscope.aliyuncs.com/compatible-api/v1/reranks`，body `{ model, query, documents }`（默认 `qwen3-rerank`，不传 `top_n`）；`RERANK_URL` 整段覆盖、`RERANK_MODEL` 覆盖模型名；密钥 `RERANK_API_KEY` 优先否则 `DASHSCOPE_API_KEY`；缺密钥 / 非 2xx / 空 results 显式 throw；空候选不发网；缺席 index 按原相对顺序追加、禁止丢 id；改写 F-2/F-3 把「live 共用 embed」当绿的测试。

**不做：** glm / `LlmProvider.complete` / `ChatComplete` / `ZhipuPrequery` 当 rerank；Hash 余弦、v3 embed 余弦、live 注入同一 embed 实例冒充独立精排；改 `Reranker` 签名；改 DSL / 检索路由 / tableHits 旁路 / `library.ts` / F-3 prequery；截断超长条款保成功；密钥写入源码/spec/plan/夹具/commit/日志/Error 值；把 rerank 凭证并入 `resolveEngineMode`；自建 GPU 精排进程；改 9 页 UI。

**Profile：** `.apt/role.md` `projectType: component`（跳过 §0.5 UI / Phase A v0 freeze / B2 `test-cases.md` Gate）。`typeHealth.suggested=business` 不改写。本片无 UI Task、无建表（§0.6 跳过）。`query_contract` name=`Reranker` 未单独登记属知识库债，类型已在 `RetrievePorts`/`ports.ts`，**不** `report_missing` 停工。

**测试案例规划（切片 done-when，不写 page test-cases.md）：** spec T1–T8 → 下表；先红后绿见 Part 2 Task 1/2。夹具 apiKey 字面量只用 `test-key`。mock `fetch` 不打真实网。

| ID | 场景 | 输入 | 预期 | Rn |
|----|------|------|------|----|
| T1 | 默认 HTTP 形 | `new HttpReranker({ env: { DASHSCOPE_API_KEY: "test-key" }, fetch })` + 非空候选 | POST 默认 URL 含 `/reranks`；`body.model=qwen3-rerank`；`body.documents` = 候选 text 数组；URL **不含** `compatible-mode`、**不含** `chat/completions`、**不以** `/embeddings` 结尾 | R2 |
| T2 | 分数排序 | mock `results: [{index:1, relevance_score:0.9},{index:0, relevance_score:0.1}]` | 输出 ids 以 index=1 的 `clause_id` 开头 | R3 |
| T3 | 缺密钥 | 无 `RERANK_API_KEY` 且无 `DASHSCOPE_API_KEY` | 构造 throw，消息匹配 `RERANK_API_KEY\|DASHSCOPE_API_KEY`，**不含** `test-key` | R4/R8 |
| T4 | HTTP 失败 | 500 或空 `results`（候选非空） | throw；不得改去调 `IndependentReranker` | R5 |
| T5 | live 装配 | `liveRetrievePorts()`（DASHSCOPE + 临时 llm.json，同 F-3） | `.rerank` 为 `HttpReranker`，`not.toBeInstanceOf(IndependentReranker)`；调用 `rerank` 时 spy `embed.embed` 次数 = 0；fetch URL 不含 `chat/completions` | R1/R3/R7 |
| T6 | URL 覆盖 | `env.RERANK_URL` 注入 | POST 该 URL，JSON 形仍是 `{ model, query, documents }` | R2 |
| T7 | A12 / 测试余弦类 | 既有 `rerank.test.ts` | `IndependentReranker` 不调用 `complete()`；`standard-rag.test.ts` A12 仍绿 | R6 |
| T8 | 默认端口 + 空候选 | `new IndependentReranker()` / `defaultRetrievePorts()`；`HttpReranker.rerank(q, [])` | 仍可用；空候选 **不** 发 fetch | R6 |

必须改写（不得保留为绿）：

- `dashscope-embeddings.test.ts`「shares one DashScopeEmbeddings instance with IndependentReranker」
- `live-zhipu-prequery.test.ts`「keeps IndependentReranker on embed only…」→ live rerank 不是 IndependentReranker、不打 chat completions、不打 embed

### 1.2 设计寻址（N/A）

本片不改 Vue / `standard_lib` 交互。component Profile 跳过 §0.5。无 `report_design_gap`。

### 1.3 依赖寻址表

| 依赖 | 来源 | 引用（tsFilePath / sourcePath / path） | 摘要 |
|------|------|----------------------------------------|------|
| IndependentReranker | contract + `query_arch` `frontend/core-engine/util#independentreranker` | `packages/core-engine/src/retrieve/rerank.ts` | `implements Reranker`；余弦 + `lexicalScore`；可注入 `embed`；`void options?.llm`，禁止 `complete()`。**本片不改算法**；仅测试 / `defaultRetrievePorts` |
| liveRetrievePorts | contract + `query_arch` `frontend/core-engine/util#liveretrieveports` | `packages/core-engine/src/retrieve/live-ports.ts` | 现 `rerank: new IndependentReranker({ embed })`，`embed` 为同一 `DashScopeEmbeddings`；`prequery: new ZhipuPrequery(llm)`；缺 DASHSCOPE / Unconfigured LLM throw。本片只换 rerank 装配 |
| Reranker | **contract 名未登记**；命中 `query_contract` `RetrievePorts` + 同文件 `Embeddings`/`ChatComplete`；同义词 `search_arch` 落到 `rerank.ts` 实现而非接口锚点 | `packages/core-engine/src/retrieve/ports.ts` | `interface Reranker { rerank(query, candidates): Promise<string[]> \| string[] }`；`RerankCandidate { clause_id, text, vector? }`。**不改签名、不另造端口**。知识库债：实现后登记 `HttpReranker`，可选补登记接口名 |
| RetrievePorts | contract | `packages/core-engine/src/retrieve/ports.ts` | `rerank: Reranker`；`embed: Embeddings`；`prequery: Prequery` |
| Embeddings | contract | 同上 | `embed(text): number[] \| Promise<number[]>` — live rerank **不得**调用 |
| ChatComplete | contract | 同上 | `complete({ prompt })` — A12 / HttpReranker **不得**调用 |
| DashScopeEmbeddings | contract | `packages/core-engine/src/retrieve/embeddings.ts` | v3 `/compatible-mode/v1/embeddings`，`DASHSCOPE_DEFAULT_BASE_URL`。**只给 embed**；禁止用该 baseUrl 拼 `/reranks` |
| HashEmbeddings | contract | 同上 | CI 48 维；不进 live rerank |
| ZhipuPrequery | contract | `packages/core-engine/src/retrieve/prequery.ts` | glm rewrite；**不回退 FakePrequery**；llm 不进 rerank |
| FakePrequery | contract | 同上 | 测试合法；live 禁止 |
| StandardLibrary | contract | `packages/core-engine/src/retrieve/library.ts` | `rerankClauseHits` 已 `await this.ports.rerank.rerank(...)`；table/annex 不进 candidates。**不改** |
| defaultRetrievePorts | arch（contract 名未登记）`query_arch` `frontend/core-engine/util#defaultretrieveports` | `packages/core-engine/src/retrieve/library.ts` | `rerank: new IndependentReranker()`；本片保持 |

无 `report_missing`。无建表。

### 1.4 拟改动模块与文件

| 文件/模块 | 变更类型 | 说明 |
|-----------|----------|------|
| `packages/core-engine/src/retrieve/http-rerank.ts` | new | `HttpReranker`：注入 fetch/env/url/model/apiKey；默认 compatible-api `/reranks`；失败 throw |
| `packages/core-engine/src/retrieve/live-ports.ts` | modify | `rerank: new HttpReranker()`；删除 IndependentReranker 装配与「共用 embed」注释 |
| `packages/core-engine/src/index.ts` | modify | re-export `HttpReranker` |
| `packages/core-engine/test/http-rerank.test.ts` | new | T1–T4、T6、T8（mock fetch） |
| `packages/core-engine/test/dashscope-embeddings.test.ts` | modify | 删除「共用 embed」绿条；改为 live rerank 不调用 embed |
| `packages/core-engine/test/live-zhipu-prequery.test.ts` | modify | live rerank 为 HttpReranker，非 IndependentReranker、非 chat completions |
| `apps/web/.env.example` | modify | 注释 `RERANK_URL` / `RERANK_MODEL` / `RERANK_API_KEY`（可空，无密钥值） |

`IndependentReranker` / `rerank.ts` / `library.ts` / `prequery.ts` **不改**（除非 live-ports 注释与事实冲突）。既有 `rerank.test.ts` / `standard-rag.test.ts` 作回归。拟改 ≤8。

实现后 `register_contract` name=`HttpReranker`；`refresh_asset` 改动源文件。本规划命令不执行闭环。

### 1.5 风险与未决项

- 现网 live 精排仍是 IndependentReranker + 共用 v3 embed（MCP 实证）。F-2 R6 的 **live 共用 embed** 部分由本片作废；测试里 IndependentReranker 仍可注入 embed。
- 默认 URL 是 `compatible-api/v1/reranks`，与 embed 的 `compatible-mode/v1` **不是同一前缀**。误拼 `/embeddings` 或 `chat/completions` 必须被 T1/T5 挡住。
- `liveRetrievePorts()` 不注入 fetch，单测继续 stub `globalThis.fetch`（同 F-2/F-3）；HttpReranker 单测优先构造注入 `fetch`，避免打网。
- 密钥：夹具只用 `test-key`。Error 只许出现变量**名**。同一 `DASHSCOPE_API_KEY` 只解决鉴权，不把 v3 向量空间当精排模型。
- 供应商单条 token 上限可能导致 400：本片 throw，不截断重试（spec 残留，非本片范围）。
- MCP `loopDone` 是相位机误判，忽略。

### 1.6 需求锁定对照

| Rn | 优先级 | 覆盖 Task | 备注 |
|----|--------|-----------|------|
| R1 | must | Task 3 | T5：`liveRetrievePorts().rerank` 为 `HttpReranker` 且 `not.toBeInstanceOf(IndependentReranker)` |
| R2 | must | Task 1 + Task 2 | T1+T6：POST URL 与 body.model/documents；非 embeddings、非 chat completions |
| R3 | must | Task 2 + Task 3 | T2 顺序随 mock score；T5 spy `embed.embed` = 0 |
| R4 | must | Task 2 | T3：构造 throw 且不返回 IndependentReranker |
| R5 | must | Task 2 | T4：HTTP 500 / 空 results throw |
| R6 | must | Task 4 | T7+T8：IndependentReranker / defaultRetrievePorts / A12 |
| R7 | must | Task 3 | live prequery 仍为 ZhipuPrequery；HttpReranker 无 complete |
| R8 | must | Task 1 + Task 2 + 全 Task 白名单 | T3 消息不含 `test-key`；夹具只用 `test-key` |
| R9 | must | 全 Task 白名单 | 不含 Vue / `library.ts` 路由；不改 `Reranker` 签名 |
| R10 | nice | Task 5 | `.env.example` 含变量名、不含密钥值 |

must 全覆盖。

---

## Part 2 — 可执行任务清单

> 每步 2–5 分钟粒度；实现时由 `/implement-plan` 按 Task 派发子 Agent 串行执行。子 Agent 每 Task 自动 `git commit`（本 plan 不写提交步骤）。**先红后绿**：Task 1 只写失败测试；Task 2 最小实现至绿。禁止本切片跑生产网；禁止回显真实密钥。

### Task 1: 测试案例规划 — HttpReranker 红灯（T1–T4/T6/T8，R2/R4/R8）

- [ ] 只读 MCP：`query_contract` name=`Reranker`（预期 missing，改查 `RetrievePorts`）；`query_contract` name=`RetrievePorts`；`query_contract` name=`IndependentReranker`
  - **MCP:** 同上；`search_arch` query=`Reranker interface RetrievePorts rerank`（若 contract 名仍未登记）
  - **Files:** （只读）`packages/core-engine/src/retrieve/ports.ts`
- [ ] 先红：新建 `http-rerank.test.ts`，夹具密钥字面量只用 `test-key`。注入 mock `fetch`（禁止真实 `dashscope.aliyuncs.com`）。覆盖：
  1. T1：POST 默认 URL 含 `/reranks` 且含 `compatible-api`；body.model=`qwen3-rerank`；body.documents 为候选 text；URL 不含 `compatible-mode`、不含 `chat/completions`、不以 `/embeddings` 结尾
  2. T2：mock `results` 按 score 降序返回对应 `clause_id`
  3. T3：空 env 构造 throw `/RERANK_API_KEY|DASHSCOPE_API_KEY/`，消息 `not.toContain("test-key")`
  4. T4：HTTP 500 → throw `/Rerank HTTP 500/`；候选非空 + 空 results → throw；实现不得 import/调用 IndependentReranker
  5. T6：`env.RERANK_URL` 为假 URL 时 POST 该 URL，JSON 形不变
  6. T8：空候选返回 `[]` 且 fetch 调用次数 = 0
  - **Files:** `packages/core-engine/test/http-rerank.test.ts`
  - **Verify:** `npx vitest run test/http-rerank.test.ts`（cwd `packages/core-engine`）——**本 Task 预期 FAIL**（`HttpReranker` 尚未存在）。对应 R2/R4/R8 的红灯基线。禁止为了绿灯去调真实网或写真实密钥。

### Task 2: 实现 HttpReranker（后绿，R2/R3/R4/R5/R8）

- [ ] 只读 MCP：`query_contract` name=`DashScopeEmbeddings`（抄注入样板，**禁止**复用 `DASHSCOPE_DEFAULT_BASE_URL`）；`query_contract` name=`ChatComplete`（确认不调用）
  - **MCP:** 同上
  - **Files:** （只读）`packages/core-engine/src/retrieve/embeddings.ts`, `packages/core-engine/src/retrieve/ports.ts`
- [ ] 最小实现 `HttpReranker implements Reranker`：
  - 构造：`(options.apiKey ?? env.RERANK_API_KEY ?? env.DASHSCOPE_API_KEY)?.trim()` 为空 → `throw new Error("RERANK_API_KEY or DASHSCOPE_API_KEY is required")`
  - URL：`options.url ?? env.RERANK_URL ?? "https://dashscope.aliyuncs.com/compatible-api/v1/reranks"`
  - 模型：`options.model ?? env.RERANK_MODEL ?? "qwen3-rerank"`
  - `rerank`：空候选 `[]` 不发网；`documents = candidates.map(c => c.text)`；POST JSON `{ model, query, documents }`（不要 `top_n`）；Header `Authorization: Bearer <secret>` + `Content-Type: application/json`
  - 解析：`body.results ?? body.output?.results`；`relevance_score ?? score`；按分数降序输出 `candidates[index].clause_id`；缺席下标按原相对顺序追加；候选非空但 results 空/非数组 → throw；index 越界忽略，有效项 0 → throw
  - 非 2xx → `throw new Error("Rerank HTTP <status>")`，消息不含密钥
  - **不得** import `HashEmbeddings` / `DashScopeEmbeddings` / `IndependentReranker`；**不得**调用 `embed()` / `complete()`；**不得**本地算余弦
  - **Files:** `packages/core-engine/src/retrieve/http-rerank.ts`, `packages/core-engine/src/index.ts`, `packages/core-engine/test/http-rerank.test.ts`
  - **Verify:** `npx vitest run test/http-rerank.test.ts`（cwd `packages/core-engine`）——对应 R2/R3/R4/R5/R8 / T1–T4/T6/T8，必须 PASS
  - **Contracts:** `HttpReranker`（本 Task 可先实现，登记放 Task 5）

### Task 3: liveRetrievePorts 换 HttpReranker + 改写 F-2/F-3 绿条（R1/R3/R7/R9）

- [ ] 只读 MCP：`query_contract` name=`liveRetrievePorts`；`query_contract` name=`ZhipuPrequery`；`query_contract` name=`IndependentReranker`
  - **MCP:** 同上
- [ ] 改写测试（先红）：
  1. T5：`liveRetrievePorts()`（`DASHSCOPE_API_KEY=test-key` + 临时 `agent-runtime.llm.json` 夹具，同 F-3）`.rerank` 为 `HttpReranker`，`not.toBeInstanceOf(IndependentReranker)`；`prequery` 仍为 `ZhipuPrequery`
  2. 调用 `ports.rerank.rerank(...)` 时 spy `ports.embed.embed` 调用次数 = 0
  3. stub `globalThis.fetch`：`/reranks` 返回精排 `results`；断言 URL 不含 `chat/completions`、不以 `/embeddings` 结尾作为精排 path
  4. 删除 `dashscope-embeddings.test.ts`「shares one DashScopeEmbeddings instance with IndependentReranker」；改为不调用 embed
  5. 改写 `live-zhipu-prequery.test.ts`「keeps IndependentReranker on embed only…」
  - **Files:** `packages/core-engine/test/dashscope-embeddings.test.ts`, `packages/core-engine/test/live-zhipu-prequery.test.ts`
- [ ] 实现：`liveRetrievePorts` `rerank: new HttpReranker()`；**禁止** `?? new IndependentReranker()`；**禁止**把 `embed` / `llm` 传入 rerank。更新过时注释「Live retrieve must share one v3 embedder with rerank」。embed 继续 `new DashScopeEmbeddings()`；prequery 继续 `ZhipuPrequery` + `requireConfiguredLlm`（不回退 FakePrequery）。
  - **Files:** `packages/core-engine/src/retrieve/live-ports.ts`, `packages/core-engine/test/dashscope-embeddings.test.ts`, `packages/core-engine/test/live-zhipu-prequery.test.ts`
  - **Verify:** `npx vitest run test/live-zhipu-prequery.test.ts test/dashscope-embeddings.test.ts test/http-rerank.test.ts`（cwd `packages/core-engine`）——对应 R1/R3/R7/T5；live prequery 仍为 ZhipuPrequery
  - **Contracts:** `liveRetrievePorts`（description 须改为 HttpReranker，不再写共用 embed）

### Task 4: IndependentReranker / defaultRetrievePorts / A12 回归（R6/R9）

- [ ] 只读 MCP：`query_contract` name=`IndependentReranker`；`query_contract` name=`StandardLibrary`；`query_arch` path=`frontend/core-engine/util#defaultretrieveports`
  - **MCP:** 同上
  - **Files:** （只读）`packages/core-engine/src/retrieve/rerank.ts`, `packages/core-engine/src/retrieve/library.ts`
- [ ] 确认 **不改** `rerank.ts` 算法、**不改** `library.ts` 路由 / `rerankClauseHits` / tableHits 旁路、**不改** `Reranker` 签名。`defaultRetrievePorts()` 仍默认 `IndependentReranker`。`rerank.test.ts`：注入 llm spy 时 `complete` 未被调用（A12）。
  - **Files:** `packages/core-engine/test/rerank.test.ts`, `packages/core-engine/test/standard-rag.test.ts`（本 Task 无强制改文件；仅当注释与 live 事实冲突且不在白名单外时才允许改测试文案，禁止改断言语义）
  - **Verify:** `npx vitest run test/rerank.test.ts test/standard-rag.test.ts test/http-rerank.test.ts`（cwd `packages/core-engine`）——对应 R6/R9 / T7/T8；A12 自然语言与「1.1」同 clause_id 仍绿

### Task 5: `.env.example` 变量名 + 登记 HttpReranker（R8/R10）

- [ ] 在 `apps/web/.env.example` 用**注释**写出 `RERANK_URL` / `RERANK_MODEL` / `RERANK_API_KEY` 变量名（可空）。可注明未设时密钥回退 `DASHSCOPE_API_KEY`。禁止写入任何密钥值 / `sk-` 字面量。
  - **Files:** `apps/web/.env.example`
- [ ] 确认 `index.ts` 已 re-export `HttpReranker`。源文件与测试 grep 夹具密钥只有 `test-key`。
  - **Files:** `packages/core-engine/src/index.ts`, `packages/core-engine/src/retrieve/http-rerank.ts`, `packages/core-engine/test/http-rerank.test.ts`
- [ ] 微闭环（实现代理执行，本规划命令不跑）：`register_contract` name=`HttpReranker`；可选补登记 name=`Reranker`（接口已在 ports.ts）；`refresh_asset` `http-rerank.ts` 与 `live-ports.ts`
  - **MCP:** `register_contract` name=`HttpReranker`；`refresh_asset` sourcePath=`packages/core-engine/src/retrieve/http-rerank.ts`；`refresh_asset` sourcePath=`packages/core-engine/src/retrieve/live-ports.ts`
  - **Verify:** `npx vitest run test/http-rerank.test.ts test/dashscope-embeddings.test.ts test/live-zhipu-prequery.test.ts test/rerank.test.ts test/standard-rag.test.ts`（cwd `packages/core-engine`）——对应 R8/R10；`.env.example` 含三个变量名且无密钥值
