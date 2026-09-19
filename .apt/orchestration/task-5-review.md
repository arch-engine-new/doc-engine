# Task 5 Review — 版式切分 + 文本 ingest + 自动边

review-tier: full
projectType: component（跳过 B2 `designs/v0/*/test-cases.md`；公开 export 注释抽检仍适用）
Plan: `docs/apt/plans/2026-09-15-rag-ingest-metadata-graph-plan.md` Task 5
Spec: `docs/superpowers/specs/2026-09-15-rag-ingest-metadata-graph-design.md`
Brief: `.apt/orchestration/task-5-brief.md` / `.apt/orchestration/task-5-review-brief.md`
Report: `.apt/orchestration/task-5-report.md`
Range: `7da6130b6ff12434aca94fb0483918f020bb0352..f594629f36268bb9465331d784e9ee7d5aae194e`
Commit: `f594629f36268bb9465331d784e9ee7d5aae194e` feat(retrieve): split layout tables and ingest provenance plus SUPPORTS
Status (implementer): `DONE`

本文件覆盖原 paddleocr Task 5 评审账本（RAG ingest plan，不是 paddleocr）。

## Spec Compliance

| 检查项 | 结果 | 证据 |
|--------|------|------|
| `splitLayoutUnits` 保留 GFM `\|`，不 flatten | **YES** | `layout-split.ts` 只 `import { splitClauses }`；全文件无 `flattenOcrMarkdown`。表 `body` = 原文 slice。单测 `body_markdown` 含 `\|` |
| 条款复用 `splitClauses`；GFM 表块 → `chunkKind=table` | **YES** | `maskTableBlocks` 后走 `splitClauses`；`rowCount>=2` 的 pipe run 另推 table unit。未改 `split.ts`（复用即可） |
| ingest `file_name`=URI basename，页默认 1 | **YES** | `fileNameFromUri("fixture://leave")` → 测定期望 `"leave"`；`DEFAULT_PAGE=1` 写入 `t_clause` / layout unit / payload。A11 hit `page_start=page_end=1` |
| 写 t_clause 列 + layout unit + 闸门 payload | **YES** | `insertClause` 带 `file_name/page_*`；条款/表均 `insertLayoutUnit`。vector upsert 含非空 `unit_id`/`chunk_kind`/`file_name`、`page_start≥1`。表 payload **无** `clause_id` 键。Memory/Qdrant upsert 仍走 Task 3 `assertVectorPayload`；本套件 ingest 10/10 绿，闸门未拒 |
| 表 `clause_id` 为空 | **YES** | `upsertTableLayout` `clause_id: null`；单测 `tables[0].clause_id` toBeNull |
| 父 `PARENT_OF` 子 | **YES** | `linkParentOf`：`from=parent, to=child`。单测 `8.5 → 8.5.1` |
| caption 然后 cell_ref `SUPPORTS`；禁止 proximity | **YES** | `linkTableSupports` 只 caption + `extractClauseRefs(body)`；注释写明 nearest-clause 禁止。GFM 单元格 1.1/2.1 → 1 table + 2 SUPPORTS，`tablesUnlinked=0` |
| unlinked 表 0 SUPPORTS、计入 `tablesUnlinked` | **YES** | 无条款号表：`tablesUnlinked=1`，`queryPath(unit, "SUPPORTS")` 长度 0。无 `proximity` 字符串 |
| 正文「第99.9条」无该条 → 0 CITES（无幽灵节点） | **YES** | `linkCites` 只连已入库 effective 条款；`queryPath(1.1, "CITES")` 长度 0；无 `*:99.9` 条款行 |
| 不写公路 seed | **YES** | diff 无公路/水利/房建预置文案 |
| A11–A14 仍绿 | **YES** | 审查方复跑 `npx vitest run packages/core-engine/test/standard-rag.test.ts` → exit 0；Test Files 1 passed；Tests **10 passed**（vitest 3.2.7，349ms）。含既有 A11–A14/A9/A15/A16 + 3 条 layout ingest |
| 公开方法有「为什么」注释；函数体 ≤80 行 | **YES** | 见 Quality。最长新增体：`upsertClauseLayout` ~45 行、`upsertTableLayout` ~41 行、`ingest` ~31 行、`splitLayoutUnits` ~27 行 |
| `index.ts` 导出不因此 FAIL | **YES** | 多导出 `splitLayoutUnits` / `extractClauseRefs` / `clauseNoFromTableCaption`。brief 允许记 nit |
| parent SHA = BASE_SHA | **YES** | `f594629` 的 parent 即 `7da6130`。4 文件：`layout-split.ts`（新）、`library.ts`、`index.ts`、`standard-rag.test.ts`。plan Files 中的 `split.ts` 未改（复用） |
| component：跳过 test-cases.md | **YES** | 未查 `designs/v0` |

