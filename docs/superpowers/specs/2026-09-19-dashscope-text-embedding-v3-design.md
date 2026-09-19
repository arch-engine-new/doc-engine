---
title: F-2 live 条款 embedding 换百炼 text-embedding-v3
date: 2026-09-19
status: approved
risk: low
phase: approved
approvedAt: 2026-09-19T07:35:00.000Z
approvedBy: apt-auto-brainstorm
topic: dashscope-text-embedding-v3
mode: apt-auto-brainstorm
feature: core-engine
pages:
  - standard_lib
parentSpec: docs/superpowers/specs/2026-08-27-slice-6-standard-rag.md
---

# Design Spec: live 检索改用 DashScope text-embedding-v3（F-2）

## Goal

配置人员在 live 标准库检索时，Qdrant `clauses` 里的条款/表向量必须由阿里云百炼 **text-embedding-v3**（OpenAI 兼容模式）计算，使自然语言问句与条文在同一语义空间对齐。禁止再用 48 维 `HashEmbeddings` 冒充生产召回。CI / 内存端口继续 Hash，缺 `DASHSCOPE_API_KEY` 时 live **显式失败**，禁止静默回退 Hash。

验收锚点：队列 F-2；既有 A12（两种问法命中同一 `clause_id`）在 live v3 空间成立。

## 范围

1. **live `RetrievePorts.embed`** 接 DashScope 兼容模式 `text-embedding-v3`：`baseUrl=https://dashscope.aliyuncs.com/compatible-mode/v1`，密钥只读环境变量 `DASHSCOPE_API_KEY`。
2. **允许** `Embeddings.embed` 改为 `number[] | Promise<number[]>`（调用方一律 `await`）。`HashEmbeddings` / `FixtureEmbeddings` 可保持同步返回。
3. **Qdrant collection `clauses`** 现为 48 维哈希向量：与 v3 返回维度不兼容则 **delete + create**，再从 Postgres 账本重嵌入现有点。
4. **live rerank 与入库共用同一 embedding 实例**（`IndependentReranker({ embed })` 与 `ports.embed` 同一对象）。禁止 rerank 内部再 `new HashEmbeddings()`。
5. **CI 默认** `defaultRetrievePorts` / 单测仍用 `HashEmbeddings`（48 维），不打百炼网。
6. **只改检索端口与 live 装配**；不改 `standard_lib` 页交互、不改其它 8 页。

## 非目标

- 不用聊天补全（`LlmProvider.complete` / `ChatComplete`）当 embedding 或 rerank。
- 不把 APT `.ai/arch/vectors.db` 当业务标准库。
- 不改检索路由算法（exact / graph / semantic 分流仍按 prequery intent）。
- 不改 DSL 硬规则。
- 不发明条款号。
- 不把 apiKey 写入源码、spec、plan、测试夹具、commit、日志、Error 消息。
- 不把 `DASHSCOPE_API_KEY` 并入 `resolveEngineMode` 的四库必填（memory/live 存储判定不变）；缺 key 的失败点在 `liveRetrievePorts()`。
- 不改其它 8 页 UI，不新增第 10 页。

## 现网缺口（查证）

| 点 | 证据 | 缺口 |
|----|------|------|
| live embed 仍是 Hash | `query_contract liveRetrievePorts`：`embed: new HashEmbeddings()` | 生产 48 维哈希 |
| rerank 另起 Hash | `query_contract IndependentReranker`：`options?.embed ?? new HashEmbeddings()`；`liveRetrievePorts` 调 `new IndependentReranker()` **未注入 embed** | 入库与 rerank 可能不在同一空间（当前碰巧都是 Hash） |
| 契约同步 | `query_contract Embeddings`：`embed(text: string): number[]` | HTTP embedding 必须 async |
| Qdrant 不重建维度 | `packages/core-engine/src/retrieve/qdrant.ts` `ensureCollection`：collection 已存在则只记 `ensuredDim`，**不读 size、不 delete** | 48 维 collection 上 upsert 1024 维会失败或静默错维 |
| 无重嵌入 | `JobPipeline.openLiveFromEnv` 只 `liveRetrievePorts()` + Postgres，无账本→Qdrant 回填 | 重建后旧点丢失 |
| 缺 key 不失败 | `liveRetrievePorts` 不读 `DASHSCOPE_API_KEY` | 与「显式失败、禁止回退 Hash」相反 |
| 设计页 | `query_design page=standard_lib`：检索面 A11–A14；本片不改 UI | 无 design gap |

