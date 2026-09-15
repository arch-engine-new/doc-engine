import { readPaddleOcrEnv, type PaddleOcrEnvConfig } from "./env.js";
import { flattenOcrMarkdown } from "./pdf-text.js";
import type { OcrPort, OcrRecognizeInput, OcrRecognizeResult } from "./port.js";

const VENDOR = "paddleocr-vl";
const MAX_LOCAL_FILE_BYTES = 50 * 1024 * 1024;
const DEFAULT_POLL_INTERVAL_MS = 5_000;
const QUEUE_BUSY_CODES = new Set([10010, 12002]);
const QUEUE_BUSY_MESSAGE = "队列繁忙或限流，请稍后手动重试";
const EMPTY_TEXT_MESSAGE = "PaddleOCR 未返回可抽取文本";

const OPTIONAL_PAYLOAD = {
  useDocOrientationClassify: false,
  useDocUnwarping: false,
  useChartRecognition: false,
};

/**
 * Test seams so recognize can stay a sync OcrPort without sleeping 5s or
 * calling aistudio from CI. Production omits this and uses real fetch/sleep.
 */
export interface PaddleOcrRuntimeDeps {
  fetch?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  pollIntervalMs?: number;
}

interface JobSnapshot {
  state: string;
  jsonUrl: string | undefined;
  errorMsg: string | undefined;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && /^[0-9]+$/.test(value)) {
    return Number(value);
  }
  return undefined;
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function vendorCode(body: unknown): number | undefined {
  return asFiniteNumber(asRecord(body)?.code);
}

function vendorMsg(body: unknown): string | undefined {
  return asNonEmptyString(asRecord(body)?.msg);
}

function readJobId(body: unknown): string | undefined {
  return asNonEmptyString(asRecord(asRecord(body)?.data)?.jobId);
}

/**
 * Submit-not-accepted copy must not mention a running remote job or invent a
 * jobId: operators would otherwise immediately POST the same file again.
 */
function throwIfSubmitRejected(httpStatus: number, body: unknown): void {
  const code = vendorCode(body);
  if (httpStatus === 429 || httpStatus !== 200 || (code != null && QUEUE_BUSY_CODES.has(code))) {
    throw new Error(QUEUE_BUSY_MESSAGE);
  }
  if (code != null && code !== 0) {
    throw new Error(vendorMsg(body) ?? `PaddleOCR 提交失败（code=${code}）`);
  }
}

async function readJsonBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.trim() === "") {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function markdownChunksFromResult(result: unknown): string[] {
  const layouts = asRecord(result)?.layoutParsingResults;
  if (!Array.isArray(layouts)) {
    return [];
  }
  const chunks: string[] = [];
  for (const item of layouts) {
    const text = asNonEmptyString(asRecord(asRecord(item)?.markdown)?.text);
    if (text != null) {
      chunks.push(text);
    }
  }
  return chunks;
}

/**
 * Official jsonl wraps pages in `result`. Accepting a top-level
 * layoutParsingResults would let a wrong mock go green while live VL output
 * is dropped as an empty string.
 */
function extractMarkdownFromJsonl(jsonl: string): string {
  const chunks: string[] = [];
  for (const rawLine of jsonl.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0) {
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(line) as unknown;
    } catch {
      throw new Error(EMPTY_TEXT_MESSAGE);
    }
    const record = asRecord(parsed);
    if (record == null || !("result" in record) || record.result == null) {
      throw new Error(EMPTY_TEXT_MESSAGE);
    }
    chunks.push(...markdownChunksFromResult(record.result));
  }
  const text = chunks.join("\n").trim();
  if (text.length === 0) {
    throw new Error(EMPTY_TEXT_MESSAGE);
  }
  return text;
}

function joinJobUrl(jobUrl: string, jobId: string): string {
  return `${jobUrl.replace(/\/$/, "")}/${encodeURIComponent(jobId)}`;
}

function timeoutMessage(jobId: string): string {
  return `PaddleOCR 任务 ${jobId} 轮询超时。远端任务可能仍在执行，请勿立即重复提交同一文件。`;
}

/**
 * Live OcrPort for AI Studio async jobs. Polling stays inside recognize so
 * upload HTTP can keep the existing sync contract; deps are injectable so CI
 * never sleeps 5s or reaches aistudio.
 */
export class PaddleOcr implements OcrPort {
  private readonly config: PaddleOcrEnvConfig;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly pollIntervalMs: number;

  constructor(config: PaddleOcrEnvConfig, deps: PaddleOcrRuntimeDeps = {}) {
    this.config = config;
    this.fetchImpl = deps.fetch ?? fetch;
    this.now = deps.now ?? Date.now;
    this.sleep = deps.sleep ?? defaultSleep;
    this.pollIntervalMs = deps.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  }

