# Task F2-4 Review — 账本 LayoutUnit 重嵌入

review-tier: full
projectType: component（跳过 B2 `designs/v0/*/test-cases.md` 门禁；非页面 Task，跳过数据防御抽检；公开方法注释必须抽检）
Plan: `docs/apt/plans/2026-09-19-dashscope-text-embedding-v3-plan.md` Task 4
Spec: `docs/superpowers/specs/2026-09-19-dashscope-text-embedding-v3-design.md`（Rn：R5 / T6）
Brief: `.apt/orchestration/task-f2-4-brief.md` / `.apt/orchestration/task-f2-4-review-brief.md`
Report: `.apt/orchestration/task-f2-4-report.md`
HEAD: `1528f571b4362f34403d4c361370b5ce699950b3`
Parent / BASE_SHA: `3a5dcbea7c746d2865e8cff1f51435bad30599b5`
Status (implementer): `DONE_WITH_CONCERNS`
Verify（implementer 已报；审查方未重跑）：TDD RED `Test Files 1 failed (1)` / `Tests 2 failed | 1 passed (3)`（async embed 下 `point.vector is not iterable`）→ GREEN `Test Files 2 passed (2)` / `Tests 18 passed (18)`（含 `standard-rag.test.ts` 回归）

审查范围：只审 `git diff 3a5dcbe..1528f57`。工作区其它未提交文件（含 `job-pipeline.ts` ocr/`appendChat` 脏改动、report）不计入本 Task。审查方只读：未改代码、未 commit、未重跑 vitest。gstack review 不可用，已跳过。

MCP（审查方只读复查）：`query_contract StandardLibrary` 已登记，`tsFilePath=packages/core-engine/src/retrieve/library.ts`，描述含 `reindexVectorsFromLedger`、payload 三字段、`embed()` 均 await、table 不得带非空 `clause_id`。`query_contract LedgerStore` 含 `listProjects` / `listSpecPacks` / `listStandardDocs` / `listStandardVersions` / `listLayoutUnits` / `getClause`。`query_contract JobPipeline` 的 `tsContent` 来自工作区（含本 Task 无关 ocr 参数），**commit 内** `openLiveFromEnv` 仅 live 分支 `await pipeline.library.reindexVectorsFromLedger()`。`query_arch frontend/packages/util#standardlibrary` 为本次 `refresh_asset`（Updated `2026-09-19T08:37Z`），摘要仍「javadoc 暂无 / 公开签名暂未提取」，未写 LayoutUnit walk / payload gate / 禁止 Hash 回填。既有 `frontend/core-engine/util#standardlibrary` Updated 仍为 `2026-09-19T06:36Z`。`search_arch` 同样命中空摘要的 packages 锚点。

### Spec Compliance
- ✅ Spec compliant

相对 plan Task 4、brief（LayoutUnit 全量 walk；payload `unit_id`/`file_name`/`chunk_kind` 及 page 以过 gate；table 无非空 `clause_id`；`openLiveFromEnv` 仅 live 调用；`library.ts` 全部 `embed()` await；失败 throw 不 Hash；导出方法「为什么」注释）与 R5/T6：**无 Missing / Extra（白名单外）/ Misunderstood**。

