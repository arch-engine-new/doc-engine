# Task F2-3 Review — Qdrant clauses 维数不一致则重建

review-tier: full
projectType: component（跳过 B2 `designs/v0/*/test-cases.md` 门禁；非页面 Task，跳过数据防御抽检；公开方法注释必须抽检）
Plan: `docs/apt/plans/2026-09-19-dashscope-text-embedding-v3-plan.md` Task 3
Spec: `docs/superpowers/specs/2026-09-19-dashscope-text-embedding-v3-design.md`（Rn：R4 / T5）
Brief: `.apt/orchestration/task-f2-3-brief.md` / `.apt/orchestration/task-f2-3-review-brief.md`
Report: `.apt/orchestration/task-f2-3-report.md`
HEAD: `3a5dcbea7c746d2865e8cff1f51435bad30599b5`
Parent / BASE_SHA: `6361de75400ccf36e6d0fd29237af693ddea5f3e`
Status (implementer): `DONE_WITH_CONCERNS`
Verify（implementer 已报；审查方未重跑）：TDD RED `Test Files 1 failed (1)` / `Tests 2 failed (2)`（`Qdrant URL not configured (set QDRANT_URL)`，mock 被忽略）→ GREEN `Test Files 1 passed (1)` / `Tests 2 passed (2)`

审查范围：只审 `git diff 6361de7..3a5dcbe`。工作区其它未提交文件（含 report）不计入本 Task。审查方只读：未改代码、未 commit、未重跑 vitest。gstack review 不可用，已跳过。

MCP（审查方只读复查）：`query_contract QdrantVectorStore` 已登记，`tsFilePath=packages/core-engine/src/retrieve/qdrant.ts`，描述含注入 `client`、`getCollection().config.params.vectors.size`、size≠dim 则 `deleteCollection('clauses')` + Cosine `createCollection`、匹配不 delete、禁止截断/补零。`query_arch frontend/core-engine/util#qdrantvectorstore` 仍是 2026-09-15「扫描失败，待人工补充」。`search_arch` 另命中本次 `refresh_asset` 新建的 `frontend/packages/util#qdrantvectorstore`（Updated `2026-09-19T08:22Z`），摘要为通用 RAG 向量存储，未写维数重建。

### Spec Compliance
- ✅ Spec compliant

相对 plan Task 3、brief（size≠dim 则 delete+create Cosine size=dim；已匹配不 delete；禁止截断/补零；可选 constructor `client`；`ensuredDim` 仍避免重复 ensure）与 R4/T5：**无 Missing / Extra（白名单外）/ Misunderstood**。

| 检查项 | 结果 | 证据 |
|--------|------|------|
| R4 / T5：已有 `clauses` size=48，upsert 1024 → delete 再 create size=1024 Cosine，再 upsert | **YES** | `ensureCollection` 读 `getCollection` size；`size !== dim` 则 `deleteCollection(COLLECTION)`，再 `createCollection` `{ vectors: { size: dim, distance: "Cosine" } }`。单测断言调用顺序 delete < create < upsert，create 的 size=1024 |
| size 已 1024：不 `deleteCollection` | **YES** | `size === dim` 时写 `ensuredDim` 并 return。单测 `deleteCollection.not.toHaveBeenCalled()` 且不 `createCollection` |
| 禁止截断/补零去适配旧维 | **YES** | upsert 原样传 `point.vector`；无对向量 `slice`/`pad`。单测 upsert 点 `vector` length=1024。唯一 `slice` 是既有 SHA1→UUID，不是向量 |
| constructor 可选 `client`；mock 不打真实 Qdrant | **YES** | `options?.client` 则直接持有并 return，不读 `QDRANT_URL`、不 `new QdrantClient`。测试文件头写明 mock only；无 `QDRANT_URL` / `6333` / 真实 URL |
| `ensuredDim` 仍避免重复 ensure | **YES** | 方法开头 `if (this.ensuredDim === dim) return`；匹配或 create 后都写入 |
| payload 过 `assertVectorPayload` | **YES** | 夹具含 `file_name` / `unit_id` / `chunk_kind` / `page_start` / `page_end`（clause 可省略 `clause_id`）。upsert 仍先 `assertVectorPayload` |
| 白名单 / 单 commit / 未 push | **YES** | 仅 2 文件：`qdrant.ts`、`qdrant-collection.test.ts`。subject=`feat(retrieve): rebuild Qdrant clauses on embedding dimension mismatch`。无 upstream |
| 不改 live-ports / embeddings / library / Vue | **YES** | diff 无名这些路径 |
| `register_contract QdrantVectorStore` | **YES** | report + MCP 描述与源码一致 |
| 公开 export 注释（为什么） | **YES** | 见 Quality |
| component：不查 test-cases.md | **YES** | 未查 |
| 非页面：跳过数据防御 | **YES** | 未抽检 |

**Missing：** 无。R5 账本重嵌 / R7 生产 await 分属 Task 4–5；brief 白名单不含 `library.ts` / `job-pipeline.ts` / Vue。`search()` 同样走 `ensureCollection`，T5 指定的证据路径是 upsert，单测覆盖 upsert 即可。

**Extra（白名单外）：** 无。未改 embeddings / live-ports / library / Vue / `.ai/`。named vector map 无顶层 `size` 视为不一致并重建，是 brief「读已有 vectors.size」的保守实现，不是越界文件。

