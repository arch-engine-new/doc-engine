# Task 10 Brief — A11–A16 与 Job 回归

plan: `docs/apt/plans/2026-09-15-rag-ingest-metadata-graph-plan.md`
projectType: component
BASE_SHA: `7d9effaef6dea0817569e1ad3bba3e8486d644cf`

## 步骤

- [ ] MCP：`query_contract` name=`JobPipeline`；`query_contract` name=`StandardLibrary`。禁止读 `.ai/`。
- [ ] 跑回归并**只在失败时**改测试白名单（或确属本 plan 回归缺口的断言）。不要新功能。
- [ ] 确认 Finding.clause_id ∈ t_clause；`search_clause` / 对话不能发明条款号（可顺跑 `agent-native-graph.test.ts`，必要时只修因 RetrieveHit 新字段导致的夹具）。
- [ ] Job 4MB 仍拒。不写公路 seed。

## Files 白名单

- `packages/core-engine/test/standard-rag.test.ts`
- `packages/core-engine/test/upload-ocr.test.ts`
- `packages/core-engine/test/agent-native-graph.test.ts`（仅夹具字段）

禁止改 library/pipeline 行为（应已在 Task 5–9 完成）。若生产代码必须修回归，**停住 BLOCKED** 问编排方，不要偷偷扩大范围。

## Verify

```
npx vitest run packages/core-engine/test/standard-rag.test.ts packages/core-engine/test/upload-ocr.test.ts packages/core-engine/test/agent-native-graph.test.ts
```

全绿。无代码改动则 **不要空 commit**，Status=DONE，commits 写 none。

## Report

`.apt/orchestration/task-10-report.md`
