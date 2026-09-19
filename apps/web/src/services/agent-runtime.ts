import { http } from "./http";

export interface AgentRunRow {
  runId: string;
  graphId: string;
  threadId: string | null;
  status: string;
  input?: unknown;
  output?: unknown;
  error?: unknown;
  createdAt?: string;
  updatedAt?: string;
}

export interface AgentTraceEvent {
  seq: number;
  eventType: string;
  payload: unknown;
  createdAt: string;
}

/** 列出控制面可见的 agent run 元数据，供 internal 页筛选 job-step-v1。 */
export async function listAgentRuns(): Promise<AgentRunRow[]> {
  const res = await http<{ runs: Array<{ metadata: AgentRunRow }> }>("/api/agent/runs");
  return (res.runs ?? []).map((row) => row.metadata ?? (row as unknown as AgentRunRow));
}

/** 按 runId 拉取单条 run 状态，用于控制面详情与 HITL 边界展示。 */
export async function getAgentRun(runId: string): Promise<AgentRunRow> {
  const res = await http<{ run: AgentRunRow }>(`/api/agent/runs/${runId}`);
  return res.run;
}

/** 读取 run 事件轨迹，对照审计与 test-cases T2（含 run_started）。 */
export async function getAgentTrace(runId: string): Promise<AgentTraceEvent[]> {
  const res = await http<{ trace: AgentTraceEvent[] }>(`/api/agent/runs/${runId}/trace`);
  return res.trace ?? [];
}

/** 人工恢复 waiting_hitl；与 confirm-next 共用 resumeHitl，不写 Receipt。 */
export async function resumeAgentHitl(
  runId: string,
  token: string,
  decision: unknown,
): Promise<void> {
  await http(`/api/agent/runs/${runId}/resume`, {
    method: "POST",
    body: JSON.stringify({ token, decision }),
  });
}
