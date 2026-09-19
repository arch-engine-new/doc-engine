# Task F4-1 Brief — HttpReranker 红灯测试（T1–T4/T6/T8）

- **Plan:** `docs/apt/plans/2026-09-19-live-http-rerank-plan.md` Task 1
- **Slice:** F-4
- **BASE_SHA:** `70cb09612fdae3b82b9406050fa30372287d9b2f`
- **Report:** `.apt/orchestration/task-f4-1-report.md`
- **review-tier:** full

## 目标

只写失败测试，**不要实现 HttpReranker**。本 Task Verify **预期 FAIL**。

## 步骤

按 plan Part 2 Task 1 全文执行。夹具 apiKey 只用字面量 `test-key`。mock fetch，禁止打真实网。禁止密钥明文。

## Files 白名单

- `packages/core-engine/test/http-rerank.test.ts`

## Verify（本 Task 预期 FAIL）

```
npx vitest run test/http-rerank.test.ts
```

cwd: `packages/core-engine`

## 禁止

- 实现 `HttpReranker` 或改 live-ports 让测试变绿
- 改白名单外文件
- `audit_arch_changes`
- 真实 HTTP / 真实密钥

## 编码规范

`.apt/code-standards.md`

## 微闭环

本 Task 仅测试文件；无契约登记。report 写 ContractsRegistered: 无。

## 上一 Task

无。HEAD 为 F-4 plan commit `70cb096`。
