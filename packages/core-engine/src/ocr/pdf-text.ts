/**
 * OCR text helpers shared by Paddle VL flatten and Unicode PDF text-layer
 * extraction. Flatten and PDF decoding share this module so JobPipeline can
 * import one place without moving the Paddle success-path call.
 */

import { extractText, getDocumentProxy } from "unpdf";

const MIN_HAN_FOR_TEXT_LAYER = 8;
const MIN_LETTERS_WITH_HAN = 40;

/**
 * Strip Paddle VL markdown so the frozen parseOcrFields regex can still see
 * 编号/日期A/日期B labels. Live VL wraps those labels in headings, emphasis,
 * and table pipes; widening parseOcrFields would change FakeOcr and stored
 * ocr_text semantics.
 */
export function flattenOcrMarkdown(markdown: string): string {
  const source = typeof markdown === "string" ? markdown : "";
  if (source.length === 0) {
    return "";
  }
  return source
    .split(/\r?\n/)
    .map((line) => flattenOcrMarkdownLine(line))
    .join("\n")
    .trim();
}

function flattenOcrMarkdownLine(line: string): string {
  let out = line.replace(/^\s{0,3}#{1,6}\s*/, "");
  out = out.replace(/[*_]/g, "");
  out = out.replace(/\|/g, " ");
  return out.replace(/[ \t]+/g, " ").trim();
}

/**
 * Decode the PDF Unicode text layer via unpdf (PDF.js), including CJK CMaps.
 * Must not use latin1 parenthesis regex: that treats binary as copy and would
 * mark scanned examples as vendor=pdf-text garbage. Empty / undecodable input
 * returns "" so the usable-layer gate can fall through to OCR.
 */
export async function extractPdfUnicodeText(bytes: Uint8Array): Promise<string> {
  if (bytes == null || bytes.byteLength === 0) {
    return "";
  }
  try {
    const data = Uint8Array.from(bytes);
    const pdf = await getDocumentProxy(data);
    // mergePages:true overload is `text: string`; `.join` would type as never.
    const result = await extractText(pdf, { mergePages: true });
    return result.text;
  } catch {
    return "";
  }
}

/**
 * Per-page Unicode for standard ingest ticks. mergePages:true would collapse
 * page boundaries so a later raster+OCR tick could not target a single empty page.
 */
export async function extractPdfUnicodePages(bytes: Uint8Array): Promise<string[]> {
  if (bytes == null || bytes.byteLength === 0) {
    return [];
  }
  try {
    const data = Uint8Array.from(bytes);
    const pdf = await getDocumentProxy(data);
    const result = await extractText(pdf, { mergePages: false });
    return result.text;
  } catch {
    return [];
  }
}

/**
 * True only when decoded text is readable copy: Han ≥ 8, or Unicode letters
 * ≥ 40 with at least one Han. Zero-Han parenthesis / latin1 soup must stay
 * false so scanned PDFs go to OcrPort instead of vendor=pdf-text.
 */
export function hasUsablePdfTextLayer(text: string): boolean {
  const source = typeof text === "string" ? text : "";
  const han = countUnicode(source, /\p{Script=Han}/gu);
  if (han >= MIN_HAN_FOR_TEXT_LAYER) {
    return true;
  }
  const letters = countUnicode(source, /\p{L}/gu);
  return letters >= MIN_LETTERS_WITH_HAN && han >= 1;
}

function countUnicode(text: string, pattern: RegExp): number {
  return Array.from(text.matchAll(pattern)).length;
}
