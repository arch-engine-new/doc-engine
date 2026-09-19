# Task F-1-2 Review — 本步对话引用正文

review-tier: full
projectType: component（跳过 B2 `designs/v0/*/test-cases.md`；非页面 Task，跳过数据防御抽检）
Plan: `docs/apt/plans/2026-09-19-standard-lib-hit-detail-plan.md` Task 2
Spec: `docs/superpowers/specs/2026-09-19-standard-lib-hit-detail-design.md`（Rn：R4 / R8）
Brief: `.apt/orchestration/task-f1-2-brief.md` / `.apt/orchestration/task-f1-2-review-brief.md`
Report: `.apt/orchestration/task-f1-2-report.md`（以 commit 内版本为准）
HEAD: `2cb107f399d7f9e3125b679043979c7bd35028ba`
Parent / BASE_SHA: `45a2a731ad99e0cf8421b2f512cff42e972c8127`
Status (implementer): `DONE_WITH_CONCERNS`
Verify（implementer 已报；审查方未重跑）: TDD RED `Test Files  1 failed (1)` / `Tests  5 failed | 6 passed (11)` → GREEN `Test Files  1 passed (1)` / `Tests  11 passed (11)`

审查范围：只审 `git show 2cb107f`。工作区其它未提交文件不计入本 Task。审查方只读：未改代码、未 commit、未重跑 vitest。

MCP（审查方只读复查）：`query_contract JobContextSnapshot` 仍为 `retrieve_hits_summary?: string`（heading/body 进该字符串，未另立 snapshot 字段）；同文件可见 `formatRetrieveHitsForPrompt` 已拼 `heading=` / `body=`，空列表「未命中」，`promptBody` 800 + `…`。`query_contract DemoHttpAdapter` 的 `parseRetrieveHits` 对 string `heading`/`body` 透传（含空串）。`query_arch frontend/core-engine/util#formatretrievehitsforprompt` 仍为 2026-09-17 摘要（未写 heading/body）。`query_arch frontend/packages/util#context` 与 `#handle-request` 为本次 `refresh_asset` 新建条目（Updated `2026-09-19T06:04Z` / `06:05Z`），未覆盖既有 `frontend/core-engine` 条目。

### Spec Compliance
- ✅ Spec compliant

相对 plan Task 2、brief（prompt 含 heading+body；800 截断；parse 透传；空列表「未命中」；不改 StepChat.vue）与 R4/R8：**无 Missing / Extra（白名单外）/ Misunderstood**。

| 检查项 | 结果 | 证据 |
|--------|------|------|
| T3 / R4：`formatRetrieveHitsForPrompt([hit])` 含 heading 与 body 片段，不只 `clause_id=` | **YES** | 行内 `heading=` / `body=`；单测 `toContain("1.1 事假须提前申请")` / `toContain("须在休假前")`，且不等于仅 id 的旧行 |
| T6：空 hits 仍「未命中」 | **YES** | `hits.length === 0` → `"未命中"`；RED 时该用例已绿（既有行为） |
| T4：`parseRetrieveHits` 往返保留 heading/body | **YES** | 未导出，走 `POST /api/chat`；FakeLlm echo 含 SAMPLE_HIT heading/body。`optionalHitText`：string（含空串）透传，非 string 不编造 |
| R8：单条 body 最多 800 字符，超出加 `…` | **YES** | `PROMPT_BODY_MAX = 800`；`body.slice(0, 800)}…`；单测 2000 字含 `…`、含前 800、不含全文、行长短于原文 |
| 空 heading/body →「无标题」/「无正文」 | **YES** | `promptHeading` / `promptBody`；单测空串。未用 LLM 补全文 |
| 截断只用于 prompt，不标成「全文」 | **YES** | `promptBody` 注释写明详情仍展示账本全文（Task 3）；格式化行无「全文」字样 |
| 不改 StepChat.vue、不改检索算法 | **YES** | commit 四文件无 Vue / `prequery` / `rerank` / `searchExact|Semantic|Graph` |
| 白名单 / 单 commit / 未 push | **YES** | `context.ts` / `handle-request.ts` / `standard-lib-stepchat.test.ts` / `task-f1-2-report.md`。subject=`feat(retrieve): include hit heading and body in step-chat prompt`。未改其它 8 页、goal.md |
| 先红后绿 | **YES** | RED：5 条新断言打在「只有 clause_id/unit_id/file_name」上（空列表已绿）。GREEN：11/11 |
| `register_contract JobContextSnapshot` | **YES（按 brief 跳过）** | 导出形状未加新 snapshot 字段；heading/body 写入既有 `retrieve_hits_summary` 字符串。MCP 已能查到该可选字段 |
| 公开 export 注释（为什么） | **YES** | 见 Quality |
| component：不查 test-cases.md | **YES** | 未查 |
| 非页面：跳过数据防御 | **YES** | 未抽检 |

**Missing：** 无。R2 详情 UI / R3 表头五列属 Task 3，未误当作本片缺口。

