# verify-fix: agent-runtime

> **Source verify:** `.apt/verify/latest.md`
> **Overall:** FAIL
> **Status:** approved
> **Command:** `$apt-plan-from-verify`
> **implementation dims:** Plan 对照, 代码质量
> **closeout (排除，走 finish-feature):** 契约登记（F2）

## Part 1 — 背景与范围

- 来自 classify：`recommended=plan-from-verify`（FAIL 含实现类维度）
- Failures 摘要（excerpt）：
  - F1（Plan 对照 T9）：`src/contracts/agent-runtime.ts` 缺失（plan Files 明确要求）；crash-recovery 示例文件未按 plan 落地（`examples/crash-recovery/main.ts` 不存在，现为 `basic-agent.ts` / `hitl-agent.ts`）
  - F3（代码质量）：`check_code_quality` = 0 high / 7 medium（≥5 门槛 FAIL）—— 4× complex-logic-uncommented（graph/compiler.ts buildAdjacency、resolveEntryNodeId、compileGraph；obs/otel-hooks.ts endRunSpan）、2× http-url（api/http.ts 60/334 本地监听 URL）、1× leaky-log（examples/hitl-agent.ts:45 打印 HITL token）
- 非目标：
  - 不处理 closeout `契约登记`（F2 —— `query_contract("AgentRuntime")` 未命中与 register_contract 落地）→ 留给 `/finish-feature`
  - 不改业务执行语义 / 不重写 scheduler、tool、hitl 核心逻辑（现有 122 测试全绿，仅补契约源文件与质量项）
  - 本 plan 只列任务，不写生产代码（实现走 `/implement-plan`）

## Part 2 — Tasks

### Task 1: 契约源文件落盘（Plan 对照 F1 之一）
- 背景：plan T9 Files 要求 `src/contracts/agent-runtime.ts`（对外 TS 契约），实现期未建立（契约走 register_contract 直接入库）。
- Files: `src/contracts/agent-runtime.ts`
- 内容：对外契约源文件 —— 聚合导出 agent-runtime 公共契约面（引用 `packages/agent-runtime` barrel 的类型：RunStatus、SchedulerResult、CompiledGraph、GraphDefinition、HitlDecision、RunView、EventRow、StateStore、ToolExecutionResult 等），带 JSDoc 说明本文件是「对外契约 SSOT 的源码载体」；**不**在此处调 register_contract（closeout）。
- Verify: `npx tsc -p packages/agent-runtime --noEmit`（无回归）＋ `Test-Path src/contracts/agent-runtime.ts`＝True

### Task 2: crash-recovery 示例对齐（Plan 对照 F1 之二）
- 背景：plan T9 Files 要求 `packages/agent-runtime/examples/crash-recovery/main.ts`；现有示例等价但文件名不符。
- Files: `packages/agent-runtime/examples/crash-recovery/main.ts`（新增）+ `packages/agent-runtime/examples/tsconfig.json`（如果 include 需含新目录，改 include）
- 内容：最小可运行 crash→resume 示例（沿用 checkpoint-service/run-manager resume 路径：startRun 写 checkpoint → 模拟中断 → resume:true 续跑并打印 trace）；复用现有 examples 的 SQLite 临时库模式。
- Verify: `npx tsc -p packages/agent-runtime/examples --noEmit` 通过

### Task 3: 代码质量 medium 清零（代码质量 F3）
- Files:
  - `packages/agent-runtime/src/graph/compiler.ts`（buildAdjacency / resolveEntryNodeId / compileGraph 加意图注释，解释校验维度与顺序）
  - `packages/agent-runtime/src/obs/otel-hooks.ts`（endRunSpan 加注释：span 结束/异常路径合并逻辑）
  - `packages/agent-runtime/src/api/http.ts`（60/334 行 http:// 字面量：改为带注释的本地 dev 语义 —— 如提取 `schemeFor(hostname)` 并加「本地监听由反向代理终结 TLS」JSDoc；不得引入外部依赖）
  - `packages/agent-runtime/examples/hitl-agent.ts`（45 行 token 打印脱敏：只打印前 8 字符 + `...`）
- 约束：仅注释/字面量语义调整，不改行为；注释语言中文或英文与上下文一致。
- Verify: `node "%USERPROFILE%\.apt\scripts\check-code-quality.cjs"`（若存在）或 MCP `check_code_quality` projectRoot=`D:\software\doc-engine` → `highCount=0` 且 `mediumCount < 5`；`npm test -w agent-runtime` 全绿（122+）；`npx tsc -p packages/agent-runtime --noEmit`

### Task 4: 回归与报告
- 说明：合并 Task 1–3 的回归动作，非独立实现。
- Verify（全量）：`npm test -w agent-runtime`（全绿）＋ `npx tsc -p packages/agent-runtime --noEmit` ＋ `npx tsc -p packages/agent-runtime/examples --noEmit` ＋ MCP `check_code_quality`（medium<5）
- 完成后提示用户：确认本 plan → `/implement-plan` → 再 `/verify`（closeout 契约登记 F2 由 `/finish-feature` 处理）
