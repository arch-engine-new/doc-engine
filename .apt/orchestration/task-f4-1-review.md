# Task F4-1 Review — HttpReranker 红灯测试（T1–T4/T6/T8）

review-tier: full
projectType: component（跳过 B2 `designs/v0/*/test-cases.md` 门禁；非页面 Task，跳过数据防御抽检；本片无新公开 export，公开方法注释抽检记 N/A）
Plan: `docs/apt/plans/2026-09-19-live-http-rerank-plan.md` Task 1
Spec: `docs/superpowers/specs/2026-09-19-live-http-rerank-design.md`（Rn：R2/R4/R8；T1–T4/T6/T8）
Brief: `.apt/orchestration/task-f4-1-brief.md` / `.apt/orchestration/task-f4-1-review-brief.md`
Report: `.apt/orchestration/task-f4-1-report.md`
BASE_SHA: `70cb09612fdae3b82b9406050fa30372287d9b2f`
HEAD: `8c8ea79e5fb150ef7ba555be71006049816c2860`（subject: `test: add failing HttpReranker cases for F-4`；parent = BASE_SHA）
Status (implementer): `DONE`
Verify（implementer 已报；审查方未重跑）：**expected FAIL** `Test Files  1 failed (1)` / `Tests  no tests`，cwd `packages/core-engine`。失败因 `Cannot find module '../src/retrieve/http-rerank.js'`（`HttpReranker` 尚未存在），不是断言绿后回退。

审查范围：只审 `git diff 70cb096..8c8ea79`。工作区其它未提交文件（含 report）不计入本 Task。审查方只读：未改代码、未 commit、未重跑 vitest。gstack review 不可用，已跳过。

MCP（审查方只读复查）：
- `query_contract Reranker` missing（plan 预期；接口在 `RetrievePorts` / `ports.ts`，禁止 `report_missing` 停工）。
- `query_contract RetrievePorts` 命中 `packages/core-engine/src/retrieve/ports.ts`，含 `interface Reranker { rerank(query, candidates): Promise<string[]> | string[] }`。
- `query_contract IndependentReranker` 命中 `rerank.ts`（余弦 + `lexicalScore`；`void options?.llm`）。
- `query_contract HttpReranker` missing（本 Task 禁止实现/登记）。
- `search_arch` `Reranker interface RetrievePorts rerank` 落到 `IndependentReranker` / `rerank.ts`，无 HttpReranker 资产。

### Spec Compliance
- ✅ Spec compliant

相对 plan Task 1、brief（只写失败测试；禁止实现 HttpReranker / 改 live-ports；T1–T4/T6/T8；mock fetch；夹具仅 `test-key`；白名单仅测试文件；Verify 预期 FAIL）与编码规范：**无 Missing / Extra（白名单外）/ Misunderstood**。未把测试做绿。

| 检查项 | 结果 | 证据 |
|--------|------|------|
| 只写失败测试，**未实现** `HttpReranker` | **YES** | diff 仅 `packages/core-engine/test/http-rerank.test.ts`（+180）。`8c8ea79` 无 `http-rerank.ts`。`git grep HttpReranker 8c8ea79` 仅该测试文件 |
| 未改 live-ports / index / IndependentReranker 让测试变绿 | **YES** | HEAD `live-ports.ts` 仍 `rerank: new IndependentReranker({ embed })`。`index.ts` / `rerank.ts` 无 diff |
| Verify 预期 FAIL（缺模块，非绿灯） | **YES** | report：文件级 FAIL，`Tests  no tests`，根因 import `../src/retrieve/http-rerank.js`。审查方确认该 path 在 HEAD 不存在。**若本片实现了类让用例绿 → Critical；未发生** |
| T1：默认 POST `compatible-api/v1/reranks`，`model=qwen3-rerank`，`documents` = 候选 text；URL 不含 `compatible-mode` / `chat/completions`、不以 `/embeddings` 结尾 | **YES** | 钉死 `https://dashscope.aliyuncs.com/compatible-api/v1/reranks`；`POST`；body.model / query / documents；`top_n` undefined；注入 mock `fetch`，不打网 |
| T2：mock `results` 按 `relevance_score` 降序，ids 以 index=1 的 `clause_id` 开头 | **YES** | `{index:1, 0.9}` / `{index:0, 0.1}` → `["clause-b","clause-a"]` |
| T3：空 env 构造 throw `/RERANK_API_KEY\|DASHSCOPE_API_KEY/`，消息不含 `test-key` | **YES** | `new HttpReranker({ env: {} })`；regex + `not.toContain(TEST_KEY)`。夹具常量只有 `"test-key"` |
| T4：HTTP 500 → `/Rerank HTTP 500/`；非空候选 + 空 `results` throw；不得回退 IndependentReranker | **YES** | 500 `rejects.toThrow(/Rerank HTTP 500/)`；`results: []` `toThrow()`；`not.toBeInstanceOf(IndependentReranker)` + 读 `http-rerank.ts` 禁止出现该标识符 |
| T6：`env.RERANK_URL` 为 `https://rerank.test.invalid/v1/reranks` 时 POST 该 URL，JSON 仍为 `{ model, query, documents }` | **YES** | keys 精确三字段；`.invalid` TLD，即使 mock 失效也不走生产网 |
| T8：空候选 `[]` 且 fetch 次数 = 0；`IndependentReranker` / `defaultRetrievePorts()` 仍可用 | **YES** | 空候选 `resolves.toEqual([])` + `not.toHaveBeenCalled`；第二 describe 构造 `defaultRetrievePorts().rerank instanceof IndependentReranker` 并跑一次余弦 rerank |
| mock fetch；禁止真实 HTTP / 真实密钥 | **YES** | 全部 HttpReranker 用例注入 `vi.fn` fetch。无 `sk-`、无真实 apiKey。未 `audit_arch_changes` |
| 白名单 / 单 commit | **YES** | 仅测试文件。report 未进 commit。subject=`test: add failing HttpReranker cases for F-4` |
| T5 / T7 / live 装配 / 契约登记 | **YES（刻意不做）** | T5/T7 属 Task 3/4。`ContractsRegistered: 无` 符合 brief |
| component：不查 test-cases.md | **YES** | 未查 |
| 非页面：跳过数据防御 | **YES** | 未抽检 |

