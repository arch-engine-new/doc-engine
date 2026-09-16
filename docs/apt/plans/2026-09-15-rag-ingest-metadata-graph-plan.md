# 工程化 RAG（可信源 + 表/条款图） Implementation Plan

> **Spec:** `docs/superpowers/specs/2026-09-15-rag-ingest-metadata-graph-design.md`
> **Command:** `/plan-from-spec`
> **Status:** approved
> **projectType:** component（声明为 component，跳过 v0 freeze；spec 含 `standard_lib` UI，切片 11 仍做 refine+页面，不得提前改 vue）
> **specRisk:** high（改动 >8 文件；红队 3 轮，material 15 已 [a] 结案，unresolved=0）

**Goal:** 标准入库每条向量与检索命中都能回到文件名+页码+单元；表格作为独立知识单元，图上 1:N 支撑多条款；Finding 只挂库内 `clause_id`。

**Architecture:** 扩展现有 `StandardLibrary` + Qdrant `clauses` collection + Neo4j，不换 embedding。文本 ingest 必写 provenance；PDF 走独立 `ingest-pdf` → tick 每页（文字层 `extractPdfUnicodePages` / 扫描页 `pdf-raster` + `OcrPort.recognizeLayout` 未拍平 markdown）。`searchSemantic` 先 `getLayoutUnit`；table 不进 rerank；符合度优先最高分 tableHit 写 N 条 Finding。

---

## Part 1 — 技术方案（APT 寻址）

### 1.1 范围与约束

范围内：

- Qdrant payload 门禁（`file_name` / `page_*` / `unit_id` / `chunk_kind`）
- `t_clause` 增列 + 新建 `t_layout_unit` / `t_layout_edge` / `t_ingest_run` / `t_ingest_page`
- 自动 `PARENT_OF` / `BELONGS_TO` / caption|cell_ref `SUPPORTS`；禁止自动 proximity
- `recognizeLayout`、按页 PDF、tick worker、跨 project pack 图检索
- 标准库页 PDF/进度/命中列（**refine 之后**）

非目标：真 embedding、BM25、LLM 建议边（R15）、公路 seed、涨 Job 4MB、Temporal、Paddle DELETE、CAD。

用户确认（`continue`）：R15 保持 nice；先 refine 再改 vue；embedding 下一片。

### 1.2 设计寻址

`projectType=component` 本可写 N/A；因 spec 含 UI，记录如下（不因 `no-implementation-ref` 停规划——该 gap 是实现缺失，不是缺 token）。

| 项 | MCP 结果 | 约束摘要 |
|----|----------|----------|
| global | `query_design` scope=global | apt-skyline-clean；`--apt-*`；禁预置公路文案 |
| page `standard_lib` | `query_design` page=standard_lib | route `/packs/:id/standards`；logic 已有 `uploadDoc`；命中仍只要 clause_id+span → **切片 11 refine 必须改 logic** |
| PrimaryButton / DataTable / StatusTag / WorkbenchCard / GhostButton | `query_design` component=* | Vue `button.btn` / native table / `span.tag` / `section.card` |
| blockingGaps | `no-implementation-ref` | 不 `report_design_gap` 停工；切片 11 补实现引用 |

### 1.3 依赖寻址表

