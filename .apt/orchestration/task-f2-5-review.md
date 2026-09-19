# Task F2-5 Review — 入库/检索 await embed + A12 回归

review-tier: full
projectType: component（跳过 B2 `designs/v0/*/test-cases.md` 门禁；非页面 Task，跳过数据防御抽检；公开方法注释必须抽检）
Plan: `docs/apt/plans/2026-09-19-dashscope-text-embedding-v3-plan.md` Task 5
Spec: `docs/superpowers/specs/2026-09-19-dashscope-text-embedding-v3-design.md`（Rn：R7 / R8 / T8）
Brief: `.apt/orchestration/task-f2-5-brief.md` / `.apt/orchestration/task-f2-5-review-brief.md`
Report: `.apt/orchestration/task-f2-5-report.md`
HEAD: `17fee66b1494f3f4da4850c5df971a1de8acc386`
Parent / BASE_SHA: `1528f571b4362f34403d4c361370b5ce699950b3`
Status (implementer): `DONE_WITH_CONCERNS`
Verify（implementer 已报；审查方未重跑）：`Test Files  6 passed | 1 skipped (7)` / `Tests  35 passed | 1 skipped (36)`（cwd `packages/core-engine`；live smoke skip）。A12：`standard-rag.test.ts` 15 passed。

审查范围：只审 `git diff 1528f57..17fee66`。工作区其它未提交文件（含 `ingest-worker.ts` 的 `unpdf` `getDocumentProxy` 计页、report）不计入本 Task。审查方只读：未改代码、未 commit、未重跑 vitest。gstack review 不可用，已跳过。

MCP（审查方只读复查）：`query_contract StandardIngestWorker` 已登记，`tsFilePath=packages/core-engine/src/retrieve/ingest-worker.ts`；**工作区** `tsContent` 含未提交 `unpdf` 计页，与 HEAD 不一致——HEAD 仅两处 `await ports.embed.embed(...)`。`query_contract StandardLibrary` 四处 `embed()` 均 await（Task 4，本 commit 未改）。`query_arch frontend/packages/util#standardingestworker` 为本次 `refresh_asset`（Updated `2026-09-19T08:52Z`），摘要仍「javadoc 暂无 / 公开签名暂无」，未写 upsert 必须 await embed。既有 `frontend/core-engine/util#standardingestworker` Updated 仍为 `2026-09-15T09:05Z`。`search_arch` 同时命中两锚点。

### Spec Compliance
- ✅ Spec compliant

相对 plan Task 5、brief（ingest-worker 两处 upsert `await embed`；live `skipIf` 含 `DASHSCOPE_API_KEY`；有向量则 `length !== 48`；仅白名单；无 apiKey；公开方法注释）与 R7/R8/T8：**无 Missing / Extra（白名单外）/ Misunderstood**。

| 检查项 | 结果 | 证据 |
|--------|------|------|
| ingest-worker clause/table upsert 两处 `await ports.embed.embed(...)` | **YES** | HEAD 仅两处 `embed(`，均 `vector: await ports.embed.embed(...)`。BASE 为同步传入 Promise。无私有第三处漏 await |
| `library.ts` ingest/searchSemantic 已 await；本 Task 无改动可不提交 | **YES** | HEAD `library.ts` 四处均 await（reindex / `searchSemantic` / clause upsert / table upsert）。diff 无名该文件 |
| live smoke `hasLiveEnv` / `skipIf` 含 `DASHSCOPE_API_KEY`；无环境 skip，不是回退 Hash | **YES** | `hasLiveEnv` 四键 + `DASHSCOPE_API_KEY`；`describe.skipIf(!hasLiveEnv)`。文件头写明 skip ≠ Hash fallback。`beforeAll` 仍先 `liveRetrievePorts()`（缺 key 会 throw，但 skipIf 拦住） |
| 有 live 且 scroll 到向量 → `length !== 48` | **YES** | `scroll` `with_vector: true`；`numericVector` 要求非空 `number[]`；`expect(point!.vector.length).not.toBe(HASH_EMBED_DIM)` 且 `HASH_EMBED_DIM === 48`。未钉死 1024（spec/brief 要的是 ≠48） |
| CI Hash A12：自然语言 paraphrase 与「1.1」同 `clause_id` | **YES** | `standard-rag.test.ts` 未改；仍有 `A12 two paraphrases hit the same clause_id`。implementer 报 15 passed。ingest-pdf 经 worker upsert 现 await（Hash 同步 `await` 仍绿） |
| 白名单 / 单 commit / 未 push | **YES** | 仅 2 文件：`ingest-worker.ts`、`live-rag-ingest.test.ts`。subject=`feat(retrieve): await ingest-worker embeddings for async DashScope`。parent=`1528f57`。`master` 无 upstream |
| 不改 Vue / DSL / 路由 / chat embed；不写 apiKey | **YES** | diff 无名这些路径。两文件无 `sk-`、无 DashScope 密钥字面量。测试只读 `process.env.DASHSCOPE_API_KEY` / 既有 `QDRANT_API_KEY` |
| 公开 export 注释（为什么） | **YES** | 见 Quality |
| component：不查 test-cases.md | **YES** | 未查 |
| 非页面：跳过数据防御 | **YES** | 未抽检 |

**Missing：** 无。live smoke 本机 skip、未打真实百炼/Qdrant 1024 维，与 spec「有环境才跑，不是 CI 必绿主体」及 report 一致。`library.ts` / `standard-rag.test.ts` / `ingest-pdf.test.ts` 无 diff 符合 brief「仅当仍需改」。未 `register_contract`：公开签名未变，brief 不要求。

