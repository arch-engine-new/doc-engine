/**
 * B-1: Vue posts step=retrieve; pack chat must not bind listJobs()[0]
 * (fixture-reversed.json / findings). Context is this retrieve's hits or 未命中.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FakeLlmProvider, setDefaultLlmProvider } from "agent-runtime";
import { AgentRuntimeFactory } from "../src/agent/agent-runtime-factory.js";
import {
  buildJobContext,
  formatJobContextForPrompt,
  formatRetrieveHitsForPrompt,
} from "../src/agent/context.js";
import { shouldSearchClause, stepSystemPrompt } from "../src/agent/prompts.js";
import { StepChatBridge } from "../src/agent/step-chat-bridge.js";
import { handleDemoRequest } from "../src/http/handle-request.js";
import { DemoHttpSession } from "../src/http/session.js";
import {
  FakePrequery,
  HashEmbeddings,
  IndependentReranker,
  JobPipeline,
  MemoryGraphStore,
  MemoryVectorStore,
} from "../src/index.js";
import type { RetrieveHit } from "../src/retrieve/ports.js";

const LEAVE_TEXT = `1.1 事假须提前申请。
须在休假前一至三个工作日提交书面申请，并经主管确认。
1.2 病假须提供证明。
申请病假应附医疗机构证明，急诊可于返岗后补交。
2.1 审批时限为三个工作日。
主管须在三个工作日内完成审批并书面回复。
`;

const SAMPLE_HIT: RetrieveHit = {
  clause_id: "ver:1.1",
  unit_id: "unit-leave-1-1",
  chunk_kind: "clause",
  file_name: "leave.txt",
  page_start: 1,
  page_end: 1,
  standard_version_id: "ver",
  span: null,
  retrieve_path: "exact",
  heading: "1.1 事假须提前申请",
  body: "须在休假前一至三个工作日提交书面申请，并经主管确认。",
};

function openPipeline(): JobPipeline {
  return JobPipeline.openStandardLibrary({
    vector: new MemoryVectorStore(),
    graph: new MemoryGraphStore(),
    prequery: new FakePrequery({
      "1.1": { rewritten: "1.1", intent: "exact", clauseNo: "1.1" },
      查条: { rewritten: "1.1", intent: "exact", clauseNo: "1.1" },
    }),
    rerank: new IndependentReranker(),
    embed: new HashEmbeddings(),
  });
}

describe("standard_lib step chat", () => {
  let pipeline: JobPipeline;

  beforeEach(() => {
    setDefaultLlmProvider(new FakeLlmProvider());
    pipeline = openPipeline();
  });

  afterEach(async () => {
    await pipeline.close();
    setDefaultLlmProvider(new FakeLlmProvider());
  });

  it("shouldSearchClause treats retrieve like standard_lib", () => {
    expect(shouldSearchClause("retrieve", "你好", "pack-1")).toBe(
      shouldSearchClause("standard_lib", "你好", "pack-1"),
    );
    expect(shouldSearchClause("retrieve", "你好", "pack-1")).toBe(true);
    expect(shouldSearchClause("retrieve", "查条 1.1", "pack-1")).toBe(true);
    expect(shouldSearchClause("retrieve", "你好", null)).toBe(false);
  });

  it("stepSystemPrompt(retrieve) uses standard_lib copy (命中条款 / 未命中)", () => {
    const retrieve = stepSystemPrompt("retrieve");
    const standard = stepSystemPrompt("standard_lib");
    expect(retrieve).toBe(standard);
    expect(retrieve).toContain("标准库");
    expect(retrieve).toContain("命中条款");
    expect(retrieve).toContain("未命中");
    expect(retrieve).not.toBe(stepSystemPrompt("uploaded"));
  });

  it("retrieve/standard_lib context excludes fixture-reversed.json and unrelated findings", async () => {
    const fixture = await pipeline.runFixtureJob({ kind: "reversed" });
    const findings = await pipeline.listFindings(fixture.job.job_id);
    expect(findings.length).toBeGreaterThan(0);

    const project = await pipeline.createProject();
    const pack = await pipeline.createSpecPack({
      projectId: project.project_id,
      name: "请假制度包",
      version: "1",
    });
    const packTrace = `pack:${pack.pack_id}`;

    const missCtx = await buildJobContext(pipeline, packTrace, "retrieve", {
      packId: pack.pack_id,
    });
    const missText = formatJobContextForPrompt(missCtx);
    expect(missText).not.toContain("fixture-reversed.json");
    expect(missText).not.toMatch(/\bfinding/i);
    for (const finding of findings) {
      expect(missText).not.toContain(finding.result);
    }
    expect(missText).toContain("未命中");
    expect(missText).toContain(pack.pack_id);

    const hitCtx = await buildJobContext(pipeline, packTrace, "standard_lib", {
      packId: pack.pack_id,
      hits: [SAMPLE_HIT],
    });
    const hitText = formatJobContextForPrompt(hitCtx);
    expect(hitText).not.toContain("fixture-reversed.json");
    expect(hitText).not.toMatch(/\bfinding/i);
    expect(hitText).toContain(SAMPLE_HIT.clause_id!);
    expect(hitText).toContain(SAMPLE_HIT.unit_id);
    expect(hitText).toContain(SAMPLE_HIT.file_name);

    const leaked = await buildJobContext(pipeline, fixture.job.trace_id, "retrieve", {
      packId: pack.pack_id,
      hits: [SAMPLE_HIT],
    });
    const leakedText = formatJobContextForPrompt(leaked);
    expect(leakedText).not.toContain("fixture-reversed.json");
    expect(leakedText).not.toContain(findings[0]!.result);
    expect(leakedText).toContain(SAMPLE_HIT.unit_id);
  });

  it("retrieve chat uses pack_id, not listJobs()[0].trace_id", async () => {
    const fixture = await pipeline.runFixtureJob({ kind: "reversed" });
    const jobs = await pipeline.listJobs();
    expect(jobs[0]?.trace_id).toBe(fixture.job.trace_id);
    expect(jobs[0]?.trace_id).not.toMatch(/^pack:/);

    const project = await pipeline.createProject();
    const pack = await pipeline.createSpecPack({
      projectId: project.project_id,
      name: "请假制度包",
      version: "1",
    });
    await pipeline.ingestStandard({
      packId: pack.pack_id,
      title: "员工请假说明",
      fileUri: "fixture://leave",
      text: LEAVE_TEXT,
    });

    const packTrace = `pack:${pack.pack_id}`;
    expect(packTrace).not.toBe(jobs[0]!.trace_id);

    const stored = await pipeline.appendChat({
      traceId: packTrace,
      step: "retrieve",
      body: "这条条款是什么意思？",
    });
    expect(stored.thread.trace_id).toBe(packTrace);
    expect(stored.thread.trace_id).not.toBe(jobs[0]!.trace_id);

    const bridge = await StepChatBridge.create({ pipeline, forceFakeLlm: true });
    const result = await bridge.reply({
      traceId: packTrace,
      packId: pack.pack_id,
      step: "retrieve",
      userMessage: "查条 1.1",
      hits: [SAMPLE_HIT],
    });

    expect(result.reply).toContain("[fake-llm");
    expect(result.reply).not.toContain("fixture-reversed.json");
    expect(result.reply).toContain(SAMPLE_HIT.clause_id!);
    expect(result.reply).toContain(SAMPLE_HIT.unit_id);
    expect(result.reply).toContain(SAMPLE_HIT.file_name);
    expect(result.reply).toContain("标准库");
  });

  it("memory DemoHttpSession POST /api/chat without llm.json returns 未配置, not [fake-llm", async () => {
    const previousConfigEnv = process.env.AGENT_RUNTIME_LLM_CONFIG;
    const tempRoot = mkdtempSync(join(tmpdir(), "stepchat-unconfigured-llm-"));
    delete process.env.AGENT_RUNTIME_LLM_CONFIG;
    process.env.AGENT_RUNTIME_LLM_CONFIG = join(tempRoot, "missing-agent-runtime.llm.json");
    const isolated = new DemoHttpSession({ projectRoot: tempRoot });
    try {
      const project = await isolated.pipeline.createProject();
      const pack = await isolated.pipeline.createSpecPack({
        projectId: project.project_id,
        name: "请假制度包",
        version: "1",
      });
      const chat = await handleDemoRequest(isolated, {
        method: "POST",
        url: "/api/chat",
        body: {
          step: "retrieve",
          pack_id: pack.pack_id,
          body: "这条条款是什么意思？",
        },
      });
      expect(chat.status).toBe(200);
      const reply = (chat.body as { assistant_reply?: string }).assistant_reply ?? "";
      expect(reply).toMatch(/未配置/);
      expect(reply).not.toContain("[fake-llm");
    } finally {
      await isolated.close();
      if (previousConfigEnv === undefined) {
        delete process.env.AGENT_RUNTIME_LLM_CONFIG;
      } else {
        process.env.AGENT_RUNTIME_LLM_CONFIG = previousConfigEnv;
      }
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("formatRetrieveHitsForPrompt includes heading and body, not only clause_id", () => {
    const text = formatRetrieveHitsForPrompt([SAMPLE_HIT]);
    expect(text).toContain(SAMPLE_HIT.heading!);
    expect(text).toContain("须在休假前");
    expect(text).toContain("clause_id=");
    expect(text).not.toBe(
      `- clause_id=${SAMPLE_HIT.clause_id} unit_id=${SAMPLE_HIT.unit_id} file_name=${SAMPLE_HIT.file_name}`,
    );
  });

  it("formatRetrieveHitsForPrompt empty list is 未命中", () => {
    expect(formatRetrieveHitsForPrompt([])).toBe("未命中");
  });

  it("formatRetrieveHitsForPrompt truncates body over 800 chars with …", () => {
    const longBody = "甲".repeat(2000);
    const text = formatRetrieveHitsForPrompt([{ ...SAMPLE_HIT, body: longBody }]);
    expect(text).toContain("…");
    expect(text.length).toBeLessThan(longBody.length);
    expect(text).not.toContain(longBody);
    expect(text).toContain(longBody.slice(0, 800));
  });

  it("formatRetrieveHitsForPrompt uses 无标题 and 无正文 for empty strings", () => {
    const text = formatRetrieveHitsForPrompt([{ ...SAMPLE_HIT, heading: "", body: "" }]);
    expect(text).toContain("无标题");
    expect(text).toContain("无正文");
  });

  it("buildJobContext retrieve prompt includes hit heading and body", async () => {
    const project = await pipeline.createProject();
    const pack = await pipeline.createSpecPack({
      projectId: project.project_id,
      name: "请假制度包",
      version: "1",
    });
    const ctx = await buildJobContext(pipeline, `pack:${pack.pack_id}`, "retrieve", {
      packId: pack.pack_id,
      hits: [SAMPLE_HIT],
    });
    const text = formatJobContextForPrompt(ctx);
    expect(text).toContain(SAMPLE_HIT.heading!);
    expect(text).toContain(SAMPLE_HIT.body!);
  });

  it("POST /api/chat parseRetrieveHits keeps heading and body in FakeLlm prompt", async () => {
    await AgentRuntimeFactory.getOrCreate({ pipeline, forceFakeLlm: true });
    const session = new DemoHttpSession({ pipeline });
    const project = await pipeline.createProject();
    const pack = await pipeline.createSpecPack({
      projectId: project.project_id,
      name: "请假制度包",
      version: "1",
    });
    const chat = await handleDemoRequest(session, {
      method: "POST",
      url: "/api/chat",
      body: {
        step: "retrieve",
        pack_id: pack.pack_id,
        body: "这条条款是什么意思？",
        hits: [SAMPLE_HIT],
      },
    });
    expect(chat.status).toBe(200);
    const reply = (chat.body as { assistant_reply?: string }).assistant_reply ?? "";
    expect(reply).toContain("[fake-llm");
    expect(reply).toContain(SAMPLE_HIT.heading!);
    expect(reply).toContain(SAMPLE_HIT.body!);
  });
});