无 Missing / Extra / Misunderstood（相对本 Task brief / plan Task 5）。`searchSemantic` 仍 `getClause`（丢表）属 Task 6，report 已披露，本切片未抢做。无 `listLayoutEdges`：SUPPORTS 用 `queryPath(kind=SUPPORTS)`，与 Verify 一致。

## Quality

**公开 export 注释抽检：Approved**

对照 diff，新增/签名变更的公开面均有「为什么」，不是 `// set x`：

- `splitLayoutUnits`：不得拍平竖线，否则 cell_ref SUPPORTS 失去表格网格。
- `extractClauseRefs`：给 SUPPORTS/CITES 抽号；调用方必须丢掉未入库引用（禁幽灵节点）。
- `clauseNoFromTableCaption`：`表 8.5.1-1` 的 `-N` 是表序号不是条款号。
- `ingest`：JSON 夹具无 PDF，provenance 只能是 URI basename + 页 1；GFM 表仍要进 layout unit 才能打 SUPPORTS。
- `toHit`：缺 file/page/unit 则 citation UI 无法展示可信源；表命中留给 Task 6。
- `linkTableSupports`：只 caption → cell_ref；最近邻条款是 proximity，禁止。
- `linkParentOf`：必须父→子，反了会破坏层级浏览。
- `linkCites`：`第99.9条` 无行不得 CREATE Clause 节点。
- `tablesUnlinked` / `containerClauseNo`：零 SUPPORTS 不得靠 proximity 补齐；容器条款按 span 包含，不是 nearest-neighbor。

TS 方法均有明确 return type；命名 camelCase / PascalCase 符合 `.apt/code-standards.md`。

**白名单 / 密钥：** 本 commit 未含 `.ai/`、`.env`、token。未改 9 页、未读 `rules/`、未写公路 seed。`index.ts` barrel 出白名单，brief 定为 nit。

**微闭环（工作区，未进本 commit）：** report 写实现当时应已 register/refresh；`.ai/` 未进 commit；`audit_arch_changes` 未调用。审查时 `project-0-doc-engine-agent-protocol-mcp` 不可用（namespace error），未能复查 `query_contract` `StandardLibrary` / `query_arch`。不影响源码验收。

**测试用例：** component → 跳过 `test-cases.md`。单测用 MemoryGraphStore / MemoryVectorStore。覆盖：GFM 两 SUPPORTS 且表体含 `\|`、表 `clause_id` null；幽灵「第99.9条」0 CITES；父 PARENT_OF 子；unlinked 表 `tablesUnlinked=1` 且 0 SUPPORTS。A11 invented hit 补齐 provenance 字段后仍拒。不是 tautology。

## Issues

**blocking：** 无（0）

**nit：**

- `index.ts` 导出 `splitLayoutUnits` 等（plan Files 外 barrel）。brief 明确不因此 FAIL。本切片测试经 `ingest`/`queryPath` 验收，并未直接 import 这些导出。
- caption SUPPORTS 代码路径在，GFM 夹具无「表 1.1」表题，只锁了 cell_ref 两条 SUPPORTS。
- `PARENT_OF` / `BELONGS_TO` / `CITES` 的 `link_method` 写 `"manual"`（自动边）。SUPPORTS 正确用 `caption`/`cell_ref`。不阻断。
- 无 `listLayoutEdges`（report 已披露）；测试读图 `queryPath`。
- `searchSemantic` 仍 `getClause`，表点本切片可入库但检索仍丢（Task 6）。
- `.ai/` 契约/资产更新未进本 commit；审查时 APT MCP 不可用，未能复查 refresh。
- `getPorts()` 沿用 BASE，无新增「为什么」注释（测试用它读 SUPPORTS，可接受）。

## Assessment

**PASS**

Spec ✅（`splitLayoutUnits` 保留 `\|` 且不 flatten；ingest 页 1 + URI basename + 闸门 payload；表无 `clause_id`；父 PARENT_OF 子；caption/cell_ref SUPPORTS、unlinked 0 SUPPORTS 非 proximity；第99.9条 0 CITES）。Quality Approved（公开方法有「为什么」注释；函数体均远小于 80）。Verify 复跑 10 passed，A11–A14 仍绿。`index.ts` 导出按 brief 记 nit，不 FAIL。无 blocking issues。