| 检查项 | 结果 | 证据 |
|--------|------|------|
| R5 / T6：clause + table unit → ≥2 次 upsert；payload 含 `unit_id`/`file_name`/`chunk_kind` | **YES** | walk `listProjects` → `listSpecPacks` → `listStandardDocs` → `listStandardVersions` → `listLayoutUnits`。单测 ingest 夹具含条款+表，reindex 后 `upserts.length >= 2`，clause/table 点 `toMatchObject` 三字段 + `page_start`/`page_end` |
| clause 文本优先 `getClause` heading+body，否则 unit heading + `body_markdown`；table/annex 用 unit 文本 | **YES** | `reindexEmbedText`：`kind === "clause"` 且 `getClause` 命中则 `` `${heading}\n${body}` ``，否则 `` `${unit.heading}\n${unit.body_markdown}` ``。单测 embed 文本同时含「1.1 事假须提前申请」与「须在休假前」 |
| payload 过 `assertVectorPayload`；table 无非空 `clause_id` | **YES** | `reindexPayload` 必写三字段 + 正整数 page；仅 `kind === "clause" && unit.clause_id` 才写 `clause_id`。`RecordingVectorStore` 内层 `MemoryVectorStore.upsert` 会跑 gate。单测 `table` 的 `clause_id` 非非空字符串 |
| `openLiveFromEnv` live 装配后 `await reindex`；memory 不调用 | **YES** | commit：`mode === "memory"` 直接 `openStandardLibrary()`；live 在 `new JobPipeline(store, liveRetrievePorts(), …)` 之后 `await pipeline.library.reindexVectorsFromLedger()`。单测 prototype spy：memory 分支 `calls === []` |
| 失败 throw，禁止 Hash 回填 | **YES** | reindex 路径无 catch。单测 embed 抛 `dashscope HTTP 503` 时 `rejects.toThrow(/503/)` 且 `upserts` 长度为 0 |
| `library.ts` 全部 `ports.embed.embed(...)` 均 `await` | **YES** | HEAD 四处均 await：reindex upsert、`searchSemantic`、`upsertClauseLayout`、`upsertTableLayout`。无未 await 调用。`ingest-worker.ts` 未改（Task 5） |
| 白名单 / 单 commit / 未 push | **YES** | 仅 3 文件：`library.ts`、`job-pipeline.ts`、`reindex-vectors.test.ts`。subject=`feat(retrieve): reindex ledger LayoutUnits with current embeddings`。parent=`3a5dcbe`。无 upstream |
| 不改 Vue / DSL / qdrant / embeddings / live-ports；不写 apiKey | **YES** | diff 无名这些路径；三文件无 `sk-` / `DASHSCOPE_API_KEY` 字面量密钥 |
| `register_contract StandardLibrary` | **YES** | report + MCP 描述与源码一致（含 reindex / await / table clause_id） |
| 公开 export 注释（为什么） | **YES** | 见 Quality |
| component：不查 test-cases.md | **YES** | 未查 |
| 非页面：跳过数据防御 | **YES** | 未抽检 |

**Missing：** 无。R7 生产 `ingest-worker` await 属 Task 5；brief 禁止改该文件。annex 与 table 共用「heading + body_markdown、不写 clause_id」分支，T6 只要求 clause+table 证据。live 四键 boot 未打真实百炼/Qdrant/Postgres，与 report 及本片 Verify（内存 vitest）一致。

**Extra（白名单外）：** 无。commit 只有白名单三文件。工作区 `job-pipeline.ts` 另有 ocr/`appendChat` 未提交改动，**未进本 commit**，与 report 披露一致，不计入本 Task。未改 embeddings / live-ports / qdrant / Vue / ingest-worker / `.ai/`。

**Misunderstood：** 无。未把 reindex 挂到 memory 分支；未在失败时改用 `HashEmbeddings`；未给 table payload 填 hashed UUID `clause_id`；未只重嵌 `t_clause`（walk 的是 `listLayoutUnits`）；embed 返回值均 await 后再赋给 `vector: number[]`。

### Strengths
- 行为与 T6 同构：RED 是 ingest 未 await async embed（`point.vector is not iterable`），证明当时生产路径仍把 `Promise<number[]>` 当向量；GREEN 后同一套 RecordingVectorStore 验的是 clause+table 各一次以上 upsert、三字段+page、table 无非空 `clause_id`、embed 文本来自条款 heading+body，不是只 grep 方法名。
- 失败路径有证据：embed 抛 503 后 0 次 upsert，与 spec「半库禁止 Hash 回填、失败即 throw」同构。
- live/memory 切分正确：reindex 发生在 `liveRetrievePorts()` 注入之后，memory `openStandardLibrary()` 不调用；单测用 prototype spy 锁 memory 负例。
- 切片锁得住：只动 library + job-pipeline 的 live hunk + 新测；`ingest-worker` 留给 Task 5；await embed 仅限 brief 白名单的 `library.ts`。
- payload 构造与 gate 对齐：缺 file_name 时用 URI basename，非法 page 回落到 `DEFAULT_PAGE`；table/annex 明确不写 `clause_id`，并有「会 fail gate / 伪造 clause hit」的为什么注释。
- 诚实 `DONE_WITH_CONCERNS`：`refresh_asset` 落到 `frontend/packages/util`、工作区无关脏文件、未打 live boot、MCP 可能改 `.ai/` 未进 commit，均写入 report。

### Issues
#### Critical (Must Fix)
- 无。