**Missing：** 无。plan Task 1 六条覆盖（T1–T4/T6/T8）均有对应用例。T1 额外锁了 Bearer `test-key` 与禁止 `top_n`，与 Task 2 最小实现一致，不是漏项。

**Extra（白名单外）：** 无。commit 只有白名单测试文件。未改 `http-rerank.ts`（尚不存在）、`live-ports.ts`、`index.ts`、`rerank.ts`、Vue、`.ai/`、`.env`。

**Misunderstood：** 无。未提前实现 HttpReranker、未改 live 装配、未打真实百炼、未把 IndependentReranker 当成本片绿灯。红灯是「模块不存在」而非用 stub 混绿。T5 live 实例类型与 T7 A12 正确留给后续 Task。

### Strengths
- 切片锁得住：一条 commit、一个测试文件、生产装配仍是 IndependentReranker + 共用 embed，红灯基线可信。
- T1 用行为钉 URL/body（精确默认 URL + 禁止 `compatible-mode` / `chat/completions` / `/embeddings`），不是只 grep 类名；与 spec S4 一致。
- T6 覆盖 URL 用 `.invalid`，与默认 dashscope 主机隔离；密钥字面量只有 `test-key`，T3 断言 Error 不含该值。
- T8 同时锁 HttpReranker 空候选不发网，以及 CI 端口 `defaultRetrievePorts` / `IndependentReranker` 仍可构造。
- report 诚实写 `Tests no tests`（文件未能 load），并写明未实现、未登记契约、未 `audit_arch_changes`。

### Issues
#### Critical (Must Fix)
- 无。未实现 `HttpReranker`，测试未绿。

#### Important (Should Fix)
- 无。T4 用 `readFileSync` + `/IndependentReranker/` 锁「不得 import/调用」，与 plan 字面一致；若 Task 2 在 JSDoc 里写禁止回退的类名，该断言会误伤——记 Minor，不阻断本片红灯验收。

#### Minor (Nice to Have)
- T4 空 `results` 只用 `toThrow()`，未钉消息；HTTP 500 已有 `/Rerank HTTP 500/`。Task 2 计划也未规定空 results 文案。
- T4 源码整文件 grep `IndependentReranker`：Task 2 若按编码规范写「为什么不能回退 IndependentReranker」注释，GREEN 会被误杀。更稳的是锁 `import` / `from "./rerank`。
- 因顶层 `import { HttpReranker }`，T8 的 IndependentReranker 用例在本 Task 也不会单独跑（整文件 load 失败）。Task 2 落地模块后应变绿；当前符合「HttpReranker 尚未存在 → FAIL」。
- T1 已 `toBe(DEFAULT_RERANK_URL)`，后面的 `toContain` / `endsWith` 是冗余。commit subject 未用 `test(retrieve):` scope（brief 只要求清晰 subject）。

### Quality
**公开方法注释抽检：N/A（本片无新 export / 无签名变更）**

仅新增测试文件。文件头说明为什么：HttpReranker 契约（T1–T4/T6/T8）、只 mock fetch、夹具仅 `test-key`、禁止打 `dashscope.aliyuncs.com`。辅助函数 `jsonResponse` / `identityResults` 有明确返回类型。测试验的是 POST URL/body、分数序、缺密钥 throw、HTTP 失败 throw、空候选不发网，不是只 grep 类名。

**白名单 / 密钥：** commit 仅 `packages/core-engine/test/http-rerank.test.ts`。无 `.env`、无 `sk-`、无真实 apiKey。未 push。未改 `.ai/`。

**APT Micro-closeout vs diff：** `ContractsRegistered: 无` 与 MCP（`HttpReranker` / `Reranker` 名仍未登记）一致。`AssetsRefreshed` / `AssetsRemoved` 无。diff 未改 `.ai/`。禁止 `audit_arch_changes`，未手工改知识库。

### Assessment
**Task quality:** Approved
**Reasoning:** 本片只提交失败测试：T1–T4/T6/T8 覆盖默认 `/reranks` 形、分数序、缺密钥、HTTP 500/空 results、URL 覆盖、空候选不发网，以及 IndependentReranker / `defaultRetrievePorts` 仍可用。HEAD 无 `HttpReranker` 实现、未改 live-ports，vitest 因缺模块 FAIL，符合 TDD 红灯，不是把测试做绿。夹具仅 `test-key`、mock fetch、未越白名单。
