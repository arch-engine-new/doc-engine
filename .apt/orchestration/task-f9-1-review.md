# Task F9-1 Review — expandOneHop 出边一跳

review-tier: **full**
projectType: component（跳过 B2 `designs/v0/*/test-cases.md` 门禁；非页面 Task，跳过数据防御抽检）
Plan: `docs/apt/plans/2026-09-20-standard-lib-expand-one-hop-plan.md` Task 1
Spec: `docs/superpowers/specs/2026-09-20-standard-lib-expand-one-hop-design.md`
Brief: `.apt/orchestration/task-f9-1-brief.md` / `.apt/orchestration/task-f9-1-review-brief.md`
Report: `.apt/orchestration/task-f9-1-report.md`
BASE_SHA: `e2e4b192545e06d31e5af1c375ba910f5639e9e5`
HEAD: `59f206d4249eb1414280c7f524705d947e9efb7f` `feat: expand standard-lib hits one hop along CITES/SUPERSEDES`
Status (implementer): `DONE_WITH_CONCERNS`
Verify（审查方独立重跑）：**PASS** `Test Files  1 passed (1)` / `Tests  20 passed (20)`。Duration 5.20s。exit 0。cwd `packages/core-engine`。

审查范围：full。相对 `BASE_SHA=e2e4b19` 确认 **只改** 白名单两文件；未改 `searchGraph` / `prequery.ts` / `ports.ts` / Vue / `page.logic.md`；未改坏 `seedPack` 共享出边。审查方只读：未改产品代码、未 commit。

## 结论（给主 Agent）

| 项 | 判定 |
|----|------|
| **Spec** | **PASS** |
| **Quality** | **Approved** |
| **测试覆盖** | **PASS** |
| **公开方法注释** | **PASS**（无新 `export` / `public` 签名；private `expandOneHop` 有不变量注释） |
| **Overall** | **PASS** |
| **阻断 Task 2？** | **否**。三条 DONE_WITH_CONCERNS 均不阻断。 |

MCP（审查方只读复查）：
- `query_contract` RetrieveHit / GraphStore → `packages/core-engine/src/retrieve/ports.ts`。形状未改（已有 `retrieve_path` / `path?: GraphEdge[]`；`queryPath(from, kind?)` 出边一跳）。本片未 `register_contract`，与 plan「形状未变则跳过」一致。
- `query_contract` StandardLibrary → `packages/core-engine/src/retrieve/library.ts`。`searchStandard` 仍是唯一入口。
- `query_arch frontend/core-engine/util#standardlibrary` 命中同一源文件。Implementer `refresh_asset` 另 **created** `frontend/packages/util/library`（重复 util 条目）属 PB-5 扫描侧问题，本片 plan 禁止 `audit_arch_changes`。
- 禁止 `audit_arch_changes` / 未手工改 `.ai/`。无新 UI → 未 `query_design`。B2 test-cases 门禁因 `projectType=component` 跳过。

gstack review（对照 `review/checklist.md` 过 Pass 1/2；未派 specialist 子 Agent）：
- SQL / 竞态 / LLM 信任边界 / Shell 注入：N/A
- 枚举：只扩 `CITES` / `SUPERSEDES`，未走 `APPLIES_TO` / `REQUIRES` / `PARENT_OF` / `SUPPORTS`
- Pre-Landing Review: **No issues found.**

### Spec Compliance
- ✅ Spec compliant

相对 plan Task 1、spec A19/R1–R5/R9/R10、review-brief 与编码规范：**无 Missing / Extra / Misunderstood**。

| 检查项 | 结果 | 证据 |
|--------|------|------|
| `git diff e2e4b19..59f206d` 仅白名单 | **YES** | 2 files / +193：`library.ts`、`standard-rag.test.ts`。`--name-only` 仅此二路径。parent = BASE_SHA |
| expandOneHop 只在 exact/semantic 之后 | **YES** | `searchStandard`：`intent===graph` → 只 `searchGraph`；else exact/semantic 后 `hits = await this.expandOneHop(hits, versionIds)` |
| graph intent 不扩 | **YES** | 扩跳不在 graph 分支。origins 再过滤 `vector\|exact`，即使误调也不会拿 graph 行当起点 |
| 出边一跳；不对邻接再 queryPath | **YES** | 仅 `queryPath(originId,"CITES")` + `queryPath(originId,"SUPERSEDES")`。helper 注释写明对 `edge.to` 再查是二跳。A19-one-hop：1.1→1.2→2.1 无 2.1 |
| 去重（先出现的 vector/exact 保留） | **YES** | `seen` 初始为原 hits 的 `clause_id`；A19-dedupe：1.2 仅一行且仍 `vector` |
| 0 条款命中短路 | **YES** | `seen.size===0` 直接 return 原数组。A19-empty：空包「不存在」`hits.length===0` 且无 graph 行 |
| 邻接 `toHit(...,"graph")` + `path=[该边]`；原行路径不变 | **YES** | A19-hit：1.1 `vector` + 1.2 `graph`，`path` 单跳 CITES，heading/body 来自 1.2。A19-exact：首条仍 exact |
| 版本集 = 本次 pack `versionIds`（非 searchGraph 项目级） | **YES** | `expandOneHop(hits, versionIds)` 的 `versionIds` 来自 `resolveEffectiveVersionIds`；邻接 `version_id` 不在则 skip |
| 未改 `searchGraph` / prequery / ports / Vue | **YES** | `searchGraph` 不在 diff。commit 无 `prequery.ts` / `ports.ts` / Vue / `page.logic.md` |
| 未改坏 seedPack 共享出边 | **YES** | `seedPack` 仍 `1.2→1.1 CITES`、`2.1→1.1 SUPERSEDES`。A19 出边均用例内 `addStandardEdge(1.1→1.2)`。A11 `hits.length===1` 仍绿 |
| A19 是行为证据而非 grep 函数名 | **YES** | 测试文件 **零** `expandOneHop` 字面量。五条均 `pipeline.searchStandard(...)` 断言 hits |
| 新增生产 export | **无** | `expandOneHop` / `expandOriginNeighbors` / `neighborHitIfNew` 均为 private |
| APT 微闭环 | **YES** | `ContractsRegistered: none`（形状未变）。`refresh_asset` 已调；重复 util id 留给 PB-5。未 `audit_arch_changes` |

