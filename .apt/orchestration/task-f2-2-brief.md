# Task F2-2 Brief — DashScopeEmbeddings + liveRetrievePorts 缺 key 失败 + 共用 rerank

- **Plan:** `docs/apt/plans/2026-09-19-dashscope-text-embedding-v3-plan.md` Task 2
- **Spec:** `docs/superpowers/specs/2026-09-19-dashscope-text-embedding-v3-design.md`
- **Slice:** F-2
- **BASE_SHA:** `bcce1e2e22155568467b02551731c58bce848e01`
- **Report:** `.apt/orchestration/task-f2-2-report.md`
- **Rn:** R1 / R2 / R3 / R6 / R9

## 目标

live `RetrievePorts.embed` 改为阿里云百炼兼容模式 `text-embedding-v3`。密钥只读环境变量 `DASHSCOPE_API_KEY`。缺 key 时 `liveRetrievePorts()` 显式 throw，禁止回退 `HashEmbeddings`。`IndependentReranker` 必须注入同一 embed 实例。

## 步骤

1. 只读 MCP：`query_contract` name=`liveRetrievePorts`；`query_contract` name=`IndependentReranker`；`query_contract` name=`ZhipuLlmProvider`（确认不把 chat complete 当 embed）。禁止掀 `.ai/arch/`。
2. TDD（mock fetch，**禁止打** dashscope.aliyuncs.com）：
   - 有 key：POST `{baseUrl}/embeddings`，JSON `model=text-embedding-v3`、`dimensions=1024`、`encoding_format=float`，Authorization Bearer 来自 env；返回 `data[0].embedding` 长度 1024。
   - 返回 length≠1024 或 HTTP 非 2xx 或空 embedding → throw。
   - 剥掉 `DASHSCOPE_API_KEY` 后 `liveRetrievePorts()` throw，消息匹配 `/DASHSCOPE_API_KEY/`，且不得返回 HashEmbeddings 实例。
   - `ports.embed` 与注入 rerank 的 embed 为同一对象引用。
   - 测试与实现不含真实 apiKey / `sk-` 字面量；可用临时 `process.env.DASHSCOPE_API_KEY = "test-key"`（测试后还原）。
3. 实现 `DashScopeEmbeddings` **放在** `embeddings.ts`（不要新开第 9 个实现文件）：
   - 可注入 `{ fetch, env, baseUrl? }` 以便单测。
   - 默认 baseUrl: `https://dashscope.aliyuncs.com/compatible-mode/v1`
   - 构造时若 env 无非空 `DASHSCOPE_API_KEY` 即 throw（不要等第一次 embed）。
   - Error 只含变量名，不含密钥值、不含完整 Bearer。
4. `liveRetrievePorts()`：`const embed = new DashScopeEmbeddings(); return { vector, graph, prequery, rerank: new IndependentReranker({ embed }), embed }`。禁止 `?? new HashEmbeddings()`。
5. `index.ts` re-export `DashScopeEmbeddings`。
6. 微闭环：`register_contract` name=`DashScopeEmbeddings`；`refresh_asset` 改动源文件。
7. git commit 一条；写 report。

## Files 白名单

- `packages/core-engine/src/retrieve/embeddings.ts`
- `packages/core-engine/src/retrieve/live-ports.ts`
- `packages/core-engine/src/index.ts`
- `packages/core-engine/test/dashscope-embeddings.test.ts`

## Verify

```
npx vitest run test/dashscope-embeddings.test.ts test/rerank.test.ts
```

cwd: `packages/core-engine`

## 禁止

- 改 qdrant / library reindex / Vue / DSL
- 聊天模型当 embed
- 把 apiKey 写入源码、测试夹具、commit
- `audit_arch_changes`
- 改白名单外文件（Task 1 已改的 ports/rerank 不要再动，除非编译需要且仍在白名单——本 Task 白名单不含 ports.ts）

## 编码规范

见 `.apt/code-standards.md`。导出类/方法必须有「为什么」注释；函数 ≤80 行；明确 return type。

## 微闭环

register_contract + refresh_asset；report 写 ContractsRegistered / AssetsRefreshed / AssetsRemoved。

## 上一 Task handoff

Task 1 Approved。`Embeddings.embed` 已是 `number[] | Promise<number[]>`；Hash 仍同步 48 维；rerank 已 await embed。Commit `bcce1e2`。
