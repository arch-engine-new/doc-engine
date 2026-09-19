---
title: F-4 live 独立 rerank 接 HTTP（禁止 Hash 余弦冒充）
date: 2026-09-19
status: approved
risk: low
phase: approved
approvedAt: 2026-09-19T11:10:00.000Z
approvedBy: apt-auto-brainstorm
topic: live-http-rerank
mode: apt-auto-brainstorm
feature: core-engine
pages:
  - standard_lib
parentSpec: docs/superpowers/specs/2026-08-27-slice-6-standard-rag.md
supersedesLive:
  - docs/superpowers/specs/2026-09-19-dashscope-text-embedding-v3-design.md#R6
---

# Design Spec: live 独立 rerank 接 HTTP（F-4）

## Goal

配置人员在 live 标准库语义检索时，条款候选的精排必须调用**独立 rerank HTTP 服务**（百炼 `qwen3-rerank` 兼容接口，或 `RERANK_URL` 指向的等价精排，如 bge）。禁止再用 `IndependentReranker` 的本地余弦 + 词面、以及与 DashScope v3 embed **共用实例**的做法冒充独立模型。禁止把 glm / 任何 `complete()` 聊天补本当 rerank（A12）。

`IndependentReranker` **只留测试 / `defaultRetrievePorts`**。缺密钥或 HTTP 失败必须显式 throw，禁止静默回退本地余弦。

验收锚点：队列 F-4；brief「独立精排（bge 或等价国产 rerank API）」；slice-6 A12。

## 范围

1. **live `RetrievePorts.rerank`** 装配新的 HTTP 精排实现（下文称 `HttpReranker`），实现已有 `Reranker` 端口：`rerank(query, candidates) → clause_id[]`。
2. **默认协议**：百炼 `qwen3-rerank`，`POST https://dashscope.aliyuncs.com/compatible-api/v1/reranks`。请求体扁平：`{ model, query, documents }`；响应顶层 `results[].index` + `results[].relevance_score`。
3. **覆盖出口**：环境变量 `RERANK_URL`（完整 URL，含 path）可指向任意讲同一 JSON 形的服务；`RERANK_MODEL` 覆盖模型名（默认 `qwen3-rerank`）。
4. **密钥**：`RERANK_API_KEY` 优先；未设则复用已有 `DASHSCOPE_API_KEY`（与 F-2 embed 同一变量名，**不是**同一 HTTP path / 同一模型）。缺密钥构造期 throw。
5. **测试**：`IndependentReranker` 行为不变（余弦+词面、禁止 `complete()`）；`defaultRetrievePorts` 仍默认它；A12 CI 夹具仍绿。
6. **只改 live 精排装配 + HTTP 类 + 被 F-2/F-3 绑到「live rerank 共用 embed」的测试**。不改 `standard_lib` 页交互、不改检索路由、不改 tableHits 跳过 rerank、不回退 F-3 的 `ZhipuPrequery`。

## 非目标

- 不把 glm / `LlmProvider.complete` / `ChatComplete` / `ZhipuPrequery` 当 rerank。
- 不把 Hash 余弦、v3 embed 余弦、或「live 注入同一 embed 实例」当成独立精排。
- 不改 `Reranker` 方法签名（不增加新的对外端口形状）。
- 不改 DSL 硬规则、不发明条款号、不改其它 8 页 UI。
- 不把 table / annex 送进 rerank（`library.ts` 已隔离，本片不改）。
- 不截断超长条款以「保成功」；HTTP 400 显式失败。
- 不把密钥写入源码、spec、plan、测试夹具、commit、日志、Error 消息（Error 只许出现变量**名**）。
- 不把 rerank 凭证并入 `resolveEngineMode` 四库判定。
- 不新起独立 GPU 精排进程 / 不改 F-3 prequery 装配。
- 不把 APT 知识库向量文件当业务精排。

## 现网缺口（查证）

