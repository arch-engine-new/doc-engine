/**
 * HttpReranker contract (T1–T4 / T6 / T8). Mock fetch only.
 * Fixture apiKey literal is only test-key. Never hit dashscope.aliyuncs.com.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { defaultRetrievePorts, IndependentReranker } from "../src/index.js";
import { HttpReranker } from "../src/retrieve/http-rerank.js";

const TEST_KEY = "test-key";
const DEFAULT_RERANK_URL =
  "https://dashscope.aliyuncs.com/compatible-api/v1/reranks";
const OVERRIDE_RERANK_URL = "https://rerank.test.invalid/v1/reranks";
const HTTP_RERANK_SOURCE = join(
  dirname(fileURLToPath(import.meta.url)),
  "../src/retrieve/http-rerank.ts",
);

const CANDIDATES = [
  { clause_id: "clause-a", text: "填料粒径不得大于 20mm。" },
  { clause_id: "clause-b", text: "混凝土强度等级不低于 C30。" },
] as const;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function identityResults(): { index: number; relevance_score: number }[] {
  return [
    { index: 0, relevance_score: 0.5 },
    { index: 1, relevance_score: 0.4 },
  ];
}

describe("HttpReranker", () => {
  it("T1 POSTs compatible-api /reranks with qwen3-rerank documents", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      expect(url).toBe(DEFAULT_RERANK_URL);
      expect(url).toContain("/reranks");
      expect(url).toContain("compatible-api");
      expect(url).not.toContain("compatible-mode");
      expect(url).not.toContain("chat/completions");
      expect(url.endsWith("/embeddings")).toBe(false);
      expect(init?.method).toBe("POST");
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe(`Bearer ${TEST_KEY}`);
      const body = JSON.parse(String(init?.body)) as {
        model: string;
        query: string;
        documents: string[];
        top_n?: number;
      };
      expect(body.model).toBe("qwen3-rerank");
      expect(body.query).toBe("填料粒径");
      expect(body.documents).toEqual(CANDIDATES.map((c) => c.text));
      expect(body.top_n).toBeUndefined();
      return jsonResponse(200, { results: identityResults() });
    });

    const reranker = new HttpReranker({
      env: { DASHSCOPE_API_KEY: TEST_KEY },
      fetch: fetchMock as typeof fetch,
    });
    const ids = await reranker.rerank("填料粒径", [...CANDIDATES]);
    expect(ids).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("T2 orders clause ids by mock relevance_score", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, {
        results: [
          { index: 1, relevance_score: 0.9 },
          { index: 0, relevance_score: 0.1 },
        ],
      }),
    );
    const reranker = new HttpReranker({
      env: { DASHSCOPE_API_KEY: TEST_KEY },
      fetch: fetchMock as typeof fetch,
    });
    const ids = await reranker.rerank("混凝土", [...CANDIDATES]);
    expect(ids[0]).toBe("clause-b");
    expect(ids).toEqual(["clause-b", "clause-a"]);
  });

  it("T3 throws on missing keys without leaking test-key", () => {
    expect(() => new HttpReranker({ env: {} })).toThrow(
      /RERANK_API_KEY|DASHSCOPE_API_KEY/,
    );
    try {
      new HttpReranker({ env: {} });
      throw new Error("expected HttpReranker to throw");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).toMatch(/RERANK_API_KEY|DASHSCOPE_API_KEY/);
      expect(message).not.toContain(TEST_KEY);
    }
  });

  it("T4 throws Rerank HTTP 500 and does not fall back to IndependentReranker", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(500, { error: "boom" }));
    const reranker = new HttpReranker({
      env: { DASHSCOPE_API_KEY: TEST_KEY },
      fetch: fetchMock as typeof fetch,
    });
    expect(reranker).not.toBeInstanceOf(IndependentReranker);
    await expect(reranker.rerank("填料粒径", [...CANDIDATES])).rejects.toThrow(
      /Rerank HTTP 500/,
    );
    const source = readFileSync(HTTP_RERANK_SOURCE, "utf8");
    expect(source).not.toMatch(/IndependentReranker/);
  });

  it("T4 throws when candidates are non-empty but results are empty", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { results: [] }));
    const reranker = new HttpReranker({
      env: { DASHSCOPE_API_KEY: TEST_KEY },
      fetch: fetchMock as typeof fetch,
    });
    await expect(reranker.rerank("填料粒径", [...CANDIDATES])).rejects.toThrow();
    expect(reranker).not.toBeInstanceOf(IndependentReranker);
  });

  it("T6 POSTs env.RERANK_URL with the same JSON shape", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe(OVERRIDE_RERANK_URL);
      const body = JSON.parse(String(init?.body)) as {
        model: string;
        query: string;
        documents: string[];
      };
      expect(Object.keys(body).sort()).toEqual(["documents", "model", "query"]);
      expect(body.model).toBe("qwen3-rerank");
      expect(body.query).toBe("填料粒径");
      expect(body.documents).toEqual(CANDIDATES.map((c) => c.text));
      return jsonResponse(200, { results: identityResults() });
    });

    const reranker = new HttpReranker({
      env: {
        DASHSCOPE_API_KEY: TEST_KEY,
        RERANK_URL: OVERRIDE_RERANK_URL,
      },
      fetch: fetchMock as typeof fetch,
    });
    await reranker.rerank("填料粒径", [...CANDIDATES]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("T8 returns [] for empty candidates without calling fetch", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("fetch must not run for empty candidates");
    });
    const reranker = new HttpReranker({
      env: { DASHSCOPE_API_KEY: TEST_KEY },
      fetch: fetchMock as typeof fetch,
    });
    await expect(reranker.rerank("填料粒径", [])).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("IndependentReranker / defaultRetrievePorts", () => {
  it("T8 still constructs IndependentReranker and defaultRetrievePorts", async () => {
    const ports = defaultRetrievePorts();
    expect(ports.rerank).toBeInstanceOf(IndependentReranker);
    const ids = await new IndependentReranker().rerank("alpha", [
      { clause_id: "c1", text: "alpha beta" },
    ]);
    expect(ids).toEqual(["c1"]);
  });
});
