/**
 * Bytes handed to OCR so the vendor can read the original without a second upload.
 * mime/fileName exist so Paddle can name the multipart file; FakeOcr ignores them.
 */
export interface OcrRecognizeInput {
  bytes: Uint8Array;
  mime: string;
  fileName: string;
}

/**
 * Full-page OCR text only. Field projection is extractByTemplate (Task 6), not this port.
 * vendor distinguishes Fake vs Paddle so health/audit never treat injected text as live OCR.
 */
export interface OcrRecognizeResult {
  text: string;
  vendor: string;
  raw?: unknown;
}

/**
 * Swap PaddleOcr vs FakeOcr at assembly time (Task 7) so CI never hits the network.
 * recognize must not parse 编号/日期 fields — that belongs to parseOcrFields + extractByTemplate.
 */
export interface OcrPort {
  recognize(input: OcrRecognizeInput): Promise<OcrRecognizeResult>;
}
