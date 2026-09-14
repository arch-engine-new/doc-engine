# 操作员法规语料入库与样例资料行为测试 Implementation Plan

> **Spec:** `docs/superpowers/specs/2026-09-14-operator-corpus-kb-test-design.md`
> **Command:** `/plan-from-spec`
> **Status:** draft
> **projectType:** component（跳过 v0 freeze 与 UI 设计 Task）

**Goal:** 用操作员自带的 `rules/` 法规摘录切条入库，并用 `examples/` 真实 PDF 跑通上传抽字与检索挂条，证明空引擎能消化语料，而不是预置公路包。

**Architecture:** 法规走 `JobPipeline.ingestStandard(text)` + `splitClauses`；资料走 `openUploadJob` 的 PDF 文字层。测试只用内存检索端口。全书扫描件 OCR 为 opt-in，不进默认 CI。不新增 HTTP、不改 seed、不加第 10 页。

---

## Part 1 — 技术方案（APT 寻址）

### 1.1 范围与约束

- 范围内：corpus 夹具、Vitest 行为测试、可选 OCR 脚本。
- 非目标：行业对错、新页面、新对外契约、默认 CI 打 live Qdrant/Neo4j/百度 OCR、把 90MB 扫描件当 Job 上传成功。
- 规范包名不得含「公路|水利|房建」（`updateSpecPack` 会拒；测试一律用 `operator-corpus-v1`）。
- `openUploadJob` 对扫描 PDF：先 `insertJob`，抽字失败则 `status=failed` 并 throw（不是「不插行」）。>4MB 则 `UploadValidationError` 且不插 Job。R4 两条都要覆盖。

### 1.2 设计寻址（无 UI 则写 N/A）

本 spec 明确不改 9 页 Vue。`query_design(standard_lib/job_upload)` 仅作口径核对：标准库「用户自己的 PDF」、上传页 Job 状态机。UI Task = N/A。

| 项 | MCP 结果 | 约束摘要 |
|----|----------|----------|
| global | `query_design(scope=global)` | 默认数据不得预置公路/水利/房建规范包 |
| standard_lib | `query_design(page=standard_lib)` | 按条款切分；本 plan 不补 `no-implementation-ref` UI |
| job_upload | `query_design(page=job_upload)` | 上传 PDF → Job；测试走 pipeline 不改页 |

### 1.3 依赖寻址表

| 依赖 | 来源 | 引用 | 摘要 |
|------|------|------|------|
| StandardLibrary / ingest / search / attachHit | contract | `packages/core-engine/src/retrieve/library.ts` | `ingest({packId,title,fileUri,text})` → clauses；search 只挂库内 clause_id |
| JobPipeline.openStandardLibrary / ingestStandard / openUploadJob / createSpecPack / listJobs / getClause | contract | `packages/core-engine/src/pipeline/job-pipeline.ts` | 测试装配入口；PDF 文字层 vendor=`pdf-text` |
| MAX_UPLOAD_BYTES / validateUploadInput | arch | `frontend/core-engine/utils` → `job-pipeline.ts` | 4MB；超限 `UploadValidationError` 且不插 Job |
| UploadValidationError | arch | `search_arch` → `job-pipeline.ts` | 上传校验错误类 |
| splitClauses / SplitClause | arch | `packages/core-engine/src/retrieve/split.ts` | 行首 `第N条` / `N.N`，非 token 窗 |
| FakePrequery | contract | `packages/core-engine/src/retrieve/prequery.ts` | 测试确定性 intent/clauseNo 映射 |
| OcrPort | contract | `packages/core-engine/src/ocr/port.ts` | opt-in OCR；默认测试 PDF 路径不走 vendor |
| FakeOcr | arch | `packages/core-engine/src/ocr/fake.ts` | `openUploadJob` 依赖注入；PDF 成功路径不使用其文本 |
| MemoryBlobStore | arch | `packages/core-engine/src/blob/memory.ts` | 上传测试不依赖 MinIO |
| MemoryVectorStore / MemoryGraphStore / HashEmbeddings / IndependentReranker | contract 随 StandardLibrary | `library.ts` `defaultRetrievePorts` | 默认 CI 内存端口 |

未 `report_missing`。`query_contract(UploadValidationError|splitClauses|MemoryBlobStore|FakeOcr)` 未登记为独立契约，已由 `search_arch` + `query_arch(frontend/core-engine/utils)` 命中源文件。

### 1.4 拟改动模块与文件

| 文件/模块 | 变更类型 | 说明 |
|-----------|----------|------|
| `packages/core-engine/test/fixtures/corpus/jtg-f80-pile-excerpt.txt` | new | 点号条款摘录（≥3 条，含灌注桩相关 heading） |
| `packages/core-engine/test/fixtures/corpus/manifest.json` | new | 6 个 example 文件名 + 标签 |
| `packages/core-engine/test/fixtures/corpus/.gitignore` | new | 忽略 `.cache/` |
| `packages/core-engine/test/operator-corpus.test.ts` | new | R1–R5 行为测试 |
| `scripts/ocr-operator-standard.mjs` | new（可选 Task） | R6/R7 opt-in |
| `packages/core-engine/src/pipeline/seed.ts` | 禁止改 | R5 |

### 1.5 风险与未决项

- 摘录标题若不被 `HEADING_RE` 命中 → 本 plan 允许**仅**扩 `split.ts` + `clause-split.test.ts`（仍计入文件数）。
- 读 `examples/` 用相对仓库根路径（`resolveRepoRoot` 已有 arch 卡）；测试 cwd 可能是 package 目录。
- 不要 `fs.readFile` 90MB 法规 PDF；超限用例用 `Buffer.alloc(MAX_UPLOAD_BYTES+1)`。
- 扫描件失败路径：最小无文字层 PDF 字节或截取法规文件头小缓冲——若头仍被 `extractPdfTextLayer` 误判有字，改用合成空 PDF。

