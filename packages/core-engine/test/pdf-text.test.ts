/**
 * Task 4: Unicode PDF text layer (no latin1 parenthesis gate).
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseOcrFields } from "../src/extract/ocr-fields.js";
import {
  extractPdfUnicodePages,
  extractPdfUnicodeText,
  flattenOcrMarkdown,
  hasUsablePdfTextLayer,
} from "../src/ocr/pdf-text.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const EXAMPLES_DIR = path.join(REPO_ROOT, "examples");
const VL_MARKDOWN = "# 表\n**编号：** SH-002\n日期A：2026-08-20\n日期B：2026-08-01";

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

/** Blank pages, no ToUnicode / Tj — scan-like fixtures; page count must stay unmerged. */
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
    if (part !== header) {
      offsets.push(cursor);
    }
    cursor += Buffer.byteLength(part);
  }
  const objectCount = 2 + pageCount;
  const pad = (n: number) => `${String(n).padStart(10, "0")} 00000 n \n`;
  const xref =
    `xref\n0 ${objectCount + 1}\n0000000000 65535 f \n` + offsets.map((n) => pad(n)).join("");
  const trailer = `trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${cursor}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(parts.join("") + xref + trailer));
}

function emptyPagePdf(): Uint8Array {
  return emptyPagesPdf(1);
}

describe("flattenOcrMarkdown", () => {
  it("lets parseOcrFields extract 编号/日期A/日期B from VL markdown", () => {
    const fields = parseOcrFields(flattenOcrMarkdown(VL_MARKDOWN));
    expect(fields["编号"]).toBe("SH-002");
    expect(fields["日期A"]).toBe("2026-08-20");
    expect(fields["日期B"]).toBe("2026-08-01");
  });
});

describe("extractPdfUnicodeText", () => {
  it("extracts at least 8 Han characters from an examples PDF", async () => {
    const bytes = new Uint8Array(readFileSync(resolveExamplePdf()));
    const text = await extractPdfUnicodeText(bytes);
    const han = Array.from(text.matchAll(/\p{Script=Han}/gu)).length;
    expect(han).toBeGreaterThanOrEqual(8);
    expect(hasUsablePdfTextLayer(text)).toBe(true);
  }, 30_000);

  it("returns empty string when the PDF has no text layer", async () => {
    await expect(extractPdfUnicodeText(emptyPagePdf())).resolves.toBe("");
  });
});

describe("extractPdfUnicodePages", () => {
  it("returns one string per page instead of a merged blob", async () => {
    const bytes = new Uint8Array(readFileSync(resolveExamplePdf()));
    const pages = await extractPdfUnicodePages(bytes);
    expect(Array.isArray(pages)).toBe(true);
    expect(pages.length).toBeGreaterThanOrEqual(1);
    const han = Array.from(pages.join("\n").matchAll(/\p{Script=Han}/gu)).length;
    expect(han).toBeGreaterThanOrEqual(8);

    const blankPages = await extractPdfUnicodePages(emptyPagesPdf(2));
    expect(blankPages).toHaveLength(2);
    expect(blankPages.every((page) => page.trim() === "")).toBe(true);
  }, 30_000);
});

describe("hasUsablePdfTextLayer", () => {
  it("is false for a synthetic PDF with no text layer", async () => {
    const text = await extractPdfUnicodeText(emptyPagePdf());
    expect(hasUsablePdfTextLayer(text)).toBe(false);
  });

  it("is false for zero-Han parenthesis / latin soup", () => {
    const garbage = `(${"binary latin1 soup ABCDEFGHIJKLMNOPQRSTUVWXYZ ".repeat(20)})`;
    expect(Array.from(garbage.matchAll(/\p{Script=Han}/gu))).toHaveLength(0);
    expect(hasUsablePdfTextLayer(garbage)).toBe(false);
  });

  it("is true at Han ≥ 8 and at letters ≥ 40 with one Han", () => {
    expect(hasUsablePdfTextLayer("质量检验评定表桩")).toBe(true);
    expect(hasUsablePdfTextLayer("质量检验评定表")).toBe(false);
    expect(hasUsablePdfTextLayer(`${"a".repeat(40)}桥`)).toBe(true);
    expect(hasUsablePdfTextLayer("a".repeat(40))).toBe(false);
  });
});
