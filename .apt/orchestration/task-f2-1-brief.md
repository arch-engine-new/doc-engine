# Task F2-1 Brief — Embeddings 签名 async 兼容 + CI Hash 仍 48

- **Plan:** `docs/apt/plans/2026-09-19-dashscope-text-embedding-v3-plan.md` Task 1
- **Spec:** `docs/superpowers/specs/2026-09-19-dashscope-text-embedding-v3-design.md`
- **Slice:** F-2
- **BASE_SHA:** `fa80d3221c23858bf79a55c77f948d54d8a60f4c`
- **Report:** `.apt/orchestration/task-f2-1-report.md`
- **Rn:** R7 / T1

## 目标

把已登记契约 `Embeddings.embed` 从同步 `number[]` 放宽为 `number[] | Promise<number[]>`，使后续 live HTTP embedding 能 async。CI 默认 `HashEmbeddings` 仍返回 48 维。本 Task **不** 实现 DashScope、**不** 改 `liveRetrievePorts`、**不** 改 Qdrant。

## 步骤

1. 只读 MCP：`query_contract` name=`Embeddings`；`query_contract` name=`HashEmbeddings`。禁止掀 `.ai/arch/`。
2. TDD：`await new HashEmbeddings().embed("x")` 长度 48；既有 rerank / standard-rag 在 embed 可能为 Promise 时仍绿。
3. 最小实现：
   - `packages/core-engine/src/retrieve/ports.ts`：`embed(text: string): number[] | Promise<number[]>`
   - Hash/Fixture 可继续同步返回
   - `IndependentReranker.rerank` 对 embed 使用 `await`（返回类型已允许 Promise）
   - 测试里 `embed.embed(...)` 凡作为向量使用处加 `await`
4. 微闭环：`register_contract` name=`Embeddings`（签名演进）；对改动的已索引 `sourcePath` 调 `refresh_asset`。
5. `git commit` 本 Task 一条清晰 subject（不要 --no-verify；不要改 git config）。
6. 写满 report。

## Files 白名单（仅可修改这些）

- `packages/core-engine/src/retrieve/ports.ts`
- `packages/core-engine/src/retrieve/embeddings.ts`
- `packages/core-engine/src/retrieve/rerank.ts`
- `packages/core-engine/test/rerank.test.ts`
- `packages/core-engine/test/standard-rag.test.ts`
- `packages/core-engine/test/ingest-pdf.test.ts`
- `packages/core-engine/test/agent-native-graph.test.ts`
- `packages/core-engine/test/standard-lib-stepchat.test.ts`

## Verify

```
npx vitest run test/rerank.test.ts test/standard-rag.test.ts test/ingest-pdf.test.ts
```

cwd: `packages/core-engine`

## 禁止

- 实现 `DashScopeEmbeddings` / 改 `live-ports.ts` / 改 `qdrant.ts` / 改 Vue
- 把 apiKey 写入任何文件
- `audit_arch_changes`
- 改白名单外文件
- 并行做 Task 2

## 编码规范（必须遵守）

见 `.apt/code-standards.md`：导出方法须有「为什么」注释；函数 ≤80 行；TS 必须有明确 return type；禁止无意义注释。

## 微闭环（`_task-micro-closeout.md`）

测试通过后、handoff 之前：对本 Task 新增/演进对外类型 `register_contract`；白名单内已索引 modified/new 路径 `refresh_asset`；report 写 `ContractsRegistered` / `AssetsRefreshed` / `AssetsRemoved`。禁止 `audit_arch_changes`。

## Part 1 摘要

live 将换 v3 embedding；本 Task 只把契约改成可 await，Hash 48 维保持，让后续 Task 能接 HTTP。