`query_ontology(topic=retrieve embeddings)`：命中 `HashEmbeddings`、`FixtureEmbeddings`、`HASH_EMBED_DIM`、`IndependentReranker`、`liveRetrievePorts`、`StandardLibrary`。复用这些端口，不新造检索栈。

`query_contract QdrantVectorStore`：未登记（`search_arch` + 源码 `qdrant.ts` 可寻址）。本片复用实现类，finish-feature 可补登记；不 `report_missing` 停工。

## 澄清（全自动自答）

`.apt/goal.md` 存在。用户经 `$apt-intake` 确认：百炼 compatible-mode + `text-embedding-v3`，密钥 `DASHSCOPE_API_KEY`。

1. **模型 / URL？** 固定 `text-embedding-v3`，`baseUrl=https://dashscope.aliyuncs.com/compatible-mode/v1`。POST `{baseUrl}/embeddings`，body 含 `model`、`input`、`dimensions: 1024`、`encoding_format: "float"`（文档默认维 1024）。禁止改用 v4 / 聊天模型。
2. **密钥？** 只读 `DASHSCOPE_API_KEY`（已在 gitignored `apps/web/.env`）。构造与 `fetch` Authorization 读取；禁止硬编码、禁止写进 spec/plan/夹具/git。Error 只许出现变量**名**。
3. **维度？** collection `vectors.size` **必须等于** v3 返回向量 `length`（断言 = 1024）。现网 48 ≠ 1024 → 重建。禁止截断/补零把 1024 塞进 48 维。
4. **缺 key？** `liveRetrievePorts()` throw（消息含 `DASHSCOPE_API_KEY`、不含密钥值）。禁止 `?? new HashEmbeddings()`。
5. **CI？** `defaultRetrievePorts` 仍 Hash。live smoke 在无 key 时 skip（与无 `QDRANT_URL` 同类），**不是**回退 Hash 继续跑 live 断言。
6. **重嵌入范围？** 队列写 `t_clause`。collection 同时存 table/annex（`t_layout_unit`）。只重嵌条款会丢掉表点 → **按 LayoutUnit 全量重嵌**（clause 文本来自对应 `t_clause` heading+body；table/annex 用 unit heading + `body_markdown`）。
7. **UI？** 不改 9 页信息架构。

## 方案（≥2 机制类）

### 方案 A — live 端口换 v3 + 维度重建 + 账本重嵌（推荐）

机制类：**行为证据**（真实 embedding HTTP、collection 维数、缺 key 抛错、rerank 共用实例）兼端口演进（embed async）。

- 新增 `DashScopeEmbeddings`（可与 Hash 同文件以控制文件数）：读 env，`embed` 调兼容模式 `/embeddings`。
- `liveRetrievePorts`：`const embed = new DashScopeEmbeddings(); return { ..., embed, rerank: new IndependentReranker({ embed }) }`。
- `QdrantVectorStore.ensureCollection`：已存在且 `size !== dim` → `deleteCollection` + `createCollection`。
- `StandardLibrary.reindexVectorsFromLedger()`：walk `listProjects` → packs → docs → versions → `listLayoutUnits`，upsert。
- `JobPipeline.openLiveFromEnv` 在 live 装配后调用 reindex。

