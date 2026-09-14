const ACCESS_TOKEN_ENV = "PADDLEOCR_ACCESS_TOKEN";
const MODEL_ENV = "PADDLEOCR_MODEL";
const JOB_URL_ENV = "PADDLEOCR_JOB_URL";
const POLL_TIMEOUT_ENV = "PADDLEOCR_POLL_TIMEOUT_MS";

const DEFAULT_PADDLE_OCR_MODEL = "PaddleOCR-VL-1.6";
const DEFAULT_PADDLE_OCR_JOB_URL =
  "https://paddleocr.aistudio-app.com/api/v2/ocr/jobs";
const DEFAULT_PADDLE_OCR_POLL_TIMEOUT_MS = 180_000;

function readTrimmed(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const raw = env[key];
  if (raw == null) {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Reject non-integers so a typo cannot silently become the 180s default and
 * hang the Vite upload proxy longer (or shorter) than operators expect.
 */
function parsePollTimeoutMs(raw: string | undefined): number {
  if (raw == null) {
    return DEFAULT_PADDLE_OCR_POLL_TIMEOUT_MS;
  }
  if (!/^[0-9]+$/.test(raw)) {
    throw new Error(
      `Invalid ${POLL_TIMEOUT_ENV}: expected a positive integer milliseconds`,
    );
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(
      `Invalid ${POLL_TIMEOUT_ENV}: expected a positive integer milliseconds`,
    );
  }
  return value;
}

/**
 * Live OCR credentials plus job routing. The token must never be interpolated
 * into logs or Error messages — only the adapter's Authorization header.
 */
export interface PaddleOcrEnvConfig {
  token: string;
  model: string;
  jobUrl: string;
  pollTimeoutMs: number;
}

/**
 * Token empty → null so live assembly can 503 / skip health instead of
 * falling back to FakeOcr. Optional model/url/timeout only apply when a token
 * is present; CI and FakeOcr never read these keys.
 */
export function readPaddleOcrEnv(
  env: NodeJS.ProcessEnv = process.env,
): PaddleOcrEnvConfig | null {
  const token = readTrimmed(env, ACCESS_TOKEN_ENV);
  if (token == null) {
    return null;
  }
  return {
    token,
    model: readTrimmed(env, MODEL_ENV) ?? DEFAULT_PADDLE_OCR_MODEL,
    jobUrl: readTrimmed(env, JOB_URL_ENV) ?? DEFAULT_PADDLE_OCR_JOB_URL,
    pollTimeoutMs: parsePollTimeoutMs(readTrimmed(env, POLL_TIMEOUT_ENV)),
  };
}
