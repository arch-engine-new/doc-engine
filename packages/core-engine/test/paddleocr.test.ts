/**
 * PaddleOcr L2: injected fetch covers job lifecycle, jsonl `result` wrapper,
 * 10010 vs timeout copy, and fromEnv without hitting aistudio.
 */

import { describe, expect, it } from "vitest";
import { parseOcrFields } from "../src/extract/ocr-fields.js";
import type { PaddleOcrEnvConfig } from "../src/ocr/env.js";
import { PaddleOcr } from "../src/ocr/paddleocr.js";
import { flattenOcrMarkdown } from "../src/ocr/pdf-text.js";
import type { OcrRecognizeInput } from "../src/ocr/port.js";

const TOKEN = "test-token-must-not-leak";
const JOB_URL = "https://paddleocr.test/api/v2/ocr/jobs";
const JOB_ID = "job-fixture-42";
const JSON_URL = "https://paddleocr.test/results/job-fixture-42.jsonl";
const PAGE_TEXT = "编号：SH-002\n日期A：2026-08-20";
const VL_MARKDOWN = "# 表\n**编号：** SH-002\n日期A：2026-08-20\n日期B：2026-08-01";
const AISTUDIO_HOST = "aistudio-app.com";
const MAX_LOCAL_FILE_BYTES = 50 * 1024 * 1024;

const CONFIG: PaddleOcrEnvConfig = {
  token: TOKEN,
  model: "PaddleOCR-VL-1.6",
  jobUrl: JOB_URL,
  pollTimeoutMs: 180_000,
};

const INPUT: OcrRecognizeInput = {
  bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
  mime: "image/jpeg",
  fileName: "scan.jpg",
};

interface RecordedCall {
  url: string;
  method: string;
  authorization: string;
  body: BodyInit | null | undefined;
}

function headerValue(headers: HeadersInit | undefined, name: string): string {
  if (headers == null) {
    return "";
  }
  if (headers instanceof Headers) {
    return headers.get(name) ?? "";
  }
  if (Array.isArray(headers)) {
    const hit = headers.find(([key]) => key.toLowerCase() === name.toLowerCase());
    return hit?.[1] ?? "";
  }
  const record = headers as Record<string, string>;
  const key = Object.keys(record).find((k) => k.toLowerCase() === name.toLowerCase());
  return key != null ? record[key]! : "";
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function jsonlWithResult(text: string): string {
  return JSON.stringify({
    result: { layoutParsingResults: [{ markdown: { text } }] },
  });
}

function jsonlTopLevelOnly(text: string): string {
  return JSON.stringify({
    layoutParsingResults: [{ markdown: { text } }],
  });
}

function jobStatusBody(state: string, extras: Record<string, unknown> = {}): unknown {
  return {
    code: 0,
    data: {
      jobId: JOB_ID,
      state,
      ...extras,
    },
  };
}

function assertNoAistudio(url: string): void {
  expect(url.toLowerCase()).not.toContain(AISTUDIO_HOST);
}

function createRecorder(handler: (call: RecordedCall, index: number) => Response | Promise<Response>): {
  fetch: typeof fetch;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    assertNoAistudio(url);
    const call: RecordedCall = {
      url,
      method: (init?.method ?? "GET").toUpperCase(),
      authorization: headerValue(init?.headers, "Authorization"),
      body: init?.body,
    };
    calls.push(call);
    return handler(call, calls.length - 1);
  };
  return { fetch: fetchImpl, calls };
}

function createAdapter(
  fetchImpl: typeof fetch,
  overrides: Partial<{
    now: () => number;
    sleep: (ms: number) => Promise<void>;
    pollIntervalMs: number;
    pollTimeoutMs: number;
  }> = {},
): PaddleOcr {
  return new PaddleOcr(
    { ...CONFIG, pollTimeoutMs: overrides.pollTimeoutMs ?? CONFIG.pollTimeoutMs },
    {
      fetch: fetchImpl,
      now: overrides.now ?? (() => 0),
      sleep: overrides.sleep ?? (async () => undefined),
      pollIntervalMs: overrides.pollIntervalMs ?? 0,
    },
  );
}

async function expectRecognizeError(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    expect(message).not.toContain(TOKEN);
    return message;
  }
  throw new Error("expected recognize to reject");
}

describe("PaddleOcr.fromEnv", () => {
  it("returns null when the access token is missing", () => {
    expect(PaddleOcr.fromEnv({})).toBeNull();
    expect(PaddleOcr.fromEnv({ PADDLEOCR_MODEL: "PaddleOCR-VL-1.6" })).toBeNull();
    expect(PaddleOcr.fromEnv({ PADDLEOCR_ACCESS_TOKEN: "   " })).toBeNull();
  });
});

