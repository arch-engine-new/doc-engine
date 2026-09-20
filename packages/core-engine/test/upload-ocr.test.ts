/**
 * Task 7: openUploadJob — MemoryBlobStore + FakeOcr, validation gate, standard-fit skip.
 * Task 5: PDF Unicode text-layer gate — examples skip OCR; empty layer calls recognize.
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MemoryBlobStore } from "../src/blob/memory.js";
import { blobObjectUri, uploadObjectKey } from "../src/blob/minio.js";
import { FakeOcr } from "../src/ocr/fake.js";
import type { OcrPort, OcrRecognizeInput, OcrRecognizeResult } from "../src/ocr/port.js";
import {
  JobPipeline,
  MAX_UPLOAD_BYTES,
  UploadValidationError,
} from "../src/pipeline/job-pipeline.js";
import { DOC_TYPE_PARENT_ID, PACK_ID, RULE_R2_VERSION_ID } from "../src/pipeline/seed.js";

const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const EXAMPLES_DIR = path.join(REPO_ROOT, "examples");

function resolveExamplePdf(): string {
  const names = readdirSync(EXAMPLES_DIR).filter((name) => name.toLowerCase().endsWith(".pdf"));
  if (names.length === 0) {
    throw new Error(`no PDF under ${EXAMPLES_DIR}`);
  }
  const ranked = names
    .map((name) => {
      const full = path.join(EXAMPLES_DIR, name);
      return { full, size: readFileSync(full).byteLength };
    })
    .sort((a, b) => a.size - b.size);
  return ranked[0]!.full;
}

/** One blank page, no ToUnicode / Tj — a scan-like fixture. */
function emptyPagePdf(): Uint8Array {
  const header = "%PDF-1.4\n";
  const obj1 = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
  const obj2 = "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";
  const obj3 = "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>\nendobj\n";
  const o1 = Buffer.byteLength(header);
  const o2 = o1 + Buffer.byteLength(obj1);
  const o3 = o2 + Buffer.byteLength(obj2);
  const after = o3 + Buffer.byteLength(obj3);
  const pad = (n: number) => `${String(n).padStart(10, "0")} 00000 n \n`;
  const xref = "xref\n0 4\n0000000000 65535 f \n" + pad(o1) + pad(o2) + pad(o3);
  const trailer = `trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${after}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(header + obj1 + obj2 + obj3 + xref + trailer));
}

class SpyOcr implements OcrPort {
  calls = 0;
  lastInput: OcrRecognizeInput | undefined;
  constructor(private readonly inner: OcrPort = new FakeOcr()) {}
  async recognize(input: OcrRecognizeInput): Promise<OcrRecognizeResult> {
    this.calls += 1;
    this.lastInput = input;
    return this.inner.recognize(input);
  }
  async recognizeLayout(input: OcrRecognizeInput): Promise<OcrRecognizeResult> {
    return this.inner.recognizeLayout(input);
  }
}

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
      doc_type_id: DOC_TYPE_PARENT_ID,
      fileName: "form.jpg",
      mime: "image/jpeg",
      bytes: JPEG_BYTES,
      track: "legacy" as const,
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
    const docType = await pipeline.createDocType({ packId: pack.pack_id, name: "默认类型" });
    const input = {
      projectId: project.project_id,
      packId: pack.pack_id,
      doc_type_id: docType.doc_type_id,
      fileName: "form.png",
      mime: "image/png",
      bytes: JPEG_BYTES,
      track: "legacy" as const,
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
      recognizeLayout: async () => {
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

  it("calls ocr.recognize for a PDF with no usable text layer", async () => {
    const spy = new SpyOcr();
    const input = await baseInput({
      fileName: "scan.pdf",
      mime: "application/pdf",
      bytes: emptyPagePdf(),
    });

    const result = await pipeline.openUploadJob(input, { blob, ocr: spy });

    expect(spy.calls).toBe(1);
    expect(spy.lastInput?.mime).toBe("application/pdf");
    expect(result.job.status).toBe("checking");
  });

  it("does not call ocr.recognize for an examples PDF with a usable text layer", async () => {
    const spy = new SpyOcr();
    const pdfPath = resolveExamplePdf();
    const bytes = new Uint8Array(readFileSync(pdfPath));
    const input = await baseInput({
      fileName: path.basename(pdfPath),
      mime: "application/pdf",
      bytes,
    });

    const result = await pipeline.openUploadJob(input, { blob, ocr: spy });

    expect(spy.calls).toBe(0);
    const ocrText = result.extraction.ocr_text ?? "";
    const han = Array.from(ocrText.matchAll(/\p{Script=Han}/gu)).length;
    expect(han).toBeGreaterThanOrEqual(8);
    const extractionAudit = (await pipeline.listAudit(result.job.trace_id)).find(
      (e) => e.event_type === "extraction",
    );
    const payloadRaw = extractionAudit?.payload_json;
    const payload =
      typeof payloadRaw === "string"
        ? (JSON.parse(payloadRaw) as Record<string, unknown>)
        : ((payloadRaw ?? {}) as Record<string, unknown>);
    expect(payload.ocr_vendor).toBe("pdf-text");
  }, 30_000);
});
