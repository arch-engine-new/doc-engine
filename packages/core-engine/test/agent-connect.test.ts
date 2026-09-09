import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  FakeLlmProvider,
  setDefaultLlmProvider,
} from "agent-runtime";
import { JobPipeline } from "../src/pipeline/job-pipeline.js";
import { StepChatBridge } from "../src/agent/step-chat-bridge.js";
import { shouldDraftWording, shouldSearchClause } from "../src/agent/prompts.js";

describe("agent connect", () => {
  let pipeline: JobPipeline;

  beforeEach(async () => {
    setDefaultLlmProvider(new FakeLlmProvider());
    pipeline = JobPipeline.openStandardLibrary();
    await pipeline.runFixtureJob({ kind: "reversed" });
  });

  afterEach(async () => {
    await pipeline.close();
    setDefaultLlmProvider(new FakeLlmProvider());
  });

  it("shouldDraftWording matches pending_review keywords", () => {
    expect(shouldDraftWording("pending_review", "请生成提案措辞")).toBe(true);
    expect(shouldDraftWording("checking", "你好")).toBe(false);
  });

  it("shouldSearchClause requires pack and keyword or clause step", () => {
    expect(shouldSearchClause("checking", "查一下规范条款", null)).toBe(false);
    expect(shouldSearchClause("checking", "查一下规范条款", undefined)).toBe(false);
    expect(shouldSearchClause("checking", "查一下规范条款", "")).toBe(false);
    expect(shouldSearchClause("uploaded", "查一下规范条款", "pack-1")).toBe(true);
    expect(shouldSearchClause("uploaded", "search_clause", "pack-1")).toBe(true);
    expect(shouldSearchClause("checking", "你好", "pack-1")).toBe(true);
    expect(shouldSearchClause("check_findings", "你好", "pack-1")).toBe(true);
    expect(shouldSearchClause("standard_lib", "你好", "pack-1")).toBe(true);
    expect(shouldSearchClause("uploaded", "你好", "pack-1")).toBe(false);
  });

  it("StepChatBridge.reply returns fake-llm text and agent_run_id", async () => {
    const jobs = await pipeline.listJobs();
    const job = jobs[0]!;
    const bridge = await StepChatBridge.create({ pipeline, forceFakeLlm: true });

    const result = await bridge.reply({
      traceId: job.trace_id,
      step: "checking",
      userMessage: "这条 blocking 是什么意思？",
    });

    expect(result.agentRunId.length).toBeGreaterThan(0);
    expect(result.reply).toContain("[fake-llm");
    expect(result.proposalId).toBeUndefined();
  });

  it("wording intent triggers check_wording Tool and proposal_id", async () => {
    const jobs = await pipeline.listJobs();
    const job = jobs.find((j) => j.status === "checking") ?? jobs[0]!;
    const bridge = await StepChatBridge.create({ pipeline, forceFakeLlm: true });

    const before = await pipeline.listPending(job.job_id);
    const result = await bridge.reply({
      traceId: job.trace_id,
      step: "pending_review",
      userMessage: "请生成提案措辞",
    });

    expect(result.proposalId).toBeTruthy();
    expect(result.reply).toContain("proposal_id=");
    const after = await pipeline.listPending(job.job_id);
    expect(after.length).toBeGreaterThan(before.length);
    expect(await pipeline.listReceipts(job.job_id)).toHaveLength(0);
  });
});
