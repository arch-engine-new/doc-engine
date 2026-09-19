# Task 4 Brief — 图端口与字典（R5/R22）

plan: `docs/apt/plans/2026-09-15-rag-ingest-metadata-graph-plan.md`
projectType: component
review-tier: light
BASE_SHA: `6cb0bd8b7756382748ee88ca3c6d9de391b85520`

## 步骤

- [ ] MCP：`query_arch` path=`frontend/core-engine/util#neo4jgraphstore`；`query_contract` name=`GraphStore`。禁止读 `.ai/`。
- [ ] `Neo4jGraphStore` + `MemoryGraphStore` 实现 `upsertNode(label, id, props)`。label 只允许 `Clause` | `LayoutUnit`（其它 throw）。`upsertClause` 可委托 `upsertNode("Clause", …)`。
- [ ] `upsertEdge`：**禁止**无条件 `MERGE (a:Clause),(b:Clause)`。按端点 label MERGE：
  - `SUPPORTS`：from=`LayoutUnit`，to=`Clause`
  - `PARENT_OF` / `BELONGS_TO`：两端按已 upsert 的 label；若尚未建点，PARENT_OF 两端 `Clause`，BELONGS_TO from=`LayoutUnit` to=`Clause`
  - `CITES|SUPERSEDES|APPLIES_TO|REQUIRES`：两端 `Clause`（保持旧语义）
  - 不得把 LayoutUnit id MERGE 成 `:Clause`（D7）
- [ ] `EDGE_KINDS` 含 `PARENT_OF|BELONGS_TO|SUPPORTS`。
- [ ] `queryPath(from, kind?)`：匹配任意已有 label（不要只 `:Clause`，否则 SUPPORTS 查不到）。**传入 kind 则只返回该 kind**。未传 kind 时 **排除 PARENT_OF**（spec 默认）。A13 单测必须 `queryPath(kind=SUPERSEDES)`。
- [ ] `dicts.ts` `standard_edge_kind` 增加 SUPPORTS / PARENT_OF / BELONGS_TO。
- [ ] `session.ts` demo reset：现有 `MATCH (c:Clause) DETACH DELETE c` 之外增加 `MATCH (n:LayoutUnit) DETACH DELETE n`。
- [ ] 单测 `packages/core-engine/test/graph-store.test.ts`（允许新文件）：
  - PARENT_OF 两端均为 Clause 节点（Memory 即可）
  - 先 SUPERSEDES 再 PARENT_OF 末跳，`queryPath(from, "SUPERSEDES")` 只有 SUPERSEDES，不含 PARENT_OF（M5/R22）
  - SUPPORTS：upsertNode LayoutUnit 后 upsertEdge，from 仍是 LayoutUnit 而非被建成 Clause

## Files 白名单

- `packages/core-engine/src/retrieve/neo4j.ts`
- `packages/core-engine/src/retrieve/memory-graph.ts`
- `packages/core-engine/src/http/dicts.ts`
- `packages/core-engine/src/http/session.ts`
- `packages/core-engine/test/graph-store.test.ts`（新）

不要改 `ports.ts` 的 `upsertEdge` 签名（Task 1 已冻结）。不要改 `library.ts`（searchGraph 传 kind 是 Task 6）。不要改 handle-request。

## Verify

```
npx vitest run packages/core-engine/test/graph-store.test.ts
```

## 约束

- Neo4j Cypher 动态 label 必须 allowlist 插值，禁止把用户字符串拼进 label。
- 公开方法注释写为什么（A13 被 PARENT_OF 污染；LayoutUnit 不能 MERGE 成 Clause）。
- 微闭环 register_contract GraphStore/EdgeKind；refresh_asset。禁止 audit_arch_changes。
- 只 commit 白名单。

## Report + commit

`.apt/orchestration/task-4-report.md`
`git commit -m "feat(retrieve): upsert graph nodes by label and keep SUPERSEDES paths clean"`