| 点 | 证据 | 缺口 |
|----|------|------|
| live rerank 仍是本地余弦 | `query_contract liveRetrievePorts`：`rerank: new IndependentReranker({ embed })`，`embed` 为 `DashScopeEmbeddings` 同一实例 | 生产精排 = v3 向量余弦 + 词面，不是独立 rerank 模型 |
| IndependentReranker 定义 | `query_contract IndependentReranker`：`rerank.ts` 余弦 + `lexicalScore`；构造可注入 `embed`；`void options?.llm`，禁止 `complete()` | 测试合法；live 继续用它即本片要拆的冒充 |
| `Reranker` 未单独登记 | `query_contract` name=`Reranker` → 未找到；`query_contract RetrievePorts` 内含 `interface Reranker { rerank(...) }` | 类型已在 `ports.ts`，不阻塞；不另造端口 |
| F-2 测试把共用 embed 当绿 | `dashscope-embeddings.test.ts`「shares one DashScopeEmbeddings instance with IndependentReranker」；`live-zhipu-prequery.test.ts` 断言 live `rerank` 为 `IndependentReranker` 且 spy `embed.embed` | 本片落地后这两条必须改写，否则继续把冒充当验收 |
| F-3 已接 glm prequery | `liveRetrievePorts`：`prequery: new ZhipuPrequery(llm)`；缺 LLM throw | 本片不得回退 `FakePrequery`，也不得把该 llm 注入 rerank |
| 调用点已 await | `StandardLibrary.rerankClauseHits`：`await this.ports.rerank.rerank(...)` | HTTP 异步无需改 library |
| 设计页 | `query_design page=standard_lib`：Rerank = 独立精排模型，禁止聊天补全；tableHits 跳过 | 无本片 UI 缺口 |
| 百炼精排 HTTP | 官方文本排序文档：`qwen3-rerank` 走 `compatible-api/v1/reranks`，与 F-2 embed 的 `compatible-mode/v1/embeddings` **不是同一前缀** | 禁止复用 `DASHSCOPE_DEFAULT_BASE_URL` 去拼 `/reranks` |

`query_ontology()` / `query_ontology(topic=rerank)` / `query_ontology(topic=retrieve)`：命中 `IndependentReranker`、`liveRetrievePorts`、`RetrievePorts`、`HashEmbeddings`、`StandardLibrary`。复用这些端口，不新造检索栈。

`query_contract Reranker` 未登记：类型可在 `RetrievePorts` 寻址，finish-feature 可补登记实现类；**不**停工。

## 澄清（全自动自答）

`.apt/goal.md` 存在。队列 F-4 与 brief 已钉：独立精排 HTTP（bge 或等价国产），A12 禁止 chat-as-rerank。

1. **默认模型 / URL？** 钉 `qwen3-rerank` + `https://dashscope.aliyuncs.com/compatible-api/v1/reranks`（与现网 embed 同源百炼公网 host，但 path 是 `compatible-api` 不是 `compatible-mode`）。`RERANK_URL` 可整段覆盖（含 path），以便接 bge / 自建等价服务。
2. **密钥？** `RERANK_API_KEY` 或回退 `DASHSCOPE_API_KEY`。禁止硬编码。独立性看 **模型 + HTTP path + 分数来源**，不要求第二套账单账号。
3. **缺配置？** `HttpReranker` 构造 / `liveRetrievePorts()`：密钥为空 → throw（消息含 `RERANK_API_KEY` 或 `DASHSCOPE_API_KEY` 变量名，不含值）。禁止 `?? new IndependentReranker()`。
4. **HTTP 失败？** 非 2xx、空 `results`（候选非空时）、无法解析 index/score → throw。禁止回退余弦。
5. **CI？** `defaultRetrievePorts` / 单测继续 `IndependentReranker`。HTTP 单测注入 `fetch` + 假 URL，夹具密钥字面量只用 `test-key`。
6. **F-2 R6（live 共用 embed）？** **仅 live 装配作废**。测试里 IndependentReranker 仍可注入 embed。
7. **UI？** 不改 9 页信息架构。

