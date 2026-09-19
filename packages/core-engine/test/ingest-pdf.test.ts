/**
 * Task 9: page-tick PDF ingest. Raster is injected so CI does not need canvas.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FakeOcr } from "../src/ocr/fake.js";
import { setPdfPageRaster } from "../src/ocr/pdf-raster.js";
import type { OcrPort, OcrRecognizeInput, OcrRecognizeResult } from "../src/ocr/port.js";
import { handleDemoRequest } from "../src/http/handle-request.js";
import { DemoHttpSession } from "../src/http/session.js";
import {
  JobPipeline,
  MAX_UPLOAD_BYTES,
  MemoryGraphStore,
  MemoryVectorStore,
} from "../src/index.js";
import type { VectorPoint, VectorStore } from "../src/retrieve/ports.js";

const STUB_PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);
const PAGE1_TEXT = `1.1 强度要求。
混凝土强度不得低于设计值。`;
const PAGE2_TEXT = `2.1 外观要求。
表面不得有蜂窝麻面。`;

/** Blank pages, no ToUnicode — scan-like so tick must OCR page PNGs, not the PDF. */
function emptyPagesPdf(pageCount: number): Uint8Array {
  const header = "%PDF-1.4\n";
  const obj1 = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
  const kids = Array.from({ length: pageCount }, (_, i) => `${3 + i} 0 R`).join(" ");
  const obj2 = `2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>\nendobj\n`;
  const pageObjs = Array.from({ length: pageCount }, (_, i) => {
    const id = 3 + i;
    return `${id} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>\nendobj\n`;
  });
  const parts = [header, obj1, obj2, ...pageObjs];
  const offsets: number[] = [];
  let cursor = 0;
  for (const part of parts) {
    if (part !== header) offsets.push(cursor);
    cursor += Buffer.byteLength(part);
  }
  const objectCount = 2 + pageCount;
  const pad = (n: number) => `${String(n).padStart(10, "0")} 00000 n \n`;
  const xref =
    `xref\n0 ${objectCount + 1}\n0000000000 65535 f \n` + offsets.map((n) => pad(n)).join("");
  const trailer = `trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${cursor}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(parts.join("") + xref + trailer));
}

class SpyOcr implements OcrPort {
  layoutCalls: OcrRecognizeInput[] = [];
  private readonly texts: string[];
  private layoutIndex = 0;

  constructor(texts: string[]) {
    this.texts = texts;
  }

  async recognize(input: OcrRecognizeInput): Promise<OcrRecognizeResult> {
    return { text: input.fileName, vendor: "spy" };
  }

  async recognizeLayout(input: OcrRecognizeInput): Promise<OcrRecognizeResult> {
    this.layoutCalls.push({
      bytes: input.bytes,
      mime: input.mime,
      fileName: input.fileName,
    });
    const text = this.texts[this.layoutIndex] ?? this.texts[this.texts.length - 1] ?? "";
    this.layoutIndex += 1;
    return { text, vendor: "spy" };
  }
}

class PageFailVector implements VectorStore {
  constructor(
    private readonly inner: MemoryVectorStore,
    private readonly failPage: number,
  ) {}

  async upsert(point: VectorPoint): Promise<void> {
    if (point.payload?.page_start === this.failPage) {
      throw new Error("qdrant unavailable");
    }
    return this.inner.upsert(point);
  }

  search(
    vector: number[],
    opts?: { versionId?: string; topK?: number },
  ): ReturnType<MemoryVectorStore["search"]> {
    return this.inner.search(vector, opts);
  }
}

async function stubPng(_bytes: Uint8Array, _pageNo: number): Promise<Uint8Array> {
  return STUB_PNG;
}

describe("PDF ingest tick", () => {
  let pipeline: JobPipeline;
  let vector: MemoryVectorStore;

  beforeEach(() => {
    vector = new MemoryVectorStore();
    pipeline = JobPipeline.openStandardLibrary({
      vector: new PageFailVector(vector, 2),
      graph: new MemoryGraphStore(),
    });
    setPdfPageRaster(stubPng);
  });

  afterEach(async () => {
    setPdfPageRaster(undefined);
    await pipeline.close();
  });

  async function seedPack() {
    const project = await pipeline.createProject();
    return pipeline.createSpecPack({
      projectId: project.project_id,
      name: "标准入库包",
      version: "1",
    });
  }

  it("M8: page2 index_error keeps page1 layout/vector; M11 OCR is a page PNG", async () => {
    const pack = await seedPack();
    const bytes = emptyPagesPdf(2);
    const ocr = new SpyOcr([PAGE1_TEXT, PAGE2_TEXT]);
    const started = await pipeline.startStandardPdfIngest(
      { packId: pack.pack_id, title: "扫描标准", fileName: "scan.pdf", bytes },
      { ocr, raster: stubPng },
    );
    expect(ocr.layoutCalls).toHaveLength(0);
    expect(started.page_count).toBe(2);

    const tick1 = await pipeline.tickStandardIngest(started.ingest_run_id);
    expect(tick1.page_no).toBe(1);
    expect(tick1.status).toBe("ok");
    expect(ocr.layoutCalls).toHaveLength(1);
    const ocrIn = ocr.layoutCalls[0]!;
    expect(ocrIn.bytes.byteLength).toBeLessThan(bytes.byteLength);
    expect(ocrIn.mime).toMatch(/^image\//);
    expect(ocrIn.mime).toBe("image/png");

    const clause = await pipeline.getClause(`${started.version.version_id}:1.1`);
    expect(clause?.page_start).toBe(1);
    expect(clause?.page_end).toBe(1);
    const ports = pipeline.library.getPorts();
    const page1Hits = await vector.search(await ports.embed.embed("强度要求"), {
      versionId: started.version.version_id,
      topK: 8,
    });
    expect(page1Hits.length).toBeGreaterThan(0);
    expect(page1Hits.every((hit) => hit.payload?.page_start === 1)).toBe(true);

    const tick2 = await pipeline.tickStandardIngest(started.ingest_run_id);
    expect(tick2.page_no).toBe(2);
    expect(tick2.status).toBe("index_error");
    expect(tick2.status).not.toBe("ocr_error");
    expect(tick2.status).not.toBe("ok");

    const still = await vector.search(await ports.embed.embed("强度要求"), {
      versionId: started.version.version_id,
      topK: 8,
    });
    expect(still.length).toBeGreaterThan(0);
    expect(still.every((hit) => hit.payload?.page_start === 1)).toBe(true);
    expect(await pipeline.getClause(`${started.version.version_id}:1.1`)).toBeTruthy();
  });

  it("does not apply Job 4MB to startStandardPdfIngest", async () => {
    const pack = await seedPack();
    const bytes = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    bytes.set(emptyPagesPdf(2));
    const started = await pipeline.startStandardPdfIngest(
      { packId: pack.pack_id, title: "大文件", fileName: "large.pdf", bytes },
      { ocr: new FakeOcr(PAGE1_TEXT), raster: stubPng },
    );
    expect(started.ingest_run_id.length).toBeGreaterThan(0);
  });
});

describe("HTTP ingest-pdf", () => {
  let session: DemoHttpSession;

  beforeEach(() => {
    session = new DemoHttpSession();
    setPdfPageRaster(stubPng);
  });

  afterEach(async () => {
    setPdfPageRaster(undefined);
    await session.close();
  });

  it("POST ingest-pdf returns 202 ingest_run_id and tick processes one page", async () => {
    const reset = await handleDemoRequest(session, {
      method: "POST",
      url: "/api/demo/reset",
      body: {},
    });
    expect(reset.status).toBe(200);
    const packId = (reset.body as { pack: { pack_id: string } }).pack.pack_id;
    const bytes = emptyPagesPdf(2);

    const created = await handleDemoRequest(session, {
      method: "POST",
      url: "/api/standards/ingest-pdf",
      body: {},
      multipart: {
        file: { bytes, fileName: "scan.pdf", mime: "application/pdf" },
        fields: { pack_id: packId, title: "扫描标准" },
      },
    });
    expect(created.status).toBe(202);
    const ingestRunId = (created.body as { ingest_run_id: string }).ingest_run_id;
    expect(ingestRunId.length).toBeGreaterThan(0);

    const tick = await handleDemoRequest(session, {
      method: "POST",
      url: `/api/standards/ingest-runs/${ingestRunId}/tick`,
      body: {},
    });
    expect(tick.status).toBe(200);
    const page = tick.body as { page_no: number; status: string };
    expect(page.page_no).toBe(1);
    expect(["ok", "ocr_error", "index_error"]).toContain(page.status);
  });

  it("POST /api/standards/edges accepts SUPPORTS/PARENT_OF/BELONGS_TO", async () => {
    const reset = await handleDemoRequest(session, {
      method: "POST",
      url: "/api/demo/reset",
      body: {},
    });
    const standard = (reset.body as { standard: { version: { version_id: string } } }).standard;
    const versionId = standard.version.version_id;
    const from = `${versionId}:1.1`;
    const to = `${versionId}:1.2`;
    for (const kind of ["SUPPORTS", "PARENT_OF", "BELONGS_TO"] as const) {
      const res = await handleDemoRequest(session, {
        method: "POST",
        url: "/api/standards/edges",
        body: { from, to, kind },
      });
      expect(res.status, kind).toBe(200);
    }
  });
});