**Trade-offs**：首次 live 启动会打百炼（条款量 × 1）；collection 重建窗口内检索为空，直到 reindex 完成。  
**隐藏成本**：embed 改 async 后所有 `ports.embed.embed(...)` 调用点要 `await`（library / ingest-worker / rerank / 测试）。  
**失败模式**：reindex 中途失败 → 抛错，**禁止**用 Hash 填半库；重试 boot。HTTP 4xx/空向量 → throw。  
**依赖前提**：`DASHSCOPE_API_KEY` 已在 operator `.env`；Qdrant/Postgres live 四键仍由 `resolveEngineMode` 管。

### 方案 B — 只加静态门禁（否决）

机制类：**静态闸门**。grep `live-ports.ts` 不含 `HashEmbeddings`，或类型注释写「生产勿用 Hash」。  
**失败模式**：绿灯 ≠ Qdrant 维数变化、≠ 语义召回（镜 2）。不选。

### 方案 C — 独立 embedding 微服务 / 聊天模型冒充向量（否决）

机制类：**流程重组**。另起服务或 `complete()` 出向量。  
**失败模式**：用户已指定兼容模式 embedding 接口；聊天当 embed 是明确非目标。文件数与运维面会爆。不选。

### 最强反方 → 推荐项回应

攻击：重建 collection 是破坏性操作，reindex 失败会留下空 `clauses`，操作员以为 live 仍可用 Hash 48 维。  
回应：空库或半库时 **openLiveFromEnv / reindex 失败即进程不可用**（HTTP 起不来或显式 5xx），与现网「live 半配置 fail-fast」同构。禁止 Hash 回退。攻击指出的是必须暴露的失败，不是回退理由。推荐项仍成立。

### 为什么最贵的真机制不是默认

最贵 = 方案 C（独立服务 + 更高维 v4）。用户原话钉死 v3 + 兼容模式 URL + 现有 `RetrievePorts.embed`。证据档位是「live 入库维数 = v3」「缺 key 不能检索」「NL 与 1.1 同 clause_id」，不是「另起向量平台」。方案 A 直接改变 live 检索世界。

## 设计

### Architecture

```
DASHSCOPE_API_KEY ──► DashScopeEmbeddings.embed (async, dim=1024)
                           │
                           ├─ liveRetrievePorts.embed
                           └─ IndependentReranker({ embed })   // 同一实例
                                    │
Postgres t_clause / t_layout_unit ──► reindexVectorsFromLedger
                                    │
                                    ▼
                         Qdrant collection clauses
                         (recreate if size !== 1024)
                                    │
                         searchSemantic: await embed(query)
```

CI：`defaultRetrievePorts` → Hash 48 维 + MemoryVectorStore，不读 DashScope。

### Components

| 组件 | 职责 |
|------|------|
| `Embeddings.embed` | 签名改为 `number[] \| Promise<number[]>` |
| `HashEmbeddings` / `FixtureEmbeddings` | CI/测试；保持 48 维；可同步返回 |
| `DashScopeEmbeddings` | live 实现；缺 key 构造即 throw；`fetch` 失败/空向量 throw；**从不**实例化 Hash |
| `liveRetrievePorts` | 装配 v3 embed，并注入 rerank |
| `QdrantVectorStore.ensureCollection` | 维数不一致则重建 |
| `StandardLibrary.reindexVectorsFromLedger` | 账本 LayoutUnit → upsert；payload 仍含 `unit_id` / `file_name` / `chunk_kind` |
| `IndependentReranker` | `await embed`；live 必须注入，禁止默认 Hash 混进 live |
| `JobPipeline.openLiveFromEnv` | live 模式下 reindex |

### Data flow

