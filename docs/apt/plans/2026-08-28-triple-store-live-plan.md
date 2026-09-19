# 三库实挂 Implementation Plan

> **Spec:** `docs/superpowers/specs/2026-08-28-triple-store-live-design.md`
> **Command:** `/plan-from-spec`
> **Status:** approved
> **projectType:** component（跳过设计寻址与 v0 freeze；无新 UI Task）

**Goal:** 演示 HTTP 在三库环境变量齐全时把账本写入 PostgreSQL、条款向量写入 Qdrant、关系写入 Neo4j；全空时保持现有内存/SQLite 单测路径。

**Architecture:** 抽出与 `CoreEngineStore` 同语义的异步 `LedgerStore`；SQLite 用薄包装保持单测。Live 装配只发生在 `DemoHttpSession`：`pg` 执行已有 `core-engine-migration.sql`，检索端口换成已有 `QdrantVectorStore` / `Neo4jGraphStore`。部分 env 启动即失败。不改 9 页路由，只加只读 `GET /api/health`。

---

## Part 1 — 技术方案（APT 寻址）

### 1.1 范围与约束

**做：** live 装配、PG 幂等 migrate（复用已有 DDL，不新建业务表）、Postgres ledger、Qdrant/Neo4j 实端口、reset 清空三库后重种夹具、health、有 Docker 才跑的集成测、手册验证步骤。

**不做：** 资料云、组卷提交、OCR、agent-runtime 迁库、真实 Embedding/rerank HTTP、CI 强制 Docker、改 Docker 端口约定、新 Vue 页。

**约束：** Agent 不持三库客户端。对话仍不能 Receipt/submit/publish。组卷 `submitted` 仍为 false。

### 1.2 设计寻址（无 UI 则写 N/A）

N/A（component Profile；本 spec 不含页面改版）。

### 1.3 依赖寻址表

| 依赖 | 来源 | 引用 | 摘要 |
|------|------|------|------|
| JobPipeline | contract | `packages/core-engine/src/pipeline/job-pipeline.ts` | `open` / `openStandardLibrary` 现 boot SQLite；构造函数吃 `CoreEngineStore`；`ingestStandard` 已是 Promise |
| CoreEngineStore | contract | `packages/core-engine/src/persistence/store.ts` | 同步 SQLite 账本；单测保留 |
| StandardLibrary / defaultRetrievePorts | contract | `packages/core-engine/src/retrieve/library.ts` | 默认 Memory 向量/图；传入 ports 可换生产实现 |
| RetrievePorts / VectorStore / GraphStore | contract | `packages/core-engine/src/retrieve/ports.ts` | upsert/search 已是 async |
| QdrantVectorStore | arch | `frontend/core-engine/utils#qdrant` → `packages/core-engine/src/retrieve/qdrant.ts` | collection `clauses`，无 `QDRANT_URL` 则构造抛错 |
| Neo4jGraphStore | arch | `frontend/core-engine/utils#neo4j` → `packages/core-engine/src/retrieve/neo4j.ts` | 无 `NEO4J_URI` 则构造抛错 |
| DemoHttpSession | arch | `frontend/core-engine/utils#session` → `packages/core-engine/src/http/session.ts` | 现 `openStandardLibrary()` 无 ports |
| DemoHttpAdapter / handleDemoRequest | contract | `packages/core-engine/src/http/handle-request.ts` | 已 async；无 `/api/health`；多数 pipeline 调用仍同步 |
| runMigrationOnDb | arch | `frontend/core-engine/utils#migrate` → `packages/core-engine/src/persistence/migrate.ts` | 只跑 SQLite；正式 DDL 在 generated SQL |
| HashEmbeddings | contract | `packages/core-engine/src/retrieve/embeddings.ts` | 本片继续用，不换厂商 |
| ClauseRow 等行类型 | contract | `docs/schema/generated/core-engine-rows.ts` | PG 读写必须对齐字段名 |
| PG DDL | 文件（schema 合同） | `docs/schema/generated/core-engine-migration.sql` | 已有 `t_*`，本片 apply，不另起表 |

**新建（实现期落点，非假装已存在）：** `live-env.ts`、`pg-migrate.ts`、`pg-store.ts`（`PostgresLedger`）、`live-ports.ts`、`GET /api/health`。

### 1.4 拟改动模块与文件