| 依赖 | 来源 | 引用 | 摘要 |
|------|------|------|------|
| StandardLibrary | contract | `packages/core-engine/src/retrieve/library.ts` | ingest payload 仅 clause_id；searchSemantic `getClause(item.id)` 会丢表 |
| RetrieveHit / EdgeKind / GraphStore / VectorStore / RerankCandidate | contract | `packages/core-engine/src/retrieve/ports.ts` | clause_id 必为 string；EdgeKind 四类；Graph 只 upsertClause |
| FakePrequery | contract | `packages/core-engine/src/retrieve/prequery.ts` | `EXACT_RE` 会把「表 8.5.1-1」打成 exact |
| IndependentReranker | contract | `packages/core-engine/src/retrieve/rerank.ts` | 只认 `clause_id:string`；禁 chat complete |
| liveRetrievePorts | contract | `packages/core-engine/src/retrieve/live-ports.ts` | Qdrant+Neo4j；仍 HashEmbeddings |
| QdrantVectorStore | arch | `query_arch` `frontend/core-engine/util#qdrantvectorstore` → `qdrant.ts` | `clause_id ?? point.id` 回填 |
| Neo4jGraphStore | arch | `query_arch` `frontend/core-engine/util#neo4jgraphstore` → `neo4j.ts` | MERGE :Clause；EDGE_KINDS 四类 |
| splitClauses | arch | `query_arch` `frontend/core-engine/util#splitclauses` → `split.ts` | 只切条款，无表 |
| MemoryVectorStore / MemoryGraphStore | arch | `memory-vector.ts` / `memory-graph.ts` | 测替身须同步改 |
| OcrPort | contract | `packages/core-engine/src/ocr/port.ts` | 仅 `recognize` |
| PaddleOcr | contract | `packages/core-engine/src/ocr/paddleocr.ts` | `recognize` 内 flatten |
| flattenOcrMarkdown / extractPdfUnicodeText | contract | `packages/core-engine/src/ocr/pdf-text.ts` | `mergePages:true` |
| LedgerStore | contract | `packages/core-engine/src/persistence/ledger.ts` | 无 layout/ingest 方法 |
| runPgMigration | contract | `packages/core-engine/src/persistence/pg-migrate.ts` | 读 generated SQL + ALTER IF NOT EXISTS |
| JobPipeline | contract | `packages/core-engine/src/pipeline/job-pipeline.ts` | `MAX_UPLOAD_BYTES=4MB`；`tryAttachStandardFit` 假定单 Finding |
| DemoHttpAdapter | contract | `packages/core-engine/src/http/handle-request.ts` | 仅 JSON ingest；edges 四类断言 |
| DEMO_DICTS.standard_edge_kind | arch | `packages/core-engine/src/http/dicts.ts` | 无 SUPPORTS/PARENT_OF/BELONGS_TO |

未 `report_missing`。本片新建：`layout-split.ts`、`ingest-worker.ts`、`pdf-raster.ts`、`OcrPort.recognizeLayout`、`GraphStore.upsertNode`、`assertVectorPayload`。

### 1.4 拟改动模块与文件

