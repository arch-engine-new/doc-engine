import type { BaiduOcrApi, BaiduOcrEnvConfig } from "./env.js";
import { readBaiduOcrEnv } from "./env.js";
import type { OcrPort, OcrRecognizeInput, OcrRecognizeResult } from "./port.js";

const TOKEN_URL = "https://aip.baidubce.com/oauth/2.0/token";
const OCR_URL_PREFIX = "https://aip.baidubce.com/rest/2.0/ocr/v1/";
const TOKEN_EXPIRY_BUFFER_MS = 60_000;
const VENDOR = "baidu";

interface CachedAccessToken {
  accessToken: string;
  refreshAfterMs: number;
}

interface BaiduTokenBody {
  access_token?: unknown;
  expires_in?: unknown;
  error?: unknown;
}

interface BaiduOcrBody {
  error_code?: unknown;
  error_msg?: unknown;
  words_result?: unknown;
}

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  return value.length > 0 ? value : undefined;
}

async function readJsonBody(response: Response, context: string): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`${context} returned non-JSON (HTTP ${response.status})`);
  }
}

/**
 * Quota (17) and QPS (18) must fail in Chinese and never retry — auto-retry
 * would burn the remaining daily allowance and hide the real operator action.
 */
function throwIfOcrVendorError(body: BaiduOcrBody): void {
  const errorCode = asFiniteNumber(body.error_code);
  if (errorCode == null || errorCode === 0) {
    return;
  }
  if (errorCode === 17) {
    throw new Error("百度OCR日调用额度已用尽，请明日再试或升级配额。未自动重试，以免继续消耗额度。");
  }
  if (errorCode === 18) {
    throw new Error("百度OCR请求频率超过QPS限制。未自动重试，以免打爆额度。");
  }
  const errorMsg = asNonEmptyString(body.error_msg);
  throw new Error(
    errorMsg
      ? `百度OCR识别失败（error_code=${errorCode}：${errorMsg}）`
      : `百度OCR识别失败（error_code=${errorCode}）`,
  );
}

function joinWordsResult(wordsResult: unknown): string {
  if (!Array.isArray(wordsResult)) {
    return "";
  }
  const lines: string[] = [];
  for (const item of wordsResult) {
    if (typeof item !== "object" || item === null) {
      continue;
    }
    const words = asNonEmptyString((item as { words?: unknown }).words);
    if (words != null) {
      lines.push(words);
    }
  }
  return lines.join("\n");
}

function cacheToken(accessToken: string, expiresInSec: number): CachedAccessToken {
  const ttlMs = Math.max(0, expiresInSec * 1000 - TOKEN_EXPIRY_BUFFER_MS);
  return { accessToken, refreshAfterMs: Date.now() + ttlMs };
}

/**
 * Live OcrPort for uploaded JPEG/PNG. Token is cached so each page does not
 * spend an extra OAuth round-trip; 17/18 fail closed without retry.
 * Does not parse 编号/日期 — that is Task 6 (parseOcrFields).
 */
export class BaiduOcr implements OcrPort {
  private readonly apiKey: string;
  private readonly secretKey: string;
  private readonly api: BaiduOcrApi;
  private cachedToken: CachedAccessToken | null = null;

  constructor(options: BaiduOcrEnvConfig) {
    this.apiKey = options.apiKey;
    this.secretKey = options.secretKey;
    this.api = options.api;
  }

  async recognize(input: OcrRecognizeInput): Promise<OcrRecognizeResult> {
    const accessToken = await this.getAccessToken();
    const body = await this.requestRecognize(accessToken, input.bytes);
    throwIfOcrVendorError(body);
    return {
      text: joinWordsResult(body.words_result),
      vendor: VENDOR,
      raw: body,
    };
  }

  private async getAccessToken(): Promise<string> {
    if (this.cachedToken !== null && Date.now() < this.cachedToken.refreshAfterMs) {
      return this.cachedToken.accessToken;
    }
    return this.requestAccessToken();
  }

  private async requestAccessToken(): Promise<string> {
    const form = new URLSearchParams();
    form.set("grant_type", "client_credentials");
    form.set("client_id", this.apiKey);
    form.set("client_secret", this.secretKey);
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    const json = (await readJsonBody(response, "Baidu OCR token")) as BaiduTokenBody;
    const accessToken = asNonEmptyString(json.access_token);
    if (json.error != null || accessToken == null) {
      throw new Error(
        "百度OCR获取 access_token 失败，请检查 API Key 与 Secret Key 是否成对配置（密钥未写入错误信息）。",
      );
    }
    const expiresInSec = asFiniteNumber(json.expires_in) ?? 2_592_000;
    this.cachedToken = cacheToken(accessToken, expiresInSec);
    return accessToken;
  }

  private async requestRecognize(
    accessToken: string,
    bytes: Uint8Array,
  ): Promise<BaiduOcrBody> {
    const form = new URLSearchParams();
    form.set("image", bytesToBase64(bytes));
    const url = `${OCR_URL_PREFIX}${this.api}?access_token=${encodeURIComponent(accessToken)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    return (await readJsonBody(response, "Baidu OCR")) as BaiduOcrBody;
  }
}

/**
 * Skip constructing BaiduOcr when both keys are absent so CI/fixture never
 * calls aip.baidubce.com. One key only is a config bug, not a FakeOcr fallback.
 */
export function fromEnv(env: NodeJS.ProcessEnv = process.env): BaiduOcr | null {
  const config = readBaiduOcrEnv(env);
  if (config == null) {
    return null;
  }
  return new BaiduOcr(config);
}