### 1.6 需求锁定对照

| Rn | 优先级 | 覆盖 Task | 备注 |
|----|--------|-----------|------|
| R1 | must | Task 1 + Task 2 | 摘录 + ingest 断言 |
| R2 | must | Task 2 | exact hit + 第999条不发明 |
| R3 | must | Task 3 | 6 份 PDF upload |
| R4 | must | Task 3 | >4MB 不插 Job；无文字层 failed+throw |
| R5 | must | Task 2 | pack 名 `operator-corpus-v1`；不改 seed |
| R6 | nice | Task 4 | 无凭证 skip |
| R7 | nice | Task 4 | 有凭证 cache ≥1 条 |

must 均有 Task 覆盖。

---

## Part 2 — 可执行任务清单

> 实现时由 `/implement-plan` 按 Task 串行派发。不要在本 plan 写 git 步骤。PowerShell 不要用 `&&`。

### Task 1: 写入 corpus 夹具

- [ ] 新增 `jtg-f80-pile-excerpt.txt`：至少 3 条 `N.N` 行首条款，body 短句，其中 ≥1 条 heading/body 含「灌注桩」或同等分项词，便于 FakePrequery 映射。禁止把全书 90MB 拷进 fixtures。
  - **MCP:** `query_arch` path=`frontend/core-engine/utils`（确认 `splitClauses`）
  - **Files:** `packages/core-engine/test/fixtures/corpus/jtg-f80-pile-excerpt.txt`
- [ ] 新增 `manifest.json`：列出 `examples/` 下 6 个 PDF 的 `fileName` 与 `kind`（批复单 / 评定表 / 中间交工）。
  - **Files:** `packages/core-engine/test/fixtures/corpus/manifest.json`
- [ ] 新增 `.gitignore` 忽略 `test/fixtures/corpus/.cache/`。
  - **Files:** `packages/core-engine/test/fixtures/corpus/.gitignore`
  - **Verify:** `splitClauses` 对摘录 `length >= 3`（可在 Task 2 测试中断言）。**Rn:** R1 前置

### Task 2: ingest + 检索行为测试（R1/R2/R5）

- [ ] 用 `JobPipeline.openStandardLibrary` + 内存端口；`createSpecPack({ name: "operator-corpus-v1", version: "1" })`；`ingestStandard` 读摘录。
  - **MCP:** `query_contract` name=`StandardLibrary`；`query_contract` name=`JobPipeline`；`query_contract` name=`FakePrequery`
  - **Files:** `packages/core-engine/test/operator-corpus.test.ts`
- [ ] 断言：`clauses.length >= 3`；每条 `qdrant_point_id === clause_id`；`clause_id` 前缀为 `version_id`；最长 body 与条数关系证明非 512-token 窗（可复用 clause-split 思路或断言条数等于摘录 heading 数）。
  - **Verify:** `npm test -w core-engine -- operator-corpus` 覆盖 R1
- [ ] FakePrequery 映射分项词 → 摘录 `clauseNo`；`searchStandard` exact 1 hit；`getClause` 存在；query「第999条」无 hit / `attachStandardFitFinding` 抛错且 findings 不出现发明 id。
  - **Verify:** 同上，覆盖 R2；pack 名无公路/水利/房建，覆盖 R5
  - **Contracts:** `IngestStandardResult`、`RetrieveHit`

### Task 3: examples 上传与扫描件负例（R3/R4）

- [ ] 按 manifest 读 `examples/*.pdf`（经 `resolveRepoRoot`），`openUploadJob({ mime: "application/pdf", bytes })` + `MemoryBlobStore` + `FakeOcr`。每份：`trace_id` 非空；extraction.ocr_text 长度 ≥ 3 或 audit `ocr_vendor` 为 `pdf-text`。
  - **MCP:** `query_contract` name=`JobPipeline`；`query_arch` path=`frontend/core-engine/utils`（`MemoryBlobStore` / `FakeOcr` / `MAX_UPLOAD_BYTES`）
  - **Files:** `packages/core-engine/test/operator-corpus.test.ts`，`examples/*.pdf`（只读）
  - **Verify:** `npm test -w core-engine -- operator-corpus` 覆盖 R3
- [ ] `bytes.length > MAX_UPLOAD_BYTES` 的假 PDF mime → `UploadValidationError`，`listJobs().length` 不变。
  - **Verify:** 覆盖 R4 尺寸闸门
- [ ] 无文字层 PDF（合成最小 PDF 或确认 `extractPdfTextLayer` 为 null 的字节）→ `openUploadJob` throw；对应 job `status === "failed"`（已插入）。
  - **Verify:** 覆盖 R4 扫描件路径；随后 `npm test -w core-engine` 与 `npx tsc -p packages/core-engine --noEmit` 均 PASS（请假 RAG 测试不得红）

### Task 4: opt-in 法规 OCR 脚本（R6/R7 nice）

- [ ] 新增脚本：若无 OCR 凭证则打印 skip 并以 0 退出；若有则识别 `rules/` 指定页，写出 `.cache/`，headed clause ≥ 1 才算成功。默认 `npm test` 不调用。
  - **MCP:** `query_contract` name=`OcrPort`
  - **Files:** `scripts/ocr-operator-standard.mjs`，`packages/core-engine/test/fixtures/corpus/.gitignore`
  - **Verify:** 无凭证时 `node scripts/ocr-operator-standard.mjs` exit 0。覆盖 R6/R7
