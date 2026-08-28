import type { OcrPort, OcrRecognizeInput, OcrRecognizeResult } from "./port.js";

/**
 * Default injected page so later tests can parse 编号/日期A/日期B without a vendor call.
 * Dates are inverted (A > B) so R2 compare can stay blocking when Task 6 wires extract.
 */
export const DEFAULT_FAKE_OCR_TEXT =
  "编号：SH-002\n日期A：2026-08-20\n日期B：2026-08-01";

/**
 * Deterministic OcrPort for unit tests and CI. Never fetches, never reads BAIDU_* env.
 * Constructor text is returned as-is so callers inject 编号/日期 samples without parsing here.
 */
export class FakeOcr implements OcrPort {
  private readonly text: string;

  constructor(text: string = DEFAULT_FAKE_OCR_TEXT) {
    this.text = text;
  }

  async recognize(_input: OcrRecognizeInput): Promise<OcrRecognizeResult> {
    return { text: this.text, vendor: "fake" };
  }
}
