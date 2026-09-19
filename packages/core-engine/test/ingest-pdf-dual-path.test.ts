/**
 * F-8 Task 1 RED: lock text-layer vs scan ingest. Mixed fixtures stay small;
 * a 259-page OCR would hide the per-page split this suite is meant to catch.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FakeOcr } from "../src/ocr/fake.js";
import { setPdfPageRaster } from "../src/ocr/pdf-raster.js";
import type { OcrPort, OcrRecognizeInput, OcrRecognizeResult } from "../src/ocr/port.js";
import { PaddleOcr } from "../src/ocr/paddleocr.js";
import { JobPipeline, MemoryGraphStore, MemoryVectorStore } from "../src/index.js";
import { requireLiveOcr } from "../src/pipeline/job-pipeline.js";

const STUB_PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);
const PAGE1_TEXT = `1.1 强度要求。
混凝土强度不得低于设计值。`;
const PAGE2_TEXT = `2.1 外观要求。
表面不得有蜂窝麻面。`;
const TEST_TOKEN = "test-token";

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

function cidHex(n: number): string {
  return n.toString(16).toUpperCase().padStart(4, "0");
}

function assemblePdf(objectBodies: string[]): Uint8Array {
  const header = "%PDF-1.4\n";
  const parts = [
    header,
    ...objectBodies.map((body, i) => `${i + 1} 0 obj\n${body}\nendobj\n`),
  ];
  const offsets: number[] = [];
  let cursor = 0;
  for (const part of parts) {
    if (part !== header) offsets.push(cursor);
    cursor += Buffer.byteLength(part);
  }
  const pad = (n: number) => `${String(n).padStart(10, "0")} 00000 n \n`;
  const xref =
    `xref\n0 ${objectBodies.length + 1}\n0000000000 65535 f \n` +
    offsets.map((n) => pad(n)).join("");
  const trailer =
    `trailer\n<< /Size ${objectBodies.length + 1} /Root 1 0 R >>\nstartxref\n${cursor}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(parts.join("") + xref + trailer));
}

function toUnicodeCmap(chars: string[]): string {
  const pairs = chars.map(
    (ch, i) => `<${cidHex(i + 1)}> <${cidHex(ch.codePointAt(0) ?? 0)}>`,
  );
  const blocks: string[] = [];
  for (let i = 0; i < pairs.length; i += 100) {
    const slice = pairs.slice(i, i + 100);
    blocks.push(`${slice.length} beginbfchar\n${slice.join("\n")}\nendbfchar`);
  }
  return `/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def
/CMapName /Adobe-Identity-UCS def
/CMapType 2 def
1 begincodespacerange
<0000> <FFFF>
endcodespacerange
${blocks.join("\n")}
endcmap
CMapName currentdict /CMap defineresource pop
end
end
`;
}

/**
 * Page texts use Identity-H ToUnicode (≥8 Han) so ingest can skip OCR; null
 * pages stay empty like emptyPagesPdf. Newlines flatten to spaces because the
 * CMap path does not preserve Td breaks, and heading search still sees the Han.
 */
