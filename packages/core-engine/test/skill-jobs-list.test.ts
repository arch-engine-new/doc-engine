/**
 * F-10 Task 11: GET /api/jobs defaults to leftover track=legacy (M16/R28/D12).
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { handleDemoRequest } from "../src/http/handle-request.js";
import { DemoHttpSession } from "../src/http/session.js";
import { resolveJobsListTrack } from "../src/persistence/ledger.js";

const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

type ListedJob = {
  job_id: string;
  track: string;
  status: string;
  file_name: string | null;
};

async function call(
  session: DemoHttpSession,
  method: string,
  url: string,
  body?: unknown,
) {
  return handleDemoRequest(session, { method, url, body: body ?? {} });
}

describe("GET /api/jobs track filter (F-10 Task 11)", () => {
  let session: DemoHttpSession;
  let tempRoot: string | undefined;
  const previousConfigEnv = process.env.AGENT_RUNTIME_LLM_CONFIG;

  beforeEach(() => {
    delete process.env.AGENT_RUNTIME_LLM_CONFIG;
    tempRoot = mkdtempSync(join(tmpdir(), "skill-jobs-list-"));
    session = new DemoHttpSession({ projectRoot: tempRoot });
  });

  afterEach(async () => {
    await session.close();
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

  it("omits skill-track jobs from the default findings/pending list (M16)", async () => {
    const reset = await call(session, "POST", "/api/demo/reset");
    expect(reset.status).toBe(200);
    const projectId = (reset.body as { project: { project_id: string } }).project.project_id;

    const uploaded = await handleDemoRequest(session, {
      method: "POST",
      url: "/api/jobs/upload",
      body: {},
      multipart: {
        file: { bytes: JPEG_BYTES, fileName: "form.jpg", mime: "image/jpeg" },
        fields: { project_id: projectId },
      },
    });
    expect(uploaded.status).toBe(200);
    const skillJob = (uploaded.body as { job: { job_id: string; track: string } }).job;
    expect(skillJob.track).toBe("skill");

    const listed = await call(session, "GET", "/api/jobs");
    expect(listed.status).toBe(200);
    const jobs = (listed.body as { jobs: ListedJob[] }).jobs;
    expect(jobs.length).toBeGreaterThan(0);
    expect(jobs.every((job) => job.track === "legacy")).toBe(true);
    expect(jobs.some((job) => job.job_id === skillJob.job_id)).toBe(false);
    expect(jobs.some((job) => job.file_name?.includes("fixture-"))).toBe(true);

    const one = await call(session, "GET", `/api/jobs/${skillJob.job_id}`);
    expect(one.status).toBe(200);
    expect((one.body as { job: { job_id: string; track: string } }).job.track).toBe("skill");
  });

  it("lists skill-track jobs only when ?track=skill is explicit", async () => {
    const reset = await call(session, "POST", "/api/demo/reset");
    expect(reset.status).toBe(200);
    const projectId = (reset.body as { project: { project_id: string } }).project.project_id;

    const uploaded = await handleDemoRequest(session, {
      method: "POST",
      url: "/api/jobs/upload",
      body: {},
      multipart: {
        file: { bytes: JPEG_BYTES, fileName: "form.jpg", mime: "image/jpeg" },
        fields: { project_id: projectId },
      },
    });
    const skillJob = (uploaded.body as { job: { job_id: string } }).job;

    const skillListed = await call(session, "GET", "/api/jobs?track=skill");
    expect(skillListed.status).toBe(200);
    const skillJobs = (skillListed.body as { jobs: ListedJob[] }).jobs;
    expect(skillJobs.some((job) => job.job_id === skillJob.job_id)).toBe(true);
    expect(skillJobs.every((job) => job.track === "skill")).toBe(true);

    const unknown = await call(session, "GET", "/api/jobs?track=all");
    expect(unknown.status).toBe(200);
    const unknownJobs = (unknown.body as { jobs: ListedJob[] }).jobs;
    expect(unknownJobs.every((job) => job.track === "legacy")).toBe(true);
    expect(unknownJobs.some((job) => job.job_id === skillJob.job_id)).toBe(false);
  });

  it("resolveJobsListTrack stays leftover unless the caller asks for skill", () => {
    expect(resolveJobsListTrack(null)).toBe("legacy");
    expect(resolveJobsListTrack(undefined)).toBe("legacy");
    expect(resolveJobsListTrack("legacy")).toBe("legacy");
    expect(resolveJobsListTrack("all")).toBe("legacy");
    expect(resolveJobsListTrack("skill")).toBe("skill");
  });
});