## 方案（≥2 机制类）

### 方案 A — live 装配 HTTP 精排类（推荐）

机制类：**行为证据**（真实 POST `/reranks` 或 `RERANK_URL`、分数来自响应、缺密钥/HTTP 失败 throw、live 实例不是 `IndependentReranker`）。

- 新增 `HttpReranker implements Reranker`：可注入 `fetch` / `env` / `url` / `model`（对齐 `DashScopeEmbeddings`）。
- `liveRetrievePorts`：`rerank: new HttpReranker()`（或 `fromEnv`）；**不再** `new IndependentReranker({ embed })`。
- embed / prequery 保持 F-2 / F-3：`DashScopeEmbeddings` + `ZhipuPrequery`；rerank **不接收** embed、**不接收** llm。

**Trade-offs**：live 语义检索每查询一次精排 HTTP（候选 ≤ 向量 topK=8，远小于模型 500 文档上限）。  
**隐藏成本**：F-2/F-3 里「live rerank 即 IndependentReranker + 共用 embed」的测试必须改写，否则会把本片目标测反。  
**失败模式**：百炼未开通 rerank、URL 误写成 `compatible-mode`、把 `/embeddings` 当精排 → HTTP 错或分数无效，必须 throw。  
**依赖前提**：`query_contract` 已证实 `Reranker` 端口与 `rerankClauseHits` await 存在；密钥变量名已在 F-2 live 路径使用。

### 方案 B — 只加静态闸门（否决）

机制类：**静态闸门**。grep `live-ports.ts` 不含 `IndependentReranker`，或注释写「生产勿用余弦」。

**失败模式**：绿灯 ≠ 发出精排 HTTP，≠ 分数来自独立模型（红队镜：静态形状当行为）。不选。

### 方案 C — 流程重组：glm 聊天打分，或单独拉起 bge GPU 服务（否决为默认）

机制类：**流程重组**。

- C1 聊天当 rerank：A12 / brief / F-3 边界明确禁止。
- C2 本仓再部署 bge-reranker-v2-m3 推理进程：是更重的真机制，但本片成功标准不要求自建推理，且会撑破文件数与运维面。

**失败模式**：C1 直接违反 A12。C2 把「独立 HTTP」做成「独立平台」，超出 F-4 边界。

### 最强反方 → 推荐项回应

攻击：live 仍读 `DASHSCOPE_API_KEY`，与 embed 同一厂商密钥，所以精排并不独立；F-2 R6 还要求共用 embed 实例，本片是回退。  
回应：独立性的可判定证据是 **（1）HTTP path 不是 `/embeddings` 也不是 `chat/completions`；（2）请求体带 `documents` 文本；（3）排序键是响应 `relevance_score`，实现内不得再算余弦或调用 `embed()` / `complete()`**。同一密钥只解决鉴权，不把 v3 向量空间伪装成精排模型。F-2 R6 的原意是阻止 Hash 与 v3 混用；F-4 队列明文要拆掉「用 embed 余弦冒充独立模型」。攻击指出的是凭证复用，不是模型复用。推荐项仍成立。

### 为什么最贵的真机制不是默认

最贵 = 方案 C2（自建 bge GPU 服务 + 探活网格 + 第二套鉴权）。brief 写的是「bge **或等价国产 rerank API**」。本片要证的是：live `rerank()` 打到独立精排 HTTP、失败显式、测试仍用 `IndependentReranker`。百炼 `qwen3-rerank` 已是国产精排 HTTP，且操作员已持 `DASHSCOPE_API_KEY`；`RERANK_URL` 保留接真 bge 的出口。证据档位到此为止，不把「自建推理平台」当默认。

## 设计

