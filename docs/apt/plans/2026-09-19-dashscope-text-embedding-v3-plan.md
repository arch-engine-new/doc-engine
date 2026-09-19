---
status: approved
feature: F-2 live DashScope text-embedding-v3
slice: F-2
---

# F-2 live 条款 embedding 换百炼 text-embedding-v3 Implementation Plan

> **Spec:** `docs/superpowers/specs/2026-09-19-dashscope-text-embedding-v3-design.md`
> **Command:** `/plan-from-spec`
> **Status:** approved

**Goal:** live 标准检索用 DashScope `text-embedding-v3` 计算条款向量；Qdrant `clauses` 按 v3 维度重建并从账本重嵌入；缺 `DASHSCOPE_API_KEY` 显式失败；CI 继续 HashEmbeddings。

**Architecture:** `Embeddings.embed` 放宽为 sync|async。CI 仍 `HashEmbeddings`(48)。live `liveRetrievePorts` 装配 `DashScopeEmbeddings`（兼容模式 `/embeddings`，`dimensions: 1024`），并把同一实例注入 `IndependentReranker`。`QdrantVectorStore.ensureCollection` 在 size 不一致时 delete+create。`StandardLibrary.reindexVectorsFromLedger` 按 LayoutUnit 全量 upsert。`JobPipeline.openLiveFromEnv` 在 live 装配后调用 reindex。禁止回退 Hash、禁止聊天当 embed、禁止把 apiKey 写入源码/测试夹具。

> 全自动自答（`/apt-goal --continue` programMode）。相位机曾报 `loopDone=true` / `specRisk=high`（与 spec `risk: low` + `auto_approved` 不符）——程序模式以 `playbook-state.json` 切片为准，本批无 ACCEPT-BATCH。

---

## Part 1 — 技术方案（APT 寻址）

### 1.1 范围与约束

**做：** live embed = text-embedding-v3；密钥只读 `DASHSCOPE_API_KEY`；缺 key throw；collection 维数=v3 返回维（1024），48 维则重建；LayoutUnit 全量重嵌；rerank 与入库同一 embed 实例；embed 可 async；CI Hash 仍绿。

**不做：** 聊天补全当 embed/rerank；`.ai/arch/vectors.db` 当业务库；改 exact/graph/semantic 路由；改 DSL；发明条款号；改其它 8 页 UI；把 DASHSCOPE 并入 `resolveEngineMode` 四键；apiKey 写入 spec/plan/夹具/git。

**Profile：** `.apt/role.md` `projectType: component`（跳过 §0.5 UI / B2 test-cases Gate）。`typeHealth.suggested=business` 不改写。本片无 UI Task。

**测试案例规划（切片 done-when，不写 page test-cases.md）：** spec T1–T8 映射见 Part 2 各 Task Verify。

### 1.2 设计寻址（N/A）

本片不改 Vue / `standard_lib` 交互。`query_design page=standard_lib` 仅确认检索面仍是 A11–A14；无 `report_design_gap`。

### 1.3 依赖寻址表