**Extra（白名单外）：** 无。相对 git parent `45a2a73` 的 `context.ts` / `handle-request.ts` **尚无** B-1 retrieve 对话栈（无 `formatRetrieveHitsForPrompt`、无 `parseRetrieveHits`、`/api/chat` 仍 `requireStr trace_id`）。本 commit 把工作区未入库的 pack 级 snapshot / parse / pack_id 聊天路径与 F-1 heading/body **一并提交**——均在白名单文件内，且为本片 HTTP 往返所必需，不构成 spec Extra。

**Misunderstood：** 无。水合仍在 Task 1 的 `toHit`/`toUnitHit`；本片只补 prompt 拼装与 HTTP 透传。未改 StepChat、未新开详情 HTTP、未把截断当详情全文。

### Strengths
- 最小行为点锁在两处：`formatRetrieveHitsForPrompt` 拼 heading+截断 body；`parseRetrieveHits` 只对 string 透传。空值走「无标题」/「无正文」，不编造。
- TDD 证据同构：RED 失败信息就是旧行只有 `clause_id=` / 无 `…` / FakeLlm 仍无 heading；GREEN 后同一断言对照夹具原文与 800 截断。
- 截断不变量写在「为什么」注释：`promptBody` 明确 prompt-only，详情全文留给 Task 3。
- HTTP 路径用 FakeLlm echo 证明 Vue POST 的 hits 进了 prompt，而不是只 grep 类型字段（T4）。
- 诚实披露 `DONE_WITH_CONCERNS`：`refresh_asset` 错挂路径写进 report，未隐瞒、未手工改 `.ai/`（brief 禁止 `audit_arch_changes`）。

### Issues
#### Critical (Must Fix)
- 无。

#### Important (Should Fix)
- `refresh_asset` 新建 `frontend/packages/util/context` 与 `frontend/packages/util/handle-request`（`query_arch` 可见，摘要仍是「context 工具 / HTTP 请求处理」，未写 heading/body 拼装），未覆盖既有 `frontend/core-engine/util#formatretrievehitsforprompt`（Updated 仍为 2026-09-17，「javadoc 暂无」）与 `frontend/core-engine/util#handle-request`。批次禁止 `audit_arch_changes` / 手工改 `.ai/`；留给 PB-5 `finish_feature` closeout，**不阻断本 Task 源码验收**（与 Task 1 同口径，非 Critical）。

#### Minor (Nice to Have)
- git parent 无 retrieve 对话栈，commit 体积含 B-1 既有用例（`shouldSearchClause` / pack 不绑 `listJobs()[0]` / 无 llm.json 回「未配置」）。与 R4/R8 正交，但使本片 diff 大于「只改两行格式化」。
- B-1「retrieve chat uses pack_id」仍只断言 `clause_id`/`unit_id`/`file_name`；heading/body 由本片新用例覆盖，旧桥接用例未升级。
- `formatJobContextForPrompt` 新增 retrieve 分支但无 why 注释；行为已由 `formatRetrieveHitsForPrompt` / `buildJobContext` 注释覆盖。
- 超长 body 断言的是整行 `text.length < 2000` 且含前 800 + `…`，未单独量 `body=` 段恰好 800。实现是 `slice(0, 800)}…`，足够。
- `parseRetrieveHits` 为 private、无独立导出单测（brief 允许 HTTP 往返）。`heading: null` 变成 `undefined` 而非 `null`；prompt 侧二者都映射「无标题」。
- commit 内 report 的 Commits 行无完整 SHA。同一 commit 带 report 可理解。

### Quality
**公开 export 注释抽检：PASS（Approved）**

本片新增/签名变更的公开面：

- `formatRetrieveHitsForPrompt`：为何空列表是明确未命中；为何每行含 heading + 截断 body（对话要引用账本，不是只报 id）。返回类型 `string`。函数体约 11 行（≤80）。
- `promptBody`（内部）：截断只用于 prompt，详情仍展示账本全文。
- `optionalHitText`（内部）：Vue POST 的 string 必须透传，丢掉会只剩 id。
- `packChatTraceId` / `BuildJobContextOptions` / `JobContextSnapshot.retrieve_hits_summary` / `buildJobContext`：随未入库的 retrieve 栈一并提交，均有「为什么」注释；`buildJobContext` 有 `Promise<JobContextSnapshot>`。

测试验的是格式化文本与 FakeLlm prompt 是否含夹具 heading/body（及 800 截断），不是只 grep 字段名。错误处理：空串→「无标题」/「无正文」，非 string 不透传、不编造。

**白名单 / 密钥：** commit 仅四文件。未含 `.ai/`、`.env`、token。未 push。未改 `StepChat.vue`。

### Assessment
**Approved**

**Reasoning:** 本步对话 prompt 已含命中 heading + body 片段（R4）；单条 body 800 截断并加 `…`（R8）；`parseRetrieveHits` 透传 string heading/body；空列表仍「未命中」。TDD RED/GREEN、白名单四文件、公开方法「为什么」注释与「形状未变则不 register_contract」合格。未改 StepChat 与检索算法。`refresh_asset` 错挂 `frontend/packages/util` 记 Important，按批次规则留 PB-5，不改本片结论。无 Critical。放行 Task 3。