| 文件/模块 | 变更类型 | 说明 |
|-----------|----------|------|
| `packages/core-engine/src/retrieve/ports.ts` | 改 | RetrieveHit 可空 clause_id；EdgeKind 扩展；GraphStore.upsertNode；queryPath kind 必填于 searchGraph |
| `packages/core-engine/src/ocr/port.ts` | 改 | `recognizeLayout` |
| `packages/core-engine/src/ocr/fake.ts` | 改 | 实现 recognizeLayout（返回含 `\|` 的 markdown 夹具） |
| `packages/core-engine/src/ocr/paddleocr.ts` | 改 | recognizeLayout **不** flatten；recognize 仍 flatten |
| `packages/core-engine/src/ocr/pdf-text.ts` | 改 | `extractPdfUnicodePages`（禁 mergePages:true） |
| `packages/core-engine/src/ocr/pdf-raster.ts` | 新 | `renderPdfPagePng` |
| `packages/core-engine/src/retrieve/layout-split.ts` | 新 | clause/table/annex |
| `packages/core-engine/src/retrieve/payload.ts` | 新 | `assertVectorPayload` |
| `packages/core-engine/src/retrieve/ingest-worker.ts` | 新 | tick 1 页 |
| `packages/core-engine/src/retrieve/library.ts` | 改 | ingest/search/attach |
| `packages/core-engine/src/retrieve/prequery.ts` | 改 | 见表 → semantic |
| `packages/core-engine/src/retrieve/qdrant.ts` | 改 | originalPointId=unit_id |
| `packages/core-engine/src/retrieve/neo4j.ts` | 改 | upsertNode；边两端 label |
| `packages/core-engine/src/retrieve/memory-*.ts` | 改 | 同步端口 |
| `packages/core-engine/src/persistence/sqlite-slice1.sql` / `migrate.ts` / `store.ts` / `ledger.ts` / `pg-store.ts` | 改 | 表+列+方法 |
| `packages/core-engine/src/persistence/pg-migrate.ts` | 改 | `ensureRagLayoutColumns` |
| `docs/schema/core-engine-schema.md` + `docs/schema/generated/core-engine-migration.sql` + `core-engine-rows.ts` | 改 | 契约表 |
| `packages/core-engine/src/http/handle-request.ts` | 改 | ingest-pdf / tick / edges kind |
| `packages/core-engine/src/http/dicts.ts` | 改 | 边类型 |
| `packages/core-engine/src/http/session.ts` | 改 | reset 删 LayoutUnit |
| `packages/core-engine/src/pipeline/job-pipeline.ts` | 改 | attach 数组；Job 4MB **不**放宽 |
| `packages/core-engine/test/*.ts` | 改/新 | M1–M13、A11–A14 |
| `designs/v0/standard_lib/page.logic.md` / `_pages.md` | 改 | **切片 11 经 `$apt-create --refine`** |
| `apps/web/src/views/standard_lib/index.vue` / `services/types.ts` | 改 | **仅 refine 后** |

### 1.4.1 表设计草案（§0.6）

公共审计：`id BIGINT`、`created_at`/`updated_at DATETIME`、`creator`/`updater VARCHAR(64)`、`deleted TINYINT(1)`。无多租户，不加 `tenant_id`。

**ALTER `t_clause`**

| 字段 | 类型 | 说明 |
|------|------|------|
| file_name | VARCHAR(512) | 可空→ingest 后非空 |
| page_start | INTEGER | 1-based |
| page_end | INTEGER | ≥ page_start |
索引：`idx_t_clause_file_page (file_name, page_start)`

**`t_layout_unit`**

| 字段 | 类型 | 说明 |
|------|------|------|
| unit_id | VARCHAR(64) | UK |
| version_id | VARCHAR(64) | |
| chunk_kind | VARCHAR(16) | clause\|table\|annex |
| clause_id | VARCHAR(64) | 可空 |
| file_name | VARCHAR(512) | |
| page_start / page_end | INTEGER | |
| heading | VARCHAR(256) | |
| body_markdown | TEXT | 表须能含 `\|` |
| qdrant_point_id | VARCHAR(64) | = unit_id |
| ingest_run_id | VARCHAR(64) | 可空 |

UK `uk_t_layout_unit_unit_id`；`idx_t_layout_unit_version_id`

**`t_layout_edge`**

| 字段 | 类型 | 说明 |
|------|------|------|
| from_unit_id / to_unit_id | VARCHAR(64) | |
| kind | VARCHAR(32) | PARENT_OF\|BELONGS_TO\|SUPPORTS\|CITES\|… |
| link_method | VARCHAR(16) | caption\|cell_ref\|manual |

`idx_t_layout_edge_from` / `idx_t_layout_edge_to`

**`t_ingest_run`**

| 字段 | 类型 | 说明 |
|------|------|------|
| ingest_run_id | VARCHAR(64) | UK |
| doc_id | VARCHAR(64) | |
| pack_id | VARCHAR(64) | |
| status | VARCHAR(32) | pending\|running\|done\|error |
| file_name | VARCHAR(512) | |

**`t_ingest_page`**

| 字段 | 类型 | 说明 |
|------|------|------|
| ingest_run_id | VARCHAR(64) | |
| doc_id | VARCHAR(64) | |
| page_no | INTEGER | |
| status | VARCHAR(16) | pending\|ok\|ocr_error\|index_error |
| error | VARCHAR(512) | 可空 |

