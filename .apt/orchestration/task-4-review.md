# Task 4 Review — 图端口与字典（R5/R22）

review-tier: light
projectType: component（跳过 B2 `designs/v0/*/test-cases.md`；公开 export 注释抽检仍适用）
Plan: `docs/apt/plans/2026-09-15-rag-ingest-metadata-graph-plan.md` Task 4
Spec: `docs/superpowers/specs/2026-09-15-rag-ingest-metadata-graph-design.md`
Brief: `.apt/orchestration/task-4-brief.md`
Report: `.apt/orchestration/task-4-report.md`
Range: `6cb0bd8b7756382748ee88ca3c6d9de391b85520..7da6130b6ff12434aca94fb0483918f020bb0352`
Commit: `7da6130b6ff12434aca94fb0483918f020bb0352` feat(retrieve): upsert graph nodes by label and keep SUPERSEDES paths clean
Status (implementer): `DONE`

## Spec Compliance

| 检查项 | 结果 | 证据 |
|--------|------|------|
| `upsertNode` label 只允许 `Clause` \| `LayoutUnit`（其它 throw）；`upsertClause` 委托 `upsertNode("Clause", …)` | **YES** | `neo4j.ts` / `memory-graph.ts`：`NODE_LABELS` + `assertNodeLabel`；非法 label throw `unsupported node label`。两处 `upsertClause` 均 `await this.upsertNode("Clause", …)` |
| `upsertEdge` 禁止无条件 `MERGE (a:Clause),(b:Clause)`；按 kind 选端点 label | **YES** | 共用 `endpointLabel`：SUPPORTS from=`LayoutUnit` to=`Clause`；CITES/SUPERSEDES/APPLIES_TO/REQUIRES 两端 `Clause`；已有点复用 label；未建点时 PARENT_OF 两端 `Clause`，BELONGS_TO from=`LayoutUnit` to=`Clause` |
| 不得把 LayoutUnit id MERGE 成 `:Clause`（D7） | **YES** | Memory `ensureNode` 已存在则不改 label；Neo4j 先 `lookupNodeLabel` 再按 allowlist MERGE。SUPPORTS 单测：先 `upsertNode("LayoutUnit")` 后 from 仍是 LayoutUnit |
| `EDGE_KINDS` 含 `PARENT_OF\|BELONGS_TO\|SUPPORTS` | **YES** | 两实现七值齐全，`assertKind` 拒未知 kind |
| `queryPath(from, kind?)`：任意已有 label；传入 kind 只返回该 kind；未传排除 PARENT_OF | **YES** | Neo4j `WHERE (a:Clause OR a:LayoutUnit)`，不再只 `:Clause`。kind 走 `-[r:${assertKind(kind)}]->`；无 kind 时 `type(r) <> 'PARENT_OF'`。Memory 同样 filter |
| A13：`queryPath(kind=SUPERSEDES)` 无 PARENT_OF | **YES** | 单测先 SUPERSEDES 再 PARENT_OF 末跳；`queryPath("2.1", "SUPERSEDES")` 仅 SUPERSEDES；未传 kind 也排除 PARENT_OF |
| `dicts.ts` `standard_edge_kind` 增加 SUPPORTS / PARENT_OF / BELONGS_TO | **YES** | 三边与 CITES/SUPERSEDES/APPLIES_TO/REQUIRES 并列 |
| `session.ts` demo reset 增加 `MATCH (n:LayoutUnit) DETACH DELETE n` | **YES** | 保留既有 `MATCH (c:Clause) DETACH DELETE c`，另跑 LayoutUnit |
| Neo4j 动态 label 只 allowlist 插值，禁止用户字符串拼进 label | **YES** | Cypher 仅插值 `assertNodeLabel` / `endpointLabel` 的 `GraphNodeLabel` 与 `assertKind` 的 `EdgeKind`。id/props 走 `$param` |
| 公开方法注释写为什么（A13 / D7） | **YES** | 见 Quality。`upsertNode`/`upsertEdge`/`queryPath`/`upsertClause`/`endpointLabel`/`deleteNeo4jClauses` 均写 D7 或 PARENT_OF 污染原因 |
| 未改 `ports.ts` / `library.ts` / handle-request | **YES** | `git diff --name-only` 恰 5 文件，与 brief Files 白名单一致。parent SHA = BASE_SHA。`upsertEdge(edge: GraphEdge)` 签名仍冻结 |
| 函数体 ≤80 行 | **YES** | `upsertNode` 体 ~8 行；`upsertEdge` ~14 行；`queryPath` Neo4j ~22 行 / Memory ~6 行；`endpointLabel` ~12 行 |
| Verify `graph-store.test.ts` | **YES** | 审查方复跑 `npx vitest run packages/core-engine/test/graph-store.test.ts` → exit 0；Test Files 1 passed；Tests **4 passed**（vitest 3.2.7） |
| component：跳过 test-cases.md | **YES** | 未查 `designs/v0` |