#### Important (Should Fix)
- `refresh_asset` 落到新建 `frontend/packages/util#standardlibrary` / `#jobpipeline`（Updated `2026-09-19T08:37Z`），摘要仍是「暂无 Javadoc / 签名待补充」，未写 LayoutUnit 全量 walk、payload 三字段、live-only reindex、禁止 Hash 回填。既有 `frontend/core-engine/util#standardlibrary` Updated 仍为 `2026-09-19T06:36Z`；`#jobpipeline` 仍为 `2026-09-15`。`register_contract StandardLibrary` 源码路径与行为描述正确。批次禁止 `audit_arch_changes` / 手工改 `.ai/`；留给 PB-5 `finish_feature` closeout，**不阻断本 Task 源码验收**（与 F2-1 / F2-2 / F2-3 同口径，非 Critical）。

#### Minor (Nice to Have)
- `openLiveFromEnv` 既有 JSDoc 仍只解释「HTTP 不自己 new Qdrant」；reindex 的为什么写在行内注释。行为正确，抽检不因未改方法头判 Fail。
- 单测只锁 memory 负例，live 正例靠源码阅读（无四键+key 的 CI 路径）。T6 不要求真实 live boot。
- annex 无独立夹具；与 table 同分支，T6 不要求第三条 upsert。
- clause embed 文本断言未区分 `getClause` 与 unit fallback（ingest 后二者通常相同）；实现优先 `getClause`。
- `reindexVectorsFromLedger` prototype spy 在 `try` 外赋值；失败/超时时依赖 `finally` 还原。测试夹具可接受。

### Quality
**公开方法注释抽检：PASS（Approved）**

本片新增或行为变更的公开面：

- `StandardLibrary.reindexVectorsFromLedger`：为何 collection 重建后不能用 Hash 48 维回填（看起来像 live RAG 仍可用），失败应让 boot 失败而不是混维。
- `JobPipeline.openLiveFromEnv`：既有「为什么装配放在 pipeline factory」仍在；live 分支行内说明为何在 `new JobPipeline` + `liveRetrievePorts()` 之后 await reindex（禁止 Hash 填空库）。
- 私有 `reindexPayload` 的 clause_id 分支：为何 table/annex 带非空 `clause_id` 会过不了 payload gate、并伪造条款命中。

`reindexVectorsFromLedger` / `reindexPackLayoutUnits` / `upsertReindexedUnit` / `reindexEmbedText` / `reindexPayload` 均有明确 return type；函数体远小于 80 行（walk 已拆 helper）。`RecordingEmbeddings` 为 async，单测断言 upsert 的 `vector` 是 `number[]` 而非 Promise。

测试验的是 upsert 次数、payload 三字段+page、table 无非空 `clause_id`、embed 文本、失败 0 upsert、memory 不调 reindex，不是只 grep `reindexVectorsFromLedger`。错误处理：无空 catch；不 Hash 回退；payload 经 MemoryVectorStore 的 `assertVectorPayload`。

**白名单 / 密钥：** commit 仅三文件。未含 `.ai/`、`.env`、token、`sk-`、真实 Qdrant/DashScope URL。未 push。未改 Vue / DSL / qdrant / embeddings / live-ports / ingest-worker。

**APT Micro-closeout vs diff：** `ContractsRegistered=StandardLibrary` 与 MCP/源码一致。`AssetsRefreshed` 的 `sourcePath` 是白名单 `library.ts` / `job-pipeline.ts`，索引落到 `frontend/packages/util` 且摘要偏空（见 Important）。`AssetsRemoved` 无。diff 未改 `.ai/`（MCP 侧效应未进本 commit，与 report 一致）。

### Assessment
**Task quality:** Approved
**Reasoning:** `reindexVectorsFromLedger` 按 LayoutUnit 全量 walk 并用当前 `ports.embed` upsert；payload 含 `unit_id`/`file_name`/`chunk_kind`（及 page）且 table 不带非空 `clause_id`，能过 payload gate。`openLiveFromEnv` 仅 live 分支在装配 `liveRetrievePorts` 之后 await reindex，memory 不调用。`library.ts` 四处 `embed()` 均 await。embed 失败 throw、0 Hash 回填。提交未越白名单。`refresh_asset` 错挂路径与空摘要属知识库债，不构成本片 Critical/Important 源码必修项。