UK `(ingest_run_id, page_no)`

`t_standard_edge` 保留条款–条款手补；自动层级/SUPPORTS 走 `t_layout_edge`。

### 1.5 风险与未决项

- 文件数 >8，high。
- `JobPipeline.tryAttachStandardFit` 今日把单 Finding push 进数组；改返回 `FindingRow[]` 后须 `push(...rows)`，无命中仍吞错、不编造。
- live `rules/` 85MB 不是 CI 门禁；切片 12 `skipIf` 无 Docker。
- armed：切片 11 前改 vue = logic-sync 风险。
- `projectType` 声明 component、实为带 UI 的 business（typeHealth）；不挡本 plan。
- 光栅化库：优先复用已有 `unpdf`/pdfjs；若不能出 PNG，Task 9 失败须换库，不得改回整本 PDF 进 Paddle。

### 1.6 需求锁定对照

| Rn | 优先级 | 覆盖 Task | 备注 |
|----|--------|-----------|------|
| R1 | must | 3, 5 | M1 payload |
| R2 | must | 6, 11 | M2 JSON；M2b UI |
| R3 | must | 5, 8 | table + `\|` |
| R4 | must | 5, 6, 7 | SUPPORTS 1:N |
| R5 | must | 4, 5, 6 | PARENT_OF；A13 kind |
| R6 | must | 7, 10 | attachHit 拒表 id |
| R7 | must | 9, 10 | 不走 Job 4MB |
| R8 | must | 8, 9 | recognizeLayout |
| R9 | must | 9 | M8 两页 tick |
| R10 | must | 5, 12 | 不写公路 seed |
| R11 | must | 5 | 无幽灵 CITES |
| R12 | must | 3 | upsert 缺元数据失败 |
| R16 | must | 6 | search 不丢表 |
| R17 | must | 8 | 不 flatten |
| R18 | must | 5, 6 | 跨 pack 建边 |
| R19 | must | 7 | N 条 Finding |
| R20 | must | 6 | 见表 ≠ exact |
| R21 | must | 3 | 禁回填 clause_id |
| R22 | must | 4, 6 | upsertNode；A13 |
| R23 | must | 5, 6 | M3 不用 proximity |
| R24 | must | 9 | tick + raster |
| R25 | must | 11 | refine 门禁 |
| R26 | must | 5 | 禁自动 proximity |
| R27 | must | 6, 7 | M13 全链 |
| R28 | must | 2, 9 | index_error |
| R29 | must | 6 | searchGraph 跨 pack |
| R13–R15 | nice | — | 本片不做 |

must 无静默丢弃。

---

## Part 2 — 可执行任务清单

> 实现时 `/implement-plan` 按 Task 串行子 Agent。不要在 plan 里写 git 提交步。

### Task 1: 扩展检索/OCR 端口类型

- [ ] `query_contract` name=`RetrieveHit`、`EdgeKind`、`GraphStore`、`OcrPort` 后改 `ports.ts` / `ocr/port.ts`：RetrieveHit 增加 `unit_id`、`chunk_kind`、`file_name`、`page_start`、`page_end`、`supported_clause_ids?`，表命中 `clause_id: string | null`；EdgeKind 增加 `PARENT_OF` `BELONGS_TO` `SUPPORTS`；`GraphStore.upsertNode(label, id, props)`；`OcrPort.recognizeLayout` 返回未拍平 markdown（可复用 `OcrRecognizeResult`，约定 `text` 含 `\|`）。
  - **MCP:** `query_contract` name=`RetrieveHit`；`query_contract` name=`OcrPort`
  - **Files:** `packages/core-engine/src/retrieve/ports.ts`, `packages/core-engine/src/ocr/port.ts`
