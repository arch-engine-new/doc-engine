# Task 3 Review — memory demo 未配置不走 FakeLlm 回显

review-tier: full
Plan: `docs/apt/plans/2026-09-17-b1-standard-lib-stepchat-fix-plan.md` Task 3
Brief: `.apt/orchestration/task-3-brief.md` / `.apt/orchestration/task-3-review-brief.md`
Report: `.apt/orchestration/task-3-report.md`
HEAD: `c01b4e2717a906c8e98f17245ec79d03fd871ca5`（= BASE_SHA；未 commit）
Status (implementer): `DONE_WITH_CONCERNS`
Verify（主 Agent，审查方未重跑）: vitest 5 files / 42 passed；`tsc --noEmit` exit 0
projectType: component（跳过 B2 `test-cases.md`）

对照工作区 vs HEAD：`session.ts` / `http-adapter.test.ts` modified；`agent-runtime-factory.ts` / `standard-lib-stepchat.test.ts` 相对 git 未跟踪。未改 `designs/v0/**` / `page.logic.md` / Task 1 `provider.ts` / Task 2 retrieve 解绑逻辑。

### Spec Compliance
- ✅ Spec compliant

相对 plan Task 3 与 brief：**无 Missing / Extra（白名单外）/ Misunderstood**。

| 检查项 | 结果 | 证据 |
|--------|------|------|
| memory 无 llm.json 时 POST `/api/chat` 不得含 `[fake-llm` | **YES** | `getAgentRuntimeFactory` 不再 `forceFakeLlm: this.mode === "memory"`；http-adapter 与 stepchat 新测均 `not.toContain("[fake-llm")` |
| 须含中文未配置（`/未配置/`） | **YES** | 用户路径 `initDefaultLlmProvider(projectRoot)` → `UnconfiguredLlmProvider`；两处新测 `toMatch(/未配置/)`。`UNCONFIGURED_LLM_MESSAGE` 含「尚未配置大语言模型」 |
| retrieve 或任意步 | **YES** | http-adapter：`step: "checking"`（任意步）；`standard-lib-stepchat`：`step: "retrieve"` + `pack_id`，走 `handleDemoRequest` |
| Vite/memory **用户路径**不把 Fake 当默认 | **YES** | `openFromEnv()` / `new DemoHttpSession()` 均不传 `forceFakeLlm`；memory 只传 `storePath: ":memory:"`。全仓已无 `forceFakeLlm: this.mode` |
| 测试显式 `forceFakeLlm` / Fake 仍 echo | **YES** | `StepChatBridge.create({ forceFakeLlm: true })` 仍 `toContain("[fake-llm")`；`agent-connect` / `agent-native-graph` / `job-step-orchestrator` 仍显式注入 |
| 既有 http-adapter `/api/chat` 非空断言仍过 | **YES** | 原用例只断言 `assistant_reply.length > 0` 且不改 job.status；未配置文案非空。主 Agent 42/42 |
| 白名单 | **YES** | 业务改动恰 brief 四路径 + report；未改 Vue / `designs/v0` / Task 1 provider / Task 2 context |
| 新增/签名变更公开方法「为什么」注释 | **YES** | 见 Strengths；抽检通过 |
| 新类型 `register_contract` | **YES** | 无新对外 TS 类型；沿用 Task 1 `UnconfiguredLlmProvider` / `FakeLlmProvider`（MCP `query_contract` 已命中） |
| 未回退 Task 1/2 | **YES** | Unconfigured 哨兵与 pack 级 retrieve 上下文未改；stepchat 既有 fixture/findings 断言仍在 |
| component：不查 test-cases.md | **YES** | 未查 |

**Missing：** 无。brief 的 RED（无 llm.json 的 `/api/chat`）、用户路径走 `initDefaultLlmProvider`、`forceFakeLlm` 仅测试显式传入，均有对应实现与测试。

**Extra（白名单外）：** 无。白名单内两处顺手、不构成 spec Extra：① 构造器 `options.pipeline` 改为可选，以便 `new DemoHttpSession({ projectRoot })` 仍走 `openStandardLibrary`；② memory 会话显式 `storePath: ":memory:"`（原先靠 `forceFakeLlm` 间接得到内存库）。二者都是去掉 force-fake 后的必要配套。