### Architecture

```
liveRetrievePorts()
  embed    ── DashScopeEmbeddings          POST .../compatible-mode/v1/embeddings
  prequery ── ZhipuPrequery(llm)           glm complete（仅改写，禁止当 rerank）
  rerank   ── HttpReranker                 POST RERANK_URL 或
                                           .../compatible-api/v1/reranks
                                           禁止 IndependentReranker
                                           禁止 complete() / embed()

defaultRetrievePorts() / 单测
  rerank   ── IndependentReranker          余弦+词面；可注入 embed；禁止 complete()
```

`HttpReranker` **不得** import 或调用 `HashEmbeddings` / `DashScopeEmbeddings.embed` / `ChatComplete.complete`。

### Components

**`HttpReranker`**（建议新文件 `packages/core-engine/src/retrieve/http-rerank.ts`）

- 构造 options：`fetch?`、`env?`、`url?`、`model?`、`apiKey?`（测试注入；生产读 env）。
- 密钥：`(options.apiKey ?? env.RERANK_API_KEY ?? env.DASHSCOPE_API_KEY)?.trim()`；空则 `throw new Error("RERANK_API_KEY or DASHSCOPE_API_KEY is required")`。
- URL：`options.url ?? env.RERANK_URL ??` 默认 `https://dashscope.aliyuncs.com/compatible-api/v1/reranks`；禁止用 `DASHSCOPE_DEFAULT_BASE_URL`（那是 `compatible-mode`）。
- 模型：`options.model ?? env.RERANK_MODEL ?? "qwen3-rerank"`。
- `rerank`：
  - `candidates.length === 0` → `[]`，不发网。
  - `documents = candidates.map(c => c.text)`，保持原顺序。
  - POST JSON：`{ model, query, documents }`。不要 `top_n`（默认返回全部，保证 `library` 能拿到全排列）。
  - Header：`Authorization: Bearer <secret>`，`Content-Type: application/json`。
  - 解析：`results = body.results ?? body.output?.results`；每项 `index` 为 `documents` 下标；分数 `relevance_score ?? score`。
  - 按分数降序输出对应 `candidates[index].clause_id`。缺席的下标按**原相对顺序**追加（不得丢 id）。候选非空但 `results` 空/非数组 → throw。
  - HTTP 非 2xx → `throw new Error("Rerank HTTP <status>")`，消息不含密钥。

**`liveRetrievePorts`**

- `rerank: new HttpReranker()`。
- 继续 `requireConfiguredLlm` + `ZhipuPrequery`（F-3，不回退）。
- 继续 `new DashScopeEmbeddings()` 只给 `embed`，**不**传入 rerank。

**`IndependentReranker`**

- 不改算法。测试与 `defaultRetrievePorts` 继续用。

### Data flow

1. `searchSemantic` → 向量 topK → 表/附件旁路、条款进 `RerankCandidate[]`（含 `clause_id` / `text` / 可选 `vector`）。
2. live：`HttpReranker` **忽略** `candidate.vector`，只把 `text` 放进 `documents`。
3. 响应分数 → `clause_id[]` → `rerankClauseHits` 按序 `toHit`。
4. 测试：`IndependentReranker` 仍可用 `vector` 或 `embed()`。

### Error handling

| 条件 | 行为 |
|------|------|
| 无 `RERANK_API_KEY` 且无 `DASHSCOPE_API_KEY` | 构造 throw |
| HTTP 非 2xx / JSON 无 results | throw |
| 候选非空、results 空 | throw |
| index 越界 | 忽略该项；若有效项数为 0 则 throw |
| live 装配失败 | 禁止回退 `IndependentReranker` |
| 超长文档 400 | throw，不截断重试 |

### Testing

