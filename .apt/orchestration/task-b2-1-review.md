# Task B-2-1 Review — arch.config.json chat 回退

review-tier: full
projectType: component（跳过 B2 `designs/v0/*/test-cases.md`）
Plan: `docs/apt/plans/2026-09-17-b2-arch-config-chat-fallback-plan.md` Task 1
Brief: `.apt/orchestration/task-b2-1-brief.md` / `.apt/orchestration/task-b2-1-review-brief.md`
Report: `.apt/orchestration/task-b2-1-report.md`
HEAD: `c01b4e2717a906c8e98f17245ec79d03fd871ca5`（= BASE_SHA；未 commit）
Status (implementer): `DONE`
Verify（主 Agent，审查方未重跑）: vitest 3 files / 11 passed；`tsc --noEmit` exit 0

对照工作区 vs HEAD：白名单四文件相对 git 均为未跟踪（`packages/agent-runtime/src/llm/` 模块自 B-1 起未入 HEAD）。`git diff` 对已跟踪路径为空；本片相对 BASE 的实质改动即这四份全文。未改 Vue / core-engine / `designs/v0` / `page.logic.md`。工作区另有 B-1 及他片脏文件，不在本 Task `FilesChanged`。

审查方未读取仓库真实 `.ai/arch/arch.config.json` / `.apt/agent-runtime.llm.json` 的密钥字段；下文只引用测试夹具假值 `test-key` / `llm-json-key`。

### Spec Compliance
- ✅ Spec compliant

相对 plan 验收 1–3、优先级条款与 Task 1 brief：**无 Missing / Extra（白名单外）/ Misunderstood**。

| 检查项 | 结果 | 证据 |
|--------|------|------|
| 有效 `llm.json`（或 `AGENT_RUNTIME_LLM_CONFIG`）优先 | **YES** | `loadLlmRuntimeConfig` 先 `parseLlmJsonFile`，命中才返回；否则才 `parseArchChatConfig`。单测「prefers valid llm.json over arch chat」：同根下 arch `glm-5.3-flash` + llm.json `from-llm-json`，loader 取后者 model/key |
| 缺 llm.json 时 arch `chat` 构建 Zhipu，不得 Fake | **YES** | `parseArchChatConfig` 固定 `provider: "zhipu"`；`createLlmProvider(null, tempRoot)` 为 `ZhipuLlmProvider`，`not.toBeInstanceOf(FakeLlmProvider)`。读 `chat.baseUrl` / `chat.model` / `chat.apiKey` 或 `apiKeyEnv` |
| `complete()` 不得 `[fake-llm`；可 mock HTTP | **YES** | stub `fetch` 后正文为模型 content；`not.toContain("[fake-llm")`；请求 URL 为 `{baseUrl}/chat/completions`，body.model=`glm-5.3-flash` |
| `apiKeyEnv` 从 `process.env` 取 | **YES** | 夹具只写 env 名、不写直填 key；`loadLlmRuntimeConfig` 解析出夹具假 key；provider 仍为 Zhipu |
| 两份配置都没有 → `UnconfiguredLlmProvider`（保持 B-1） | **YES** | 空临时根：`Unconfigured`、中文「未配置」、不 echo、不含 `[fake-llm`。`unconfigured-llm.test.ts` 仍覆盖 HITL 原文不回显、显式 Fake 仍 echo |
| 测试用临时目录夹具，禁止读仓库真密钥 | **YES** | `mkdtempSync` + 自写 `.ai/arch/arch.config.json`；假 key 仅 `test-key` / `llm-json-key`。源码无硬编码仓库密钥；不读 `arch.secrets.json` |
| 白名单 | **YES** | 业务改动仅 brief 四文件 + report；未改 Vue / core-engine / `designs/v0` |
| 新增 export 注释（为什么） | **YES** | 无新公开类型。变更的公开函数均有「为什么」注释，见 Strengths |
| 新类型 `register_contract` | **YES** | report：`LlmRuntimeConfig` 形状未变、未新增导出类型。MCP `query_contract`：`LlmRuntimeConfig` / `FakeLlmProvider` / `ZhipuLlmProvider` / `UnconfiguredLlmProvider` 均命中；`loadLlmRuntimeConfig` 为 util 非独立 contract 名 |
| component：不查 test-cases.md | **YES** | 未查 |
| 未 commit；未打印真实 API key | **YES** | report Commits: none；测试与 report 只用夹具假 key |

**Missing：** 无。plan Task 1 五条（非 Fake/非 Unconfigured 的 arch 回退、mock complete、两无仍 Unconfigured、llm.json 优先、apiKeyEnv）均有对应用例。