**Misunderstood：** 无。未把「测试替身」砍掉；未把 Vite 用户路径继续绑 Fake；未改 F-1 / page.logic。

### Strengths
- TDD 路径清楚：RED 时 memory `DemoHttpSession` 的 `/api/chat` 为 `[fake-llm:fake]` 回显 HITL 系统提示；GREEN 拆开「用户会话 initDefault」与「测试 `forceFakeLlm`」。
- 最小切口：只停掉 session 对 memory 的强制 Fake；factory 本就 `forceFakeLlm` 才 `new FakeLlmProvider()`，否则 `initDefaultLlmProvider`。`createControlPlane` 可能按 cwd/`APT_PROJECT_ROOT` 再 init，bootstrap 在其后用 `projectRoot` 复写，chat `startRun` 取 `getDefaultLlmProvider()`，与新测绿相符。
- 测试隔离：http-adapter `beforeEach` 与 stepchat 新测用空临时根 + 清 `AGENT_RUNTIME_LLM_CONFIG`，避免本机已有 `llm.json` 假绿或打到 live 模型。report 已披露 Vite 仍 `resolveRepoRoot()`。
- 本 Task 签名变更的公开面有为什么：`getAgentRuntimeFactory`（memory 不得 force Fake，缺配置要 Unconfigured）；构造器补充 `projectRoot`（隔离 checkout llm.json）；`AgentRuntimeFactoryOptions.forceFakeLlm`（测试显式 echo，用户路径省略）。
- 未越权实现 F-1、未改产品 logic、未 commit。

### Issues
#### Critical (Must Fix)
- 无。

#### Important (Should Fix)
- `refresh_asset` 后 `query_arch` `frontend/core-engine/util#AgentRuntimeFactory` / `DemoHttpSession` 仍是「javadoc 与方法签名暂缺 / 暂无」。批次禁止 `audit_arch_changes` / 手工改 `.ai/`；与 Task 1/2 同类记账，不阻断本 Task 源码验收。

#### Minor (Nice to Have)
- `AgentRuntimeFactory.getOrCreate` 无独立 why 注释（WeakMap 按 pipeline 缓存、忽略后续 `forceFakeLlm`）。类注释 + `forceFakeLlm` 字段注释已覆盖本片不变量；`getStepChatBridge` / `getJobStepOrchestrator` 为懒 getter，标准不要求条条注释。
- `http-adapter` 的 `afterEach` 恢复 env / 临时根，不恢复 `defaultProvider`。本套件后续文件均显式 `forceFakeLlm`，42/42 未碎；`document-gaps` / `ingest-pdf` 仍 `new DemoHttpSession()`（无 tempRoot），缺配置走 Unconfigured、有 checkout llm.json 则可能 init 真模型（白名单外）。
- `health()` 的 `probeLlmHealth()` 不传 `session.projectRoot`，可能按仓库根 init 并改进程默认 provider。Vite 用户路径 factory 与 probe 都落 `resolveRepoRoot()`，无 llm.json 时 probe 为 skip 且不 init，与 Unconfigured 一致；仅测试隔离有窗口。
- 构造器注释仍写「Tests construct this with no args」；http-adapter 现传 `{ projectRoot }`。`options?.pipeline` 为假时忽略传入的 `mode: "live"`（无现成调用方）。
- 未配置断言用 `/未配置/` 而非 `UNCONFIGURED_LLM_MESSAGE` 全文；http-adapter 新测与既有「chat 不改 status」几乎同 payload，可合并。
- 未在浏览器点过 Vite 本步对话（implementer 未声称）；HTTP 单测覆盖 memory session，与 brief 一致。

### Assessment
**Task quality:** Approved
**Reasoning:** memory/Vite 用户会话已不再 `forceFakeLlm`；无有效 llm.json 时 `/api/chat`（checking 与 retrieve）返回中文未配置、不含 `[fake-llm`；测试显式 Fake 仍 echo。白名单、公开注释抽检、契约（无新类型）与 Task 1/2 未回退均满足。arch 文档仍是 refresh 占位，按批次规则留 closeout，不改本片源码结论。