**Misunderstood：** 无。未截断 1024→48；未在 size 已匹配时 delete；未打真实 Qdrant；collection 名仍为 `clauses`；未把维数钉死成常量（用 upsert/search 传入的 `vector.length` 作为 dim，与「维度 = 当前 embed 返回维」一致）。

### Strengths
- 行为与 T5 同构：RED 是注入 mock 仍因缺 `QDRANT_URL` 失败（证明当时 constructor 不认 `client`）；GREEN 后同一批断言验的是 delete→create(size=1024, Cosine)→upsert 顺序，以及匹配维不 delete。不是只 grep `deleteCollection`。
- 重建策略最小且正确：已存在则读 size；匹配则 cache 返回；不匹配才 delete，create 与「不存在」共用同一 Cosine 分支。禁止截断写在 delete 前的为什么注释里。
- 测试不触网：构造期注入 mock，payload 走真实 `assertVectorPayload`，向量 `new Array(1024).fill(0)`。
- 切片锁得住：只动 `qdrant.ts` + 新测；未提前做账本 reindex 或 live-ports。
- 诚实 `DONE_WITH_CONCERNS`：arch 旧锚点仍「扫描失败」、`refresh_asset` 落到 `frontend/packages/util`、named vector 保守重建、MCP 可能改 `.ai/` 未进 commit，均写入 report。

### Issues
#### Critical (Must Fix)
- 无。

#### Important (Should Fix)
- `refresh_asset` 落到新建 `frontend/packages/util#qdrantvectorstore`（Updated `2026-09-19T08:22Z`），摘要仍是通用「向量存储 / RAG 召回」，未写 size≠dim 则 delete+create、匹配不删、禁止截断。既有 `frontend/core-engine/util#qdrantvectorstore` Updated 仍为 `2026-09-15`，「扫描失败，待人工补充」。`register_contract` 源码路径与行为描述正确。批次禁止 `audit_arch_changes` / 手工改 `.ai/`；留给 PB-5 `finish_feature` closeout，**不阻断本 Task 源码验收**（与 F2-1 / F2-2 同口径，非 Critical）。

#### Minor (Nice to Have)
- `search` 仍无「为什么」注释（BASE 已如此）；本片行为变更在私有 `ensureCollection`，构造函数与 delete 分支已说明为何注入 client / 为何不能截断。
- 未覆盖「collection 不存在则只 create」与 named vector map；report 已披露后者视为 mismatch。T5 不要求这两条。
- `ensureCollection` 按传入 `dim` 双向重建（1024 collection 遇上 48 维也会删）。live 走 v3、CI 走 MemoryVectorStore，符合「维度 = 当前 embed 返回维」；若误把 Hash 打到 live Qdrant 会把 1024 collection 降维，属装配错误而非本片缺口。
- `mockQdrantClient` 无显式 return type；测试夹具可接受。

### Quality
**公开方法注释抽检：PASS（Approved）**

本片新增或行为变更的公开面：

- 文件头 / `QdrantVectorStore`：为何缺 URL 仍可构造（注入 `client`），为何测试不得打开 live Qdrant URL。
- constructor：为何 live 需要 `QDRANT_URL`，为何测试传 `client`（才能在无真实进程时断言维数重建）。
- `upsert`：既有「先 provenance、hash unit_id、禁止用 point.id 回填 clause_id」注释仍在；维数重建由随后的 `ensureCollection(point.vector.length)` 承担。
- 私有 `ensureCollection` 的关键分支：为何 48 维 Hash collection 不能装 v3 1024 点、禁止 truncate/pad。`collectionVectorSize` 说明 named map 无顶层 size 视为不一致，避免往未知维 upsert。

`ensureCollection` / `collectionVectorSize` / `upsert` / `search` 均有明确 return type；函数体远小于 80 行。`search` 未 export 新签名，抽检不因缺 JSDoc 判 Fail（见 Minor）。

测试验的是 client 调用顺序、create 的 size/distance、upsert 向量仍 1024、匹配维不 delete，不是只 grep 集合名。错误处理：无空 catch；不截断适配；payload 仍走 `assertVectorPayload`。

**白名单 / 密钥：** commit 仅两文件。未含 `.ai/`、`.env`、token、`sk-`、真实 Qdrant URL。未 push。未改 live-ports / embeddings / library / Vue。

**APT Micro-closeout vs diff：** `ContractsRegistered=QdrantVectorStore` 与 MCP/源码一致。`AssetsRefreshed` 的 `sourcePath` 是白名单 `qdrant.ts`，索引落到 `frontend/packages/util` 且摘要偏空（见 Important）。`AssetsRemoved` 无。diff 未改 `.ai/`（MCP 侧效应未进本 commit，与 report 一致）。

### Assessment
**Task quality:** Approved
**Reasoning:** `clauses` 已存在且 `vectors.size !== dim` 时 delete 再 Cosine create（size=dim），已匹配则不 delete；1024 维向量原样 upsert，无截断/补零。constructor 可注入 mock client，单测覆盖 T5 两条路径且不打真实 Qdrant。提交未越白名单。`refresh_asset` 错挂路径与空摘要属知识库债，不构成本片 Critical/Important 源码必修项。