- 请求：`POST https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings`，`Authorization: Bearer <env>`，JSON `{ model: "text-embedding-v3", input: <text>, dimensions: 1024, encoding_format: "float" }`。
- 响应：`data[0].embedding` 为 `number[]`；`length !== 1024` → throw（禁止截断）。
- 入库文本：clause unit = `` `${heading}\n${body}` ``（与现 `upsertClauseLayout` 一致）；table/annex = heading + `body_markdown`。
- payload 字段不删：`unit_id`、`file_name`、`chunk_kind`（及现有 versionId 等）。禁止用 hashed UUID 回填 `clause_id`。
- rerank：query 向量与候选向量必须同模型；候选已有 `vector` 则复用（来自 Qdrant `with_vector`），否则 `await embed(text)`。

### Error handling

| 情况 | 行为 |
|------|------|
| 未设置 / 空白 `DASHSCOPE_API_KEY` | `liveRetrievePorts()` throw；消息含变量名，不含值 |
| DashScope HTTP 非 2xx / 空 embedding | throw；不回退 Hash、不写 48 维点 |
| 返回维数 ≠ 1024 | throw |
| 现网 collection size=48 | delete + create(1024) + reindex；reindex 失败则 throw，不启动半库 |
| CI 无 key | 不调用 `liveRetrievePorts()` 作为默认测试路径；`HashEmbeddings` 仍绿 |
| 聊天模型误注入 rerank | 现有 `IndependentReranker` 禁止 `complete()`；本片不改此禁令 |

### Testing（行为证据，非纯形状）

| ID | 行为（通过后世界不同） |
|----|------------------------|
| T1 | CI：`new HashEmbeddings().embed("x")` 长度仍为 48；`defaultRetrievePorts` 不读 DashScope |
| T2 | mock `fetch` 返回 1024 维：`DashScopeEmbeddings.embed` 长度 1024；断言 **未** 调用 Hash 路径 |
| T3 | 构造 `liveRetrievePorts` 时剥掉 `DASHSCOPE_API_KEY` → throw `/DASHSCOPE_API_KEY/`；不返回 `HashEmbeddings` |
| T4 | `liveRetrievePorts()`（mock embed 或注入）的 `rerank` 与 `embed` 为同一实例：对 query 调 embed 的次数/对象可断言共用 |
| T5 | Qdrant mock：已有 collection size=48，`upsert` 1024 维向量 → 先 delete 再 create size=1024，再 upsert |
| T6 | `reindexVectorsFromLedger`：账本一条 clause + 一条 table unit → 两次 upsert，payload 含 `unit_id`/`file_name`/`chunk_kind` |
| T7 | 源码与测试夹具不含 apiKey 字面量（禁止把真实/伪造 sk 写进 fixture）；Error 消息不含 Bearer 值 |
| T8 | `searchSemantic` 在 embed 为 async 时仍返回命中（Hash 测试夹具 A12：自然语言与「1.1」同 `clause_id`） |

T2–T5 用注入 `fetch` / mock Qdrant client，**默认 CI 不打** `dashscope.aliyuncs.com`。  
live smoke（已有 `live-rag-ingest.test.ts`）：`skipIf` 增加无 `DASHSCOPE_API_KEY`；有 live 四键 + key 时，scroll 一点向量长度 **≠ 48**。此条有环境才跑，不是 CI 必绿主体。

禁止只 grep「text-embedding-v3」字符串当 T2/T3 通过。

## 追问记录

- 轮次：**2**（第 2 轮无新实质发现，收敛）
- 模式：全自动（`.apt/goal.md` 存在）；S3 均有 MCP/源码查证
- 红队册前载：扫 7 镜；本片 risk=low，步骤 4 方案红队强化代替独立红队

### 第 1 轮

