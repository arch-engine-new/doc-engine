/**
 * OCR text helpers shared by Paddle VL flatten and (Task 4) Unicode PDF
 * text-layer extraction. Flatten lives here so later PDF decoding can land
 * in the same module without moving the Paddle success-path call.
 */

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
