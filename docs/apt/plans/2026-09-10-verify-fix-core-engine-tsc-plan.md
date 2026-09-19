# verify-fix: core-engine-tsc

> **Source verify:** `.apt/verify/latest.md`
> **Source plan:** `docs/apt/plans/2026-09-09-agent-native-graph-search-clause-plan.md`
> **Overall:** FAIL
> **Status:** approved
> **ApprovedAt:** 2026-09-10T01:06:00.000Z
> **ApprovedBy:** user
> **Command:** `$apt-plan-from-verify`
> **implementation dims:** Plan 对照、测试/构建、外部 Harness

## Part 1 — 背景与范围

### 分流

- `classify-verify-failures` → `recommended=plan-from-verify`
- `implementation`: Plan 对照、测试/构建、外部 Harness（`harnessMissed=true`）
- **closeout 项（架构 audit / 契约登记）不在本 plan**；上一轮 native-graph 已 refresh / register
- **F2 合并说明（不单开 Task）：** Failures 中的 logic 同步是 **BLOCKED**（仓库无 `scripts/check-logic-sync.cjs`），classify **未**把它列入 implementation FAIL。本 plan 不补 APT 模板脚本、不手改 `page.logic.md`。复测该维等 APT 脚本到位后再 `/verify`。

### Failures 摘要（实现类）

| ID | 维度 | 问题 | 根因 |
|----|------|------|------|
| F1 | Plan 对照 + 测试/构建 | `npx tsc -p packages/core-engine --noEmit` exit 2 | 5 个既有文件类型不匹配（见下）；**不是** native graph / `search_clause` 回滚 |
| harnessMissed | 外部 Harness | classify 因 sourceDoc/goal 含「OpenAPI」且报告 `## Harness` 为空跑 SKIP | C4 草稿 + `adapter-mock.test.ts` 已存在，但 `/verify` §5.6 未当套件执行 |

F1 五处 tsc 错误：

1. `excel/fill-service.ts`：`workbook.xlsx.load(Buffer)` — Node `Buffer<ArrayBufferLike>` 对不上 exceljs 的 `Buffer`
2. `http/handle-request.ts`：`fillRulesFromBody` 的 `min_num` / `max_num` 为 `{} \| null`，对不上 `FieldFillRuleWrite` 的 `string \| null`
3. `http/session.ts`：`LedgerStore` 不能赋给 `ConcreteExcelSeedStore`（`listDocTypesByPack` 等为 `Promise` vs 同步数组）
4. `persistence/pg-store.ts`：同上（`PostgresLedger` → `seedConcreteInspectionBatchExcelDemo`）
5. `pipeline/seed.ts`：`BlobStore` 断言成 `{ bucket: string }` 不重叠

### 非目标

- 不回滚 `step-chat-v1` / `search_clause` / `shouldSearchClause`
- 不换扣子 / LangGraph / Temporal
- 不改 Excel 出表业务语义、不改 C4 无回执不得写入
- 不把仅 closeout 项塞进本 plan
- 本文件只规划，不写生产代码

### 依赖寻址

| 依赖 | 来源 | 路径 |
|------|------|------|
| `ExcelFillService` | contract | `packages/core-engine/src/excel/fill-service.ts` |
| `FieldFillRuleWrite` | contract（`CoreEngineStore`） | `packages/core-engine/src/persistence/store.ts` |
| `LedgerStore` | contract | `packages/core-engine/src/persistence/ledger.ts`（`listDocTypesByPack` → `Promise<DocTypeRow[]>`） |
| `BlobStore` | contract | `packages/core-engine/src/blob/port.ts`（无 `bucket` 字段） |
| `DocumentPipeline` | contract | `packages/core-engine/src/pipeline/document-pipeline.ts`（已有 `blobBucketName` 鸭类型） |
| `seedConcreteInspectionBatchLedger` / `seedConcreteInspectionBatchExcelDemo` | arch | `packages/core-engine/src/pipeline/seed.ts`（内部类型 `ConcreteExcelSeedStore` 未单独登记契约） |
| `uploadDocument` / `mockPendingMount` / `commitAdapterWrite` | contract | `packages/core-engine/src/adapter/mock.ts` |
| C4 OpenAPI 草稿 | 仓库 | `docs/schema/generated/adapter-openapi.yaml` |
| 已有 OpenAPI 探针测试 | 测试 | `packages/core-engine/test/adapter-mock.test.ts` |
| `MemoryBlobStore` | arch（契约未登记，search_arch 命中） | `packages/core-engine/src/blob/memory.ts` |