| 镜头 | 关键追问 | 结论 / 修订 |
|------|----------|-------------|
| S1 场景 | 谁在何时用 v3？空 key？CI？ | 配置人员 live `standard_lib` 入库/语义检索。CI 继续 Hash。空 key 不能假装 live 可用。 |
| S2 破坏 | 砍一半保哪半？伪需求？ | 保：live 真 embedding、维数重建、缺 key 失败、rerank 同空间。砍：聊天当 embed、改路由/DSL、改 8 页 UI、独立微服务。 |
| S3 可行 | 现有端口能否支撑？ | 能：`Embeddings` / `liveRetrievePorts` / `QdrantVectorStore` / `IndependentReranker` / `LedgerStore.listLayoutUnits` 均在。缺口是 live 仍 Hash、ensureCollection 不重建、rerank 未注入。`query_contract QdrantVectorStore` 未登记但不阻塞（源码可寻址）。 |
| S4 验收 | 怎样证明不是形状？ | T2 mock 1024；T3 缺 key throw；T5 重建；live smoke 维数 ≠48。禁止只 grep 模型名。 |

需求修订 v1→v2：重嵌范围从「仅 t_clause」扩到 LayoutUnit 全量（表点否则丢失）。

### 第 2 轮

| 镜头 | 关键追问 | 结论 / 修订 |
|------|----------|-------------|
| S1 | 首次 boot 重建窗口用户看见什么？ | 重建+reindex 完成前不提供半库 Hash 检索；失败则进程/装配失败。 |
| S2 | 把 DASHSCOPE 并入 resolveEngineMode 四键？ | 否。存储模式与 embedding 凭证分离；失败点在 `liveRetrievePorts`，避免「四键全空却因无 DashScope 不能进 memory」。 |
| S3 | VectorStore 端口要加 recreate？ | 否（YAGNI）。MemoryVectorStore 无 collection。重建留在 `QdrantVectorStore`。 |
| S4 | A12 是否只在 live 才验？ | CI Hash 仍保 A12（T8）。live 有 key 时 smoke 验维数。两档都要，不把 CI 绿当成 live 语义已换。 |

无新实质发现。残留：无。

### 需求修订 delta

- v1：live 换 v3，重建 48 维 collection，密钥走 env。
- v2：rerank 必须注入同一 embed；重嵌 LayoutUnit 全量；缺 key 失败点在 `liveRetrievePorts` 而非 `resolveEngineMode`。
- v3：无（第 2 轮收敛）。

## 需求锁定表

| ID | 需求描述 | 来源 | 验收标准（可判定） | 优先级 |
|----|----------|------|--------------------|--------|
| R1 | live embed 为 DashScope text-embedding-v3，baseUrl 为指定兼容模式 | 用户明示（队列 F-2） | T2：mock 请求 URL 以 `/embeddings` 结尾且 model 为 `text-embedding-v3`；返回长度 1024 | must |
| R2 | 密钥只读 `DASHSCOPE_API_KEY`，源码/git/夹具无 apiKey | 用户明示 | T3+T7：缺 key throw；仓库无密钥字面量 | must |
| R3 | 缺 key 时 live 显式失败，禁止回退 Hash | 用户明示 | T3：`liveRetrievePorts()` 不返回 Hash 实例 | must |
| R4 | Qdrant `clauses` 维度 = v3 返回维（非 48），必要时重建 | 用户明示 | T5：size 48 → delete+create 1024 | must |
| R5 | 从账本重嵌入现有点；payload 含 unit_id/file_name/chunk_kind | 用户明示 + 追问确认（含表单元） | T6：clause+table 均 upsert 且 payload 三字段在 | must |
| R6 | live rerank 与入库共用同一 embedding 端口 | 用户明示 | T4：同一 embed 实例注入 IndependentReranker | must |
| R7 | 允许 embed 改为 async；CI 仍可用 HashEmbeddings | 用户明示 | T1+T8：Hash 48 维；async embed 下 A12 仍过 | must |
| R8 | 不用聊天模型当 embed/rerank；不改 DSL；不发明条款号；不改其它 8 页 | 用户明示 | 实现白名单不含 chat complete / 其它 page views；rerank 禁 complete 回归仍绿 | must |
| R9 | 请求钉 `dimensions: 1024`（文档默认），禁止自创 48/768 | 追问确认 | T2 请求 body 含 dimensions=1024；响应 length≠1024 则 throw | nice |