describe("PaddleOcr.recognize", () => {
  it("walks pending → running → done and reads markdown via result.layoutParsingResults", async () => {
    const states = ["pending", "running", "done"];
    const { fetch, calls } = createRecorder(async (call) => {
      if (call.method === "POST" && call.url === JOB_URL) {
        expect(call.authorization).toBe(`bearer ${TOKEN}`);
        expect(call.body).toBeInstanceOf(FormData);
        const form = call.body as FormData;
        expect(form.get("model")).toBe("PaddleOCR-VL-1.6");
        expect(JSON.parse(String(form.get("optionalPayload")))).toEqual({
          useDocOrientationClassify: false,
          useDocUnwarping: false,
          useChartRecognition: false,
        });
        expect(form.get("file")).not.toBeNull();
        return jsonResponse({ code: 0, data: { jobId: JOB_ID } });
      }
      if (call.method === "GET" && call.url === `${JOB_URL}/${JOB_ID}`) {
        expect(call.authorization).toBe(`bearer ${TOKEN}`);
        const state = states.shift() ?? "done";
        return jsonResponse(
          jobStatusBody(state, state === "done" ? { resultUrl: { jsonUrl: JSON_URL } } : {}),
        );
      }
      if (call.method === "GET" && call.url === JSON_URL) {
        expect(call.authorization).toBe("");
        return new Response(jsonlWithResult(PAGE_TEXT), {
          status: 200,
          headers: { "Content-Type": "application/jsonl" },
        });
      }
      throw new Error(`unexpected ${call.method} ${call.url}`);
    });

    const result = await createAdapter(fetch).recognize(INPUT);

    expect(result.vendor).toBe("paddleocr-vl");
    expect(result.text).toBe(PAGE_TEXT);
    expect(calls.filter((c) => c.method === "POST" && c.url.includes("/ocr/jobs")).length).toBe(1);
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
    expect(calls.every((c) => !c.url.toLowerCase().includes(AISTUDIO_HOST))).toBe(true);
  });

  it("fails when jsonl only has top-level layoutParsingResults without result", async () => {
    const { fetch, calls } = createRecorder(async (call) => {
      if (call.method === "POST") {
        return jsonResponse({ code: 0, data: { jobId: JOB_ID } });
      }
      if (call.url === `${JOB_URL}/${JOB_ID}`) {
        return jsonResponse(jobStatusBody("done", { resultUrl: { jsonUrl: JSON_URL } }));
      }
      if (call.url === JSON_URL) {
        return new Response(jsonlTopLevelOnly(PAGE_TEXT), { status: 200 });
      }
      throw new Error(`unexpected ${call.method} ${call.url}`);
    });

    const message = await expectRecognizeError(() => createAdapter(fetch).recognize(INPUT));
    expect(message).toContain("未返回可抽取文本");
    expect(calls.filter((c) => c.method === "POST").length).toBe(1);
  });

  it("maps HTTP 200 + code=10010 to a manual-retry message without claiming the remote is still running", async () => {
    const { fetch, calls } = createRecorder(async (call) => {
      if (call.method === "POST") {
        return jsonResponse({ code: 10010, msg: "queue is full" });
      }
      throw new Error(`unexpected ${call.method} ${call.url}`);
    });

    const message = await expectRecognizeError(() => createAdapter(fetch).recognize(INPUT));
    expect(message).toContain("请稍后手动重试");
    expect(message).toContain("队列繁忙或限流");
    expect(message).not.toContain("远端仍在执行");
    expect(message).not.toContain(JOB_ID);
    expect(calls.filter((c) => c.method === "POST").length).toBe(1);
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
  });

  it("includes jobId and forbids immediate resubmit after poll timeout, without a second POST", async () => {
    let nowMs = 0;
    const { fetch, calls } = createRecorder(async (call) => {
      if (call.method === "POST") {
        return jsonResponse({ code: 0, data: { jobId: JOB_ID } });
      }
      if (call.url === `${JOB_URL}/${JOB_ID}`) {
        return jsonResponse(jobStatusBody("pending"));
      }
      throw new Error(`unexpected ${call.method} ${call.url}`);
    });

    const message = await expectRecognizeError(() =>
      createAdapter(fetch, {
        pollTimeoutMs: 1_000,
        pollIntervalMs: 500,
        now: () => nowMs,
        sleep: async () => {
          nowMs += 1_000;
        },
      }).recognize(INPUT),
    );

    expect(message).toContain(JOB_ID);
    expect(message).toContain("请勿立即重复提交");
    expect(calls.filter((c) => c.method === "POST" && c.url === JOB_URL).length).toBe(1);
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
  });

  it("rejects local files larger than 50MB in Chinese without posting a job", async () => {
    const { fetch, calls } = createRecorder(async (call) => {
      throw new Error(`unexpected ${call.method} ${call.url}`);
    });
    const oversized: OcrRecognizeInput = {
      ...INPUT,
      bytes: new Uint8Array(MAX_LOCAL_FILE_BYTES + 1),
    };

    const message = await expectRecognizeError(() => createAdapter(fetch).recognize(oversized));
    expect(message).toMatch(/50\s*MB|体积|过大/);
    expect(calls.length).toBe(0);
  });

  it("flattens VL markdown on the success path so parseOcrFields can read labels", async () => {
    const { fetch } = createRecorder(async (call) => {
      if (call.method === "POST") {
        return jsonResponse({ code: 0, data: { jobId: JOB_ID } });
      }
      if (call.url === `${JOB_URL}/${JOB_ID}`) {
        return jsonResponse(jobStatusBody("done", { resultUrl: { jsonUrl: JSON_URL } }));
      }
      if (call.url === JSON_URL) {
        return new Response(jsonlWithResult(VL_MARKDOWN), { status: 200 });
      }
      throw new Error(`unexpected ${call.method} ${call.url}`);
    });

    const result = await createAdapter(fetch).recognize(INPUT);
    const fields = parseOcrFields(result.text);
    expect(fields["编号"]).toBe("SH-002");
    expect(fields["日期A"]).toBe("2026-08-20");
    expect(fields["日期B"]).toBe("2026-08-01");
    expect(result.text).not.toContain("#");
    expect(result.text).not.toContain("*");
  });
});

describe("flattenOcrMarkdown", () => {
  it("lets parseOcrFields extract 编号/日期A/日期B from VL markdown", () => {
    const fields = parseOcrFields(flattenOcrMarkdown(VL_MARKDOWN));
    expect(fields["编号"]).toBe("SH-002");
    expect(fields["日期A"]).toBe("2026-08-20");
    expect(fields["日期B"]).toBe("2026-08-01");
  });
});
