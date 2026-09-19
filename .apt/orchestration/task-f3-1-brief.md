# Task F3-1 Brief — liveRetrievePorts 装配 ZhipuPrequery

- **Plan:** `docs/apt/plans/2026-09-19-f3-zhipu-prequery-plan.md` Task 1
- **Slice:** F-3
- **BASE_SHA:** `17fee66b1494f3f4da4850c5df971a1de8acc386`
- **Report:** `.apt/orchestration/task-f3-1-report.md`
- **review-tier:** full

## Goal（§0.2，全自动自答，未经用户确认）

live 检索 prequery 接 glm（ZhipuPrequery），禁止 FakePrequery。

## 验收标准

1. `liveRetrievePorts().prequery` 为 `ZhipuPrequery`
2. 缺 LLM 配置显式失败，不静默 FakePrequery
3. 单测仍可注入 FakePrequery

## 步骤

1. 只读 MCP：`query_contract` name=`liveRetrievePorts`；`query_contract` name=`FakePrequery`；`query_contract` name=`UnconfiguredLlmProvider`；`query_contract` name=`ZhipuLlmProvider`；`query_arch` path=`frontend/core-engine/util#zhipuprequery`。禁止掀 `.ai/arch/`。
2. TDD（先红后绿，禁止真实 LLM HTTP）：
   - 用 `AGENT_RUNTIME_LLM_CONFIG` 指向临时 json（`provider: zhipu`、`baseUrl`、`model`、`apiKey: "test-key"`）。有配置且有 DASHSCOPE/QDRANT/NEO4J 占位 env 时，`liveRetrievePorts().prequery` 为 `ZhipuPrequery`，不是 `FakePrequery`。
   - 将 `AGENT_RUNTIME_LLM_CONFIG` 指到缺失/无效文件（或空配置）后，`liveRetrievePorts()` throw；捕获值不得为 FakePrequery 实例。消息对齐未配置（可含 Unconfigured / LLM / llm.json 等），**禁止**回显密钥明文。
   - `new FakePrequery()` 仍可直接构造；`rewrite` 仍可用。
   - `ports.rerank` 仍为 `IndependentReranker`；构造时禁止把 ChatComplete 当 rerank（不要 `new IndependentReranker(llm)`）。
   - 测试与实现不含真实 apiKey / `sk-` 字面量；用 `test-key`。测完还原 env。
3. 实现 `liveRetrievePorts()`：
   - `createLlmProvider()`（agent-runtime 已是 core-engine 依赖）。若结果是 `UnconfiguredLlmProvider` 或 `FakeLlmProvider` → throw，禁止 `new FakePrequery()`。
   - `prequery: new ZhipuPrequery(llm)`。`ZhipuLlmProvider` 的 `complete({prompt})` 结构兼容 `ChatComplete`。
   - `rerank: new IndependentReranker({ embed })` 保持现状，只注入 embed。
   - 构造顺序：现有 DashScope 缺 key 仍先失败（既有用例保留）；LLM 检查在其后或合理位置，但缺 LLM 不得落到 FakePrequery。
4. 更新 `dashscope-embeddings.test.ts` 里成功路径的 `liveRetrievePorts()`：补临时 llm.json，避免本片改装配后绿测变红。缺 DASHSCOPE 的 throw 用例保持。
5. 微闭环：`register_contract` name=`ZhipuPrequery`（当前 query_contract 该名 missing）；`refresh_asset` `packages/core-engine/src/retrieve/live-ports.ts` 与 `prequery.ts`（若 description 需同步）。可 `register_contract` 更新 `liveRetrievePorts` description：prequery 为 ZhipuPrequery；缺 LLM throw。
6. git commit 一条清晰 subject；写满 report。

## Files 白名单

- `packages/core-engine/src/retrieve/live-ports.ts`
- `packages/core-engine/test/live-zhipu-prequery.test.ts`
- `packages/core-engine/test/dashscope-embeddings.test.ts`

## Verify

```
npx vitest run test/live-zhipu-prequery.test.ts test/dashscope-embeddings.test.ts test/standard-rag.test.ts
```

cwd: `packages/core-engine`

## 禁止

- 把 chat complete 当 rerank
- 静默 `new FakePrequery()` 作为 live 回退
- 把 apiKey 写入源码、测试夹具（除字面量 `test-key`）、commit、report
- 在任何文件或 stdout 回显 `DASHSCOPE_API_KEY` 的值或其它密钥明文
- `audit_arch_changes`
- 改白名单外文件（含 `job-pipeline.ts`、`prequery.ts` 实现、`rerank.ts`、Vue）
- 打真实智谱 / DashScope HTTP（mock 或只做 instanceof 装配断言）

## 编码规范

见 `.apt/code-standards.md`。导出函数须有「为什么」注释；函数 ≤80 行；明确 return type。

## 微闭环

测试通过后、handoff 之前，对本 Task 范围内执行 APT 微闭环（禁止 `audit_arch_changes`）：

1. 新对外类型 → `register_contract`（name, description, tsFilePath）。
2. 白名单内 modified/new 且属架构索引 → `refresh_asset`（sourcePath 必填）。
3. report 写 ContractsRegistered / AssetsRefreshed / AssetsRemoved。

## 上一 Task handoff

无（F-3 轻链 Task 1）。HEAD `17fee66` 为 F-2 收尾。