无 Missing / Extra / Misunderstood（相对本 Task brief）。`neo4j.ts` / `memory-graph.ts` / `dicts.ts` / `graph-store.test.ts` 相对 BASE_SHA 为新文件（工作区原先未入 git），实现覆盖 brief 全部加法。`searchGraph` 传 kind 留给 Task 6（未改 `library.ts`），符合 brief。

## Quality

**公开 export 注释抽检：Approved**

对照 diff，新增/签名变更的公开面均有「为什么」，不是 `// set x`：

- `endpointLabel`：无条件 `(a:Clause),(b:Clause)` 会把 LayoutUnit id 建成 `:Clause`（D7）；PARENT_OF/BELONGS_TO 复用已 upsert 的 label。
- `upsertClause`：条款调用方不必自选 label；表必须走 `upsertNode("LayoutUnit")`，否则 MERGE 成 `:Clause`。
- `upsertNode`：动态 label 只在 Clause|LayoutUnit 校验后插值，用户字符串不能变成 Cypher label。
- `upsertEdge`：按 kind/label MERGE，SUPPORTS 的 from 保持 LayoutUnit。
- `queryPath`：只匹配 `:Clause` 会藏掉 SUPPORTS；传入 kind 才能锁住 A13 SUPERSEDES，避免 PARENT_OF 末跳替换；省略 kind 排除 PARENT_OF。
- `MemoryGraphStore.nodeLabel`：给测试证明 SUPPORTS from 仍是 LayoutUnit、PARENT_OF 两端仍是 Clause。
- `deleteNeo4jClauses`：只删 Clause 会留下 SUPPORTS 源点，下次 ingest 复用脏表节点。

TS 方法均有明确 return type；命名 camelCase / PascalCase 符合 `.apt/code-standards.md`。

**白名单 / 密钥：** 本 commit 未含 `.ai/`、`.env`、token。未改 `ports.ts` / `library.ts` / handle-request。

**微闭环（工作区，未进本 commit）：** 抽检 `query_contract`：`GraphStore` / `EdgeKind` → `packages/core-engine/src/retrieve/ports.ts`（描述含 upsertNode、upsertEdge 按端点 label、queryPath 避免 PARENT_OF 污染 SUPERSEDES）。`query_arch` `frontend/core-engine/util#neo4jgraphstore` / `#memorygraphstore` / `#demo_dicts` / `#demohttpsession` 均命中对应源文件，Source=refresh。`audit_arch_changes` 未调用。

**测试用例：** component → 跳过 `test-cases.md`。单测用 MemoryGraphStore，未连 Neo4j（brief 允许）。覆盖：PARENT_OF 两端 Clause；A13 `queryPath(kind=SUPERSEDES)` 无 PARENT_OF；SUPPORTS from 仍 LayoutUnit；非法 label throw。

## Issues

**blocking：** 无（0）

**nit：**

- `Neo4jGraphStore.shortestPath` / `MemoryGraphStore.shortestPath` 无方法级 JSDoc；Neo4j 实现仍只 `MATCH (a:Clause)`。brief 未要求改 shortestPath，不阻断 Quality Approved。
- `DEMO_DICTS` 常量无「为什么」注释；三边已在 `standard_edge_kind` 中。
- Memory `ensureNode` 遇已存在节点不改 label：若错误地先建成 Clause 再 SUPPORTS，from 会留下 Clause。brief 要求的路径是先 `upsertNode("LayoutUnit")`，单测已锁。
- `.ai/` 契约/资产更新未进本 commit（工作区该树原先已脏；brief 只 commit 白名单）。
- `refresh_asset` 摘要偏泛（How to use / Exports 多为「暂无」）。不影响源码验收。

## Assessment

**PASS**

Spec ✅（`upsertNode` allowlist；`upsertEdge` 按端点 label，LayoutUnit 不 MERGE 成 Clause；`queryPath(kind=SUPERSEDES)` 无 PARENT_OF；dicts 三边；session 删 LayoutUnit；Neo4j label 只 allowlist 插值；未改 ports/library/handle-request）。Quality Approved（公开方法有「为什么」注释；函数体均远小于 80）。白名单恰 5 文件。Verify 复跑 4 passed。component 跳过 test-cases.md。无 blocking issues。
