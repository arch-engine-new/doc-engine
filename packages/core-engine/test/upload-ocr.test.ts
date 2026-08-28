/**
 * Task 7: openUploadJob — MemoryBlobStore + FakeOcr, validation gate, standard-fit skip.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MemoryBlobStore } from "../src/blob/memory.js";
import { blobObjectUri, uploadObjectKey } from "../src/blob/minio.js";
import { FakeOcr } from "../src/ocr/fake.js";
import type { OcrPort } from "../src/ocr/port.js";
import {
  JobPipeline,
  MAX_UPLOAD_BYTES,
  UploadValidationError,
} from "../src/pipeline/job-pipeline.js";
import { PACK_ID, RULE_R2_VERSION_ID } from "../src/pipeline/seed.js";

const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

describe("openUploadJob", () => {
  let pipeline: JobPipeline;
  let blob: MemoryBlobStore;
  let ocr: FakeOcr;

  beforeEach(() => {
    pipeline = JobPipeline.open(":memory:");
    blob = new MemoryBlobStore();
    ocr = new FakeOcr();
  });

  afterEach(async () => {
    await pipeline.close();
  });

  async function baseInput(overrides: Partial<Parameters<JobPipeline["openUploadJob"]>[0]> = {}) {
    const project = await pipeline.createProject();
    return {
      projectId: project.project_id,
      packId: PACK_ID,
      fileName: "form.jpg",
      mime: "image/jpeg",
      bytes: JPEG_BYTES,
      ...overrides,
    };
  }

  it("stores blob, extracts inverted dates, and yields R2 blocking finding", async () => {
    const input = await baseInput();
    const result = await pipeline.openUploadJob(input, { blob, ocr });

    const key = uploadObjectKey(result.job.job_id, input.fileName);
    const stored = await blob.get(key);
    expect(stored).toEqual(JPEG_BYTES);
    expect(result.document.file_uri).toBe(blobObjectUri("docengine", key));
    const rawFields = result.extraction.fields_json;
    const fields =
      typeof rawFields === "string"
        ? (JSON.parse(rawFields) as Record<string, unknown>)
        : (rawFields as Record<string, unknown>);
    expect(fields["日期A"]).toBe("2026-08-20");
    expect(fields["日期B"]).toBe("2026-08-01");

    const r2Fail = result.findings.filter(
      (f) => f.rule_version_id === RULE_R2_VERSION_ID && f.result === "fail" && f.blocking === 1,
    );
    expect(r2Fail.length).toBeGreaterThan(0);
    expect(result.job.status).toBe("checking");
  });

  it("throws UploadValidationError for illegal MIME without inserting a job", async () => {
    const input = await baseInput({ mime: "text/plain" });
    const before = (await pipeline.listJobs()).length;

    await expect(pipeline.openUploadJob(input, { blob, ocr })).rejects.toBeInstanceOf(
      UploadValidationError,
    );
    expect((await pipeline.listJobs()).length).toBe(before);
  });

  it("throws UploadValidationError for >4MB without inserting a job", async () => {
    const input = await baseInput({
      bytes: new Uint8Array(MAX_UPLOAD_BYTES + 1),
    });
    const before = (await pipeline.listJobs()).length;

    await expect(pipeline.openUploadJob(input, { blob, ocr })).rejects.toBeInstanceOf(
      UploadValidationError,
    );
    expect((await pipeline.listJobs()).length).toBe(before);
  });

  it("skips attachStandardFitFinding when retrieve has no hit (no fake clause_id)", async () => {
    const project = await pipeline.createProject();
    const pack = await pipeline.createSpecPack({
      projectId: project.project_id,
      name: "无标准包",
      version: "1",
    });
    const input = {
      projectId: project.project_id,
      packId: pack.pack_id,
      fileName: "form.png",
      mime: "image/png",
      bytes: JPEG_BYTES,
    };

    const result = await pipeline.openUploadJob(input, { blob, ocr });
    const withClause = result.findings.filter((f) => f.clause_id != null);
    expect(withClause).toHaveLength(0);
  });

  it("marks job failed with ocr_error audit when OCR fails after insert", async () => {
    const failingOcr: OcrPort = {
      recognize: async () => {
        throw new Error("OCR vendor down");
      },
    };
    const input = await baseInput();

    await expect(pipeline.openUploadJob(input, { blob, ocr: failingOcr })).rejects.toThrow(
      "OCR vendor down",
    );

    const jobs = await pipeline.listJobs();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.status).toBe("failed");

    const audit = await pipeline.listAudit(jobs[0]!.trace_id);
    expect(audit.some((e) => e.event_type === "ocr_error")).toBe(true);
  });
});
