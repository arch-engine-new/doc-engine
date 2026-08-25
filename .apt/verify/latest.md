# Verify Report

**Plan:** docs/apt/plans/2026-08-25-graph-agent-runtime-plan.md
**Overall:** FAIL
**Date:** 2026-08-25

## Summary
| 维度 | 结果 |
|------|------|
| Plan 对照 | FAIL |
| 架构 audit | PASS |
| 设计 audit | SKIP |
| 产品对齐 | SKIP |
| Connect 门禁 | SKIP |
| 契约登记 | FAIL |
| 可检索性 | PASS |
| 代码质量 | FAIL |
| 测试/构建 | PASS |
| 外部 Harness | SKIP |

## Harness
SKIP：无外部 Harness 触发（.apt/goal.md frontmatter 无 sourceDoc/activeSpec；activeSpec 为设计文档，非可执行规格套件）

## Plan Coverage
| Task | 结果 | 备注 |
|------|------|------|
| T1 脚手架 | PASS | monorepo + 包 + vitest 就绪 |
| T2 graph-core | PASS | types + compiler + 单测 |
| T3 Scheduler/RunManager | PASS | ≥5 节点图串行通过（AC-1）|
| T4 SQLite StateStore | PASS | 7 表 migration CRUD（AC-6）|
| T5 Checkpoint | PASS | 崩溃续跑不重复副作用（AC-2）|
| T6 ToolRuntime | PASS | retry/幂等/超时（AC-4）|
| T7 HITL | PASS | waiting_hitl/token/resume 幂等（AC-3）|
| T8 EventLog+控制面 | PASS | getTrace/AC-5；HTTP 套件 describe.skip（可选适配）|
| T9 契约+示例+文档 | FAIL | `src/contracts/agent-runtime.ts` 未建立；契约未按 plan 映射 `AgentRuntime` 登记；示例为 `examples/basic-agent.ts` / `hitl-agent.ts`（等价但文件名≠plan 的 `examples/crash-recovery/main.ts`）；README ✓ |
| T10 知识闭环 | PASS | 18 assets + 9 契约入库，search_arch 命中 |

## Failures
- [F1] Plan 对照 T9（实现类）：`src/contracts/agent-runtime.ts` 缺失（plan Files 明确要求），契约登记走了 `register_contract` 直接入库但未产生契约源文件；crash-recovery 示例文件名与 plan 不一致（功能等价：checkpoint-recovery.test.ts 已覆盖 crash 场景）。
- [F2] 契约完整性：`query_contract("AgentRuntime")` 未命中（plan 契约映射 `AgentRuntime → src/contracts/agent-runtime.ts` 未落地）；抽样 RunStatus / CompiledGraph / StateStore 均已登记（tsFilePath=src/index.ts）。
- [F3] 代码质量：check_code_quality = 0 high / 7 medium（≥5 门槛 FAIL）。明细：4× complex-logic-uncommented（graph/compiler.ts buildAdjacency/resolveEntryNodeId/compileGraph、obs/otel-hooks.ts endRunSpan）、2× http-url（api/http.ts 本地监听 60/334 行，属本地 dev 适配器）、1× leaky-log（examples/hitl-agent.ts:45 打印 HITL token，属示例行为）。

## Recommended next steps
- Overall **FAIL** 且含实现类维度（Plan 对照 / 代码质量）→ **`/plan-from-verify`**（读取 `.apt/verify/latest.md`）确认后 `/implement-plan` → 再 `/verify`。建议修复点：
  1. 建 `src/contracts/agent-runtime.ts`（对外契约源文件）并按 plan 名 `AgentRuntime` 登记（或经 `/finish-feature` 同步契约并更新 plan 映射）。
  2. 补齐/改名 crash-recovery 示例以对齐 plan Files（或 plan 侧更新映射）。
  3. 降低 medium 项：加注释于 compiler.ts/otel-hooks.ts 复杂逻辑；examples/hitl-agent.ts 移除/脱敏 token 打印；http.ts 本地监听 URL 加显式说明。
- 契约登记残留（closeout 维度）可并入 `/finish-feature`；本报告 FAIL 以实现类维度为主，先走 `/plan-from-verify`。
- 脚本 `scripts/classify-verify-failures.cjs` 不存在，未能打印 `recommended=`（不影响结论，见上述分类）。
