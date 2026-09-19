---
title: 对接 PostgreSQL / Qdrant / Neo4j 实库
date: 2026-08-28
status: approved
risk: high
phase: approved
topic: triple-store-live
mode: apt-auto-brainstorm
goalSha: 6900c96c0679cba37337f51c3356d096355eb577939de41b76d1d115a7818c37
approvedAt: 2026-08-28T03:44:00.000Z
approvedBy: user
---

# Design Spec: 对接三库（PostgreSQL + Qdrant + Neo4j）

## Goal

把已经在本机 Docker 跑着的三套库接到 `apps/web` 演示流水线：业务账本进 **PostgreSQL**，条款向量进 **Qdrant**，条款关系进 **Neo4j**。打开工作台、重置演示、入库条款之后，用三库客户端能查到行 / collection / 节点，而不是只活在进程内存里。

成功标准是 **运行时真写入**，不是「适配器能编译」。

## 澄清（全自动自答）

`.apt/goal.md` 存在，本轮按全自动 brainstorming：AI 自问自答。

1. **目的？** 用户已起 `docengine-postgres` / `qdrant` / `neo4j`，并明确问是否对接。要对上这三套，而不是继续 Memory + SQLite `:memory:`。
2. **CI 要不要连 Docker？** 不要。无三库环境变量时保持现有内存/SQLite 路径，现有 vitest 必须继续绿。
3. **缺一个环境变量怎么办？** 配了部分却缺其余 → **启动失败**（禁止静默掉回内存，否则会误以为已对接）。三个都缺 → 内存路径（测试默认）。
4. **要不要换真实 Embedding / rerank HTTP？** 本片不换。继续 `HashEmbeddings` + 独立 rerank。本片只换存储位置。
5. **「重置演示」在实库上做什么？** 清空本引擎账本表 + 重建 Qdrant `clauses` + 删除 Neo4j `Clause` 节点后重新种夹具。不 `DROP DATABASE`。
6. **要不要改 9 页 UI？** 不改信息架构。可加只读 `GET /api/health` 供验证；页面按钮与路由保持原样。

## 范围

1. 演示 HTTP（Vite 中间件 / `DemoHttpSession`）在完整环境变量下走实库。
2. 对 `docs/schema/generated/core-engine-migration.sql` 做幂等 apply（表已存在则跳过）。
3. 用已有 `QdrantVectorStore`、`Neo4jGraphStore` 作为检索端口，不再默认 `Memory*`。
4. 账本从 `CoreEngineStore`（SQLite）切到 PostgreSQL 实现，**表名与行字段与现合同一致**（`t_project` … `t_clause` 等，不新建业务表）。
5. `GET /api/health` 报告三库连通与 `mode: live | memory`。
6. 环境变量示例（不提交真实 `.env`）：`DATABASE_URL`、`QDRANT_URL`、`NEO4J_URI`、`NEO4J_USER`、`NEO4J_PASSWORD`。
7. 有 Docker 时的集成测试（无 env 则 skip）。
8. 更新 `docs/使用手册.md` 中「未对接」的表述与验证命令。

## 非目标

- 资料云实挂、组卷提交、OCR/OSS、Temporal。
- 把 `packages/agent-runtime` 的 SQLite 认知库迁到 Postgres；Agent 仍不持正式账本、不持三库客户端。
- 真实 Embedding API、独立 rerank HTTP 厂商、智谱预查询实挂（可继续 FakePrequery / HashEmbeddings）。
- 从历史内存进程迁移数据。
- 新建 Vue 页面或改 9 页路由。
- 把 CI 改成强制 Docker。
- 改 Docker 容器名/端口约定（沿用 `127.0.0.1:5434`、`6333`、`7687`）。

## 验收标准

| ID | 通过标准 |
|----|----------|
| L1 | 三个 URL/口令都配置时，`DemoHttpSession` 使用 PG + Qdrant + Neo4j；缺任一则进程拒绝启动（测试除外：全空走 memory）。 |
| L2 | `POST /api/demo/reset` 后：`docengine` 库有 `t_project` 等表且有演示行；Qdrant 有 collection `clauses` 且 point id = `clause_id`；Neo4j 有 `Clause` 节点。 |
| L3 | 重启 `npm run dev -w web` 后，不点重置也能列出上次的项目/任务（账本在 PG）。 |
| L4 | 标准库页入库 + 检索仍只挂库内 `clause_id`；对话仍不能写 Receipt / submit / publish。 |
| L5 | 无三库 env 时 `npm test -w core-engine` 与现有夹具测试全绿（内存路径）。 |
| L6 | `GET /api/health` 在 live 下三库均为 ok；停掉其中一个后对应项失败。 |
| L7 | 组卷提交仍禁用；mock 无 `receipt_id` 仍不算写入。 |