| 依赖 | 来源 | 引用 | 摘要 |
|------|------|------|------|
| Embeddings | contract | `packages/core-engine/src/retrieve/ports.ts` | `embed(text): number[]` — 本片改为 `number[] \| Promise<number[]>` |
| RetrievePorts | contract | 同上 | `embed` + `rerank` 必须同一空间 |
| HashEmbeddings | contract | `packages/core-engine/src/retrieve/embeddings.ts` | CI 48 维 n-gram；非生产 |
| liveRetrievePorts | contract | `packages/core-engine/src/retrieve/live-ports.ts` | 现装配 `new HashEmbeddings()` + 未注入的 `IndependentReranker()` |
| IndependentReranker | contract | `packages/core-engine/src/retrieve/rerank.ts` | 默认 Hash；禁 `complete()` |
| StandardLibrary | contract | `packages/core-engine/src/retrieve/library.ts` | 同步 `ports.embed.embed`；无 reindex |
| StandardIngestWorker | contract | `packages/core-engine/src/retrieve/ingest-worker.ts` | 同步 embed upsert |
| JobPipeline | contract | `packages/core-engine/src/pipeline/job-pipeline.ts` | `openLiveFromEnv` 调 `liveRetrievePorts()` 无 reindex |
| LedgerStore | contract | `packages/core-engine/src/persistence/ledger.ts` | `listProjects` / packs / docs / versions / `listLayoutUnits` / `getClause` |
| resolveEngineMode | contract | `packages/core-engine/src/persistence/live-env.ts` | 四库键；**不改** |
| ZhipuLlmProvider | contract | `packages/agent-runtime/src/llm/zhipu-provider.ts` | 聊天补全 — **不复用当 embed** |
| QdrantVectorStore | arch（contract 未登记） | `search_arch` + `query_arch frontend/core-engine/util#qdrantvectorstore` + `packages/core-engine/src/retrieve/qdrant.ts` | collection `clauses`；`ensureCollection` 不检查已有 size |
| HASH_EMBED_DIM | arch | `packages/core-engine/src/retrieve/embeddings.ts` | 48；仅 Hash |

无 `report_missing`。无建表（§0.6 跳过）。

### 1.4 拟改动模块与文件

| 文件/模块 | 变更类型 | 说明 |
|-----------|----------|------|
| `packages/core-engine/src/retrieve/ports.ts` | modify | embed 签名 async 兼容 |
| `packages/core-engine/src/retrieve/embeddings.ts` | modify | Hash 保持；新增 `DashScopeEmbeddings` |
| `packages/core-engine/src/retrieve/live-ports.ts` | modify | v3 + 注入 rerank；缺 key throw |
| `packages/core-engine/src/retrieve/qdrant.ts` | modify | size 不一致则重建；允许注入 client 以便单测 |
| `packages/core-engine/src/retrieve/library.ts` | modify | await embed；`reindexVectorsFromLedger` |
| `packages/core-engine/src/retrieve/ingest-worker.ts` | modify | await embed |
| `packages/core-engine/src/retrieve/rerank.ts` | modify | await embed |
| `packages/core-engine/src/pipeline/job-pipeline.ts` | modify | live 装配后 reindex |
| `packages/core-engine/src/index.ts` | modify | re-export `DashScopeEmbeddings`（不计第 9 个实现文件） |
| `packages/core-engine/test/dashscope-embeddings.test.ts` | new | T2/T3/T4/T7 mock fetch |
| `packages/core-engine/test/qdrant-collection.test.ts` | new | T5 mock client |
| `packages/core-engine/test/reindex-vectors.test.ts` | new | T6 MemoryVectorStore |
| `packages/core-engine/test/rerank.test.ts` 等既有 | modify | await Hash embed；T1/T8 |

### 1.5 风险与未决项

- 首次 live boot 重建窗口：reindex 失败必须 throw，禁止 Hash 半库。
- DashScope HTTP 默认 CI 不打网；一律注入 `fetch`。
- `QdrantVectorStore` 构造现只收 url/apiKey，单测需可选 `client` 注入（仍在 qdrant.ts 白名单）。
- 密钥：测试只用 `process.env` 临时赋值假值如 `test-key`，禁止真实/sk- 字面量进仓库。
- MCP `loopDone` / `specRisk=high` 是相位机误判，忽略。

### 1.6 需求锁定对照

| Rn | 优先级 | 覆盖 Task | 备注 |
|----|--------|-----------|------|
| R1 | must | Task 2 | v3 + 兼容模式 URL + 1024 |
| R2 | must | Task 2 | 只读 env；夹具无 apiKey |
| R3 | must | Task 2 | 缺 key throw，不回退 Hash |
| R4 | must | Task 3 | collection 重建 |
| R5 | must | Task 4 | LayoutUnit 重嵌 + payload 三字段 |
| R6 | must | Task 2 | rerank 注入同一 embed |
| R7 | must | Task 1 + Task 5 | async embed；CI Hash 48；A12 |
| R8 | must | 全 Task 白名单 | 不改 UI/DSL/chat embed |
| R9 | nice | Task 2 | dimensions=1024；length≠1024 throw |

