# Task F2-1 Review — Embeddings 签名 async 兼容 + CI Hash 仍 48

review-tier: full
projectType: component（跳过 B2 `designs/v0/*/test-cases.md` 门禁；非页面 Task，跳过数据防御抽检）
Plan: `docs/apt/plans/2026-09-19-dashscope-text-embedding-v3-plan.md` Task 1
Spec: `docs/superpowers/specs/2026-09-19-dashscope-text-embedding-v3-design.md`（Rn：R7；T1）
Brief: `.apt/orchestration/task-f2-1-brief.md` / `.apt/orchestration/task-f2-1-review-brief.md`
Report: `.apt/orchestration/task-f2-1-report.md`
HEAD: `bcce1e2e22155568467b02551731c58bce848e01`
Parent / BASE_SHA: `fa80d3221c23858bf79a55c77f948d54d8a60f4c`
Status (implementer): `DONE_WITH_CONCERNS`
Verify（implementer 已报；审查方未重跑）：TDD RED `Tests 1 failed | 2 passed (3)`（`expected 'wrong' to be 'right'`）→ GREEN `Test Files 3 passed (3)` / `Tests 22 passed (22)`

审查范围：只审 `git diff fa80d32..bcce1e2`。工作区其它未提交文件（含 report）不计入本 Task。审查方只读：未改代码、未 commit、未重跑 vitest。gstack review 不可用（本机无 gstack bin / Unix skill 预热），已跳过。

MCP（审查方只读复查）：`query_contract Embeddings` 已为 `embed(text: string): number[] | Promise<number[]>`，`tsFilePath=packages/core-engine/src/retrieve/ports.ts`。`query_contract HashEmbeddings` 仍指向 `embeddings.ts`（CI 48 维 n-gram，同步 `number[]`）。`query_arch frontend/packages/util#ports` / `#rerank` / `#embeddings` 为本次 `refresh_asset`（Updated `2026-09-19T07:46–07:47Z`，摘要「暂无」导出）；既有 `frontend/core-engine/util#HashEmbeddings` Updated 仍为 `2026-09-14`。

### Spec Compliance
- ✅ Spec compliant

相对 plan Task 1、brief（签名放宽；Hash 48；rerank `await`；不实现 DashScope / 不改 live-ports / Qdrant / Vue）与 R7/T1：**无 Missing / Extra（白名单外）/ Misunderstood**。

| 检查项 | 结果 | 证据 |
|--------|------|------|
| `Embeddings.embed` → `number[] \| Promise<number[]>` | **YES** | `ports.ts` 签名 +「Callers must always await」注释。MCP 契约已更新 |
| `HashEmbeddings` / `FixtureEmbeddings` 仍可同步返回 | **YES** | `embed(text: string): number[]`；默认 `HASH_EMBED_DIM = 48` |
| CI Hash 48：`await new HashEmbeddings().embed("x")` 长度 48 | **YES** | `rerank.test.ts` 断言 `toHaveLength(48)` |
| `IndependentReranker.rerank` 对 embed `await` | **YES** | query / 无 `candidate.vector` 时 `await this.embed.embed(...)`；已有 vector 则复用 |
| TDD：embed 为 Promise 时 rerank 仍按向量排序 | **YES** | 用例 `reranks when embed returns a Promise`：async mock 把 `yyyy` 对齐 `alpha`，期望 `right` 先于 `wrong`。RED 即 cosine 吃到 Promise 退回输入序 |
| 测试里向量使用处 `await` | **YES** | `ingest-pdf.test.ts` 两处 `vector.search(await ports.embed.embed(...))`。`standard-rag.test.ts` / `agent-native-graph.test.ts` / `standard-lib-stepchat.test.ts` 无 `embed()` 当 `number[]` 使用处，未改（与 report 一致） |
| 不实现 DashScope / 不改 live-ports / Qdrant / Vue / apiKey | **YES** | HEAD 与 BASE 上 `live-ports.ts` / `qdrant.ts` blob 相同。diff 无 `DashScope`、无 `apiKey`、无 Vue |
| 白名单 / 单 commit / 未 push | **YES** | 5 文件均在白名单：`ports.ts`（M）、`embeddings.ts`（A）、`rerank.ts`（A）、`rerank.test.ts`（A）、`ingest-pdf.test.ts`（M）。subject=`feat(retrieve): allow Embeddings.embed to return a Promise` |
| `register_contract Embeddings` | **YES** | report + MCP 签名演进一致 |
| 公开 export 注释（为什么） | **YES** | 见下方 Quality |
| component：不查 test-cases.md | **YES** | 未查 |
| 非页面：跳过数据防御 | **YES** | 未抽检 |

