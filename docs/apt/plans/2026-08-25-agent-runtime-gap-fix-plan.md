# agent-runtime 缺口补齐计划

> **Spec:** `docs/superpowers/specs/2026-08-25-graph-agent-runtime-design.md`
> **Status:** approved
> **Trigger:** apt-goal 缺口修复（LLM / subgraph / 并行 fan-out/fan-in）

## Tasks

### T1 LLM 节点
- Files: `packages/agent-runtime/src/llm/provider.ts`, `packages/agent-runtime/src/runtime/node-executors.ts`
- FakeLlmProvider + LLMExecutor 实现
- Verify: 单测 llm 节点跑通；scheduler 测试不再期望 NotImplementedError

### T2 Subgraph 节点
- Files: `node-executors.ts`, `state.ts`, `scheduler.ts`, `run-manager.ts`
- SubgraphExecutor 通过 getCompiledGraph + runGraph 嵌套执行
- Verify: 子图示例图单测通过

### T3 并行 fan-out/fan-in
- Files: `scheduler.ts`
- `parallelExecution` 选项：同批 ready 节点 Promise.all；fan-in 仍由 in-degree 屏障保证
- Verify: fan-out/fan-in 图 completed；并行批次测试

### T4 回归
- Verify: `npm test -w agent-runtime` 全绿；`npx tsc --noEmit`
