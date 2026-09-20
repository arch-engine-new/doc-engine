/**
 * F-10 Task 7: Job.track mutex — skill confirm-next 409; leftover C2 still CONFIRM_NEXT.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryBlobStore } from "../src/blob/memory.js";
import { DemoHttpSession } from "../src/http/session.js";
import { handleDemoRequest } from "../src/http/handle-request.js";
import { FakeOcr } from "../src/ocr/fake.js";
import {
  JobPipeline,
  SkillTrackConfirmNextError,
} from "../src/pipeline/job-pipeline.js";

const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

async function call(
  session: DemoHttpSession,
  method: string,
  url: string,
  body?: unknown,
) {
  return handleDemoRequest(session, { method, url, body: body ?? {} });
}

describe("Job.track mutex (F-10 Task 7)", () => {
  describe("HTTP confirm-next", () => {
    let session: DemoHttpSession;
    let tempRoot: string | undefined;
    const previousConfigEnv = process.env.AGENT_RUNTIME_LLM_CONFIG;

    beforeEach(() => {
      delete process.env.AGENT_RUNTIME_LLM_CONFIG;
      tempRoot = mkdtempSync(join(tmpdir(), "skill-track-mutex-"));
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

    it("POST confirm-next on skill-track upload returns 409 (M16)", async () => {
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
      const job = (uploaded.body as { job: { job_id: string; track: string; status: string } }).job;
      expect(job.track).toBe("skill");
      expect(job.status).toBe("uploaded");

      const res = await call(session, "POST", `/api/jobs/${job.job_id}/confirm-next`);
      expect(res.status).toBe(409);
      expect((res.body as { error: string }).error).toBe("cannot confirm-next from track=skill");

      const after = await session.pipeline.getJob(job.job_id);
      expect(after?.status).toBe("uploaded");
      expect(after?.agent_run_id).toBeNull();
    });

    it("legacy fixture Job still advances checking → pending via confirm-next", async () => {
      await call(session, "POST", "/api/demo/reset");
      const listed = await call(session, "GET", "/api/jobs");
      const jobs = (listed.body as { jobs: { job_id: string; status: string; track?: string }[] }).jobs;
      const checking = jobs.find((j) => j.status === "checking");
      expect(checking).toBeTruthy();
      expect(checking!.track ?? "legacy").toBe("legacy");

      const res = await call(session, "POST", `/api/jobs/${checking!.job_id}/confirm-next`);
      expect(res.status).toBe(200);
      expect((res.body as { job: { status: string } }).job.status).toBe("pending");
    });
  });

  describe("pipeline + orchestrator", () => {
    let pipeline: JobPipeline;
    let blob: MemoryBlobStore;

    beforeEach(() => {
      pipeline = JobPipeline.open(":memory:");
      blob = new MemoryBlobStore();
    });

    afterEach(async () => {
      await pipeline.close();
    });

    async function skillInput() {
      const project = await pipeline.createProject();
      const pack = await pipeline.createSpecPack({
        projectId: project.project_id,
        name: "互斥包",
        version: "1",
      });
      return {
        projectId: project.project_id,
        packId: pack.pack_id,
        fileName: "form.jpg",
        mime: "image/jpeg",
        bytes: JPEG_BYTES,
      };
    }

    it("does not call onStepEntered for skill-track uploads", async () => {
      const onStepEntered = vi.fn();
      pipeline.stepOrchestrator = { onStepEntered };
      const result = await pipeline.openUploadJob(await skillInput(), {
        blob,
        ocr: new FakeOcr(),
      });
      expect(result.job.track).toBe("skill");
      expect(result.job.status).toBe("uploaded");
      expect(onStepEntered).not.toHaveBeenCalled();
      expect(result.job.agent_run_id).toBeNull();
    });

    it("still calls onStepEntered for leftover track=legacy uploads", async () => {
      const onStepEntered = vi.fn();
      pipeline.stepOrchestrator = { onStepEntered };
      const input = await skillInput();
      const result = await pipeline.openUploadJob({ ...input, track: "legacy" }, {
        blob,
        ocr: new FakeOcr(),
      });
      expect(result.job.track).toBe("legacy");
      expect(result.job.status).toBe("checking");
      expect(onStepEntered).toHaveBeenCalledTimes(1);
      expect(onStepEntered.mock.calls[0]?.[1]).toBe("checking");
    });

    it("pipeline.confirmNext rejects skill-track jobs", async () => {
      const result = await pipeline.openUploadJob(await skillInput(), {
        blob,
        ocr: new FakeOcr(),
      });
      await expect(pipeline.confirmNext(result.job.job_id)).rejects.toThrow(
        SkillTrackConfirmNextError,
      );
      expect((await pipeline.getJob(result.job.job_id))?.status).toBe("uploaded");
    });

    it("runFixtureJob leftover confirmNext still follows CONFIRM_NEXT", async () => {
      const { job } = await pipeline.runFixtureJob({ kind: "ok" });
      expect(job.track).toBe("legacy");
      expect(job.status).toBe("checking");
      const next = await pipeline.confirmNext(job.job_id);
      expect(next.status).toBe("pending");
    });
  });
});