- [ ] FakeOcr 同时实现 `recognize`（可 flatten）与 `recognizeLayout`（保留表）。
  - **Files:** `packages/core-engine/src/ocr/fake.ts`
  - **Verify:** `npx vitest run packages/core-engine/test/paddleocr.test.ts` 仍绿（Job 路径未改）
  - **Contracts:** `RetrieveHit`、`OcrPort`

### Task 2: 建表 / 增列 / Ledger 方法

- [ ] 按 Part 1.4.1 写 SQLite DDL + PG generated SQL + `core-engine-rows.ts`；`LEDGER_TABLES` 纳入新表；`pg-migrate` 增加 `ensureRagLayoutColumns`（`t_clause` 三列 IF NOT EXISTS）。
  - **MCP:** `query_contract` name=`LedgerStore`；`query_contract` name=`runPgMigration`
  - **Files:** `packages/core-engine/src/persistence/sqlite-slice1.sql`, `packages/core-engine/src/persistence/migrate.ts`, `packages/core-engine/src/persistence/pg-migrate.ts`, `docs/schema/core-engine-schema.md`, `docs/schema/generated/core-engine-migration.sql`, `docs/schema/generated/core-engine-rows.ts`
- [ ] `CoreEngineStore` / `SqliteLedger` / `PostgresLedger`：`insertLayoutUnit` `getLayoutUnit` `listLayoutUnits` `insertLayoutEdge` `insertIngestRun` `listIngestPages` `updateIngestPage`；`insertClause` 接受 file_name/page_*。
  - **Files:** `packages/core-engine/src/persistence/store.ts`, `packages/core-engine/src/persistence/ledger.ts`, `packages/core-engine/src/persistence/pg-store.ts`
  - **Verify:** 内存 SQLite migrate 后 `PRAGMA table_info(t_layout_unit)` 含 `unit_id`；`t_ingest_page` 含 `index_error` 合法写入（R28）
  - **Contracts:** `LedgerStore`

### Task 3: 向量 payload 闸门（R1/R12/R21）

- [ ] 新增 `assertVectorPayload`：缺 `file_name` / 非法页 / 缺 `unit_id` / `chunk_kind` 非法则抛；`table`/`annex` 若出现非空 `clause_id` 则抛。
  - **MCP:** `query_arch` path=`frontend/core-engine/util#qdrantvectorstore`
  - **Files:** `packages/core-engine/src/retrieve/payload.ts`, `packages/core-engine/src/retrieve/qdrant.ts`, `packages/core-engine/src/retrieve/memory-vector.ts`
- [ ] `originalPointId` **只认** `payload.unit_id`；upsert 把 `id` 哈希，payload 写入 `unit_id`，table 点不写 clause_id。
  - **Verify:** 单测 upsert 缺页码失败；table 点读回 id=unit_id 且 payload 无回填 clause_id（M1/R12/R21）
  - **Contracts:** `VectorPoint`

### Task 4: 图端口与字典（R5/R22）

- [ ] `Neo4jGraphStore` + `MemoryGraphStore`：`upsertNode`；`upsertEdge` 按 from/to label MERGE，禁止把 LayoutUnit 建成 `:Clause`；`queryPath(from, kind)` — `searchGraph` 必须传 kind。
  - **MCP:** `query_arch` path=`frontend/core-engine/util#neo4jgraphstore`
  - **Files:** `packages/core-engine/src/retrieve/neo4j.ts`, `packages/core-engine/src/retrieve/memory-graph.ts`, `packages/core-engine/src/http/dicts.ts`, `packages/core-engine/src/http/session.ts`
- [ ] dict `standard_edge_kind` 增加 SUPPORTS/PARENT_OF/BELONGS_TO；demo reset `DETACH DELETE` `:LayoutUnit`。
  - **Verify:** 单测 PARENT_OF 两端为 Clause；A13 夹具 `queryPath(kind=SUPERSEDES)` 不被 PARENT_OF 末跳替换（M5/R22）
  - **Contracts:** `GraphStore`、`EdgeKind`