| 文件/模块 | 变更类型 | 说明 |
|-----------|----------|------|
| `packages/core-engine/src/persistence/live-env.ts` | 新 | 全空 memory；缺一 throw |
| `packages/core-engine/src/persistence/pg-migrate.ts` | 新 | 幂等执行 generated SQL |
| `packages/core-engine/src/persistence/ledger.ts` | 新 | `LedgerStore` 接口（CoreEngineStore 公有方法的 Promise 版）+ sqlite 包装 |
| `packages/core-engine/src/persistence/pg-store.ts` | 新 | PostgresLedger，`$n`，truncate/wipe |
| `packages/core-engine/src/retrieve/live-ports.ts` | 新 | Qdrant + Neo4j + 现有 embed/rerank/prequery |
| `packages/core-engine/src/pipeline/job-pipeline.ts` | 改 | `LedgerStore`；`openLiveFromEnv`；store 调用 await |
| `packages/core-engine/src/retrieve/library.ts` | 改 | 构造函数改吃 `LedgerStore` |
| `packages/core-engine/src/http/session.ts` | 改 | live/memory 分支；live reset 清三库再种夹具 |
| `packages/core-engine/src/http/handle-request.ts` | 改 | await pipeline；`GET /api/health`；依赖失败 503 |
| `packages/core-engine/src/index.ts` | 改 | 导出 live 工厂与 LedgerStore |
| `packages/core-engine/package.json` | 改 | 依赖 `pg` + `@types/pg` |
| `packages/core-engine/test/live-triple-store.test.ts` | 新 | `skipIf` 无 DATABASE_URL |
| `apps/web/.env.example` | 新 | 本机 docker_run 默认连接串 |
| `.gitignore` | 改 | 忽略 `.env` |
| `docs/使用手册.md` | 改 | 去掉「未对接」；补验证命令 |

禁止改 `packages/agent-runtime` 业务库客户端。

### 1.5 风险与未决项

- `pg` 异步 vs 现有同步 store：必须用 `LedgerStore` 包装，禁止 deasync。
- PG `TIMESTAMP`/`JSONB` 读回可能不是 string：映射成行类型里的 string（`toISOString` / `JSON.stringify`）。
- reset 与 FK：用 `TRUNCATE ... CASCADE` 本引擎 `t_*` 表，或按依赖倒序 DELETE；不要 DROP DATABASE。
- Vite 只自动加载 `apps/web/.env`：示例文件放那里，勿假设仓库根 `.env` 生效。
- live 测试依赖本机 Docker；CI 无 env 必须 skip。
- 向量 upsert 失败允许孤儿条款（spec 已定），不引入分布式事务。

---

## Part 2 — 可执行任务清单

> 实现时由 `/implement-plan` 按 Task 派发。PowerShell 不要用 `&&`。

### Task 1: live-env 解析

- [ ] 实现 `resolveEngineMode()`：三库键全空 → `memory`；缺任一 → throw（列出缺键）；齐全 → `live` 并返回连接信息
  - **MCP:** `query_arch` path=`frontend/core-engine/utils#session`
  - **Files:** `packages/core-engine/src/persistence/live-env.ts`, `packages/core-engine/test/live-env.test.ts`
  - **Verify:** `npm test -w core-engine -- live-env`

键：`DATABASE_URL`、`QDRANT_URL`、`NEO4J_URI`、`NEO4J_PASSWORD`（`NEO4J_USER` 缺省 `neo4j`）。

### Task 2: PG 幂等 migrate

- [ ] 用 `pg` 执行 `docs/schema/generated/core-engine-migration.sql`（`IF NOT EXISTS`）；加 `pg` 依赖
  - **MCP:** `query_arch` path=`frontend/core-engine/utils#migrate`
  - **Files:** `packages/core-engine/src/persistence/pg-migrate.ts`, `packages/core-engine/package.json`
  - **Verify:** `npx tsc -p packages/core-engine --noEmit`

### Task 3: LedgerStore 接口 + SQLite 包装

- [ ] 从 `CoreEngineStore` 公有方法抽出 `LedgerStore`（方法返回 `Promise`）；`SqliteLedger` 转接现有同步 store；`JobPipeline` / `StandardLibrary` / ReviewDesk / VolumeDesk 改为吃 `LedgerStore`（内部 await）
  - **MCP:** `query_contract` name=`CoreEngineStore`；`query_contract` name=`JobPipeline`
  - **Files:** `packages/core-engine/src/persistence/ledger.ts`, `packages/core-engine/src/persistence/store.ts`, `packages/core-engine/src/pipeline/job-pipeline.ts`, `packages/core-engine/src/retrieve/library.ts`, `packages/core-engine/src/pipeline/review.ts`, `packages/core-engine/src/pipeline/volume.ts`
  - **Verify:** `npm test -w core-engine`
  - **Contracts:** `LedgerStore` → 实现后 `register_contract`

无三库 env 时行为与改前一致。

### Task 4: PostgresLedger（配置与规则表）

