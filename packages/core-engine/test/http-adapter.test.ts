/**
 * HTTP adapter around JobPipeline — process-local, no browser.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DemoHttpSession } from "../src/http/session.js";
import { handleDemoRequest } from "../src/http/handle-request.js";

async function call(
  session: DemoHttpSession,
  method: string,
  url: string,
  body?: unknown,
) {
  return handleDemoRequest(session, { method, url, body: body ?? {} });
}

describe("core-engine HTTP adapter", () => {
  let session: DemoHttpSession;

  beforeEach(() => {
    session = new DemoHttpSession();
  });

  afterEach(async () => {
    await session.close();
  });

  it("POST /api/demo/reset is idempotent and seeds fixture jobs", async () => {
    const first = await call(session, "POST", "/api/demo/reset");
    expect(first.status).toBe(200);
    const firstBody = first.body as { jobs: { job: { job_id: string } }[] };
    expect(firstBody.jobs).toHaveLength(2);

    const second = await call(session, "POST", "/api/demo/reset");
    expect(second.status).toBe(200);
    const listed = await call(session, "GET", "/api/jobs");
    const jobs = (listed.body as { jobs: { job_id: string }[] }).jobs;
    expect(jobs).toHaveLength(2);
    expect(jobs.map((j) => j.job_id)).not.toContain(firstBody.jobs[0]!.job.job_id);
  });

  it("GET /api/jobs lists fixture jobs after reset", async () => {
    await call(session, "POST", "/api/demo/reset");
    const res = await call(session, "GET", "/api/jobs");
    expect(res.status).toBe(200);
    const jobs = (res.body as { jobs: { status: string; file_name: string | null }[] }).jobs;
    expect(jobs.length).toBeGreaterThan(0);
    expect(jobs.some((j) => j.file_name?.includes("fixture-"))).toBe(true);
  });

  it("POST /api/chat does not confirm, publish, submit, or change job.status", async () => {
    await call(session, "POST", "/api/demo/reset");
    const listed = await call(session, "GET", "/api/jobs");
    const jobs = (listed.body as { jobs: { job_id: string; trace_id: string; status: string }[] }).jobs;
    const checking = jobs.find((j) => j.status === "checking");
    expect(checking).toBeTruthy();

    const chat = await call(session, "POST", "/api/chat", {
      trace_id: checking!.trace_id,
      step: "checking",
      body: "请确认并提交",
    });
    expect(chat.status).toBe(200);

    const after = await session.pipeline.getJob(checking!.job_id);
    expect(after?.status).toBe("checking");
    expect(await session.pipeline.listReceipts(checking!.job_id)).toHaveLength(0);
  });

  it("POST /api/jobs/:id/confirm-next advances checking → pending", async () => {
    await call(session, "POST", "/api/demo/reset");
    const listed = await call(session, "GET", "/api/jobs");
    const jobs = (listed.body as { jobs: { job_id: string; status: string }[] }).jobs;
    const checking = jobs.find((j) => j.status === "checking");
    expect(checking).toBeTruthy();

    const res = await call(session, "POST", `/api/jobs/${checking!.job_id}/confirm-next`);
    expect(res.status).toBe(200);
    expect((res.body as { job: { status: string } }).job.status).toBe("pending");
  });

  it("volume preview tree.submitted is always false; POST does not submit", async () => {
    await call(session, "POST", "/api/demo/reset");
    const listed = await call(session, "GET", "/api/jobs");
    const jobId = (listed.body as { jobs: { job_id: string }[] }).jobs[0]!.job_id;

    const posted = await call(session, "POST", `/api/jobs/${jobId}/volume`);
    expect(posted.status).toBe(200);
    const tree = (posted.body as { tree: { submitted: boolean } }).tree;
    expect(tree.submitted).toBe(false);

    const got = await call(session, "GET", `/api/jobs/${jobId}/volume`);
    expect(got.status).toBe(200);
    expect((got.body as { tree: { submitted: boolean } }).tree.submitted).toBe(false);
    expect((await session.pipeline.getJob(jobId))?.status).not.toBe("submitted");
  });

  it("POST /adapter/pending-mount returns receipt_id", async () => {
    const res = await call(session, "POST", "/adapter/pending-mount");
    expect(res.status).toBe(200);
    const body = res.body as { receipt_id: string; status: string };
    expect(body.receipt_id.length).toBeGreaterThan(0);
    expect(body.status).toBe("pending");
  });

  it("GET /api/dict/:dictType returns dropdown items", async () => {
    const res = await call(session, "GET", "/api/dict/job_status");
    expect(res.status).toBe(200);
    const items = (res.body as { items: { value: string }[] }).items;
    expect(items.map((i) => i.value)).toContain("checking");
  });

  it("appendChat does not confirm a pending proposal", async () => {
    await call(session, "POST", "/api/demo/reset");
    const proposals = await call(session, "GET", "/api/proposals");
    const list = (proposals.body as { proposals: { proposal_id: string; job_id: string }[] }).proposals;
    expect(list.length).toBeGreaterThan(0);
    const job = (await session.pipeline.getJob(list[0]!.job_id))!;

    await call(session, "POST", "/api/chat", {
      traceId: job.trace_id,
      step: "pending_review",
      body: "已确认",
    });

    const still = await call(session, "GET", "/api/proposals");
    const after = (still.body as { proposals: { proposal_id: string }[] }).proposals;
    expect(after.some((p) => p.proposal_id === list[0]!.proposal_id)).toBe(true);
    expect(await session.pipeline.listReceipts(job.job_id)).toHaveLength(0);
  });

  it("GET/POST /api/projects and packs round-trip", async () => {
    const created = await call(session, "POST", "/api/projects", { name: "夹具项目" });
    expect(created.status).toBe(200);
    const projectId = (created.body as { project: { project_id: string } }).project.project_id;

    const pack = await call(session, "POST", "/api/packs", {
      projectId,
      name: "空规范包",
      version: "1",
    });
    expect(pack.status).toBe(200);

    const listed = await call(session, "GET", `/api/projects/${projectId}/packs`);
    expect((listed.body as { packs: unknown[] }).packs).toHaveLength(1);
  });

  it("reset seeds 空规范包 + template on the demo project (not industry packs)", async () => {
    const res = await call(session, "POST", "/api/demo/reset");
    expect(res.status).toBe(200);
    const body = res.body as {
      project: { project_id: string };
      pack: { pack_id: string; name: string; project_id: string };
      template: { template_id: string; pack_id: string };
      jobs: { job: { job_id: string; trace_id: string } }[];
    };
    expect(body.pack.name).toBe("空规范包");
    expect(body.pack.project_id).toBe(body.project.project_id);
    expect(body.template.pack_id).toBe(body.pack.pack_id);
    expect(JSON.stringify(body)).not.toMatch(/公路|水利|房建/);

    const packs = await call(session, "GET", `/api/projects/${body.project.project_id}/packs`);
    const listed = (packs.body as { packs: { name: string; templates: { template_id: string }[] }[] }).packs;
    expect(listed.some((p) => p.name === "空规范包" && p.templates.length > 0)).toBe(true);

    const tpls = await call(session, "GET", `/api/packs/${body.pack.pack_id}/templates`);
    expect(tpls.status).toBe(200);
    expect((tpls.body as { templates: unknown[] }).templates.length).toBeGreaterThan(0);

    const gotTpl = await call(session, "GET", `/api/templates/${body.template.template_id}`);
    expect(gotTpl.status).toBe(200);

    const volume = await call(session, "POST", `/api/jobs/${body.jobs[0]!.job.job_id}/volume`);
    expect(volume.status).toBe(200);
    expect((volume.body as { tree: { submitted: boolean } }).tree.submitted).toBe(false);
  });

  it("POST /api/packs/:id/group-keys and GET /api/packs/:id", async () => {
    await call(session, "POST", "/api/demo/reset");
    const created = await call(session, "POST", "/api/projects", { name: "分组项目" });
    const projectId = (created.body as { project: { project_id: string } }).project.project_id;
    const packRes = await call(session, "POST", "/api/packs", {
      projectId,
      name: "空规范包",
    });
    const packId = (packRes.body as { pack: { pack_id: string } }).pack.pack_id;

    const updated = await call(session, "POST", `/api/packs/${packId}/group-keys`, {
      groupKeys: ["zone", "process"],
      orderKey: "seq",
    });
    expect(updated.status).toBe(200);
    const pack = (updated.body as { pack: { group_keys_json: string; order_key: string } }).pack;
    expect(JSON.parse(pack.group_keys_json)).toEqual(["zone", "process"]);
    expect(pack.order_key).toBe("seq");
    expect(JSON.stringify(pack)).not.toMatch(/公路|水利|房建/);

    const got = await call(session, "GET", `/api/packs/${packId}`);
    expect(got.status).toBe(200);
  });
});