### Task 5: 版式切分 + 文本 ingest + 自动边（R3/R4/R10/R11/R23/R26）

- [ ] `splitLayoutUnits`：条款复用 `splitClauses`；GFM/VL 表块 → table；禁止调用 `flattenOcrMarkdown`。
  - **MCP:** `query_arch` path=`frontend/core-engine/util#splitclauses`
  - **Files:** `packages/core-engine/src/retrieve/layout-split.ts`, `packages/core-engine/src/retrieve/split.ts`, `packages/core-engine/src/retrieve/library.ts`
- [ ] `ingest`：file_name=URI basename，默认页 1；写 t_clause 列 + layout unit + Qdrant 闸门 payload；自动 PARENT_OF / BELONGS_TO；caption/cell_ref SUPPORTS；0 命中 → `tables_unlinked` **不** proximity；未入库条款号 0 CITES；不写公路 seed。
  - **Verify:** 请假 GFM 表单元格 1.1 与 2.1 → 1 table + 2 SUPPORTS；正文「第99.9条」无该条则 0 CITES（R3/R4/R11/R26）；`npx vitest run packages/core-engine/test/standard-rag.test.ts` 既有 A11 仍绿
  - **Contracts:** `StandardLibrary`

### Task 6: 预查询 + 检索不丢表 + 跨 pack 图（R2/R16/R20/R29）

- [ ] `inferIntent`：匹配 `表`/`附表`/`见表` → semantic，不得 exact。
  - **MCP:** `query_contract` name=`FakePrequery`
  - **Files:** `packages/core-engine/src/retrieve/prequery.ts`, `packages/core-engine/src/retrieve/library.ts`
- [ ] `searchSemantic`：`getLayoutUnit(payload.unit_id)`；tableHits 不 rerank；clauseHits 才进 IndependentReranker；返回混合 hits（表在前按向量分）。`searchGraph` 用 `resolveProjectEffectiveVersionIds`。`toHit` 填 provenance；表 `clause_id=null`。
  - **Verify:** `searchStandard("见表")` 返回 chunk_kind=table 且 supported_clause_ids≥2（M3/R16，禁只查 Neo4j）；`"表 8.5.1-1"` intent≠exact（M12/R20）；packA graph 命中 packB（M12/R29）；JSON 含 file_name+页+unit_id（M2）
  - **Contracts:** `RetrieveHit`、`IndependentReranker`

### Task 7: 符合度 N 条 Finding（R6/R19/R27）

- [ ] `attachHit`：table unit_id 当 clause_id 必抛。`attachStandardFitFinding` → `FindingRow[]`：有 tableHits 则最高分表展开 ≤20 条，detail.source 同源表；否则 clauseHits[0]。
  - **MCP:** `query_contract` name=`StandardLibrary`
  - **Files:** `packages/core-engine/src/retrieve/library.ts`, `packages/core-engine/src/pipeline/job-pipeline.ts`
- [ ] `tryAttachStandardFit` 改为 `push(...rows)`；无命中仍 catch、不编造。
  - **Verify:** M4 拒表 id；M13 ingest VL 表后对表题调用 attach，length≥2 且 clause_id 互异且 ∈ t_clause（禁止合成 tableHit）（R6/R19/R27）
  - **Contracts:** `FindingRow`

### Task 8: recognizeLayout 与按页文字层（R8/R17）

- [ ] `PaddleOcr.recognizeLayout`：复用提交/轮询/jsonl，**跳过** `flattenOcrMarkdown`；`recognize` 行为不变。
  - **MCP:** `query_contract` name=`PaddleOcr`
  - **Files:** `packages/core-engine/src/ocr/paddleocr.ts`, `packages/core-engine/src/ocr/pdf-text.ts`, `packages/core-engine/test/paddleocr.test.ts`
