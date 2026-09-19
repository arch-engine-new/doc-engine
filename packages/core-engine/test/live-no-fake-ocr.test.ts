/**
 * F-5 Task 1 RED: live assembly must not silently fall back to FakeOcr.
 * requireLiveOcr is not exported yet — missing export / runtime throw is the red light.
 * Placeholder token is only "test-token". Never call recognize on PaddleOcr or hit aistudio.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FakeOcr } from "../src/ocr/fake.js";
import { PaddleOcr } from "../src/ocr/paddleocr.js";
import { requireLiveOcr } from "../src/pipeline/job-pipeline.js";

const TEST_TOKEN = "test-token";
const FORBIDDEN_LIVE_FALLBACK = "PaddleOcr.fromEnv() ?? new FakeOcr()";
const PIPELINE_SOURCE = join(
  dirname(fileURLToPath(import.meta.url)),
  "../src/pipeline/job-pipeline.ts",
);

function extractOpenLiveFromEnvBody(source: string): string {
  const marker = "static async openLiveFromEnv(";
  const start = source.indexOf(marker);
  if (start < 0) {
    throw new Error("openLiveFromEnv not found in job-pipeline.ts");
  }
  const brace = source.indexOf("{", start);
  if (brace < 0) {
    throw new Error("openLiveFromEnv body brace not found");
  }
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(brace, i + 1);
      }
    }
  }
  throw new Error("openLiveFromEnv body is unclosed");
}

describe("live JobPipeline forbids silent FakeOcr", () => {
  it("openLiveFromEnv body must not contain PaddleOcr.fromEnv() ?? new FakeOcr()", () => {
    const source = readFileSync(PIPELINE_SOURCE, "utf8");
    const body = extractOpenLiveFromEnvBody(source);
    expect(body).not.toContain(FORBIDDEN_LIVE_FALLBACK);
  });

  it("requireLiveOcr throws without PADDLEOCR_ACCESS_TOKEN and does not leak secrets", () => {
    // Guard against TypeError "requireLiveOcr is not a function" matching /OCR/i.
    expect(typeof requireLiveOcr).toBe("function");
    expect(() => requireLiveOcr({})).toThrow(/Paddle|OCR|token/i);
    try {
      requireLiveOcr({});
      throw new Error("expected requireLiveOcr to throw");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).toMatch(/Paddle|OCR|token/i);
      expect(message).not.toContain(TEST_TOKEN);
      expect(message).not.toMatch(/bearer\s+\S+/i);
      expect(message).not.toMatch(/is not a function/i);
    }
  });

  it("requireLiveOcr with test-token returns PaddleOcr, not FakeOcr", () => {
    expect(typeof requireLiveOcr).toBe("function");
    const ocr = requireLiveOcr({ PADDLEOCR_ACCESS_TOKEN: TEST_TOKEN });
    expect(ocr).toBeInstanceOf(PaddleOcr);
    expect(ocr).not.toBeInstanceOf(FakeOcr);
  });

  it("explicit FakeOcr scan-fixture recognize stays vendor fake", async () => {
    const ocr = new FakeOcr("scan-fixture");
    const result = await ocr.recognize({
      bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
      mime: "image/jpeg",
      fileName: "scan.jpg",
    });
    expect(result.vendor).toBe("fake");
    expect(result.text).toContain("scan-fixture");
  });
});
