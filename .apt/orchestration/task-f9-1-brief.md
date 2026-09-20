# Task F9-1 Brief — expandOneHop 行为（R1–R5 / R9 / R10）

- **Plan:** `docs/apt/plans/2026-09-20-standard-lib-expand-one-hop-plan.md` Task 1
- **Spec:** `docs/superpowers/specs/2026-09-20-standard-lib-expand-one-hop-design.md`
- **Report:** `.apt/orchestration/task-f9-1-report.md`
- **review-tier:** full
- **BASE_SHA:** `e2e4b192545e06d31e5af1c375ba910f5639e9e5`

## 目标

`searchStandard` 在 exact/semantic 条款命中后沿 `CITES` / `SUPERSEDES` **出边一跳**并入 hits。原命中路径不变。0 条款命中不扩图。同一 `clause_id` 不重复。禁止递归多跳。

## Files 白名单（仅可改这些）

- `packages/core-engine/test/standard-rag.test.ts`
- `packages/core-engine/src/retrieve/library.ts`

禁止改：`page.logic.md`、`prequery.ts`、`ports.ts`、`searchGraph` 语义、Vue、其它 8 页、seedPack 里已有的 1.2→1.1 CITES 与 2.1→1.1 SUPERSEDES。

## MCP（开始先只读）

- `query_contract` name=`RetrieveHit`
- `query_contract` name=`GraphStore`
- `query_contract` name=`StandardLibrary`

## 步骤

1. TDD：在 `standard-rag.test.ts` 增加 A19 用例。**本用例自备** `addStandardEdge(1.1 → 1.2, CITES)`，禁止改 `seedPack` 共享出边。
   - FakePrequery map 增加「事假」「不存在」。「事假」rewritten 须能向量命中 1.1（复用 CANON `事假须提前申请`，intent semantic）。
   - 「事假」→ 含 1.1 `retrieve_path=vector` **与** 1.2 `graph`，graph 行 `path=[{from:1.1,to:1.2,kind:"CITES"}]`，可断言 heading 来自 1.2。
   - 「不存在」semantic 无命中 → 无 `retrieve_path=graph` 行。
   - 去重：让 1.1 与 1.2 都出现在向量结果且 1.1 CITES 1.2 → 1.2 仅一行且仍 vector（可用 FakePrequery + 夹具文本/边组合；若难构造双向量命中，可用精确命中两条再扩跳时 1.2 已在 exact 结果中）。
   - 一跳：1.1→1.2 与 1.2→2.1 两条 CITES；仅命中 1.1 → 有 1.2 graph、**无** 2.1。
   - 「1.1」exact + 自备出边 → 首条 exact 1.1，另有 graph 邻接。
2. 最小实现：`searchStandard` **仅**在 exact/semantic 分支之后 `hits = await this.expandOneHop(hits, versionIds)`。graph intent 不调用。
   - 只扩原数组里 `clause_id` 非空且 `retrieve_path` 为 vector|exact 的行（不要对追加的 graph 行再扩）。
   - 对每个起点：`queryPath(id,"CITES")` 与 `queryPath(id,"SUPERSEDES")`。
   - 邻接 `getClause(to)` 缺失或 `version_id` 不在本次 pack `versionIds` → 跳过。
   - `seen` 初始为原 hits 的 clause_id；已存在则不追加。
   - `toHit(clause,"graph")` 且 `path=[该边]`（单跳）。
   - 0 条款命中：直接返回原 hits。
3. 公开方法：若抽出可导出函数须有「为什么」注释；private `expandOneHop` 也要注释不变量（禁止递归、只出边、0 命中短路）。
4. Verify 绿后微闭环：形状未变则不 `register_contract`；对 `library.ts` 调 `refresh_asset` sourcePath=`packages/core-engine/src/retrieve/library.ts`（若 MCP 可用）。
5. `git commit` 一条 subject。不要写入任何 API key。

## Verify

`npx vitest run test/standard-rag.test.ts`（cwd `packages/core-engine`）

期望：A11/A12/A13 仍绿；A19 新测绿。

commit 建议：`feat: expand standard-lib hits one hop along CITES/SUPERSEDES`

## 编码规范（摘录）

- TS 函数必须有明确 return type；函数体 ≤ 80 行，超过则拆。
- 注释说为什么；禁止 `// set x`。
- 禁止把密钥写进代码或 commit。