`VerifyResult` 未登记契约；Overall 语义以 classify 脚本为准（`PASS` \| `FAIL` \| `BLOCKED`），不阻塞本修复。

---

## Part 2 — Tasks

### Task 1: 修复 core-engine tsc（F1）

五个文件同一 Failure，合并为一 Task。

- [ ] `packages/core-engine/src/excel/fill-service.ts`：`load` 不要把 `Buffer<ArrayBufferLike>` 直接交给 exceljs。优先 `Uint8Array` / `ArrayBuffer`（或 `Buffer.from(...)` 后再按 exceljs 声明的输入）。`ExcelFillTemplate` 可扩成 `string | Buffer | Uint8Array`。返回值保持 `Buffer`（`Buffer.from(out)`）。
  - **Files:** `packages/core-engine/src/excel/fill-service.ts`
  - **回归:** `packages/core-engine/test/excel-fill-service.test.ts`
- [ ] `packages/core-engine/src/http/handle-request.ts`：`fillRulesFromBody` 把 `min_num` / `max_num` 收成 `string | null`（空 / 缺省 → `null`，否则 `String(...)`），对齐 `FieldFillRuleWrite` 与 `pattern` 的处理。
  - **Files:** `packages/core-engine/src/http/handle-request.ts`
- [ ] `packages/core-engine/src/pipeline/seed.ts`：让 `DocTypeSeedStore` / `ConcreteExcelSeedStore` 的读写方法返回 `T | Promise<T>`，调用处一律 `await Promise.resolve(...)`，使 `LedgerStore` / `PostgresLedger` 可传入 `seedConcreteInspectionBatchExcelDemo`，同时 `CoreEngineStore` 同步实现仍可用。
  - **Files:** `packages/core-engine/src/pipeline/seed.ts`
  - **调用方（只改类型能编过则不动逻辑）：** `packages/core-engine/src/http/session.ts`、`packages/core-engine/src/persistence/pg-store.ts`、`packages/core-engine/src/persistence/store.ts`
- [ ] `uploadConcreteTemplateBytes`：去掉 `BlobStore as { bucket: string }`。复用 `DocumentPipeline` 的鸭类型（`typeof bucket === "string"` 则用，否则 `"docengine"`），或抽一小函数两边共用。
  - **Files:** `packages/core-engine/src/pipeline/seed.ts`；可选 `packages/core-engine/src/pipeline/document-pipeline.ts`（只抽 helper，不改出表语义）
- [ ] **Verify:** `npx tsc -p packages/core-engine --noEmit` 退出码 0

### Task 2: 外部 Harness 实跑 C4 OpenAPI 探针（harnessMissed）

sourceDoc / goal 的「OpenAPI」指向 C4 草稿，不是 todobackend.com。仓库已有可执行规格：`packages/core-engine/test/adapter-mock.test.ts`（读 `adapter-openapi.yaml` + 无回执拒绝 + `uploadDocument` 必带 `receipt_id`）。

- [ ] 保持该测试为 Harness 套件；必要时在 `packages/core-engine/package.json` 加一条明确脚本（如 `test:adapter-openapi` → `vitest run adapter-mock`），**不要**新写第二套 mock。
- [ ] 实现完成后的 `/verify` **必须执行**该命令，并在 `.apt/verify/latest.md` 的 `## Harness` 写真实套件行（结果列为 `PASS` / `FAIL` / `BLOCKED` 之一）。禁止再写「SKIP：无触发」空跑——否则 classify 仍会 `harnessMissed`。
- [ ] **Verify:** `npm test -w core-engine -- adapter-mock` 退出码 0；OpenAPI 文件仍含 `/adapter/pending-mount` 与 `/adapter/documents/upload`

### Task 3: 回归（native graph 不得回退）

- [ ] 既有 agent / excel / adapter 测试无回归
  - **Verify:** `npm test -w core-engine -- excel-fill-service seed-concrete-excel adapter-mock agent-connect agent-native-graph`
  - **Verify:** `npm test -w agent-runtime -- tool-runtime submit-tool-ban`（抽检即可；全量 `npm test -w agent-runtime` 若时间允许）
- [ ] 重新 `/verify`（对照本 plan + 原 native-graph plan）
  - **期望:** Overall PASS；`npx tsc -p packages/core-engine --noEmit` 绿；`## Harness` 为 RAN。若仅剩 closeout → `/finish-feature`
