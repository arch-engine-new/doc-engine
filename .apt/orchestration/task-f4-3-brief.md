# Task F4-3 Brief — liveRetrievePorts 换 HttpReranker + 改写 F-2/F-3 绿条

- **Plan:** `docs/apt/plans/2026-09-19-live-http-rerank-plan.md` Task 3
- **Slice:** F-4
- **BASE_SHA:** `cb785c5ae0f6d85acbc5a396e90158159fabaaa9`
- **Report:** `.apt/orchestration/task-f4-3-report.md`
- **review-tier:** full

## 目标

live `RetrievePorts.rerank` 装配 `HttpReranker`，不再 `IndependentReranker({ embed })`。改写 F-2/F-3 把「live 共用 embed」当绿的测试。

## 步骤

严格按 plan Part 2 Task 3：

1. 只读 MCP：`query_contract` name=`liveRetrievePorts`；`query_contract` name=`ZhipuPrequery`；`query_contract` name=`IndependentReranker`；`query_contract` name=`HttpReranker`（可能尚未登记）。
2. 改写测试（可与实现同一 commit，但须覆盖 T5）：
   - `liveRetrievePorts()`（`DASHSCOPE_API_KEY=test-key` + 临时 llm.json，同 F-3）`.rerank` 为 `HttpReranker`，`not.toBeInstanceOf(IndependentReranker)`；`prequery` 仍为 `ZhipuPrequery`
   - 调用 `ports.rerank.rerank(...)` 时 spy `ports.embed.embed` 次数 = 0
   - stub `globalThis.fetch`：`/reranks` 返回精排 results；URL 不含 `chat/completions`、不以 `/embeddings` 作为精排 path
   - 删除 `dashscope-embeddings.test.ts`「shares one DashScopeEmbeddings instance with IndependentReranker」；改为 live rerank 不调用 embed
   - 改写 `live-zhipu-prequery.test.ts`「keeps IndependentReranker on embed only…」
3. 实现：`rerank: new HttpReranker()`；禁止 `?? new IndependentReranker()`；禁止把 embed/llm 传入 rerank。更新过时注释「Live retrieve must share one v3 embedder with rerank」。embed 继续 DashScopeEmbeddings；prequery 继续 ZhipuPrequery + requireConfiguredLlm。
4. 微闭环：`register_contract` 更新 `liveRetrievePorts` description（HttpReranker，不再共用 embed）；`refresh_asset` `live-ports.ts`。
5. git commit 一条。只 add 白名单。不要把 PdfTickPanel.vue / job-pipeline.ts 等脏文件捎进 commit。

## Files 白名单

- `packages/core-engine/src/retrieve/live-ports.ts`
- `packages/core-engine/test/dashscope-embeddings.test.ts`
- `packages/core-engine/test/live-zhipu-prequery.test.ts`

## Verify

```
npx vitest run test/live-zhipu-prequery.test.ts test/dashscope-embeddings.test.ts test/http-rerank.test.ts
```

cwd: `packages/core-engine`

## 禁止

- 改 `rerank.ts` / `library.ts` / `http-rerank.ts` / Vue / job-pipeline
- 静默回退 IndependentReranker
- chat-as-rerank
- 真实网 / 真实密钥 / `audit_arch_changes`
- 把工作区无关脏文件加入 commit

## 编码规范

`.apt/code-standards.md`

## 上一 Task handoff

F4-2 DONE `cb785c5`：HttpReranker 已实现并 re-export；8 tests green。live 装配未改。