function dualPathPdf(pageTexts: Array<string | null>): Uint8Array {
  const pageCount = pageTexts.length;
  const kids = pageTexts.map((_, i) => `${3 + i} 0 R`).join(" ");
  const fontId = 3 + pageCount;
  const cidFontId = fontId + 1;
  const fdId = fontId + 2;
  const cmapId = fontId + 3;
  const bodies: string[] = [];
  const setObj = (id: number, body: string): void => {
    bodies[id - 1] = body;
  };
  setObj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  setObj(2, `<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`);
  const allChars: string[] = [];
  let nextContentId = cmapId + 1;
  for (let i = 0; i < pageCount; i += 1) {
    const raw = pageTexts[i];
    const pageId = 3 + i;
    if (raw == null || raw.length === 0) {
      setObj(pageId, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>");
      continue;
    }
    const chars = Array.from(raw.replaceAll("\n", " "));
    const startCid = allChars.length + 1;
    allChars.push(...chars);
    const contentId = nextContentId;
    nextContentId += 1;
    const tj = chars.map((_, j) => cidHex(startCid + j)).join("");
    const content = `BT /F1 12 Tf 10 100 Td <${tj}> Tj ET\n`;
    setObj(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    setObj(
      contentId,
      `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`,
    );
  }
  setObj(
    fontId,
    `<< /Type /Font /Subtype /Type0 /BaseFont /Dummy /Encoding /Identity-H /DescendantFonts [${cidFontId} 0 R] /ToUnicode ${cmapId} 0 R >>`,
  );
  setObj(
    cidFontId,
    `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /Dummy /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${fdId} 0 R /DW 1000 /CIDToGIDMap /Identity >>`,
  );
  setObj(
    fdId,
    "<< /Type /FontDescriptor /FontName /Dummy /Flags 4 /FontBBox [0 0 1000 1000] /ItalicAngle 0 /Ascent 800 /Descent -200 /CapHeight 700 /StemV 80 >>",
  );
  const cmap = toUnicodeCmap(allChars);
  setObj(cmapId, `<< /Length ${Buffer.byteLength(cmap)} >>\nstream\n${cmap}endstream`);
  return assemblePdf(bodies);
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

async function stubPng(_bytes: Uint8Array, _pageNo: number): Promise<Uint8Array> {
  return STUB_PNG;
}

describe("PDF text/scan dual-path ingest", () => {
  let pipeline: JobPipeline;
  let vector: MemoryVectorStore;

  beforeEach(() => {
    vector = new MemoryVectorStore();
    pipeline = JobPipeline.openStandardLibrary({
      vector,
      graph: new MemoryGraphStore(),
    });
    setPdfPageRaster(stubPng);
  });

  afterEach(async () => {
    setPdfPageRaster(undefined);
    await pipeline.close();
  });

  async function seedPack(): Promise<{ pack_id: string }> {
    const project = await pipeline.createProject();
    return pipeline.createSpecPack({
      projectId: project.project_id,
      name: "标准入库包",
      version: "1",
    });
  }

  it("text-layer PDF ticks one page without OCR and is searchable", async () => {
    const pack = await seedPack();
    const ocr = new SpyOcr([PAGE2_TEXT]);
    const started = await pipeline.startStandardPdfIngest(
      {
        packId: pack.pack_id,
        title: "文字层标准",
        fileName: "text.pdf",
        bytes: dualPathPdf([PAGE1_TEXT]),
      },
      { ocr, raster: stubPng },
    );
    expect(started.page_count).toBe(1);
    expect(ocr.layoutCalls).toHaveLength(0);

    const tick = await pipeline.tickStandardIngest(started.ingest_run_id);
    expect(tick.page_no).toBe(1);
    expect(tick.status).toBe("ok");
    expect(ocr.layoutCalls).toHaveLength(0);

    const ports = pipeline.library.getPorts();
    const hits = await vector.search(await ports.embed.embed("强度要求"), {
      versionId: started.version.version_id,
      topK: 8,
    });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((hit) => hit.payload?.page_start === 1)).toBe(true);
  });

  it("blank emptyPagesPdf OCRs a PNG", async () => {
    const pack = await seedPack();
    const ocr = new SpyOcr([PAGE1_TEXT]);
    const started = await pipeline.startStandardPdfIngest(
      {
        packId: pack.pack_id,
        title: "扫描标准",
        fileName: "scan.pdf",
        bytes: emptyPagesPdf(1),
      },
      { ocr, raster: stubPng },
    );

    const tick = await pipeline.tickStandardIngest(started.ingest_run_id);
    expect(tick.page_no).toBe(1);
    expect(tick.status).toBe("ok");
    expect(ocr.layoutCalls.length).toBeGreaterThanOrEqual(1);
    expect(ocr.layoutCalls[0]!.mime).toBe("image/png");
  });

  it("mixed 2-page PDF uses text then OCR and both retrieve", async () => {
    const pack = await seedPack();
    const ocr = new SpyOcr([PAGE2_TEXT]);
    const started = await pipeline.startStandardPdfIngest(
      {
        packId: pack.pack_id,
        title: "混排标准",
        fileName: "mixed.pdf",
        bytes: dualPathPdf([PAGE1_TEXT, null]),
      },
      { ocr, raster: stubPng },
    );
    expect(started.page_count).toBe(2);
    expect(ocr.layoutCalls).toHaveLength(0);

    const tick1 = await pipeline.tickStandardIngest(started.ingest_run_id);
    expect(tick1.page_no).toBe(1);
    expect(tick1.status).toBe("ok");
    expect(ocr.layoutCalls).toHaveLength(0);

    const tick2 = await pipeline.tickStandardIngest(started.ingest_run_id);
    expect(tick2.page_no).toBe(2);
    expect(tick2.status).toBe("ok");
    expect(ocr.layoutCalls).toHaveLength(1);
    expect(ocr.layoutCalls[0]!.mime).toBe("image/png");

    const ports = pipeline.library.getPorts();
    const versionId = started.version.version_id;
    const page1Hits = await vector.search(await ports.embed.embed("强度要求"), {
      versionId,
      topK: 8,
    });
    expect(page1Hits.length).toBeGreaterThan(0);
    expect(page1Hits.some((hit) => hit.payload?.page_start === 1)).toBe(true);

    const page2Hits = await vector.search(await ports.embed.embed("外观要求"), {
      versionId,
      topK: 8,
    });
    expect(page2Hits.length).toBeGreaterThan(0);
    expect(page2Hits.some((hit) => hit.payload?.page_start === 2)).toBe(true);
  });

  it("single tick advances only one page_no", async () => {
    const pack = await seedPack();
    const ocr = new SpyOcr([PAGE1_TEXT, PAGE2_TEXT]);
    const started = await pipeline.startStandardPdfIngest(
      {
        packId: pack.pack_id,
        title: "分页标准",
        fileName: "pages.pdf",
        bytes: emptyPagesPdf(2),
      },
      { ocr, raster: stubPng },
    );

    const tick1 = await pipeline.tickStandardIngest(started.ingest_run_id);
    expect(tick1.page_no).toBe(1);
    expect(tick1.done).toBe(false);
    expect(ocr.layoutCalls).toHaveLength(1);

    const tick2 = await pipeline.tickStandardIngest(started.ingest_run_id);
    expect(tick2.page_no).toBe(2);
    expect(tick2.page_no).not.toBe(tick1.page_no);
    expect(ocr.layoutCalls).toHaveLength(2);
  });

  it("requireLiveOcr with test-token returns PaddleOcr, not FakeOcr", () => {
    expect(typeof requireLiveOcr).toBe("function");
    const ocr = requireLiveOcr({ PADDLEOCR_ACCESS_TOKEN: TEST_TOKEN });
    expect(ocr).toBeInstanceOf(PaddleOcr);
    expect(ocr).not.toBeInstanceOf(FakeOcr);
  });
});