| ID | 可判定 |
|----|--------|
| T1 | `new HttpReranker({ env: { DASHSCOPE_API_KEY: "test-key" }, fetch })` 对非空候选 POST 默认 URL（含 `/reranks`），body.model=`qwen3-rerank`，body.documents 为候选 text 数组；URL **不含** `compatible-mode`、**不含** `chat/completions`、**不以** `/embeddings` 结尾 |
| T2 | mock 返回 `results: [{index:1, relevance_score:0.9},{index:0, relevance_score:0.1}]` → 输出 ids 以 index=1 的 clause_id 开头 |
| T3 | 缺密钥构造 throw，消息匹配 `RERANK_API_KEY|DASHSCOPE_API_KEY`，**不含**夹具 `test-key` |
| T4 | HTTP 500 / 空 results → throw；不得改去调 `IndependentReranker` |
| T5 | `liveRetrievePorts()`（DASHSCOPE + 临时 llm.json 夹具，同 F-3）`.rerank` 为 `HttpReranker`，**不是** `IndependentReranker`；调用 `rerank` **不**触发 `ports.embed.embed` |
| T6 | `RERANK_URL` 注入时 POST 该 URL；仍用同一 JSON 形 |
| T7 | 既有 `rerank.test.ts`：IndependentReranker 不调用 `complete()`；A12 `standard-rag.test.ts` 仍绿 |
| T8 | `new IndependentReranker()` / `defaultRetrievePorts()` 仍可用；空候选 `HttpReranker.rerank` 不发 fetch |

改写（不得保留为绿）：

- `dashscope-embeddings.test.ts`「shares one DashScopeEmbeddings instance with IndependentReranker」
- `live-zhipu-prequery.test.ts`「keeps IndependentReranker on embed only…」改为：live rerank 不是 IndependentReranker、不打 chat completions、不打 embed

## 追问记录

- 轮次：**3**（第 3 轮无新实质发现，收敛；最少 2、最多 4）
- 模式：全自动（`.apt/goal.md` 存在）；S3 均有 MCP/源码查证
- 红队册：仓库内 `.apt/redteam-patterns.md` 与 `templates/_redteam-patterns.md` 均缺失；按技能内联镜前载（镜：静态绿灯≠行为；机制类多样性；chat-as-rerank 伪独立）。本片 risk=low，步骤 4 方案红队强化代替独立子代理红队。

### 第 1 轮

| 镜头 | 关键追问 | 结论 / 修订 |
|------|----------|-------------|
| S1 场景 | 谁在何时用独立精排？空候选 / CI？ | 操作员 live `standard_lib` 语义检索；`JobPipeline.openLiveFromEnv` → `liveRetrievePorts`。空候选不发网。CI 继续 IndependentReranker。 |
| S2 破坏 | 砍一半保哪半？伪需求？ | 保：live HTTP 精排、失败显式、测试余弦类留下。砍：glm 打分、自建 bge 进程、改路由/UI、截断保活。 |
| S3 可行 | 端口能否支撑？ | 能：`Reranker` 已在 `RetrievePorts`；`rerankClauseHits` 已 await；`DashScopeEmbeddings` 提供 fetch/env 注入样板。缺口只在 live 装配仍用 IndependentReranker。`query_contract Reranker` 未登记不阻塞。 |
| S4 验收 | 怎样证明不是形状？ | T1 URL+body；T5 live 实例类型 + 不调用 embed；T3/T4 throw。禁止只 grep 类名。 |

需求修订 v1→v2：锁定默认 `qwen3-rerank` + `compatible-api/v1/reranks`；明确不得复用 embed 的 `compatible-mode` baseUrl。

### 第 2 轮

| 镜头 | 关键追问 | 结论 / 修订 |
|------|----------|-------------|
| S1 | 与 F-2 测试冲突？ | 是。必须改写「共用 embed」测试，否则本片无法绿。 |
| S2 | 同一 `DASHSCOPE_API_KEY` 算不算独立？ | 算独立模型，不算独立账单。可判定点是 path/模型/分数来源。 |
| S3 | 要不要改 `Reranker` 接口或 library？ | 否。tableHits 旁路与 await 已够。 |
| S4 | top_n 截断会丢 clause_id？ | 不传 top_n；缺席 index 按原序追加，禁止丢 id。 |