## 方案比较（核心决策：账本怎么上 Postgres）

### 方案 A — 只接线 Qdrant/Neo4j，账本仍 SQLite 内存

- 优点：改动小，半天能做完。
- 缺点：用户要的三库只接了两个；重启网页账本仍丢。
- **不推荐。**

### 方案 B — 账本迁 PostgreSQL（async store）+ 检索走已有 Qdrant/Neo4j 适配器（推荐）

- 优点：与 schema 合同、goal（C1 RAG 三库）一致；重启可对账。
- 缺点：`CoreEngineStore` 今天是 **同步** better-sqlite3，`pg` 是异步，演示路径上的 store 调用要改成 `await`；文件数会超过 8。
- **推荐。** 理由：用户明确要三库都可验证；Qdrant/Neo4j 适配器已存在，缺口就是账本与启动装配。

### 方案 C — 进程内 SQLite 文件 + 三库双写

- 优点：少改同步 API。
- 缺点：两套账本，对账困难，不符合「PG 是正式账本」。
- **不推荐。**

**选定：方案 B。**

## 设计

### Architecture

```
apps/web (Vite)
  └─ core-engine HTTP 中间件
        DemoHttpSession
           │
           ├─ live（三库 env 齐全）
           │     JobPipeline + PostgresLedger + QdrantVectorStore + Neo4jGraphStore
           └─ memory（三库 env 全空，测试默认）
                 JobPipeline.openStandardLibrary() 现状：SQLite :memory: + MemoryVector/Graph
```

- 装配点只允许 `packages/core-engine/src/http/session.ts` 与一个 `openLiveFromEnv()` 工厂。
- 禁止在 `packages/agent-runtime` 里 `new QdrantClient` / `neo4j.driver` / `pg.Client`。
- HTTP JSON 仍用现有 snake_case；不改 9 页调用约定。只增加只读 health。

### Components

| 组件 | 职责 |
|------|------|
| `live-env.ts` | 解析 env；全空 → memory；部分缺失 → throw |
| `pg-migrate.ts` | 对 `docs/schema/generated/core-engine-migration.sql` 幂等执行 |
| `PostgresLedger` | 与 `CoreEngineStore` 同方法语义，参数 `$n`，JSONB/TIMESTAMP 按生成 DDL |
| `live-ports.ts` | `new QdrantVectorStore()` + `new Neo4jGraphStore()` + 现有 embed/rerank/prequery |
| `DemoHttpSession` | 按 env 选择 live/memory；`reset()` live 时 truncate+清向量+清图再种夹具 |
| `GET /api/health` | `{ mode, postgres, qdrant, neo4j }` |

SQLite `CoreEngineStore` **保留**给单测。不要删 `sqlite-slice1.sql`。

驱动：`pg`（已有 `@qdrant/js-client-rest`、`neo4j-driver`）。不要为账本再引入 ORM。

本机默认（已在 `D:\docker_run` 约定，不改容器）：

```
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5434/docengine
QDRANT_URL=http://127.0.0.1:6333
NEO4J_URI=bolt://127.0.0.1:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=12345678
```

Vite 从 `apps/web/.env` 注入到 Node 中间件进程（`apps/web/.env.example` 入库，`.env` 不入库）。

### Data flow

1. 启动：读 env → migrate PG → 构造 pipeline。
2. 重置演示：按 FK 安全顺序 `TRUNCATE` 本引擎 `t_*` 表（或 `DELETE`）→ 删除 Qdrant collection `clauses`（或清空 points）→ `MATCH (c:Clause) DETACH DELETE c` → 再跑现有夹具种数据（项目、空规范包、3 框、请假说明、合规/颠倒 Job、pending Proposal）。
3. 入库条款：PG `t_clause`（`qdrant_point_id = clause_id`）→ Qdrant upsert → Neo4j `MERGE (:Clause {id})`；加边时 PG `t_standard_edge` 与 Neo4j 关系一起写。向量失败则接口返回错误（本片允许短暂孤儿条款，不要求分布式事务）。
4. 检索：仍走 `StandardLibrary.search` 路由（exact / vector / graph）；Finding 只挂命中的 `clause_id`。
5. 对话：仍 `appendChat`，不写 Receipt。

### Error handling

