# B-3 需求验收报告

来源：`docs/apt/plans/2026-09-17-b3-standard-lib-stepchat-on-load-plan.md`
时间：2026-09-17T12:15:00Z
修复轮数：0（先红后绿一次过）

| AC | 描述 | 结果 | attempts |
|----|------|------|----------|
| AC-1 | 未检索即挂载 StepChat，不得 v-if=chatReady | PASS | 0 |
| AC-2 | 零命中不卸载侧栏 | PASS | 0 |
| AC-3 | 不绑 /api/jobs[0]；pack 级 trace | PASS | 0 |

证据：`npx vitest run test/standard-lib-stepchat-on-load.test.ts test/standard-lib-stepchat.test.ts` → 7 passed。源码无 `chatReady`、无 `/api/jobs`，含 `pack:${packId}`。