需求修订 v2→v3：F-2 R6 仅 live 作废；强制改写两份 live 测试；排序必须来自 HTTP 分数而非本地余弦。

### 第 3 轮

| 镜头 | 关键追问 | 结论 / 修订 |
|------|----------|-------------|
| S1 | 超长条款？ | 不截断；400 显式失败。残留见下（非本片范围）。 |
| S2 | instruct / 多协议 parser 是否 YAGNI？ | instruct 不做。parser 只认 `results` 或 `output.results` + `relevance_score\|score`，覆盖兼容口与原生口，不再加第三套。 |
| S3 | 文件数？ | 实现+必要测试改写 ≤8，见下表。 |
| S4 | 空候选是否要 mock 网？ | 不发 fetch（T8）。 |

无新实质发现。残留：超长条款触发供应商 400 —— 本片显式失败，不在本片做切片。

### 需求修订 delta

- v1：live 换独立 HTTP 精排；测试保留 IndependentReranker；禁止 chat-as-rerank。
- v2：默认 qwen3-rerank + compatible-api `/reranks`；禁止复用 embed baseUrl。
- v3：废止 live 共用 embed（F-2 R6 live 部分）；改写 F-2/F-3 测试；分数必须来自 HTTP。
- v4：无（第 3 轮收敛）。

残留问题：供应商单条 4000 token 上限可能导致个别超长条款 400。缓解：throw，不静默截断；后续切片再谈截断策略。

## 需求锁定表

| ID | 需求描述 | 来源 | 验收标准（可判定） | 优先级 |
|----|----------|------|--------------------|--------|
| R1 | live `rerank` 为 HTTP 精排实现，不是 `IndependentReranker` | 用户明示（队列 F-4） | T5：`liveRetrievePorts().rerank` 为 `HttpReranker` 且 `not.toBeInstanceOf(IndependentReranker)` | must |
| R2 | 调用独立 rerank HTTP（默认 qwen3-rerank / compatible-api `/reranks`，或 `RERANK_URL`） | 用户明示 | T1+T6：POST URL 与 body.model/documents；非 embeddings、非 chat completions | must |
| R3 | 排序来自响应分数，实现内不算余弦、不调用 embed/complete | 追问确认 | T2 顺序随 mock score；T5 spy `embed.embed` 调用次数 = 0 | must |
| R4 | 缺密钥显式失败，禁止回退 IndependentReranker | 用户明示 | T3：构造 throw 且不返回 IndependentReranker | must |
| R5 | HTTP 失败显式 throw，禁止回退本地余弦 | 用户明示 | T4 | must |
| R6 | 测试 / `defaultRetrievePorts` 继续 IndependentReranker；A12 仍绿；不调用 complete | 用户明示 | T7+T8 | must |
| R7 | 不把 glm chat 当 rerank；F-3 `ZhipuPrequery` 不回退 FakePrequery | 用户明示 | live prequery 仍为 ZhipuPrequery；HttpReranker 无 complete 调用 | must |
| R8 | 密钥不进 git/源码/Error 值；夹具只用 `test-key` | 用户明示 | T3 消息不含 `test-key`；本 spec/commit 无真实密钥 | must |
| R9 | 不改 UI / 路由 / tableHits 旁路 / `Reranker` 签名 | 用户明示 | 白名单不含 Vue 与 library 路由；table 仍不进 candidates | must |
| R10 | `.env.example` 用注释写出 `RERANK_URL` / `RERANK_MODEL` / `RERANK_API_KEY` 变量名（可空） | 追问确认 | 文件含变量名、不含密钥值 | nice |

无「AI 假设未确认」的 must。