**Extra（白名单外）：** 无。commit 只有白名单两文件。工作区 `ingest-worker.ts` 另有 `unpdf` `getDocumentProxy` 计页未提交改动，**未进本 commit**，与 report 披露一致，不计入本 Task。未改 Vue / DSL / embeddings / live-ports / qdrant / library / `.ai/`。

**Misunderstood：** 无。未在无 key 时改跑 Hash；skip 是 vitest skipIf，不是 `?? new HashEmbeddings()`。向量断言是 `!== HASH_EMBED_DIM`（48），不是误把 CI Hash 48 当 live 成功。live 路径仍是既有 JSON `ingestStandard` + Qdrant scroll，不是改 PDF worker 打网。`numericVector` 只认 unnamed `number[]`，与本片 `createCollection({ vectors: { size, distance: "Cosine" } })` 一致。

### Strengths
- 生产漏 await 的最后两处补齐：clause/table upsert 从把 `Promise<number[]>` 当向量，改为 await 后再 upsert；与 Task 4 library 同构，CI Hash `await` 同步返回仍合法。
- live smoke 与「缺 key 显式失败、禁止 Hash 回退」对齐：`DASHSCOPE_API_KEY` 进入 `hasLiveEnv`；文件头写明 skip 不是 Hash fallback；有环境时 `with_vector: true` 验维数，不是只 grep 模型名。
- 切片锁得住：只动 ingest-worker 两行 + live 测试；未改 Vue / DSL / prequery / chat embed；未把 `unpdf` 计页捎进 commit。
- 密钥纪律：夹具无 apiKey 字面量；`HASH_EMBED_DIM` 从 embeddings 导入，避免测试里写死另一个 48。
- 诚实 `DONE_WITH_CONCERNS`：live skip、`refresh_asset` 错挂、工作区无关脏文件、MCP 可能改 `.ai/` 未进 commit，均写入 report。

### Issues
#### Critical (Must Fix)
- 无。

#### Important (Should Fix)
- `refresh_asset` 落到新建 `frontend/packages/util#standardingestworker`（Updated `2026-09-19T08:52Z`），摘要仍是「暂无 Javadoc / 签名待补充」，未写 clause/table upsert 必须 `await embed`（否则 DashScope Promise 会被当成向量）。既有 `frontend/core-engine/util#standardingestworker` Updated 仍为 `2026-09-15`。`query_contract` 源码路径正确，但当前 MCP `tsContent` 读的是含 unpdf 的工作区，不是 HEAD。批次禁止 `audit_arch_changes` / 手工改 `.ai/`；留给 PB-5 `finish_feature` closeout，**不阻断本 Task 源码验收**（与 F2-1–F2-4 同口径，非 Critical）。

#### Minor (Nice to Have)
- 两处私有 upsert 未加「为什么必须 await」行内注释（未 await 时 ingest 看似成功、Qdrant 实为非向量）。公开 `startPdf` / `tick` 的既有为什么仍在；抽检不因私有 helper 缺新 JSDoc 判 Fail。
- live scroll 取前 32 个带 `file_name`+数值向量的点，不绑定本次 leave fixture 的 point id。混库若先扫到残留 Hash 48 维会失败——这正是 smoke 要抓的，不是缺口。
- `numericVector` 不拆 named-vector map / `Float32Array`；本片 collection 是 unnamed Cosine `number[]`，T8 不要求。
- 断言是 `!== 48` 而非 `=== 1024`；与 spec live smoke 原文一致。R9 的 1024 钉在 Task 2 mock。
- 单测只锁 live 环境存在时的维数负例（不是 48）；本机无四键+key，审查方亦未重跑。

### Quality
**公开方法注释抽检：PASS（Approved）**

本片无新公开 API。既有公开面的为什么仍在（HEAD，不含工作区 unpdf）：

- 文件头 / `StandardIngestWorker`：为何 `startPdf` 只登记 pending、tick 一页，避免 202 藏整本 OCR。
- `startPdf`：为何 start 不做 OCR（2 页 `index_error` 夹具不能看起来像一次 ingest）。
- `tick`：为何 OCR 与 vector/graph 分 `ocr_error` / `index_error`（后页不能抹掉前页 ok）。

行为变更在私有 `upsertClauseLayout` / `upsertTableLayout`：`vector` 现为 `await embed` 的 `number[]`。两函数有明确 `Promise<LayoutUnitRow>` 返回类型；体量远小于 80 行。

测试验的是 skipIf 条件、scroll `with_vector: true`、`length !== HASH_EMBED_DIM`，不是只 grep `await`。错误处理：无空 catch；无 Hash 回退；缺 live 环境 skip。

**白名单 / 密钥：** commit 仅两文件。未含 `.ai/`、`.env`、token、`sk-`、真实 DashScope/Qdrant URL。未 push。未改 Vue / DSL / library / embeddings / live-ports。

**APT Micro-closeout vs diff：** `ContractsRegistered` 无（签名未变，与 brief 一致）。`AssetsRefreshed` 的 `sourcePath` 是白名单 `ingest-worker.ts`，索引落到 `frontend/packages/util` 且摘要偏空（见 Important）。`AssetsRemoved` 无。diff 未改 `.ai/`（MCP 侧效应未进本 commit，与 report 一致）。

### Assessment
**Task quality:** Approved
**Reasoning:** ingest-worker 条款/表 upsert 均 `await embed`，async DashScope 不会把 Promise 当向量写入。live smoke 在无 `DASHSCOPE_API_KEY` 时 skip（与无 Qdrant 同类），有环境且 scroll 到数值向量时断言 `length !== 48`。CI Hash A12 路径未改且 implementer 报仍绿。提交未越白名单、未写入 apiKey。`refresh_asset` 错挂路径与空摘要属知识库债，不构成本片 Critical 源码必修项。
