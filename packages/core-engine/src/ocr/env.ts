/**
 * Default OCR route: general_basic has the wider free daily quota.
 * accurate_basic is opt-in only so uploads do not silently spend the dearer API.
 */
export const DEFAULT_BAIDU_OCR_API = "general_basic";

/**
 * Baidu REST path segment. general_basic is the default (wider free quota);
 * accurate_basic is opt-in via BAIDU_OCR_API so we do not spend quota silently.
 */
export type BaiduOcrApi = "general_basic" | "accurate_basic";

/**
 * Credentials plus which OCR route to hit. Values come from env or tests;
 * they must never be interpolated into logs or Error messages.
 */
export interface BaiduOcrEnvConfig {
  apiKey: string;
  secretKey: string;
  api: BaiduOcrApi;
}

const API_KEY_ENV = "BAIDU_OCR_API_KEY";
const SECRET_KEY_ENV = "BAIDU_OCR_SECRET_KEY";
const API_ENV = "BAIDU_OCR_API";

function readTrimmed(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const raw = env[key];
  if (raw == null) {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Accept only the two documented Baidu OCR routes so a typo cannot hit an
 * unexpected paid endpoint. Empty/unset means general_basic (quota-friendly).
 */
export function parseBaiduOcrApi(raw: string | undefined): BaiduOcrApi {
  if (raw == null || raw.length === 0) {
    return DEFAULT_BAIDU_OCR_API;
  }
  if (raw === "general_basic" || raw === "accurate_basic") {
    return raw;
  }
  throw new Error(
    `Invalid ${API_ENV}: expected general_basic or accurate_basic`,
  );
}

/**
 * Both keys missing → OCR is unconfigured (assembly returns null, no network).
 * Exactly one key → misconfiguration that must throw instead of FakeOcr fallback.
 * Key values are never included in the thrown message.
 */
export function readBaiduOcrEnv(
  env: NodeJS.ProcessEnv = process.env,
): BaiduOcrEnvConfig | null {
  const apiKey = readTrimmed(env, API_KEY_ENV);
  const secretKey = readTrimmed(env, SECRET_KEY_ENV);
  if (apiKey == null && secretKey == null) {
    return null;
  }
  if (apiKey == null || secretKey == null) {
    const missing = apiKey == null ? API_KEY_ENV : SECRET_KEY_ENV;
    throw new Error(`Incomplete Baidu OCR configuration: missing ${missing}`);
  }
  return {
    apiKey,
    secretKey,
    api: parseBaiduOcrApi(readTrimmed(env, API_ENV)),
  };
}
