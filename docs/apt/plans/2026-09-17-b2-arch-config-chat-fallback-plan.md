---
status: approved
feature: B-2 arch-config chat fallback
slice: B-2
---

# B-2 本步对话回退 arch.config.json chat

> 全自动自答，未经用户确认（片间 inbox 并入）。

**Goal：** 本步对话在仓库已有 `.ai/arch/arch.config.json` 的 chat 配置时使用 glm-5.3-flash，不再因缺少 `.apt/agent-runtime.llm.json` 而走 FakeLlmProvider。

**验收标准：**

1. 存在 arch.config.json 的 `chat.model=glm-5.3-flash` 且 key 非空时，`createLlmProvider()` 不得落到 FakeLlmProvider（也不得落到仅中文未配置的 Unconfigured，应走真实 Zhipu provider）。
2. 助手回复不得以 `[fake-llm` 开头。
3. loader 必须读到 `chat.baseUrl` / `chat.apiKey` 或 `chat.apiKeyEnv` / `chat.model`；单测可 mock HTTP。

**优先级：** `.apt/agent-runtime.llm.json` 有效时覆盖 arch 回退。两者皆无 → 保持 B-1 `UnconfiguredLlmProvider`（中文未配置，不 echo）。

**禁止：** 把 key 写进源码或提交新密钥文件；改 designs/v0；实现 F-1；回退 B-1 的 pack 上下文修复。

## 依赖寻址

| 依赖 | 来源 | sourcePath |
|------|------|------------|
| LlmRuntimeConfig / loadLlmRuntimeConfig | contract | packages/agent-runtime/src/llm/config.ts |
| createLlmProvider / UnconfiguredLlmProvider / ZhipuLlmProvider | contract | packages/agent-runtime/src/llm/provider.ts |

## Part 2

### Task 1 — arch.config.json chat 回退

- [ ] TDD：临时根无 llm.json、有 `.ai/arch/arch.config.json` chat 夹具（假 key，勿用仓库真密钥）时 createLlmProvider 不是 FakeLlmProvider / UnconfiguredLlmProvider
- [ ] complete 可走 Zhipu（mock fetch）
- [ ] 无 llm.json 且无 arch chat → 仍 Unconfigured，不 `[fake-llm`
- [ ] 有效 llm.json 优先于 arch
- [ ] apiKeyEnv 支持从 env 读 key

**Files：**
- packages/agent-runtime/src/llm/config.ts
- packages/agent-runtime/src/llm/provider.ts
- packages/agent-runtime/test/arch-chat-fallback.test.ts
- packages/agent-runtime/test/unconfigured-llm.test.ts

**Verify：** cwd packages/agent-runtime：`npx vitest run test/arch-chat-fallback.test.ts test/unconfigured-llm.test.ts test/zhipu-provider.test.ts`
