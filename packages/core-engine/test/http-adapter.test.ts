/**
 * HTTP adapter around JobPipeline — process-local, no browser.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DemoHttpSession } from "../src/http/session.js";
import { handleDemoRequest } from "../src/http/handle-request.js";
import {
  DOC_TYPE_CHILD_ID,
  PACK_ID,
} from "../src/pipeline/seed.js";

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

  it("GET /api/health on memory session returns mode memory", async () => {
    const res = await call(session, "GET", "/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      mode: "memory",
      postgres: "skip",
      qdrant: "skip",
      neo4j: "skip",
      ocr: "skip",
      minio: "skip",
    });
    expect(["ok", "skip"]).toContain((res.body as { llm: string }).llm);
  });

  it("POST /api/jobs/upload with multipart file creates a checking job", async () => {
    const reset = await call(session, "POST", "/api/demo/reset");
    expect(reset.status).toBe(200);
    const resetBody = reset.body as {
      project: { project_id: string };
      pack: { pack_id: string };
      template: { template_id: string };
    };
    const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

    const res = await handleDemoRequest(session, {
      method: "POST",
      url: "/api/jobs/upload",
      body: {},
      multipart: {
        file: { bytes: JPEG_BYTES, fileName: "form.jpg", mime: "image/jpeg" },
        fields: {
          project_id: resetBody.project.project_id,
          pack_id: resetBody.pack.pack_id,
          template_id: resetBody.template.template_id,
        },
      },
    });
    expect(res.status).toBe(200);
    const body = res.body as { job: { status: string; job_id: string } };
    expect(body.job.status).toBe("checking");

    const listed = await call(session, "GET", "/api/jobs");
    const jobs = (listed.body as { jobs: { job_id: string }[] }).jobs;
    expect(jobs.some((j) => j.job_id === body.job.job_id)).toBe(true);
  });

  it("POST /api/jobs/upload without doc_type_id or template_id returns 400", async () => {
    await call(session, "POST", "/api/demo/reset");
    const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

    const res = await handleDemoRequest(session, {
      method: "POST",
      url: "/api/jobs/upload",
      body: {},
      multipart: {
        file: { bytes: JPEG_BYTES, fileName: "form.jpg", mime: "image/jpeg" },
        fields: {},
      },
    });
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toMatch(/doc_type_id or template_id required/i);
  });

  it("POST /api/jobs/upload maps UploadValidationError to 400", async () => {
    const reset = await call(session, "POST", "/api/demo/reset");
    const resetBody = reset.body as {
      project: { project_id: string };
      pack: { pack_id: string };
      template: { template_id: string };
    };
    const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

    const res = await handleDemoRequest(session, {
      method: "POST",
      url: "/api/jobs/upload",
      body: {},
      multipart: {
        file: { bytes: JPEG_BYTES, fileName: "notes.txt", mime: "text/plain" },
        fields: {
          project_id: resetBody.project.project_id,
          pack_id: resetBody.pack.pack_id,
          template_id: resetBody.template.template_id,
        },
      },
    });
    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toMatch(/unsupported mime/i);
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
    const chatBody = chat.body as { assistant_reply?: string };
    expect(chatBody.assistant_reply?.length).toBeGreaterThan(0);

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

  it("GET /api/agent/runs lists job-step runs after demo reset", async () => {
    await call(session, "POST", "/api/demo/reset");
    const res = await call(session, "GET", "/api/agent/runs");
    expect(res.status).toBe(200);
    const runs = (res.body as { runs: Array<{ metadata: { graphId: string } }> }).runs;
    expect(runs.some((r) => r.metadata.graphId === "job-step-v1")).toBe(true);
  });

  it("GET /api/agent/runs/:id/trace returns run_started (T2)", async () => {
    await call(session, "POST", "/api/demo/reset");
    const listed = await call(session, "GET", "/api/agent/runs");
    const runs = (listed.body as { runs: Array<{ metadata: { runId: string; graphId: string } }> }).runs;
    const jobStep = runs.find((r) => r.metadata.graphId === "job-step-v1");
    expect(jobStep).toBeTruthy();

    const traceRes = await call(session, "GET", `/api/agent/runs/${jobStep!.metadata.runId}/trace`);
    expect(traceRes.status).toBe(200);
    const trace = (traceRes.body as { trace: { eventType: string }[] }).trace;
    expect(trace.length).toBeGreaterThan(0);
    expect(trace.some((e) => e.eventType === "run_started")).toBe(true);
  });

  it("POST /api/agent/runs/:id/resume advances waiting_hitl run (T3)", async () => {
    await call(session, "POST", "/api/demo/reset");
    const jobsRes = await call(session, "GET", "/api/jobs");
    const checking = (jobsRes.body as { jobs: { job_id: string; status: string }[] }).jobs.find(
      (j) => j.status === "checking",
    );
    expect(checking).toBeTruthy();

    const orchestrator = await session.getJobStepOrchestrator();
    const open = await orchestrator.getOpenHitl(checking!.job_id);
    expect(open?.runId).toBeTruthy();
    expect(open?.token).toBeTruthy();

    const before = await call(session, "GET", `/api/agent/runs/${open!.runId}`);
    expect((before.body as { metadata: { status: string } }).metadata.status).toBe("waiting_hitl");

    const resumeRes = await call(session, "POST", `/api/agent/runs/${open!.runId}/resume`, {
      token: open!.token,
      decision: { action: "approve", decidedAt: new Date().toISOString() },
    });
    expect(resumeRes.status).toBe(200);
    expect((resumeRes.body as { status: string }).status).toBe("completed");

    const afterJob = await session.pipeline.getJob(checking!.job_id);
    expect(afterJob?.status).toBe("pending");
  });

  it("POST confirm-next without open HITL returns 409", async () => {
    await call(session, "POST", "/api/demo/reset");
    const listed = await call(session, "GET", "/api/jobs");
    const job = (listed.body as { jobs: { job_id: string; status: string }[] }).jobs.find(
      (j) => j.status === "checking",
    )!;
    await call(session, "POST", `/api/jobs/${job.job_id}/confirm-next`);
    const again = await call(session, "POST", `/api/jobs/${job.job_id}/confirm-next`);
    expect(again.status).toBe(409);
    expect((again.body as { error: string }).error).toBe("no_open_hitl");
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

  describe("PATCH/DELETE /api/projects and /api/packs", () => {
    it("renames and deletes an empty project", async () => {
      const created = await call(session, "POST", "/api/projects", { name: "原名称" });
      const projectId = (created.body as { project: { project_id: string } }).project.project_id;

      const renamed = await call(session, "PATCH", `/api/projects/${projectId}`, { name: "新名称" });
      expect(renamed.status).toBe(200);
      expect((renamed.body as { project: { name: string } }).project.name).toBe("新名称");

      const deleted = await call(session, "DELETE", `/api/projects/${projectId}`);
      expect(deleted.status).toBe(200);
      expect((deleted.body as { project: { project_id: string; deleted: number } }).project).toMatchObject({
        project_id: projectId,
        deleted: 1,
      });

      const listed = await call(session, "GET", "/api/projects");
      const projects = (listed.body as { projects: { project_id: string }[] }).projects;
      expect(projects.some((p) => p.project_id === projectId)).toBe(false);
    });

    it("renames and deletes an empty spec pack", async () => {
      const created = await call(session, "POST", "/api/projects", { name: "规范包项目" });
      const projectId = (created.body as { project: { project_id: string } }).project.project_id;
      const packRes = await call(session, "POST", "/api/packs", {
        projectId,
        name: "原规范包",
      });
      const packId = (packRes.body as { pack: { pack_id: string } }).pack.pack_id;

      const renamed = await call(session, "PATCH", `/api/packs/${packId}`, { name: "新规范包" });
      expect(renamed.status).toBe(200);
      expect((renamed.body as { pack: { name: string } }).pack.name).toBe("新规范包");

      const deleted = await call(session, "DELETE", `/api/packs/${packId}`);
      expect(deleted.status).toBe(200);
      expect((deleted.body as { pack: { pack_id: string; deleted: number } }).pack).toMatchObject({
        pack_id: packId,
        deleted: 1,
      });

      const listed = await call(session, "GET", `/api/projects/${projectId}/packs`);
      expect((listed.body as { packs: unknown[] }).packs).toHaveLength(0);
    });

    it("DELETE /api/projects/:id returns 409 when project has spec packs", async () => {
      const created = await call(session, "POST", "/api/projects", { name: "有包项目" });
      const projectId = (created.body as { project: { project_id: string } }).project.project_id;
      await call(session, "POST", "/api/packs", { projectId, name: "空规范包" });

      const res = await call(session, "DELETE", `/api/projects/${projectId}`);
      expect(res.status).toBe(409);
      expect((res.body as { error: string }).error).toBe("project has spec packs");
    });

    it("DELETE /api/packs/:id returns 409 when pack has jobs", async () => {
      const reset = await call(session, "POST", "/api/demo/reset");
      const projectId = (reset.body as { project: { project_id: string } }).project.project_id;
      const packId = (reset.body as { pack: { pack_id: string } }).pack.pack_id;
      const templateId = (reset.body as { template: { template_id: string } }).template.template_id;
      const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

      const upload = await handleDemoRequest(session, {
        method: "POST",
        url: "/api/jobs/upload",
        body: {},
        multipart: {
          file: { bytes: JPEG_BYTES, fileName: "form.jpg", mime: "image/jpeg" },
          fields: { project_id: projectId, pack_id: packId, template_id: templateId },
        },
      });
      expect(upload.status).toBe(200);

      const res = await call(session, "DELETE", `/api/packs/${packId}`);
      expect(res.status).toBe(409);
      expect((res.body as { error: string }).error).toBe("spec pack has jobs");
    });
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

  it("maps store connectivity failures to 503", async () => {
    const cases = [
      "connect ECONNREFUSED 127.0.0.1:5434",
      "Qdrant URL not configured (set QDRANT_URL)",
      "Incomplete live engine configuration: missing NEO4J_PASSWORD",
      "Neo4j connection failed",
      "query timeout after 5000ms",
    ];
    for (const message of cases) {
      session.pipeline.listProjects = async () => {
        throw new Error(message);
      };
      const res = await call(session, "GET", "/api/projects");
      expect(res.status, message).toBe(503);
      expect((res.body as { error: string }).error).toBe(message);
    }
  });

  it("keeps validation and not-found errors off 503", async () => {
    const badKind = await call(session, "POST", "/api/jobs/fixture", { kind: "nope" });
    expect(badKind.status).toBe(400);

    const missing = await call(session, "POST", "/api/packs", { name: "空规范包" });
    expect(missing.status).toBe(400);

    session.pipeline.listProjects = async () => {
      throw new Error("spec pack not found: pack_x");
    };
    const notFound = await call(session, "GET", "/api/projects");
    expect(notFound.status).toBe(404);
  });

  describe("DocType HTTP API", () => {
    it("CRUD doc-types under a pack", async () => {
      const created = await call(session, "POST", "/api/projects", { name: "DocType 项目" });
      const projectId = (created.body as { project: { project_id: string } }).project.project_id;
      const packRes = await call(session, "POST", "/api/packs", {
        projectId,
        name: "DocType 规范包",
      });
      const packId = (packRes.body as { pack: { pack_id: string } }).pack.pack_id;

      const parent = await call(session, "POST", "/api/doc-types", {
        packId,
        name: "父类型",
      });
      expect(parent.status).toBe(200);
      const parentId = (parent.body as { docType: { doc_type_id: string } }).docType.doc_type_id;

      const child = await call(session, "POST", "/api/doc-types", {
        packId,
        name: "子类型",
        parentDocTypeId: parentId,
      });
      expect(child.status).toBe(200);

      const listed = await call(session, "GET", `/api/packs/${packId}/doc-types`);
      expect(listed.status).toBe(200);
      expect((listed.body as { docTypes: { doc_type_id: string }[] }).docTypes).toHaveLength(2);

      const renamed = await call(session, "PATCH", `/api/doc-types/${parentId}`, { name: "父类型-改" });
      expect(renamed.status).toBe(200);
      expect((renamed.body as { docType: { name: string } }).docType.name).toBe("父类型-改");

      const childId = (child.body as { docType: { doc_type_id: string } }).docType.doc_type_id;
      const deletedChild = await call(session, "DELETE", `/api/doc-types/${childId}`);
      expect(deletedChild.status).toBe(200);

      const deleteParent = await call(session, "DELETE", `/api/doc-types/${parentId}`);
      expect(deleteParent.status).toBe(200);
    });

    it("DELETE doc-type with children returns 409", async () => {
      const created = await call(session, "POST", "/api/projects", { name: "冲突项目" });
      const projectId = (created.body as { project: { project_id: string } }).project.project_id;
      const packRes = await call(session, "POST", "/api/packs", { projectId, name: "冲突包" });
      const packId = (packRes.body as { pack: { pack_id: string } }).pack.pack_id;

      const parent = await call(session, "POST", "/api/doc-types", { packId, name: "父" });
      const parentId = (parent.body as { docType: { doc_type_id: string } }).docType.doc_type_id;
      await call(session, "POST", "/api/doc-types", { packId, name: "子", parentDocTypeId: parentId });

      const res = await call(session, "DELETE", `/api/doc-types/${parentId}`);
      expect(res.status).toBe(409);
      expect((res.body as { error: string }).error).toBe("doc type has children");
    });

    it("field-defs GET/PUT round-trip", async () => {
      const created = await call(session, "POST", "/api/projects", { name: "字段项目" });
      const projectId = (created.body as { project: { project_id: string } }).project.project_id;
      const packRes = await call(session, "POST", "/api/packs", { projectId, name: "字段包" });
      const packId = (packRes.body as { pack: { pack_id: string } }).pack.pack_id;
      const docType = await call(session, "POST", "/api/doc-types", { packId, name: "类型A" });
      const docTypeId = (docType.body as { docType: { doc_type_id: string } }).docType.doc_type_id;

      const saved = await call(session, "PUT", `/api/doc-types/${docTypeId}/field-defs`, {
        defs: [
          { field_key: "编号", value_type: "string", required: 1 },
          { field_key: "日期A", value_type: "date", required: 0 },
        ],
      });
      expect(saved.status).toBe(200);
      expect((saved.body as { defs: { field_key: string }[] }).defs).toHaveLength(2);

      const got = await call(session, "GET", `/api/doc-types/${docTypeId}/field-defs`);
      expect(got.status).toBe(200);
      const keys = (got.body as { defs: { field_key: string }[] }).defs.map((d) => d.field_key);
      expect(keys.sort()).toEqual(["日期A", "编号"]);
    });

    it("AC-2 effective-boxes returns 3 keys for child type scenario", async () => {
      const tpl = await call(session, "POST", "/api/templates", {
        packId: PACK_ID,
        docTypeId: DOC_TYPE_CHILD_ID,
        name: "子类型模板",
      });
      expect(tpl.status).toBe(200);
      const templateId = (tpl.body as { template: { template_id: string } }).template.template_id;

      const saved = await call(session, "PUT", `/api/templates/${templateId}/boxes`, {
        boxes: [
          {
            field_key: "特殊批号",
            value_type: "string",
            page: 1,
            x: "10",
            y: "20",
            w: "80",
            h: "12",
          },
        ],
      });
      expect(saved.status).toBe(200);

      const res = await call(session, "GET", `/api/templates/${templateId}/effective-boxes`);
      expect(res.status).toBe(200);
      const keys = (res.body as { boxes: { field_key: string }[] }).boxes.map((b) => b.field_key).sort();
      expect(keys).toEqual(["日期A", "特殊批号", "编号"]);
    });

    it("AC-3 upload with doc_type_id binds child type and extracts inherited keys", async () => {
      const reset = await call(session, "POST", "/api/demo/reset");
      const projectId = (reset.body as { project: { project_id: string } }).project.project_id;

      const tpl = await call(session, "POST", "/api/templates", {
        packId: PACK_ID,
        docTypeId: DOC_TYPE_CHILD_ID,
        name: "上传子类型模板",
      });
      const templateId = (tpl.body as { template: { template_id: string } }).template.template_id;
      await call(session, "PUT", `/api/templates/${templateId}/boxes`, {
        boxes: [
          {
            field_key: "特殊批号",
            value_type: "string",
            page: 1,
            x: "10",
            y: "20",
            w: "80",
            h: "12",
          },
        ],
      });

      const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const res = await handleDemoRequest(session, {
        method: "POST",
        url: "/api/jobs/upload",
        body: {},
        multipart: {
          file: { bytes: JPEG_BYTES, fileName: "form.jpg", mime: "image/jpeg" },
          fields: {
            project_id: projectId,
            pack_id: PACK_ID,
            doc_type_id: DOC_TYPE_CHILD_ID,
            template_id: templateId,
          },
        },
      });
      expect(res.status).toBe(200);
      const body = res.body as {
        job: { doc_type_id: string; status: string };
        extraction: { fields_json: string };
      };
      expect(body.job.doc_type_id).toBe(DOC_TYPE_CHILD_ID);
      expect(body.job.status).toBe("checking");
      const fields = JSON.parse(body.extraction.fields_json) as Record<string, unknown>;
      expect(Object.keys(fields).sort()).toEqual(["日期A", "特殊批号", "编号"]);
      expect(fields["特殊批号"]).toBeNull();
    });
  });
});