must 全覆盖。

---

## Part 2 — 可执行任务清单

### Task 1: Embeddings 签名 async 兼容 + CI Hash 仍 48（R7）

- [ ] 只读 MCP：`query_contract` name=`Embeddings`；`query_contract` name=`HashEmbeddings`
  - **MCP:** 同上
  - **Files:** （只读）
- [ ] TDD：`await new HashEmbeddings().embed("x")` 长度 48；既有 `rerank.test.ts` / `standard-rag.test.ts` 在 embed 可能为 Promise 时仍编译并绿
  - **Files:** `packages/core-engine/test/rerank.test.ts`, `packages/core-engine/test/standard-rag.test.ts`
- [ ] 最小实现：`Embeddings.embed(text: string): number[] | Promise<number[]>`；`HashEmbeddings`/`FixtureEmbeddings` 可同步返回；`IndependentReranker.rerank` 与测试调用点 `await` embed。本 Task **不** 改 `liveRetrievePorts`。
  - **Files:** `packages/core-engine/src/retrieve/ports.ts`, `packages/core-engine/src/retrieve/embeddings.ts`, `packages/core-engine/src/retrieve/rerank.ts`, `packages/core-engine/test/rerank.test.ts`, `packages/core-engine/test/standard-rag.test.ts`, `packages/core-engine/test/ingest-pdf.test.ts`, `packages/core-engine/test/agent-native-graph.test.ts`, `packages/core-engine/test/standard-lib-stepchat.test.ts`
  - **Verify:** `npx vitest run test/rerank.test.ts test/standard-rag.test.ts test/ingest-pdf.test.ts`（cwd `packages/core-engine`）——对应 R7/T1
  - **Contracts:** `Embeddings`（签名演进，`register_contract`）

### Task 2: DashScopeEmbeddings + liveRetrievePorts 缺 key 失败 + 共用 rerank（R1/R2/R3/R6/R9）

- [ ] 只读 MCP：`query_contract` name=`liveRetrievePorts`；`query_contract` name=`IndependentReranker`；`query_contract` name=`ZhipuLlmProvider`（确认不复用 complete）
  - **MCP:** 同上
- [ ] TDD（mock fetch，不打网）：
  1. 有 key 时请求 `.../compatible-mode/v1/embeddings`，body `model=text-embedding-v3` 且 `dimensions=1024`，返回 length=1024
  2. 返回 length≠1024 或非 2xx 或空 embedding → throw
  3. 删除 env `DASHSCOPE_API_KEY` 后 `liveRetrievePorts()` throw `/DASHSCOPE_API_KEY/`，返回值不得是 HashEmbeddings
  4. `ports.rerank` 与 `ports.embed` 为同一 DashScope 实例（可比较引用或 embed 调用计数）
  5. 测试文件与实现不含真实密钥字面量
  - **Files:** `packages/core-engine/test/dashscope-embeddings.test.ts`
- [ ] 实现 `DashScopeEmbeddings`（放 `embeddings.ts`）：构造读 env（可注入 `fetch` + `env`）；`liveRetrievePorts` 装配并注入 rerank。缺 key 构造/工厂即 throw。禁止 `?? new HashEmbeddings()`。
  - **Files:** `packages/core-engine/src/retrieve/embeddings.ts`, `packages/core-engine/src/retrieve/live-ports.ts`, `packages/core-engine/src/index.ts`, `packages/core-engine/test/dashscope-embeddings.test.ts`
  - **Verify:** `npx vitest run test/dashscope-embeddings.test.ts test/rerank.test.ts`（cwd `packages/core-engine`）——对应 R1/R2/R3/R6/R9
  - **Contracts:** `DashScopeEmbeddings`（`register_contract`）