  /**
   * Token empty → null so live assembly 503s / health-skips instead of
   * constructing an adapter that would POST with a blank Authorization.
   */
  static fromEnv(env: NodeJS.ProcessEnv = process.env): PaddleOcr | null {
    const config = readPaddleOcrEnv(env);
    return config == null ? null : new PaddleOcr(config);
  }

  /**
   * Job checks need flattened copy: parseOcrFields is frozen and cannot see
   * VL headings/emphasis/table pipes. Standard ingest must not call this.
   */
  async recognize(input: OcrRecognizeInput): Promise<OcrRecognizeResult> {
    const { text, jobId } = await this.runJob(input);
    return { text: flattenOcrMarkdown(text), vendor: VENDOR, raw: { jobId } };
  }

  /**
   * Standard ingest keeps VL table pipes so splitLayoutUnits can recover
   * cell_ref. Flattening here would drop D2 tables that Job recognize still strips.
   */
  async recognizeLayout(input: OcrRecognizeInput): Promise<OcrRecognizeResult> {
    const { text, jobId } = await this.runJob(input);
    return { text, vendor: VENDOR, raw: { jobId } };
  }

  /** Shared submit/poll/jsonl so recognize vs layout only differ on flatten. */
  private async runJob(input: OcrRecognizeInput): Promise<{ text: string; jobId: string }> {
    this.assertWithinLocalLimit(input.bytes);
    const jobId = await this.submitJob(input);
    const done = await this.pollUntilDone(jobId);
    const text = await this.readResultMarkdown(done);
    return { text, jobId };
  }

  private assertWithinLocalLimit(bytes: Uint8Array): void {
    if (bytes.byteLength <= MAX_LOCAL_FILE_BYTES) {
      return;
    }
    throw new Error("本地文件超过 PaddleOCR 50MB 上限，请压缩后再上传。");
  }

  private authHeaders(): { Authorization: string } {
    return { Authorization: `bearer ${this.config.token}` };
  }

  private async submitJob(input: OcrRecognizeInput): Promise<string> {
    const form = new FormData();
    form.set("model", this.config.model);
    form.set("optionalPayload", JSON.stringify(OPTIONAL_PAYLOAD));
    form.set("file", new Blob([input.bytes], { type: input.mime }), input.fileName);
    const response = await this.fetchImpl(this.config.jobUrl, {
      method: "POST",
      headers: this.authHeaders(),
      body: form,
    });
    const body = await readJsonBody(response);
    throwIfSubmitRejected(response.status, body);
    const jobId = readJobId(body);
    if (jobId == null) {
      throw new Error("PaddleOCR 提交未被接受，请稍后手动重试");
    }
    return jobId;
  }

  private async pollUntilDone(jobId: string): Promise<JobSnapshot> {
    const startedAt = this.now();
    for (;;) {
      const snapshot = await this.readJobSnapshot(jobId);
      if (snapshot.state === "done") {
        return snapshot;
      }
      if (snapshot.state === "failed") {
        throw new Error(
          snapshot.errorMsg ?? `PaddleOCR 任务 ${jobId} 失败，请勿立即重复提交同一文件。`,
        );
      }
      if (this.now() - startedAt >= this.config.pollTimeoutMs) {
        throw new Error(timeoutMessage(jobId));
      }
      await this.sleep(this.pollIntervalMs);
    }
  }

  private async readJobSnapshot(jobId: string): Promise<JobSnapshot> {
    const response = await this.fetchImpl(joinJobUrl(this.config.jobUrl, jobId), {
      method: "GET",
      headers: this.authHeaders(),
    });
    const body = await readJsonBody(response);
    if (response.status !== 200) {
      throw new Error(`PaddleOCR 查询任务失败（HTTP ${response.status}）`);
    }
    const data = asRecord(asRecord(body)?.data) ?? asRecord(body);
    const state = asNonEmptyString(data?.state)?.toLowerCase() ?? "pending";
    const jsonUrl = asNonEmptyString(asRecord(data?.resultUrl)?.jsonUrl);
    const errorMsg = asNonEmptyString(data?.errorMsg);
    return { state, jsonUrl, errorMsg };
  }

  private async readResultMarkdown(done: JobSnapshot): Promise<string> {
    if (done.jsonUrl == null) {
      throw new Error(EMPTY_TEXT_MESSAGE);
    }
    const response = await this.fetchImpl(done.jsonUrl);
    if (response.status !== 200) {
      throw new Error(EMPTY_TEXT_MESSAGE);
    }
    return extractMarkdownFromJsonl(await response.text());
  }
}

/**
 * Same null-token gate as PaddleOcr.fromEnv so Task 6 can import a function
 * without constructing a client that would hit AI Studio from CI.
 */
export function fromEnv(env: NodeJS.ProcessEnv = process.env): PaddleOcr | null {
  return PaddleOcr.fromEnv(env);
}