无「AI 假设未确认」的 must。

## Ontology detection

调用：

- `query_ontology()` 项目快照
- `query_ontology(topic=retrieve embeddings)`
- `query_contract Embeddings` / `HashEmbeddings` / `liveRetrievePorts` / `RetrievePorts` / `IndependentReranker` / `StandardLibrary` / `StandardIngestWorker` / `resolveEngineMode` / `ZhipuLlmProvider`
- `query_contract QdrantVectorStore` → 未登记；`search_arch` + `query_arch frontend/core-engine/util#qdrantvectorstore` + 源码
- `query_design scope=global`
- `query_design page=standard_lib`（本片不改 UI）

复用决策：

| 资产 | 决策 | 理由 |
|------|------|------|
| `Embeddings` / `RetrievePorts` | **复用并放宽 embed 为 async** | 已登记；不另造 EmbeddingPort |
| `HashEmbeddings` | **复用，仅 CI/测试** | 用户明示 CI 可继续 Hash |
| `liveRetrievePorts` | **复用并改装配** | live 唯一工厂，禁止第二套 |
| `IndependentReranker` | **复用，强制注入 embed** | 禁止 chat complete；禁止 live 默认 Hash |
| `QdrantVectorStore` | **复用并修 ensureCollection** | collection 名 `clauses` 不变 |
| `StandardLibrary` / ingest-worker | **复用，await embed + reindex** | 入库调用点已存在 |
| `resolveEngineMode` | **不改四键** | embedding 凭证不是存储模式 |
| `ZhipuLlmProvider` | **不复用当 embed** | 聊天补全非目标 |
| `.ai/arch/vectors.db` | **不碰** | 非业务库 |
| `standard_lib` UI / 其它 8 页 | **不碰** | 范围冻结 |

S3 缺口：无缺失契约需停工。`QdrantVectorStore` 未登记属知识库债，finish-feature 补 `register_contract`。

## 拟改动文件（≤8）

| 文件 | 变更 |
|------|------|
| `packages/core-engine/src/retrieve/ports.ts` | `Embeddings.embed` → `number[] \| Promise<number[]>` |
| `packages/core-engine/src/retrieve/embeddings.ts` | Hash/Fixture 保持可用；新增 `DashScopeEmbeddings`（同文件以免第 9 个实现文件） |
| `packages/core-engine/src/retrieve/live-ports.ts` | v3 embed；rerank 注入同一实例；缺 key throw |
| `packages/core-engine/src/retrieve/qdrant.ts` | collection size 不一致则重建 |
| `packages/core-engine/src/retrieve/library.ts` | await embed；`reindexVectorsFromLedger` |
| `packages/core-engine/src/retrieve/ingest-worker.ts` | await embed |
| `packages/core-engine/src/retrieve/rerank.ts` | await embed |
| `packages/core-engine/src/pipeline/job-pipeline.ts` | `openLiveFromEnv` 调用 reindex |

`index.ts` 仅增加 `DashScopeEmbeddings` re-export，不计第 9 个实现文件。  
测试改/增：`packages/core-engine/test/rerank.test.ts`、`standard-rag.test.ts`、`ingest-pdf.test.ts`、`live-rag-ingest.test.ts`，以及 `dashscope-embeddings.test.ts`（mock fetch；无真实 key）。

实现后 `register_contract Embeddings`（签名演进）及 `DashScopeEmbeddings` / `QdrantVectorStore`。

## 风险分级

- frontmatter 未标 high。
- 正文未命中 MCP / arch 管线 / 破坏性对外面关键词（不把内部 embed 签名写成对外 breaking 口号）。
- 拟改动实现文件 = 8，未超过 8。

**risk: low** → `auto_approved`。步骤 5.5 独立红队免派（方案红队强化即为红队档）。