- [ ] `extractPdfUnicodePages`：`mergePages:false`（或逐页 API）；标准入库禁止 `mergePages:true`。
  - **Verify:** paddleocr 单测：recognizeLayout 文本含 `\|`；recognize 不含表竖线（M7/R17）；Job 回归仍 flatten
  - **Contracts:** `PaddleOcr`、`flattenOcrMarkdown`

### Task 9: 光栅化 + ingest-worker + HTTP（R7/R9/R24/R28）

- [ ] `renderPdfPagePng(bytes, pageNo)`；tick 无文字层只把 **单页 PNG** 交给 `recognizeLayout`，禁止全书 PDF bytes。
  - **MCP:** `query_contract` name=`DemoHttpAdapter`
  - **Files:** `packages/core-engine/src/ocr/pdf-raster.ts`, `packages/core-engine/src/retrieve/ingest-worker.ts`, `packages/core-engine/src/http/handle-request.ts`, `packages/core-engine/src/pipeline/job-pipeline.ts`
- [ ] `POST /api/standards/ingest-pdf` → 202 + ingest_run_id（只登记页）；`POST /api/standards/ingest-runs/:id/tick` 最多 1 页；向量失败 → `index_error` 不得记 ocr_error/ok。
  - **Verify:** ≥2 页夹具，第 2 页注入失败，第 1 页向量仍在（M8/R9）；OCR 入参不是原 PDF（M11/R24）；Job 仍拒超 4MB（M6/M10/R7）；index_error 枚举（R28）
  - **Contracts:** `JobPipeline`、`DemoHttpAdapter`

### Task 10: A11–A16 与 Job 回归

- [ ] 跑既有 `standard-rag` / upload-ocr / agent-connect 检索相关测；确认 Finding.clause_id ∈ t_clause；对话仍不能发明条款号。
  - **MCP:** `query_contract` name=`JobPipeline`
  - **Files:** `packages/core-engine/test/standard-rag.test.ts`, `packages/core-engine/test/upload-ocr.test.ts`
  - **Verify:** `npx vitest run packages/core-engine/test/standard-rag.test.ts packages/core-engine/test/upload-ocr.test.ts`（R6/R10 回归）
  - **Contracts:** `StandardLibrary`

### Task 11: refine 标准库页 + UI（R2/R25）

- [ ] **先** `$apt-create --refine`：`page.logic.md` 增加文件名/页/`chunk_kind`/tableHits/`tables_unlinked`/ingest tick 状态；`_pages.md` 该页 `approved=no`。此前 **禁止** 改 `index.vue`。
  - **MCP:** `query_design` page=`standard_lib`；`query_design` scope=`global`
  - **Files:** `designs/v0/standard_lib/page.logic.md`, `designs/v0/_pages.md`
- [ ] refine 后再改 `index.vue` / `RetrieveHitView`：PDF 选择、tick 进度 StatusTag、命中列 file_name+页+unit_id（表 clause_id 显示为 —）。组件：PrimaryButton/DataTable/StatusTag/WorkbenchCard；颜色只用 `--apt-*`。
  - **Files:** `apps/web/src/views/standard_lib/index.vue`, `apps/web/src/services/types.ts`
  - **Verify:** logic 含 uploadDoc+页码列；vue 含 file input 与页列（M2b/R2/R25）；无公路预置文案（R10）
  - **Contracts:** `RetrieveHit`

### Task 12: Docker live 冒烟（非 CI 强制）

- [ ] `describe.skipIf(!process.env.DATABASE_URL)`：tick `rules/` 前 N 页（默认 5 或直到第一张表）；抽查 Qdrant payload 非空 file_name；不把公路写入 seed。
  - **MCP:** `query_contract` name=`liveRetrievePorts`
  - **Files:** `packages/core-engine/test/live-triple-store.test.ts`（或新 `live-rag-ingest.test.ts`）
  - **Verify:** live 环境下任一点 `file_name` 非空（R1/R10）；无 Docker 则 skip
  - **Contracts:** `liveRetrievePorts`