**Missing：** 无。plan Task 1 五条 A19（hit / empty / dedupe / one-hop / exact）均有 `searchStandard` 断言。R10 heading/body 在 A19-hit。FakePrequery 已加「事假」（rewritten=CANON）与「不存在」。

**Extra（白名单外）：** 无。`topClauseRerank` / `reopenWithTopClauseRerank` 仅测试夹具，未改产品 rerank。未改共享 seed。

**Misunderstood：** 无。未把入边（共享 1.2→1.1）当成 A19 邻接；未对 graph 行递归；未改 `searchGraph` 当默认入口；未改 prequery 意图规则。A19-one-hop 用 exact「1.1」构造「仅命中 1.1」，比语义截断更干净，符合 spec T13。

### Strengths
- 切片锁得住：相对 `e2e4b19..59f206d` 只 +193 行，白名单两文件，parent 即 BASE_SHA。
- 挂钩位置正确：graph 分支完全不动；exact/semantic 共用 pack `versionIds` 扩一跳。
- 测试是行为证据：全部走 `searchStandard`，不 grep 私有函数名。A19 出边用例自备，共享 seed 1.2→1.1 / 2.1→1.1 未动，A11 `length===1` 仍成立。
- 函数拆分满足 ≤80 行；private `expandOneHop` 注释写清禁止递归 / 只出边 / 0 命中短路。

### Issues
#### Critical (Must Fix)
- 无。

#### Important (Should Fix)
- 无。不阻断 Task 2。

#### Minor (Nice to Have)
- A19-hit 测试内 top-1 rerank：`MemoryVectorStore` `topK=8` 会把包内条款都送进 rerank，不截断则 1.2 先以 vector 出现，无法断言 graph 邻接。产品 rerank 未改。注释已说明原因。Task 2 不必改产品 rerank。
- A19-empty 用空包构造 0 条款命中，未另测「仅 table 命中、`clause_id=null`」短路。实现 `seen.size===0` 已覆盖该路径；origins 也要求非空 `clause_id`。可选补测，非本片 must。
- `refresh_asset` 对 `library.ts` **created** `frontend/packages/util/library`，与既有 `frontend/core-engine/util#standardlibrary` 可能重复。plan 禁止本片 `audit_arch_changes`，留给 PB-5。

### Quality
**公开方法注释抽检：PASS**

本片无新生产 `export` / 无公开方法签名变更，不要求新公共 JSDoc。既有 `searchStandard` 保留「为什么」注释（graph 用项目级版本、exact/semantic 用调用方 pack）。private `expandOneHop` 按 brief 写了不变量：禁止对追加 graph 行递归、不走入边、0 条款/纯表命中不扫图。`expandOriginNeighbors` 说明 `queryPath` 已是出边一跳。不是复述代码 / 空 TODO。

三私有 helper 均有显式 `Promise<RetrieveHit[]>` / `Promise<RetrieveHit | null>` 返回类型。函数体远小于 80 行。

**白名单 / 密钥：** commit 仅上述两文件。无 `.env`、无 `DASHSCOPE_API_KEY`、无 `sk-`。未 push。未手工改 `.ai/`。

**APT Micro-closeout vs diff：** `ContractsRegistered: none` 与未改 `ports.ts` / RetrieveHit / GraphStore 一致。`AssetsRefreshed` 已调；created 新 util 路径不构成本片 FAIL。`AssetsRemoved: none`。

**编码规范：** camelCase / 明确 return type / 函数拆分符合 `.apt/code-standards.md`。非页面，跳过数据防御。component → 跳过 B2 test-cases（T10–T14 核对属 Task 2）。

**Implementer concerns 判定：**
1. 重复 util 资产路径 → PB-5，不阻断 Task 2。
2. 测试 top-1 rerank → 夹具纪律，产品行为未改，不阻断。
3. 未覆盖纯表命中短路 → 实现已短路；plan Task 1 要求的是空数组 T11，不阻断。

### Assessment
**Task quality:** Approved

**Reasoning:** 相对 `e2e4b19..59f206d` 只改白名单 `library.ts` + `standard-rag.test.ts`（+193），未改 `searchGraph` / prequery / ports / Vue，未改坏 seedPack `1.2→1.1` / `2.1→1.1`。`searchStandard` 仅在 exact/semantic 后扩出边一跳；graph intent 不调用；去重保留原 vector/exact；0 条款命中短路。A19 五条均为 `searchStandard` 行为断言（测试中无 `expandOneHop` grep）。审查方重跑 20 passed。公开面无新 export；private 扩跳有「为什么」注释。三条 concerns 不阻断 Task 2。无 Must Fix / Should Fix。
