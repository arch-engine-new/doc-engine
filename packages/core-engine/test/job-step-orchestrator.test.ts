import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FakeLlmProvider, setDefaultLlmProvider } from "agent-runtime";
import { AgentRuntimeFactory } from "../src/agent/agent-runtime-factory.js";
import { JobStepOrchestrator } from "../src/agent/job-step-orchestrator.js";
import { JobPipeline } from "../src/pipeline/job-pipeline.js";

describe("JobStepOrchestrator", () => {
  let pipeline: JobPipeline;
  let orchestrator: JobStepOrchestrator;

  beforeEach(async () => {
    setDefaultLlmProvider(new FakeLlmProvider());
    pipeline = JobPipeline.openStandardLibrary();
    const factory = await AgentRuntimeFactory.getOrCreate({
      pipeline,
      forceFakeLlm: true,
      storePath: ":memory:",
    });
    pipeline.stepOrchestrator = factory.getJobStepOrchestrator();
    orchestrator = factory.getJobStepOrchestrator();
  });

  afterEach(async () => {
    await pipeline.close();
    setDefaultLlmProvider(new FakeLlmProvider());
  });

  it("starts agent run at checking and auto creates proposal for blocking findings", async () => {
    const { job } = await pipeline.runFixtureJob({ kind: "reversed" });
    expect(job.status).toBe("checking");
    expect(job.agent_run_id).toBeTruthy();

    const pending = await pipeline.listPending(job.job_id);
    expect(pending.length).toBeGreaterThan(0);

    const open = await orchestrator.getOpenHitl(job.job_id);
    expect(open?.runId).toBe(job.agent_run_id);
  });

  it("resumeConfirm advances checking to pending via resumeHitl", async () => {
    const { job } = await pipeline.runFixtureJob({ kind: "reversed" });
    const advanced = await orchestrator.resumeConfirm(job.job_id);
    expect(advanced.status).toBe("pending");
  });

  it("resumeConfirm without open HITL throws NoOpenHitlError", async () => {
    const { job } = await pipeline.runFixtureJob({ kind: "ok" });
    await orchestrator.resumeConfirm(job.job_id);
    await expect(orchestrator.resumeConfirm(job.job_id)).rejects.toThrow("no_open_hitl");
  });
});