## Ontology detection

调用：

- `query_project_status`
- `query_ontology()` 项目快照
- `query_ontology(topic=rerank)`
- `query_ontology(topic=retrieve)`
- `query_contract`：`IndependentReranker`、`liveRetrievePorts`、`Reranker`（未登记）、`RetrievePorts`、`Embeddings`、`DashScopeEmbeddings`
- `search_arch` query=`liveRetrievePorts IndependentReranker rerank embedding`；query=`Reranker interface RetrievePorts rerank`
- `query_arch` `frontend/core-engine/util#independentreranker`；`frontend/core-engine/util#liveretrieveports`
- `query_design page=standard_lib`；`search_ui` query=`standard_lib retrieve rerank`

复用决策：

| 资产 | 决策 | 理由 |
|------|------|------|
| `Reranker` / `RerankCandidate` / `RetrievePorts` | **复用，不改签名** | 已有 await 调用点 |
| `liveRetrievePorts` | **复用并改 rerank 装配** | live 唯一工厂 |
| `IndependentReranker` | **复用，仅测试/默认内存端口** | A12 禁 complete；live 不再用它冒充 |
| `DashScopeEmbeddings` | **复用，仅 embed** | 不传入 HttpReranker；其 `compatible-mode` baseUrl 不复用 |
| `ZhipuPrequery` / `createLlmProvider` | **复用，不改 F-3** | 不回退 FakePrequery；llm 不进 rerank |
| `StandardLibrary.rerankClauseHits` | **不改** | 已 await 全序列 |
| `HashEmbeddings` | **不进 live rerank** | 测试 IndependentReranker 仍可用 |
| `standard_lib` UI / 其它 8 页 | **不碰** | 范围冻结 |
| 未登记的 `Reranker` 名 | **实现后可登记 `HttpReranker` 类** | 知识库债，不阻塞本 spec |

S3 缺口：无缺失类型需停工。`Reranker` 作为独立 contract 名未登记，属知识库债。

`query_design` `standard_lib.gaps` 含既有 `no-implementation-ref`，与本片精排装配无关，**不** `report_design_gap`。

## 拟改动文件（≤8）

| 文件 | 变更 |
|------|------|
| `packages/core-engine/src/retrieve/http-rerank.ts` | 新增 `HttpReranker` |
| `packages/core-engine/src/retrieve/live-ports.ts` | live `rerank: new HttpReranker()`；不再 IndependentReranker |
| `packages/core-engine/src/index.ts` | re-export `HttpReranker` |
| `packages/core-engine/test/http-rerank.test.ts` | T1–T4、T6、T8 |
| `packages/core-engine/test/dashscope-embeddings.test.ts` | 删除「共用 embed」绿条，改为不调用 embed |
| `packages/core-engine/test/live-zhipu-prequery.test.ts` | live rerank 非 IndependentReranker、非 chat completions |
| `apps/web/.env.example` | 注释 `RERANK_URL` / `RERANK_MODEL` / `RERANK_API_KEY`（可空，无密钥值） |

`IndependentReranker` / `rerank.ts` / `library.ts` / `prequery.ts` **不改**（除非注释与 live 事实冲突的一行说明，仍算进 live-ports）。  
既有 `rerank.test.ts` / `standard-rag.test.ts` 作回归，无强制改文件则不计入。

实现后 `register_contract` 名=`HttpReranker`；`refresh_asset` 改动源文件。

## 风险分级

- frontmatter 未标 high。
- 正文未使用风险关键词清单中的 MCP / 平台管线 / 对外破坏面用语。
- 拟改动文件 = 7，未超过 8。
- 不改已有 `Reranker` 端口形状；只新增实现类并改 live 装配。

**risk: low** → `auto_approved`。步骤 5.5 独立红队免派（方案红队强化即为红队档）。**不要**在本代理跑 `/plan-from-spec`（外层编排派发）。
