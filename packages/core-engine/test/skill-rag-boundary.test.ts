/**
 * F-10 Task 10: keep POST /api/standards/search; Skill flow skips RAG (M11/D4/R18).
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToolRegistry, setDefaultLlmProvider, type LlmProvider } from "agent-runtime";
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

class TeachThenCheckLlm implements LlmProvider {
  async complete(options: { prompt: string }): Promise<string> {
    if (options.prompt.includes("Matched check items")) {
      return JSON.stringify({ verdict: "fail", item_results: [] });
    }
    return JSON.stringify(TAUGHT);
  }
}

type RetrieveHitBody = {
  clause_id?: string | null;
  heading?: string | null;
  body?: string | null;
};

async function call(
  session: DemoHttpSession,
  method: string,
  url: string,
  body?: unknown,
) {
  return handleDemoRequest(session, { method, url, body: body ?? {} });
}

describe("Skill RAG boundary (F-10 Task 10)", () => {
  let session: DemoHttpSession;
  let tempRoot: string | undefined;
  const previousConfigEnv = process.env.AGENT_RUNTIME_LLM_CONFIG;
  let previousLlm: LlmProvider | undefined;

  beforeEach(() => {
    delete process.env.AGENT_RUNTIME_LLM_CONFIG;
    previousLlm = undefined;
    setDefaultLlmProvider(new TeachThenCheckLlm());
    tempRoot = mkdtempSync(join(tmpdir(), "skill-rag-boundary-"));
    session = new DemoHttpSession({ projectRoot: tempRoot });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await session.close();
    setDefaultLlmProvider(previousLlm ?? new TeachThenCheckLlm());
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

  async function uploadSkill(demo?: { projectId: string; packId: string }) {
    const ids = demo ?? (await resetDemo());
    const uploaded = await handleDemoRequest(session, {
      method: "POST",
      url: "/api/jobs/upload",
      body: {},
      multipart: {
        file: { bytes: JPEG_BYTES, fileName: "form.jpg", mime: "image/jpeg" },
        fields: { project_id: ids.projectId, pack_id: ids.packId },
      },
    });
    expect(uploaded.status).toBe(200);
    const job = (
      uploaded.body as {
        job: { job_id: string; trace_id: string; track: string; skill_draft_id: string | null };
      }
    ).job;
    expect(job.track).toBe("skill");
    return { ...ids, job };
  }

  it("POST /api/standards/search still 200 and hits a seeded clause (M11)", async () => {
    const { packId } = await resetDemo();
    const res = await call(session, "POST", "/api/standards/search", {
      packId,
      query: "1.1",
    });
    expect(res.status).toBe(200);
    const hits = (res.body as { hits: RetrieveHitBody[] }).hits;
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((hit) => hit.clause_id?.endsWith(":1.1"))).toBe(true);
    expect(hits.some((hit) => hit.heading?.includes("事假") || hit.body?.includes("事假"))).toBe(
      true,
    );
  });

  it("Skill teach registry skips search_clause; leftover HITL keeps library search", () => {
    const pipeline = session.pipeline;
    const teach = createSkillTeachRegistry(pipeline);
    expect(teach.has("search_clause")).toBe(false);
    const leftover = createStepChatRegistry(pipeline);
    expect(leftover.has("search_clause")).toBe(true);
  });

  it("Skill upload/chat/confirm/dry-run never call searchStandard, attach, or search_clause", async () => {
    const pipeline = session.pipeline;
    const search = vi.spyOn(pipeline, "searchStandard");
    const attach = vi.spyOn(pipeline, "attachStandardFitFinding");
    const librarySearch = vi.spyOn(pipeline.library, "searchStandard");
    const libraryAttach = vi.spyOn(pipeline.library, "attachStandardFitFinding");
    const getSpy = vi.spyOn(ToolRegistry.prototype, "get");

    const { job, packId } = await uploadSkill();
    setDefaultLlmProvider(new TeachThenCheckLlm());
    const chat = await call(session, "POST", "/api/chat", {
      trace_id: job.trace_id,
      step: "job_upload",
      body: "查一下规范条款 search_clause，这是混凝土浇筑施工记录，须有编号。",
    });
    expect(chat.status).toBe(200);

    const dry = await call(session, "POST", `/api/jobs/${job.job_id}/skill-dry-run`);
    expect(dry.status).toBe(200);

    const confirm = await call(session, "POST", `/api/jobs/${job.job_id}/confirm-skill`);
    expect(confirm.status).toBe(200);

    const index = await call(session, "GET", `/api/packs/${packId}/skills`);
    expect((index.body as { skills: unknown[] }).skills).toHaveLength(1);

    expect(search).not.toHaveBeenCalled();
    expect(attach).not.toHaveBeenCalled();
    expect(librarySearch).not.toHaveBeenCalled();
    expect(libraryAttach).not.toHaveBeenCalled();
    expect(getSpy.mock.calls.some(([name]) => name === "search_clause")).toBe(false);
  });

  it("leftover search_clause no-ops for a skill-track job without calling library search", async () => {
    const { job, packId } = await uploadSkill();
    const leftover = createStepChatRegistry(session.pipeline);
    const librarySearch = vi.spyOn(session.pipeline.library, "searchStandard");
    const tool = leftover.get("search_clause");
    expect(tool).toBeTruthy();
    const hits = await tool!.handler({ packId, query: "1.1", jobId: job.job_id });
    expect(hits).toEqual([]);
    expect(librarySearch).not.toHaveBeenCalled();
  });

  it("skipping Skill RAG does not disable POST /api/standards/search", async () => {
    const { packId } = await uploadSkill();
    const res = await call(session, "POST", "/api/standards/search", {
      packId,
      query: "1.1",
    });
    expect(res.status).toBe(200);
    const hits = (res.body as { hits: RetrieveHitBody[] }).hits;
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((hit) => hit.clause_id?.endsWith(":1.1"))).toBe(true);
  });
});
