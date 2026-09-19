# Task 1 Review — 未配置 LLM 不回显系统提示

review-tier: full
Plan: `docs/apt/plans/2026-09-17-b1-standard-lib-stepchat-fix-plan.md` Task 1
Brief: `.apt/orchestration/task-1-brief.md` / `.apt/orchestration/task-1-review-brief.md`
Report: `.apt/orchestration/task-1-report.md`
HEAD: `c01b4e2717a906c8e98f17245ec79d03fd871ca5`（= BASE_SHA；未 commit）
Status (implementer): `DONE_WITH_CONCERNS`
Verify（主 Agent，审查方未重跑）: vitest 4 files / 36 passed；`tsc --noEmit` exit 0

对照工作区 vs HEAD：`index.ts` modified；`provider.ts` / `config.ts` / `unconfigured-llm.test.ts` / `zhipu-provider.test.ts` 相对 git 为未跟踪（llm 模块原先未入 HEAD）。未改 Vue / core-engine / `page.logic.md`。

### Spec Compliance
- ✅ Spec compliant

相对 plan 验收 1 与 Task 1 brief：**无 Missing / Extra / Misunderstood**。

| 检查项 | 结果 | 证据 |
|--------|------|------|
| 缺配置 `complete()` 中文未配置 | **YES** | `UNCONFIGURED_LLM_MESSAGE` 含「尚未配置大语言模型」；`UnconfiguredLlmProvider.complete` 固定返回该文案、忽略 prompt |
| 不得含 `[fake-llm` | **YES** | 未配置路径不再走 `FakeLlmProvider` echo；单测 `not.toContain("[fake-llm")` |
| 不得回显「禁止：确认提案」 | **YES** | complete 不拼接 `options.prompt`；单测 `not.toContain("禁止：确认提案")` |
| 显式 `FakeLlmProvider` / `provider:"fake"` 仍 echo | **YES** | `new FakeLlmProvider()` 单测仍含 `[fake-llm:unit]` + 原文；`zhipu-provider.test.ts` `createLlmProvider({provider:"fake",…})` 仍为 `FakeLlmProvider` |
| 未配置路径与 Fake 分离 | **YES** | `createLlmProvider(null)` / `load` 失败 → `UnconfiguredLlmProvider`；文件内 `provider:"fake"` 被 load 成 null（用户路径不 echo）；显式 config 仍 Fake |
| 用户助手入口会 init | **YES** | 白名单外只读：`AgentRuntimeFactory` 非 `forceFakeLlm` 与 `createControlPlane` 均调 `initDefaultLlmProvider` |
| 白名单 | **YES** | 业务改动仅 brief 五文件；未改 Vue / core-engine / `designs/v0` |
| 新增 export 注释（为什么） | **YES** | 见 Strengths |
| 新增类型 `register_contract` | **YES** | report：`UnconfiguredLlmProvider`；MCP `query_contract` 已命中 |
| gap-fix / scheduler 显式 Fake | **YES** | 主 Agent 36/36 含这两文件；实现仍 `new FakeLlmProvider()` |

### Strengths
- TDD 路径清楚：RED 时缺配置仍 `[fake-llm:fake]` 回显 HITL 原文；GREEN 拆出 `UnconfiguredLlmProvider`，测试用 Fake 未误伤。
- 最小实现：`createLlmProvider` / `initDefaultLlmProvider` 缺配置走哨兵；`FakeLlmProvider` 保留确定性 echo。
- 新公开面注释说为什么（HITL 泄漏 / 与 Fake 分离），不是复述代码：`UNCONFIGURED_LLM_MESSAGE`、`UnconfiguredLlmProvider`、`createLlmProvider`、`initDefaultLlmProvider`、`index.ts` barrel。
- `unconfigured-llm.test.ts` 用空临时根 + 清 `AGENT_RUNTIME_LLM_CONFIG`，避免本机已有 `llm.json` 造成假绿；`afterEach` 恢复 default provider 与 env。
- 未越权实现 F-1、未改产品 logic。

### Issues
#### Critical (Must Fix)
- 无。

#### Important (Should Fix)
- `refresh_asset` 把 `provider.ts` / `index.ts` 等登记到 `frontend/packages/util`（`query_arch` 可见 `UnconfiguredLlmProvider` / `FakeLlmProvider` / `index`），既有 `frontend/agent-runtime/util` 文档路径仍 Path not found。批次禁止手工改 `.ai/`；留给最终 closeout 再扫，不阻断本 Task 源码验收。

#### Minor (Nice to Have)
- 模块级 `defaultProvider` 仍默认 `new FakeLlmProvider()`。未调用 `initDefaultLlmProvider` 的直连 `getDefaultLlmProvider()` / `LLMExecutor` 构造仍会 echo；生产 StepChat 经 factory/`createControlPlane` 会 init，report 已披露。
- 既有 `getDefaultLlmProvider` / `setDefaultLlmProvider` 无「为什么」注释；本次随 barrel 出现在 `index.ts` 公开面，但非本任务新写签名。
- 未配置单测用 `/未配置/` 而非断言 `UNCONFIGURED_LLM_MESSAGE` 全文；未覆盖 placeholder key / 非法 JSON（`loadLlmRuntimeConfig` 已返回 null，行为与缺文件相同）。
- `index.ts` 一并导出 `ZhipuLlmProvider` / `loadLlmRuntimeConfig` 等（brief：仅当需导出新类型）。相对 HEAD 整个 LLM barrel 为新增；core-engine 已从 `agent-runtime` 包进口，属合理公开面，非 spec 膨胀。

### Assessment
**Task quality:** Approved
**Reasoning:** 缺配置用户路径已与 Fake 分离，中文未配置、不回显 HITL、显式 Fake 仍 echo，白名单与新 export 注释均满足。`refresh_asset` 错挂 `frontend/packages/util` 记 Important，按批次规则留 closeout，不改本片结论。