**Missing：** 无。`library.ts` / `ingest-worker.ts` 生产调用点仍同步调 `embed`（`searchSemantic` 把 union 传给期望 `number[]` 的 `semanticHitsForVersion`）属 plan Task 5，brief 未列入本片白名单；report 已披露。

**Extra（白名单外）：** 无。BASE tree 不含 `embeddings.ts` / `rerank.ts` / `rerank.test.ts`（`index.ts` 却已 re-export），本 commit 以 create 纳入既有 Hash/rerank 实现 + 本片 await/注释，不是 DashScope 提前做。未改 `goal.md` / playbook / 其它页。

**Misunderstood：** 无。未把 live 换 v3、未改 collection 维度、未改检索路由；Hash 仍默认同步 48 维。

### Strengths
- 切片锁得住：只放宽端口签名 + rerank/测试 await，Hash 保持同步 48，后续 HTTP embed 有落点。
- TDD 同构：RED 失败就是 Promise 向量被当成同步 `number[]` 时排序塌成输入序；GREEN 后同一断言验的是重排结果，不是类型形状。
- `await` 注释写在不变量上：HTTP 不能同 tick 返回、CI 不打网、cosine 必须两侧都是 `number[]`。
- 诚实 `DONE_WITH_CONCERNS`：BASE 缺文件、`refresh_asset` 错挂 `frontend/packages/util`、生产 await 留给 Task 5 均写入 report；未手工改 `.ai/`（brief 禁止 `audit_arch_changes`）。

### Issues
#### Critical (Must Fix)
- 无。

#### Important (Should Fix)
- `refresh_asset` 落到 `frontend/packages/util#ports` / `#rerank` / `#embeddings`（`query_arch` 可见，摘要仍是「暂无」导出/签名，未写 async union 或 48 维），未覆盖既有 `frontend/core-engine/util#HashEmbeddings`（Updated 仍为 2026-09-14）。`register_contract Embeddings` 源码路径正确。批次禁止 `audit_arch_changes` / 手工改 `.ai/`；留给 PB-5 `finish_feature` closeout，**不阻断本 Task 源码验收**（与 F-1 同口径，非 Critical）。

#### Minor (Nice to Have)
- `HASH_EMBED_DIM` 常量本身无独立「为什么是 48」注释；`HashEmbeddings.embed` 已说明 CI 固定 48 维空间。`IndependentReranker` 类无独立 JSDoc，文件头「Must never call LlmProvider」覆盖了主要不变量。
- `HashEmbeddings` 构造仍允许覆盖 `dim`；本片只保证默认 48。与既有 CI 默认端口一致。
- `library.ts` / `ingest-worker.ts` 在类型上已不满足 `vector: number[]`（embed 现为 union）。运行时仍走 Hash 故本片 22 测可绿；Task 5 必须 `await`，否则 live async embed 会把 Promise 当向量 upsert/search。非本片白名单。

### Quality
**公开方法注释抽检：PASS（Approved）**

本片新增或签名变更的公开方法：

- `Embeddings.embed`：为何允许 Promise（live HTTP 不能同 tick）以及 Hash/Fixture 为何仍同步（CI 不打网）；调用方必须 await。
- `HashEmbeddings.embed`：为何固定 48 维且保持 sync（`await` 在测试里是 no-op）。
- `FixtureEmbeddings.embed`：为何用精确字符串钉向量（不换整个 embedder、不改 `HASH_EMBED_DIM`）。
- `IndependentReranker.rerank`：为何必须 await（cosine 在两侧都是 `number[]` 之前无定义）。

均有明确 return type；函数体远小于 80 行。`cosine` / `lexicalScore` / `tokenize` 未 export。

测试验的是行为：Hash 默认长度 48；async embed 时 `right` 排到 `wrong` 前面；`LlmProvider.complete` 未被调用。错误处理：embed 拒绝会沿 Promise 冒泡，无空 catch、无 Hash 回退。

**白名单 / 密钥：** commit 仅五文件。未含 `.ai/`、`.env`、token、`apiKey`。未 push。

**APT Micro-closeout vs diff：** `ContractsRegistered=Embeddings` 与 MCP/源码一致。`AssetsRefreshed` 三个 `sourcePath` 与白名单源文件一致，但索引落到 `frontend/packages/util/*`（见 Important）。`AssetsRemoved` 无。diff 未改 `.ai/`。

### Assessment
**Task quality:** Approved
**Reasoning:** 契约已放宽为可 await、Hash 默认仍 48、rerank 用真实 Promise 向量验排序，且未越界做 DashScope/live/Qdrant。`refresh_asset` 错挂路径与生产调用点 await 分属 closeout / Task 5，不构成本片 Critical/Important 必修项。