**Extra（白名单外）：** 无。白名单内顺手：arch 解析透传可选 `timeoutMs`；`resolveProjectRoot` 上行查找同时认 llm.json **或** arch.config.json（无显式 root 时才能落到仓库 chat）。均服务本目标，非 spec 膨胀。

**Misunderstood：** 无。未把 F-1 / Vue 对话接线当成本片；显式 `{provider:"fake"}` 仍 Fake；无效 llm.json（含文件内 `provider:"fake"`）视为未命中后回退 arch，与「**有效** llm.json 优先」一致，未回退 B-1 两无路径。

### Strengths
- TDD 路径清楚：RED 时仅有 arch 夹具仍 Unconfigured / `apiKeyEnv` 为 null；GREEN 拆出 `parseArchChatConfig` + `resolveApiKey`，用户路径走 Zhipu。
- 优先级实现与测试同构：有效 llm.json → arch `chat` → Unconfigured。夹具根隔离，删 `AGENT_RUNTIME_LLM_CONFIG`，避免本机已有 llm.json 假绿。
- 新/变更公开面注释说为什么，不是复述代码：`config.ts` 文件头（llm.json 优先、回退 arch chat、不碰 secrets）；`loadLlmRuntimeConfig`（两源顺序与双无返回 null）；`createLlmProvider`（缺配置 Unconfigured、显式 fake 仍 Fake、其余 Zhipu）；`initDefaultLlmProvider`（装载两源或 Unconfigured、禁止 echo）；`UNCONFIGURED_LLM_MESSAGE` 已改为「两源皆无」。
- 只读确认用户入口：`AgentRuntimeFactory` 非 `forceFakeLlm` 与 `DemoHttpSession.getAgentRuntimeFactory` 均 `initDefaultLlmProvider(projectRoot)`，不再 memory 强行 Fake。本片 loader 回退后，缺 llm.json 但 arch chat 有效时本步对话会落到 Zhipu。
- 未越权实现 F-1、未改产品 logic、未 commit。

### Issues
#### Critical (Must Fix)
- 无。

#### Important (Should Fix)
- `refresh_asset` 把 `loadLlmRuntimeConfig` 记到 `frontend/packages/util`（`query_arch` `frontend/packages/util#loadLlmRuntimeConfig` 可见），摘要仍不提 arch `chat` 回退；`search_arch` 另有 `frontend/agent-runtime/util/loadLlmRuntimeConfig` 旧条目。批次禁止手工改 `.ai/` / `audit_arch_changes`；留给最终 closeout 再扫，不阻断本 Task 源码验收。

#### Minor (Nice to Have)
- 模块级 `defaultProvider` 仍默认 `new FakeLlmProvider()`。未 `initDefaultLlmProvider` 的直连 `getDefaultLlmProvider()` 仍 echo；生产 StepChat 经 factory / `createControlPlane` 会 init，report 已披露。
- `LlmRuntimeConfig.provider` 注释仍写「文件内 fake → 未配置 UI」。B-2 下该文件被当作无效 llm.json，若 arch chat 可用会落到 Zhipu（符合「有效 llm.json 优先」），注释略滞后。
- `UNCONFIGURED_LLM_MESSAGE` 仍只引导写 llm.json，未提示 arch `chat` 也可作为来源；两无行为正确。
- `AgentRuntimeFactory.bootstrap` 注释仍写「缺 llm.json 则 Unconfigured」（白名单外，本片未改）。现应理解为：缺 llm.json **且** arch chat 不可用才 Unconfigured。
- 未覆盖：占位 `YOUR_ZHIPU_API_KEY` 的 llm.json 回退 arch；`apiKeyEnv` 有名但 env 空；非法 JSON。实现上 `parseLlmJsonFile` 返回 null 后会走 arch，与优先级一致。
- 既有 `zhipu-provider.test.ts`（非本片白名单）在仓库存在 llm.json 时会从**真实 repo 根**加载并断言 model/`apiKey` 非占位符；vitest 失败时可能把实际 key 打进输出。本片新测未走这条路径。审查方未打开真实配置文件。
- MCP `query_contract LlmRuntimeConfig` 的 description 仍只提 llm.json、未写 arch chat；`tsContent` 已是新 loader。形状未变故未 `register_contract`，可接受。

### Assessment
**Task quality:** Approved
**Reasoning:** 有效 llm.json 覆盖 arch chat；缺 llm.json 时从临时夹具 arch `chat` 构建 Zhipu 而非 Fake；两源皆无保持 B-1 Unconfigured。白名单、假 key 夹具、公开函数「为什么」注释与主 Agent 11/11 + tsc 0 均满足。`refresh_asset` 错挂 `frontend/packages/util` 记 Important，按批次规则留 closeout，不改本片结论。