### Task 3: Qdrant clauses 维数不一致则重建（R4）

- [ ] 只读 MCP：`search_arch` query=`QdrantVectorStore ensureCollection`；`query_arch` path=`frontend/core-engine/util#qdrantvectorstore`
  - **MCP:** 同上
- [ ] TDD：注入 mock client——已有 collection size=48，`upsert` 1024 维点 → 调用 `deleteCollection('clauses')` 再 `createCollection` size=1024，然后 upsert；size 已 1024 则不 delete
  - **Files:** `packages/core-engine/test/qdrant-collection.test.ts`
- [ ] 实现：`ensureCollection` 读取已有 vectors.size；不一致则重建。可选 constructor `client` 供测试。禁止截断向量去适配旧维。
  - **Files:** `packages/core-engine/src/retrieve/qdrant.ts`, `packages/core-engine/test/qdrant-collection.test.ts`
  - **Verify:** `npx vitest run test/qdrant-collection.test.ts`（cwd `packages/core-engine`）——对应 R4/T5
  - **Contracts:** `QdrantVectorStore`（补登记）

### Task 4: 账本 LayoutUnit 重嵌入（R5）

- [ ] 只读 MCP：`query_contract` name=`StandardLibrary`；`query_contract` name=`LedgerStore`；`query_contract` name=`JobPipeline`
  - **MCP:** 同上
- [ ] TDD：内存账本插入一条 clause unit + 一条 table unit；`reindexVectorsFromLedger` 对 MemoryVectorStore upsert 两次；payload 含 `unit_id`、`file_name`、`chunk_kind`；clause 文本来自 heading+body
  - **Files:** `packages/core-engine/test/reindex-vectors.test.ts`
- [ ] 实现 `StandardLibrary.reindexVectorsFromLedger()`：walk `listProjects` → `listSpecPacks` → `listStandardDocs` → `listStandardVersions` → `listLayoutUnits`；clause 用 `getClause` 文本，table/annex 用 unit heading+`body_markdown`。`JobPipeline.openLiveFromEnv` 在 live 分支 `new JobPipeline` 之后 `await pipeline.library.reindexVectorsFromLedger()`；memory 分支不调用。失败 throw，不回退 Hash。
  - **Files:** `packages/core-engine/src/retrieve/library.ts`, `packages/core-engine/src/pipeline/job-pipeline.ts`, `packages/core-engine/test/reindex-vectors.test.ts`
  - **Verify:** `npx vitest run test/reindex-vectors.test.ts`（cwd `packages/core-engine`）——对应 R5/T6

### Task 5: 入库/检索 await embed + A12 回归（R7/R8）

- [ ] 只读 MCP：`query_contract` name=`StandardIngestWorker`；`query_contract` name=`StandardLibrary`
  - **MCP:** 同上
- [ ] 所有生产调用点 `await` embed：`library.ts` ingest/searchSemantic、`ingest-worker.ts` upsert。禁止改 prequery intent 路由、禁止改 DSL、禁止改 Vue。
  - **Files:** `packages/core-engine/src/retrieve/library.ts`, `packages/core-engine/src/retrieve/ingest-worker.ts`, `packages/core-engine/test/standard-rag.test.ts`, `packages/core-engine/test/ingest-pdf.test.ts`, `packages/core-engine/test/live-rag-ingest.test.ts`
- [ ] live smoke：`skipIf` 增加无 `DASHSCOPE_API_KEY`；有 live 环境时若滚动到向量则 length ≠ 48（有环境才跑）。
  - **Verify:** `npx vitest run test/standard-rag.test.ts test/ingest-pdf.test.ts test/live-rag-ingest.test.ts test/rerank.test.ts test/dashscope-embeddings.test.ts test/qdrant-collection.test.ts test/reindex-vectors.test.ts`（cwd `packages/core-engine`）——对应 R7/R8/T8；A12 自然语言与「1.1」同 clause_id 仍绿
