# 测试用例 — agent-runtime-control

## 业务测试（来自 page.logic.md）

| ID | 场景 | 输入 | 预期 | 来源 |
|----|------|------|------|------|
| T1 | 列表 runs | GET /api/agent/runs | 返回数组，含 job-step-v1 run | §操作明细 startRun/getRun |
| T2 | 查看 trace | GET /api/agent/runs/:id/trace | 事件序列非空，含 run_started | §操作明细 getTrace |
| T3 | 手动 resume HITL | POST /api/agent/runs/:id/resume + token | waiting_hitl → completed 或推进 | §操作明细 resumeHitl |
| T4 | Run.status 边界 | run 已完成 | getRun status=completed | §状态 Run.status |

## 接口测试

| ID | 接口 | 场景 | 预期 |
|----|------|------|------|
| T5 | GET /api/agent/runs | demo reset 后 | 至少 1 条 graphId=job-step-v1 |
| T6 | POST confirm-next | 无 open HITL | 409 no_open_hitl |