- 部分 env：抛明确错误，列出缺了哪几个键。
- PG/Qdrant/Neo4j 连不上：health 对应项 fail；业务请求返回 503，body 含哪一个依赖失败。
- `reset` 中途失败：不假装成功；可重试 reset（幂等清空）。
- 条款号冲突：按 `clause_id` 幂等（upsert / ignore），避免二次入库把演示打爆。

### Testing

- 现有 `packages/core-engine/test/*`：不设三库 env，必须全绿。
- 新增 live 测试（`describe.skipIf(!process.env.DATABASE_URL)`）：reset → 查 PG 行数 → Qdrant `clauses` → Neo4j `count(Clause)` > 0 → search 命中请假说明 `clause_id`。
- 不把 Docker 当作 CI 必过。
- 手工验收命令见下节（与用户已跑过的探针一致）。

### 手工验证（实现后执行）

```powershell
Invoke-WebRequest http://127.0.0.1:5173/api/health
docker exec docengine-postgres psql -U postgres -d docengine -c "\dt"
docker exec docengine-postgres psql -U postgres -d docengine -c "SELECT count(*) FROM t_clause;"
Invoke-WebRequest http://127.0.0.1:6333/collections
docker exec neo4j cypher-shell -u neo4j -p 12345678 "MATCH (c:Clause) RETURN count(c) AS clauses;"
```

重置演示后再跑一遍：三处都应非空。停 Vite 再启动：PG 行还在。

## 拟改文件（风险用）

预计 **> 8**：

1. `packages/core-engine/src/persistence/live-env.ts`（新）
2. `packages/core-engine/src/persistence/pg-migrate.ts`（新）
3. `packages/core-engine/src/persistence/pg-store.ts`（新）
4. `packages/core-engine/src/retrieve/live-ports.ts`（新）
5. `packages/core-engine/src/pipeline/job-pipeline.ts`
6. `packages/core-engine/src/http/session.ts`
7. `packages/core-engine/src/http/handle-request.ts`
8. `packages/core-engine/src/index.ts`
9. `packages/core-engine/package.json`（加 `pg`）
10. `packages/core-engine/test/live-triple-store.test.ts`（新）
11. `apps/web/.env.example`（新）
12. `.gitignore`（忽略 `.env`）
13. `docs/使用手册.md`

实现期若 store 调用全面 async，还可能改 `retrieve/library.ts` 等调用方。

## Ontology detection

调用记录：

- `query_ontology()` 无参：模块 `core-engine` / `web` / `agent-runtime`；契约含 `JobPipeline`、`CoreEngineStore`、`StandardLibrary`、`RetrievePorts`、`VectorStore`、`GraphStore`、`Qdrant`/`Neo4j` 适配器、行类型 `ClauseRow` 等。
- `query_ontology("StandardLibrary")`：命中 `library.ts`、`defaultRetrievePorts`、`standard_lib` 页。
- `query_ontology("persistence")`：命中 SQLite migrate；**没有** Postgres store 资产。
- `query_contract("CoreEngineStore")`：明确是 SQLite ledger。
- `search_arch("JobPipeline persistence SQLite Qdrant Neo4j")`：`QdrantVectorStore` / `Neo4jGraphStore` / `JobPipeline` / `defaultRetrievePorts` 已存在。

复用决策：

| 资产 | 决策 | 理由 |
|------|------|------|
| `QdrantVectorStore` | 复用 | 生产向量端口已实现，缺的是装配 |
| `Neo4jGraphStore` | 复用 | 同上 |
| `defaultRetrievePorts` / `Memory*` | 复用（仅测试） | CI 不可降级成「必须有 Docker」 |
| `CoreEngineStore` + `sqlite-slice1.sql` | 复用（仅测试） | 单测保持快、无网络 |
| `docs/schema/generated/core-engine-migration.sql` | 复用 | 正式 PG DDL，不另起一套表名 |
| `StandardLibrary` / `JobPipeline` | 复用 | 不改检索路由与 HITL 禁写口径 |
| `DemoHttpSession` | 改装配，不改夹具语义 | 重置仍种请假说明，禁止公路/水利/房建 |
| `packages/agent-runtime` 持久化 | 不复用、不改 | 认知库不是业务账本 |
| 9 页 Vue | 不改结构 | 无新 UI；health 可选 |

未调用 `report_missing`：缺口是运行时装配与 PG store，不是缺契约名。

## 风险分级

**high**

依据：拟改动 **> 8 个文件**。HTTP 以新增只读 health 为主，现有 9 页请求/响应字段保持。

因此本 spec 已由用户回复「批准」标为 `status: approved`。实现须先经 plan 确认后再 `/implement-plan`。
