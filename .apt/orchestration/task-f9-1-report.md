# Task F9-1 Report — expandOneHop

## Status

DONE_WITH_CONCERNS

## Commits

- `59f206d4249eb1414280c7f524705d947e9efb7f` feat: expand standard-lib hits one hop along CITES/SUPERSEDES
  - files: `packages/core-engine/src/retrieve/library.ts`, `packages/core-engine/test/standard-rag.test.ts`

## 测试摘要

- Command: `npx vitest run test/standard-rag.test.ts`（cwd `packages/core-engine`）
- Result: **20 passed / 0 failed**
- A11 / A12 / A13 仍绿（共享 seed 未改 1.2→1.1 CITES、2.1→1.1 SUPERSEDES；graph intent 不调用 expandOneHop）
- A19 新测绿：
  - A19-hit：事假 semantic（top-1 rerank）→ 1.1 `vector` + 1.2 `graph`，`path` 单跳 CITES，heading/body 来自 1.2
  - A19-empty：不存在 + 空包 → 0 hits，无 graph 行
  - A19-dedupe：默认 rerank 同时召回 1.1/1.2 → 1.2 仅一行且仍 `vector`
  - A19-one-hop：exact 1.1 + 1.1→1.2→2.1 两条 CITES → 有 1.2 graph、无 2.1
  - A19-exact：exact 1.1 + 用例内 1.1→1.2 CITES → 首条 exact，邻接 graph

## APT Micro-closeout

| 项 | 结果 |
|----|------|
| ContractsRegistered | none（未改 ports.ts / RetrieveHit / GraphStore 形状） |
| AssetsRefreshed | `refresh_asset` sourcePath=`packages/core-engine/src/retrieve/library.ts` → MCP `ok:true`，id=`frontend/packages/util/library`，action=`created` |
| AssetsRemoved | none |

## 实现摘要

- `searchStandard` 仅在 exact/semantic 分支之后 `hits = await this.expandOneHop(hits, versionIds)`
- 只扩原数组中 `clause_id` 非空且 `retrieve_path` 为 vector|exact 的行
- 每个起点 `queryPath(id,"CITES")` 与 `queryPath(id,"SUPERSEDES")`；不对追加 graph 行再扩
- 邻接 getClause 缺失或 `version_id` 不在本次 pack `versionIds` → skip
- `seen` 初始为原 hits 的 clause_id；`toHit(clause,"graph")` 且 `path=[该边]`，追加在原 hits 之后
- 0 条款命中短路，不查图
- graph intent 不调用 expandOneHop

## concerns

1. `refresh_asset` 对 `packages/core-engine/src/retrieve/library.ts` 返回 **created** `frontend/packages/util/library`，而契约/arch 既有 StandardLibrary 在 `frontend/core-engine/util#standardlibrary`。未 `register_contract`、未 `audit_arch_changes`（留给 PB-5）。可能产生重复 util 条目，需主 Agent / 扫描侧核对。
2. A19-hit 在测试内用 top-1 rerank：MemoryVectorStore `topK=8` 会把包内全部条款送进 rerank；若不截断，1.2 会先以 vector 出现，无法断言 graph 邻接。产品 rerank 行为未改。
3. A19-empty 用空 pack（无 ingest）构造 0 条款命中；未覆盖「仅有 table 命中、clause_id=null」的短路。
