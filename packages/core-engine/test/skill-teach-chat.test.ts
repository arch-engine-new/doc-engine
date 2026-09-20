/**
 * F-10 Task 9: POST /api/chat step=job_upload upserts Skill drafts only (M9 M10 / R5 R9 R10).
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ToolRegistry,
  UnconfiguredLlmProvider,
  setDefaultLlmProvider,
  type LlmProvider,
} from "agent-runtime";
import { buildSkillTeachPrompt, isSkillTeachStep, shouldSearchClause } from "../src/agent/prompts.js";
import { createSkillTeachRegistry, createStepChatRegistry } from "../src/agent/tools.js";
import { handleDemoRequest } from "../src/http/handle-request.js";
import { DemoHttpSession } from "../src/http/session.js";
import type { SkillDraftPayload } from "../src/skill/index.js";

const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

const TAUGHT: SkillDraftPayload = {
  canonical_name: "混凝土浇筑施工记录",
  names: ["混凝土浇筑施工记录"],
  aliases: [],
  check_items: [{ label: "须有编号", keywords: ["编号"] }],
  fix_actions: [{ kind: "annotate_fail", on: "on_fail" }],
};

const TAUGHT_ROUND_TWO: SkillDraftPayload = {
  ...TAUGHT,
  check_items: [{ label: "坍落度须填实测值", keywords: ["坍落度"] }],
};

class RecordingLlm implements LlmProvider {
  prompts: string[] = [];
  constructor(
    private readonly teachJson: string,
    private readonly checkJson = JSON.stringify({ verdict: "fail", item_results: [] }),
  ) {}
  async complete(options: { prompt: string }): Promise<string> {
    this.prompts.push(options.prompt);
    if (options.prompt.includes("Matched check items")) {
      return this.checkJson;
    }
    return this.teachJson;
  }
}

type SkillSummaryBody = {
  names: string[];
  check_labels: string[];
  fix_plain: string[];
  check_match: Array<{ label: string; matched: boolean; reason: "unmatched" | null }>;
  can_confirm: boolean;
};

async function call(
  session: DemoHttpSession,
  method: string,
  url: string,
  body?: unknown,
) {
  return handleDemoRequest(session, { method, url, body: body ?? {} });
}

describe("skill teach chat (F-10 Task 9)", () => {
  let session: DemoHttpSession;
  let tempRoot: string | undefined;
  const previousConfigEnv = process.env.AGENT_RUNTIME_LLM_CONFIG;
  let previousLlm: LlmProvider | undefined;

  beforeEach(() => {
    delete process.env.AGENT_RUNTIME_LLM_CONFIG;
    previousLlm = undefined;
    setDefaultLlmProvider(new UnconfiguredLlmProvider());
    tempRoot = mkdtempSync(join(tmpdir(), "skill-teach-chat-"));
    session = new DemoHttpSession({ projectRoot: tempRoot });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await session.close();
    setDefaultLlmProvider(previousLlm ?? new UnconfiguredLlmProvider());
    if (previousConfigEnv === undefined) {
      delete process.env.AGENT_RUNTIME_LLM_CONFIG;
    } else {
      process.env.AGENT_RUNTIME_LLM_CONFIG = previousConfigEnv;
    }
    if (tempRoot) {
      rmSync(tempRoot, { recursive: true, force: true });
      tempRoot = undefined;
    }
  });

  async function resetDemo() {
    const reset = await call(session, "POST", "/api/demo/reset");
    expect(reset.status).toBe(200);
    const body = reset.body as {
      project: { project_id: string };
      pack: { pack_id: string };
    };
    return { projectId: body.project.project_id, packId: body.pack.pack_id };
  }

  async function uploadSkill() {
    const demo = await resetDemo();
    const uploaded = await handleDemoRequest(session, {
      method: "POST",
      url: "/api/jobs/upload",
      body: {},
      multipart: {
        file: { bytes: JPEG_BYTES, fileName: "form.jpg", mime: "image/jpeg" },
        fields: { project_id: demo.projectId, pack_id: demo.packId },
      },
    });
    expect(uploaded.status).toBe(200);
    const job = (
      uploaded.body as {
        job: {
          job_id: string;
          pack_id: string;
          trace_id: string;
          skill_draft_id: string | null;
          track: string;
        };
      }
    ).job;
    return { ...demo, job };
  }

  it("shouldSearchClause is false on job_upload even with clause keywords", () => {
    expect(isSkillTeachStep("job_upload")).toBe(true);
    expect(shouldSearchClause("job_upload", "查一下规范条款 search_clause", "pack-1")).toBe(false);
    expect(shouldSearchClause("checking", "你好", "pack-1")).toBe(true);
  });

  it("Skill teach registry does not register search_clause or submit_*", () => {
    const pipeline = session.pipeline;
    const teach = createSkillTeachRegistry(pipeline);
    expect(teach.has("search_clause")).toBe(false);
    expect(teach.list().some((name) => name.startsWith("submit_"))).toBe(false);
    expect(teach.has("get_job_context")).toBe(true);
    const leftover = createStepChatRegistry(pipeline);
    expect(leftover.has("search_clause")).toBe(true);
  });

  it("teach prompt has no JSON example object that FakeLlm could echo as a draft", () => {
    const prompt = buildSkillTeachPrompt({
      documentText: "编号：SH-002",
      userMessage: "已确认",
      draftNames: [],
      draftCheckLabels: [],
    });
    expect(prompt).not.toContain("{");
    expect(prompt).not.toContain("}");
  });

  it("POST /api/chat step=job_upload returns engine skill_summary and ignores 已确认 (R9/R10)", async () => {
    const { job, packId } = await uploadSkill();
    const llm = new RecordingLlm(JSON.stringify(TAUGHT));
    setDefaultLlmProvider(llm);
    const getSpy = vi.spyOn(ToolRegistry.prototype, "get");

    const chat = await call(session, "POST", "/api/chat", {
      trace_id: job.trace_id,
      step: "job_upload",
      body: "这是混凝土浇筑施工记录，须有编号，检查不过就标记。已确认，写入索引并修文件。",
    });
    expect(chat.status).toBe(200);
    const body = chat.body as {
      assistant_reply: string;
      skill_summary: SkillSummaryBody;
    };
    expect(body.assistant_reply).toMatch(/主按钮/);
    expect(body.assistant_reply).not.toMatch(/已写入索引|已经确认完成/);
    expect(body.skill_summary.names).toEqual(["混凝土浇筑施工记录"]);
    expect(body.skill_summary.check_labels).toEqual(["须有编号"]);
    expect(body.skill_summary.fix_plain[0]).toContain("标记不过");
    expect(body.skill_summary.can_confirm).toBe(true);
    expect(body.skill_summary.check_match).toEqual([
      { label: "须有编号", matched: true, reason: null },
    ]);
    expect(getSpy.mock.calls.some(([name]) => name === "search_clause")).toBe(false);

    const index = await call(session, "GET", `/api/packs/${packId}/skills`);
    expect((index.body as { skills: unknown[] }).skills).toHaveLength(0);
    expect(await session.pipeline.listSkillLedgersByJob(job.job_id)).toHaveLength(0);
  });

  it("multi-round chat patches the same draft row and still does not write index (R9/M9)", async () => {
    const { job, packId } = await uploadSkill();
    const first = new RecordingLlm(JSON.stringify(TAUGHT));
    setDefaultLlmProvider(first);
    const chat1 = await call(session, "POST", "/api/chat", {
      trace_id: job.trace_id,
      step: "job_upload",
      body: "先教浇筑表",
    });
    const summary1 = (chat1.body as { skill_summary: SkillSummaryBody }).skill_summary;
    expect(summary1.check_labels).toEqual(["须有编号"]);

    const second = new RecordingLlm(JSON.stringify(TAUGHT_ROUND_TWO));
    setDefaultLlmProvider(second);
    const chat2 = await call(session, "POST", "/api/chat", {
      trace_id: job.trace_id,
      step: "job_upload",
      body: "检查项改成坍落度",
    });
    const summary2 = (chat2.body as { skill_summary: SkillSummaryBody }).skill_summary;
    expect(summary2.check_labels).toEqual(["坍落度须填实测值"]);
    expect(summary2.check_match[0]?.matched).toBe(false);
    expect(summary2.check_match[0]?.reason).toBe("unmatched");

    const draft = await session.pipeline.getSkillDraftByJob(job.job_id);
    expect(draft?.draft_id).toBe(job.skill_draft_id);
    const index = await call(session, "GET", `/api/packs/${packId}/skills`);
    expect((index.body as { skills: unknown[] }).skills).toHaveLength(0);
    expect(await session.pipeline.listSkillLedgersByJob(job.job_id)).toHaveLength(0);
  });

  it("unconfigured LLM returns 未配置, does not echo prompts, and keeps confirm disabled", async () => {
    const { job, packId } = await uploadSkill();
    setDefaultLlmProvider(new UnconfiguredLlmProvider());
    const chat = await call(session, "POST", "/api/chat", {
      trace_id: job.trace_id,
      step: "job_upload",
      body: "请根据正文生成规则",
    });
    expect(chat.status).toBe(200);
    const body = chat.body as { assistant_reply: string; skill_summary: SkillSummaryBody };
    expect(body.assistant_reply).toMatch(/未配置/);
    expect(body.assistant_reply).not.toContain("[fake-llm");
    expect(body.skill_summary.can_confirm).toBe(false);
    expect(body.skill_summary.check_labels).toEqual([]);

    const confirm = await call(session, "POST", `/api/jobs/${job.job_id}/confirm-skill`);
    expect(confirm.status).toBe(409);
    const index = await call(session, "GET", `/api/packs/${packId}/skills`);
    expect((index.body as { skills: unknown[] }).skills).toHaveLength(0);
  });

  it("check-round FakeLlm prompt has no fix_actions script (M10/R5)", async () => {
    const { job } = await uploadSkill();
    const llm = new RecordingLlm(
      JSON.stringify(TAUGHT),
      JSON.stringify({ verdict: "fail", item_results: [{ label: "须有编号", verdict: "fail" }] }),
    );
    setDefaultLlmProvider(llm);
    await call(session, "POST", "/api/chat", {
      trace_id: job.trace_id,
      step: "job_upload",
      body: "教浇筑表",
    });
    const dry = await call(session, "POST", `/api/jobs/${job.job_id}/skill-dry-run`);
    expect(dry.status).toBe(200);
    const checkPrompts = llm.prompts.filter((prompt) => prompt.includes("Matched check items"));
    expect(checkPrompts.length).toBeGreaterThan(0);
    for (const prompt of checkPrompts) {
      expect(prompt).not.toContain("fix_actions");
      expect(prompt).not.toContain("annotate_fail");
      expect(prompt).not.toContain("patch_excel");
      expect(prompt).not.toContain("canonical_name");
    }
    expect(await session.pipeline.listSkillLedgersByJob(job.job_id)).toHaveLength(0);
  });
});