- [ ] 实现 project / spec_pack / template / field_box / rule / rule_version / rule_fixture 的 CRUD，语义对齐 `CoreEngineStore`（`ON CONFLICT DO NOTHING` 替代 `INSERT OR IGNORE`）
  - **MCP:** `query_contract` name=`CoreEngineStore`
  - **Files:** `packages/core-engine/src/persistence/pg-store.ts`
  - **Verify:** `npx tsc -p packages/core-engine --noEmit`

### Task 5: PostgresLedger（Job / 待审 / 审计 / 对话）

- [ ] 实现 job / document / extraction / finding / proposal / receipt / volume_preview / audit_event / conversation_* ，行字段对齐 `ClauseRow` 合同那套生成类型
  - **MCP:** `query_contract` name=`ClauseRow`
  - **Files:** `packages/core-engine/src/persistence/pg-store.ts`
  - **Verify:** `npx tsc -p packages/core-engine --noEmit`

### Task 6: PostgresLedger（标准库表 + wipe）

- [ ] 实现 standard_doc / version / clause / edge；`wipeLedger()` TRUNCATE 或等价清空；`seedPublishedRules` 对齐 SQLite
  - **MCP:** `query_contract` name=`StandardLibrary`
  - **Files:** `packages/core-engine/src/persistence/pg-store.ts`
  - **Verify:** `npx tsc -p packages/core-engine --noEmit`

### Task 7: live 检索端口工厂

- [ ] `liveRetrievePorts()`：`new QdrantVectorStore()` + `new Neo4jGraphStore()` + 默认 HashEmbeddings / IndependentReranker / FakePrequery
  - **MCP:** `query_arch` path=`frontend/core-engine/utils#qdrant`；`query_arch` path=`frontend/core-engine/utils#neo4j`
  - **Files:** `packages/core-engine/src/retrieve/live-ports.ts`, `packages/core-engine/src/index.ts`
  - **Verify:** `npx tsc -p packages/core-engine --noEmit`

### Task 8: JobPipeline.openLiveFromEnv + HTTP 全 await

- [ ] `openLiveFromEnv`：migrate → PostgresLedger → live ports；`handleDemoRequest` 所有 pipeline 调用加 await；连接失败映射 503
  - **MCP:** `query_contract` name=`DemoHttpAdapter`；`query_contract` name=`JobPipeline`
  - **Files:** `packages/core-engine/src/pipeline/job-pipeline.ts`, `packages/core-engine/src/http/handle-request.ts`
  - **Verify:** `npm test -w core-engine`

### Task 9: DemoHttpSession live reset + health

- [ ] mode=live 时 reset：wipe PG + 删 Qdrant `clauses` + `MATCH (c:Clause) DETACH DELETE c` + 现有夹具语义（请假说明，禁公路/水利/房建）；`GET /api/health` 返回 `{ mode, postgres, qdrant, neo4j }`
  - **MCP:** `query_arch` path=`frontend/core-engine/utils#session`
  - **Files:** `packages/core-engine/src/http/session.ts`, `packages/core-engine/src/http/handle-request.ts`
  - **Verify:** `npm test -w core-engine`

### Task 10: 环境文件

- [ ] `apps/web/.env.example` 写入本机 docker_run 默认串（5434 / 6333 / 7687）；`.gitignore` 忽略 `.env`
  - **MCP:** `query_arch` path=`frontend/core-engine/utils#session`
  - **Files:** `apps/web/.env.example`, `.gitignore`
  - **Verify:** 确认 `.env.example` 含 `DATABASE_URL` `QDRANT_URL` `NEO4J_URI` `NEO4J_PASSWORD`

### Task 11: live 集成测试（可 skip）

- [ ] `describe.skipIf(!process.env.DATABASE_URL)`：reset → PG `t_clause` count>0 → Qdrant collection `clauses` → Neo4j Clause count>0 → search 命中请假条款 `clause_id`
  - **MCP:** `query_contract` name=`StandardLibrary`
  - **Files:** `packages/core-engine/test/live-triple-store.test.ts`
  - **Verify:** 无 env 时 `npm test -w core-engine` 仍全绿；有 env 时该文件 PASS

### Task 12: 手册与契约注册

- [ ] 更新 `docs/使用手册.md` 对接状态与验证命令；`register_contract`：`LedgerStore`；`refresh_asset` module=`core-engine`（新/改 ts）
  - **MCP:** `register_contract`；`refresh_asset` sourcePath=`packages/core-engine/src/http/session.ts`
  - **Files:** `docs/使用手册.md`, `packages/core-engine/src/index.ts`
  - **Verify:** 手册含 health / `\dt` / collections / cypher count；`npx tsc -p packages/core-engine --noEmit`
