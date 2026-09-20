/**
 * F-10 Task 6: Skill-track upload — xlsx / recognizeLayout / no RAG / no DocType.
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import { MemoryBlobStore } from "../src/blob/memory.js";
import { FakeOcr } from "../src/ocr/fake.js";
import type { OcrPort, OcrRecognizeInput, OcrRecognizeResult } from "../src/ocr/port.js";
import {
  JobPipeline,
  UploadValidationError,
  validateUploadInput,
} from "../src/pipeline/job-pipeline.js";
import { PACK_ID } from "../src/pipeline/seed.js";
import { XLSX_MIME } from "../src/skill/index.js";

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

class SkillSpyOcr implements OcrPort {
  recognizeCalls = 0;
  layoutCalls = 0;
  constructor(private readonly inner: OcrPort = new FakeOcr()) {}
  async recognize(input: OcrRecognizeInput): Promise<OcrRecognizeResult> {
    this.recognizeCalls += 1;
    return this.inner.recognize(input);
  }
  async recognizeLayout(input: OcrRecognizeInput): Promise<OcrRecognizeResult> {
    this.layoutCalls += 1;
    return this.inner.recognizeLayout(input);
  }
}

async function makeXlsx(sheet: string, cell: string, value: string): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet(sheet);
  ws.getCell(cell).value = value;
  const out = await workbook.xlsx.writeBuffer();
  return new Uint8Array(out);
}

describe("skill-track openUploadJob (F-10 Task 6)", () => {
  let pipeline: JobPipeline;
  let blob: MemoryBlobStore;

  beforeEach(() => {
    pipeline = JobPipeline.open(":memory:");
    blob = new MemoryBlobStore();
  });

  afterEach(async () => {
    await pipeline.close();
  });

  async function skillInput(
    overrides: Partial<Parameters<JobPipeline["openUploadJob"]>[0]> = {},
  ) {
    const project = await pipeline.createProject();
    const pack = await pipeline.createSpecPack({
      projectId: project.project_id,
      name: "技能上传包",
      version: "1",
    });
    return {
      projectId: project.project_id,
      packId: pack.pack_id,
      fileName: "form.jpg",
      mime: "image/jpeg",
      bytes: JPEG_BYTES,
      ...overrides,
    };
  }

  it("uploads without doc_type_id and hangs a non-empty skill_draft_id (M12)", async () => {
    const input = await skillInput();
    const result = await pipeline.openUploadJob(input, { blob, ocr: new FakeOcr() });

    expect(result.job.track).toBe("skill");
    expect(result.job.doc_type_id).toBeNull();
    expect(result.job.skill_draft_id).toBeTruthy();
    const fetched = await pipeline.getJob(result.job.job_id);
    expect(fetched?.skill_draft_id).toBe(result.job.skill_draft_id);
    const draft = await pipeline.getSkillDraftByJob(result.job.job_id);
    expect(draft?.draft_id).toBe(result.job.skill_draft_id);
  });

  it("does not call searchStandard or attachStandardFitFinding (M11)", async () => {
    const search = vi.spyOn(pipeline, "searchStandard");
    const attach = vi.spyOn(pipeline, "attachStandardFitFinding");
    const librarySearch = vi.spyOn(pipeline.library, "searchStandard");
    const input = await skillInput();

    await pipeline.openUploadJob(input, { blob, ocr: new FakeOcr() });

    expect(search).not.toHaveBeenCalled();
    expect(attach).not.toHaveBeenCalled();
    expect(librarySearch).not.toHaveBeenCalled();
  });

  it("uses recognizeLayout for images and never ocr.recognize (D3)", async () => {
    const spy = new SkillSpyOcr();
    const input = await skillInput();
    const result = await pipeline.openUploadJob(input, { blob, ocr: spy });

    expect(spy.recognizeCalls).toBe(0);
    expect(spy.layoutCalls).toBe(1);
    expect(result.extraction.ocr_text).toContain("编号");
  });

  it("reads xlsx cells without OCR and keeps xlsx MIME (R24/D11)", async () => {
    const spy = new SkillSpyOcr();
    const bytes = await makeXlsx("检验批", "A1", "混凝土浇筑施工记录");
    const input = await skillInput({
      fileName: "batch.xlsx",
      mime: XLSX_MIME,
      bytes,
    });

    const result = await pipeline.openUploadJob(input, { blob, ocr: spy });

    expect(spy.recognizeCalls).toBe(0);
    expect(spy.layoutCalls).toBe(0);
    expect(result.document.mime).toBe(XLSX_MIME);
    expect(result.extraction.ocr_text).toContain("混凝土浇筑施工记录");
    expect(result.job.skill_draft_id).toBeTruthy();
  });

  it("allows xlsx MIME aliases on skill track and rejects them on legacy", () => {
    const bytes = new Uint8Array([0x50, 0x4b]);
    expect(() =>
      validateUploadInput({ mime: "application/x-xlsx", bytes, track: "skill" }),
    ).not.toThrow();
    expect(() =>
      validateUploadInput({ mime: "application/vnd.ms-excel", bytes, track: "skill" }),
    ).not.toThrow();
    expect(() =>
      validateUploadInput({ mime: XLSX_MIME, bytes, track: "legacy" }),
    ).toThrow(UploadValidationError);
  });

  it("FakeOcr empty + PDF text-layer miss is unreadable original-only (M8)", async () => {
    const input = await skillInput({
      fileName: "scan.pdf",
      mime: "application/pdf",
      bytes: emptyPagePdf(),
    });
    const result = await pipeline.openUploadJob(input, {
      blob,
      ocr: new FakeOcr(""),
    });

    expect(result.job.status).toBe("failed");
    expect(result.job.skill_draft_id).toBeNull();
    expect(await pipeline.getSkillDraftByJob(result.job.job_id)).toBeNull();
    expect(await pipeline.listSkillRecords(input.packId!)).toHaveLength(0);
    const ledgers = await pipeline.listSkillLedgersByJob(result.job.job_id);
    expect(ledgers).toHaveLength(1);
    expect(ledgers[0]?.verdict).toBe("fail");
    expect(ledgers[0]?.reason).toBe("unreadable");
    expect(ledgers[0]?.original_blob_uri).toBe(result.document.file_uri);
    expect(ledgers[0]?.patched_blob_uri).toBeNull();
    expect(ledgers[0]?.skill_id).toBeNull();
  });

  it("recognizeLayout throw + PDF text-layer miss is unreadable without calling recognize (M8)", async () => {
    const spy = new SkillSpyOcr({
      recognize: async () => {
        throw new Error("recognize must not run on skill");
      },
      recognizeLayout: async () => {
        throw new Error("layout down");
      },
    });
    const input = await skillInput({
      fileName: "scan.pdf",
      mime: "application/pdf",
      bytes: emptyPagePdf(),
    });

    const result = await pipeline.openUploadJob(input, { blob, ocr: spy });

    expect(spy.recognizeCalls).toBe(0);
    expect(result.job.status).toBe("failed");
    const ledgers = await pipeline.listSkillLedgersByJob(result.job.job_id);
    expect(ledgers[0]?.reason).toBe("unreadable");
    expect(await pipeline.getSkillDraftByJob(result.job.job_id)).toBeNull();
  });

  it("skips OCR when a PDF has a usable Unicode text layer", async () => {
    const spy = new SkillSpyOcr();
    const pdfPath = resolveExamplePdf();
    const bytes = new Uint8Array(readFileSync(pdfPath));
    const input = await skillInput({
      fileName: path.basename(pdfPath),
      mime: "application/pdf",
      bytes,
    });

    const result = await pipeline.openUploadJob(input, { blob, ocr: spy });

    expect(spy.recognizeCalls).toBe(0);
    expect(spy.layoutCalls).toBe(0);
    expect(result.job.skill_draft_id).toBeTruthy();
    const han = Array.from((result.extraction.ocr_text ?? "").matchAll(/\p{Script=Han}/gu)).length;
    expect(han).toBeGreaterThanOrEqual(8);
  }, 30_000);

  it("keeps runFixtureJob on leftover track=legacy", async () => {
    const { job } = await pipeline.runFixtureJob({ kind: "ok" });
    expect(job.track).toBe("legacy");
    expect(job.pack_id).toBe(PACK_ID);
  });
});
