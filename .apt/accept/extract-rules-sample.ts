/**
 * Pull a short Unicode sample from rules/*.pdf for standard_lib textarea ingest.
 * Full 85MB book is out of Job 4MB gate; this is only clause-split text, not upload.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractPdfUnicodeText } from "../../packages/core-engine/src/ocr/pdf-text.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const rulesDir = path.join(root, "rules");
const outPath = path.join(root, ".apt/accept/rules-ingest-sample.txt");

const pdf = readdirSync(rulesDir).find((name) => name.toLowerCase().endsWith(".pdf"));
if (!pdf) {
  writeFileSync(outPath, "", "utf8");
  console.log("NO_RULES_PDF");
  process.exit(0);
}

async function main(): Promise<void> {
  const pdfPath = path.join(rulesDir, pdf);
  const bytes = readFileSync(pdfPath);
  console.log(`reading ${pdf} bytes=${bytes.byteLength}`);
  const text = await extractPdfUnicodeText(bytes);
  const han = (text.match(/\p{Script=Han}/gu) ?? []).length;
  const sample = text.slice(0, 12_000);
  writeFileSync(outPath, sample, "utf8");
  console.log(`wrote ${outPath} chars=${sample.length} han=${han} totalChars=${text.length}`);
}

void main();
