## Task B-2-1 Report
**Status:** DONE
### Tests
- Command: `npx vitest run test/arch-chat-fallback.test.ts test/unconfigured-llm.test.ts test/zhipu-provider.test.ts`（cwd: `packages/agent-runtime`）。另跑 `npx tsc -p tsconfig.json --noEmit`（exit 0）。
- Result: 3 files / 11 tests passed；tsc 无错误。
- TDD RED/GREEN: RED 时临时根仅有夹具 `.ai/arch/arch.config.json`（假 key `test-key`，未读仓库真实配置）时 `createLlmProvider(null, tempRoot)` 为 `UnconfiguredLlmProvider`；`loadLlmRuntimeConfig` 对 `apiKeyEnv` 返回 `null`。GREEN：缺 llm.json 时从 arch `chat` 构建 `ZhipuLlmProvider`；mock fetch 后 `complete()` 返回模型内容且不含 `[fake-llm`；`apiKeyEnv` 从 `process.env` 解析；两份配置都没有仍为 `UnconfiguredLlmProvider`（含「未配置」）；有效 llm.json 的 model/key 覆盖 arch chat。
### APT Micro-closeout
- ContractsRegistered: none（`LlmRuntimeConfig` 公开形状未变；未新增导出类型）
- AssetsRefreshed: `packages/agent-runtime/src/llm/config.ts`（loadLlmRuntimeConfig）；`packages/agent-runtime/src/llm/provider.ts`（createLlmProvider）
- AssetsRemoved: none
### FilesChanged
- `packages/agent-runtime/src/llm/config.ts`
- `packages/agent-runtime/src/llm/provider.ts`
- `packages/agent-runtime/test/arch-chat-fallback.test.ts`
- `packages/agent-runtime/test/unconfigured-llm.test.ts`
- `.apt/orchestration/task-b2-1-report.md`
### Commits
- none（brief 禁止 commit）
### Blockers / Concerns
- 优先级：有效 `.apt/agent-runtime.llm.json`（或 `AGENT_RUNTIME_LLM_CONFIG`）> `<root>/.ai/arch/arch.config.json` 的 `chat`（`baseUrl` / `apiKey` 或 `apiKeyEnv` / `model`）> `UnconfiguredLlmProvider`。不读取 `arch.secrets.json`。
- `refresh_asset` 将条目记到 `frontend/packages/util/*`（created），与既有 `frontend/agent-runtime/util/loadLlmRuntimeConfig` 并存。禁止 `audit_arch_changes`，未手工改 `.ai/`。
- 未读取、打印或复制仓库真实 `.ai/arch/arch.config.json` 的 apiKey；测试只用临时目录夹具假 key `test-key`。
- 模块默认 `defaultProvider` 仍为 `FakeLlmProvider`（显式注入 / 未 init）。用户路径走 `initDefaultLlmProvider` / `createLlmProvider(null, root)`。
