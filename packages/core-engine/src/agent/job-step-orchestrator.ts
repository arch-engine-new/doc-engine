import {
  createHitlGateway,
  type ControlPlane,
  type GraphDefinition,
  type HitlGateway,
  type SQLiteStateStore,
  type ToolRegistry,
} from "agent-runtime";
import type { JobRow } from "../types.js";
import type { JobPipeline } from "../pipeline/job-pipeline.js";
import { buildAutoWording } from "./prompts.js";

export class NoOpenHitlError extends Error {
  constructor() {
    super("no_open_hitl");
    this.name = "NoOpenHitlError";
  }
}

/** Steps where job-step-v1 runs and confirm-next must resume HITL. */
export const ORCHESTRATED_STEPS = new Set([
  "uploaded",
  "inspecting",
  "extracting",
  "checking",
  "pending",
]);

export interface JobStepInput {
  jobId: string;
  step: string;
}

interface PendingHitl {
  runId: string;
  token: string;
  step: string;
}

export function buildJobStepGraphDefinition(
  pipeline: JobPipeline,
  _registry: ToolRegistry,
): GraphDefinition {
  return {
    graphId: "job-step-v1",
    nodes: [
      { id: "start", type: "start" },
      {
        id: "prepare_step",
        type: "fn",
        config: {
          inputChannels: ["input"],
          outputChannel: "prep",
          inlineFn: async (
            inputs: { input?: JobStepInput },
            context: { runId: string },
          ) => {
            const payload = inputs.input;
            if (!payload?.jobId || !payload.step) {
              throw new Error("job-step-v1 requires jobId and step");
            }

            const findings = await pipeline.listFindings(payload.jobId);
            const blocking = findings.filter((f) => f.blocking);

            if (payload.step === "checking" && blocking.length > 0) {
              const wording = buildAutoWording(payload.jobId, blocking);
              await pipeline.checkWording({
                jobId: payload.jobId,
                wording,
                agentRunId: context.runId,
                advanceJobStatus: false,
              });
            }

            return {
              jobId: payload.jobId,
              step: payload.step,
              blocking_count: blocking.length,
            };
          },
        },
      },
      {
        id: "wait_confirm",
        type: "hitl",
        config: {
          payload: { message: "请确认进入下一步（人点 confirm-next 恢复）" },
        },
      },
      {
        id: "advance",
        type: "fn",
        config: {
          inputChannels: ["prep", "hitl_decision_wait_confirm"],
          outputChannel: "output",
          inlineFn: async (inputs: { prep?: { jobId: string } }) => {
            const jobId = inputs.prep?.jobId;
            if (!jobId) {
              throw new Error("job-step-v1 advance missing jobId");
            }
            await pipeline.confirmNext(jobId);
            return { advanced: true, jobId };
          },
        },
      },
      { id: "end", type: "end" },
    ],
    edges: [
      { from: "start", to: "prepare_step" },
      { from: "prepare_step", to: "wait_confirm" },
      { from: "wait_confirm", to: "advance" },
      { from: "advance", to: "end" },
    ],
  };
}

/**
 * Long-lived job HITL orchestration: startRun on cognitive steps, resumeHitl on confirm-next.
 */
export class JobStepOrchestrator {
  private readonly hitlGateway: HitlGateway;
  private readonly pendingHitl = new Map<string, PendingHitl>();

  constructor(
    private readonly plane: ControlPlane,
    private readonly store: SQLiteStateStore,
    private readonly pipeline: JobPipeline,
  ) {
    this.hitlGateway = createHitlGateway(store);
  }

  async onStepEntered(job: JobRow, step: string): Promise<void> {
    if (!ORCHESTRATED_STEPS.has(step)) return;

    if (job.agent_run_id) {
      const existing = await this.plane.getRun(job.agent_run_id);
      if (existing?.metadata.status === "waiting_hitl") {
        return;
      }
    }

    const threadId = `job:${job.job_id}`;
    const started = await this.plane.startRun({
      graphId: "job-step-v1",
      input: { jobId: job.job_id, step } satisfies JobStepInput,
      threadId,
    });

    await this.pipeline.updateJobAgentRunId(job.job_id, started.runId);

    if (started.status === "waiting_hitl" && started.hitlInterrupt) {
      this.pendingHitl.set(job.job_id, {
        runId: started.runId,
        token: started.hitlInterrupt.token,
        step,
      });
      return;
    }

    const settled = await this.plane.waitForRun(started.runId);
    if (settled?.status === "waiting_hitl") {
      const interrupts = await this.hitlGateway.getInterruptsForRun(started.runId);
      const open = interrupts.find((row) => row.status === "pending");
      if (open) {
        this.pendingHitl.set(job.job_id, {
          runId: started.runId,
          token: open.token,
          step,
        });
      }
    }
  }

  async getOpenHitl(jobId: string): Promise<PendingHitl | null> {
    const cached = this.pendingHitl.get(jobId);
    if (cached) return cached;

    const job = await this.pipeline.getJob(jobId);
    if (!job?.agent_run_id) return null;

    const interrupts = await this.hitlGateway.getInterruptsForRun(job.agent_run_id);
    const open = interrupts.find((row) => row.status === "pending");
    if (!open) return null;

    return {
      runId: job.agent_run_id,
      token: open.token,
      step: job.status,
    };
  }

  async resumeConfirm(jobId: string): Promise<JobRow> {
    const pending = await this.getOpenHitl(jobId);
    if (!pending) {
      throw new NoOpenHitlError();
    }

    const decision = {
      action: "approve" as const,
      decidedAt: new Date().toISOString(),
    };

    await this.plane.resumeHitl({
      runId: pending.runId,
      token: pending.token,
      decision,
    });

    await this.plane.waitForRun(pending.runId);
    this.pendingHitl.delete(jobId);

    const job = await this.pipeline.getJob(jobId);
    if (!job) {
      throw new Error(`job not found: ${jobId}`);
    }
    return job;
  }
}
