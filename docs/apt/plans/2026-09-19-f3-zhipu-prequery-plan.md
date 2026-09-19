---
status: approved
slice: F-3
chain: feature-light
---

# F-3 live prequery 接 ZhipuPrequery

**Status:** approved（`/apt-goal` 全自动自答，未经用户确认）

**Goal:** live 检索 prequery 接 glm（ZhipuPrequery），禁止 FakePrequery（全自动自答，未经用户确认）

**验收标准:**

1. `liveRetrievePorts().prequery` 为 `ZhipuPrequery`
2. 缺 LLM 配置显式失败，不静默 FakePrequery
3. 单测仍可注入 FakePrequery

## Part 1

**范围:** 只改 `liveRetrievePorts()` 装配。`ZhipuPrequery` 已存在。测试继续 FakePrequery。禁止把 chat complete 当 rerank。

**寻址（MCP）:**

| 依赖 | 来源 | 路径 |
|------|------|------|
| liveRetrievePorts | contract | `packages/core-engine/src/retrieve/live-ports.ts` — 现 `prequery: new FakePrequery()` |
| FakePrequery / ZhipuPrequery | contract + `query_arch` `#zhipuprequery` | `packages/core-engine/src/retrieve/prequery.ts` |
| ChatComplete | contract | `packages/core-engine/src/retrieve/ports.ts` |
| UnconfiguredLlmProvider / createLlmProvider / ZhipuLlmProvider | contract | `packages/agent-runtime/src/llm/provider.ts`、`zhipu-provider.ts` |

**拟改:** `live-ports.ts` 用 `createLlmProvider()` 得到 ChatComplete；`UnconfiguredLlmProvider` / `FakeLlmProvider` 视为未配置并 throw（对齐「不静默 Fake」，不把未配置当 rewrite 成功）。`prequery: new ZhipuPrequery(llm)`。`IndependentReranker` 仍只注入 embed，禁止注入 llm。

**风险:** 既有 `dashscope-embeddings.test.ts` 的 liveRetrievePorts 用例需补 LLM 配置夹具（`AGENT_RUNTIME_LLM_CONFIG` 临时 json，apiKey 用 `test-key`，禁止真实密钥）。`live-rag-ingest.test.ts` 为 skipIf live env，不在本 Task 白名单。

## Part 2

### Task 1: liveRetrievePorts 装配 ZhipuPrequery（先红后绿）

- [ ] 只读 MCP：`query_contract` name=`liveRetrievePorts`；`query_contract` name=`FakePrequery`；`query_contract` name=`UnconfiguredLlmProvider`；`query_contract` name=`ZhipuLlmProvider`；`query_arch` path=`frontend/core-engine/util#zhipuprequery`
- [ ] TDD：先写失败测试再改装配
  1. 有可用 LLM 配置时 `liveRetrievePorts().prequery` 为 `ZhipuPrequery`，不是 `FakePrequery`
  2. 缺 LLM 配置（`createLlmProvider` → Unconfigured / Fake）时 `liveRetrievePorts()` throw，不得返回 FakePrequery
  3. `new FakePrequery()` 单测仍可用（已有 standard-rag 等；本 Task 加一条显式注入断言即可）
  4. `IndependentReranker` 不因本片获得 llm / 不调用 complete
- [ ] 实现：`liveRetrievePorts` 装配 `ZhipuPrequery`；缺配置 throw；不改 rerank 为 chat
- [ ] 更新既有 `dashscope-embeddings.test.ts` 中调用 `liveRetrievePorts()` 的用例，使其在有 DASHSCOPE 时同时提供临时 llm.json
- [ ] 微闭环：`register_contract` name=`ZhipuPrequery`（若仍 missing）；`refresh_asset` 改动源文件
- [ ] git commit 一条；写 report

**MCP:** query_contract / query_arch（只读）；register_contract / refresh_asset（微闭环）

**Files:**

- `packages/core-engine/src/retrieve/live-ports.ts`
- `packages/core-engine/test/live-zhipu-prequery.test.ts`
- `packages/core-engine/test/dashscope-embeddings.test.ts`

**Verify:**

```
npx vitest run test/live-zhipu-prequery.test.ts test/dashscope-embeddings.test.ts test/standard-rag.test.ts
```

cwd: `packages/core-engine`

**Contracts:** ZhipuPrequery（补登记）、liveRetrievePorts（description 更新由 refresh/register）
