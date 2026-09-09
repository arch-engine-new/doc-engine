/**
 * Native step-chat-v1 graph: search_clause tool + llm node under FakeLlm.
 * Leave-request fixture only. Does not write Receipt or invent clause_id.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  FakePrequery,
  HashEmbeddings,
  IndependentReranker,
  JobPipeline,
  MemoryGraphStore,
  MemoryVectorStore,
} from "../src/index.js";
import { AgentRuntimeFactory } from "../src/agent/agent-runtime-factory.js";
import { StepChatBridge } from "../src/agent/step-chat-bridge.js";

const LEAVE_TEXT = `1.1 事假须提前申请。
须在休假前一至三个工作日提交书面申请，并经主管确认。
1.2 病假须提供证明。
申请病假应附医疗机构证明，急诊可于返岗后补交。
2.1 审批时限为三个工作日。
主管须在三个工作日内完成审批并书面回复。
`;

const QUERY_CLAUSE_1_1 = "查条 1.1";

describe("native step-chat graph", () => {
  let pipeline: JobPipeline;

  beforeEach(() => {
    pipeline = JobPipeline.openStandardLibrary({
      vector: new MemoryVectorStore(),
      graph: new MemoryGraphStore(),
      prequery: new FakePrequery({
        "1.1": { rewritten: "1.1", intent: "exact", clauseNo: "1.1" },
        [QUERY_CLAUSE_1_1]: { rewritten: "1.1", intent: "exact", clauseNo: "1.1" },
      }),
      rerank: new IndependentReranker(),
      embed: new HashEmbeddings(),
    });
  });

  afterEach(async () => {
    await pipeline.close();
  });

  it("checking + 查条 1.1 after ingest cites real clause_id and traces search_clause + llm", async () => {
    const project = await pipeline.createProject();
    const pack = await pipeline.createSpecPack({
      projectId: project.project_id,
      name: "请假制度包",
      version: "1",
    });
    const ingested = await pipeline.ingestStandard({
      packId: pack.pack_id,
      title: "员工请假说明",
      fileUri: "fixture://leave",
      text: LEAVE_TEXT,
    });
    const clauseId = `${ingested.version.version_id}:1.1`;
    const job = await pipeline.openJobForPack({
      projectId: pack.project_id,
      packId: pack.pack_id,
    });

    const bridge = await StepChatBridge.create({ pipeline, forceFakeLlm: true });
    const result = await bridge.reply({
      traceId: job.trace_id,
      step: "checking",
      userMessage: QUERY_CLAUSE_1_1,
    });

    expect(result.reply).toContain(clauseId);
    expect(result.reply).not.toMatch(/第999条/);
    expect(await pipeline.listReceipts(job.job_id)).toHaveLength(0);

    const factory = await AgentRuntimeFactory.getOrCreate({ pipeline, forceFakeLlm: true });
    const trace = await factory.plane.getTrace(result.agentRunId);
    const toolNames = trace
      .filter((row) => row.eventType === "tool_call")
      .map((row) => (row.payload as { toolName?: string }).toolName);
    expect(toolNames).toContain("search_clause");
    expect(
      trace.some(
        (row) =>
          row.eventType === "node_start" && (row.payload as { nodeType?: string }).nodeType === "llm",
      ),
    ).toBe(true);
  });

  it("checking + 查条 1.1 without ingest does not invent or attach findings", async () => {
    const project = await pipeline.createProject();
    const pack = await pipeline.createSpecPack({
      projectId: project.project_id,
      name: "请假制度包",
      version: "1",
    });
    const job = await pipeline.openJobForPack({
      projectId: pack.project_id,
      packId: pack.pack_id,
    });
    const findingsBefore = await pipeline.listFindings(job.job_id);

    const bridge = await StepChatBridge.create({ pipeline, forceFakeLlm: true });
    const result = await bridge.reply({
      traceId: job.trace_id,
      step: "checking",
      userMessage: QUERY_CLAUSE_1_1,
    });

    expect(result.reply).toMatch(/未命中|未检索/);
    expect(result.reply).not.toMatch(/第999条/);
    const findingsAfter = await pipeline.listFindings(job.job_id);
    expect(findingsAfter).toHaveLength(findingsBefore.length);
    expect(await pipeline.listReceipts(job.job_id)).toHaveLength(0);
  });
});
