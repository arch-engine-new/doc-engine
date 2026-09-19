# Task F2-3 Brief — Qdrant clauses 维数不一致则重建

- **Plan:** `docs/apt/plans/2026-09-19-dashscope-text-embedding-v3-plan.md` Task 3
- **Spec:** `docs/superpowers/specs/2026-09-19-dashscope-text-embedding-v3-design.md`
- **BASE_SHA:** `6361de75400ccf36e6d0fd29237af693ddea5f3e`
- **Report:** `.apt/orchestration/task-f2-3-report.md`
- **Rn:** R4 / T5

## 目标

`QdrantVectorStore.ensureCollection`：若 collection `clauses` 已存在且 `vectors.size !== dim`，则 `deleteCollection` 再 `createCollection`（Cosine，size=dim）。size 已匹配则不 delete。禁止截断/补零去适配旧维。

## 步骤

1. 只读 MCP：`search_arch` query=`QdrantVectorStore ensureCollection`；`query_arch` path=`frontend/core-engine/util#qdrantvectorstore`。禁止掀 `.ai/arch/`。`query_contract` name=`QdrantVectorStore` 可能未登记，以源码+arch 为准。
2. TDD：构造时注入 mock client（不要打真实 Qdrant）：
   - mock `getCollections` 含 clauses；`getCollection`（或等价）size=48；`upsert` 1024 维合法 payload → 断言调用了 `deleteCollection('clauses')` 与 `createCollection` size=1024，然后 client.upsert。
   - size 已 1024：不调用 deleteCollection。
3. 实现：constructor 增加可选 `client`（测试注入）。读取已有 collection 向量维：用 client API（getCollection / collection info）。不一致才重建。`ensuredDim` 逻辑仍避免重复 ensure。
4. 微闭环：`register_contract` QdrantVectorStore；`refresh_asset` qdrant.ts。
5. git commit；写 report。

## Files 白名单

- `packages/core-engine/src/retrieve/qdrant.ts`
- `packages/core-engine/test/qdrant-collection.test.ts`

## Verify

```
npx vitest run test/qdrant-collection.test.ts
```

cwd: `packages/core-engine`

payload 必须过 `assertVectorPayload`（含 unit_id / file_name / chunk_kind 等，见 `payload.ts`）。向量可用 `new Array(1024).fill(0)`。

## 禁止

- 改 live-ports / embeddings / library / Vue
- 真实 Qdrant / 真实 key
- 截断 1024→48
- `audit_arch_changes`

## 编码规范

`.apt/code-standards.md`。导出方法「为什么」注释。

## 上一 Task handoff

Task 2 Approved。live embed 已是 DashScope v3；缺 key throw。Commit `6361de7`。
