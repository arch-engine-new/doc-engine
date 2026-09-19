/**
 * DashScope text-embedding-v3: mock fetch only. Never hit dashscope.aliyuncs.com.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DashScopeEmbeddings,
  HashEmbeddings,
  liveRetrievePorts,
} from "../src/index.js";

const TEST_KEY = "test-key";
const DEFAULT_EMBED_URL =
  "https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings";

const envSnapshot = {
  DASHSCOPE_API_KEY: process.env.DASHSCOPE_API_KEY,
  QDRANT_URL: process.env.QDRANT_URL,
  NEO4J_URI: process.env.NEO4J_URI,
  AGENT_RUNTIME_LLM_CONFIG: process.env.AGENT_RUNTIME_LLM_CONFIG,
};

const tempDirs: string[] = [];

afterEach(() => {
  restoreEnv("DASHSCOPE_API_KEY", envSnapshot.DASHSCOPE_API_KEY);
  restoreEnv("QDRANT_URL", envSnapshot.QDRANT_URL);
  restoreEnv("NEO4J_URI", envSnapshot.NEO4J_URI);
  restoreEnv("AGENT_RUNTIME_LLM_CONFIG", envSnapshot.AGENT_RUNTIME_LLM_CONFIG);
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function writeTempZhipuLlmJson(): string {
  const dir = mkdtempSync(join(tmpdir(), "dashscope-live-llm-"));
  tempDirs.push(dir);
  const configPath = join(dir, "agent-runtime.llm.json");
  writeFileSync(
    configPath,
    JSON.stringify({
      provider: "zhipu",
      baseUrl: "https://llm.test.invalid/v4",
      model: "glm-4",
      apiKey: TEST_KEY,
    }),
    "utf8",
  );
  return configPath;
}

function vectorOf(length: number): number[] {
  return Array.from({ length }, (_, i) => (i === 0 ? 1 : 0));
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("DashScopeEmbeddings", () => {
  it("POSTs compatible-mode embeddings with v3 body and returns length 1024", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe(DEFAULT_EMBED_URL);
      expect(init?.method).toBe("POST");
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe(`Bearer ${TEST_KEY}`);
      const body = JSON.parse(String(init?.body)) as {
        model: string;
        input: string;
        dimensions: number;
        encoding_format: string;
      };
      expect(body.model).toBe("text-embedding-v3");
      expect(body.input).toBe("填料粒径");
      expect(body.dimensions).toBe(1024);
      expect(body.encoding_format).toBe("float");
      return jsonResponse(200, { data: [{ embedding: vectorOf(1024) }] });
    });

    const embedder = new DashScopeEmbeddings({
      fetch: fetchMock as typeof fetch,
      env: { DASHSCOPE_API_KEY: TEST_KEY },
    });
    const vector = await embedder.embed("填料粒径");
    expect(vector).toHaveLength(1024);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws when HTTP is not 2xx", async () => {
    const embedder = new DashScopeEmbeddings({
      fetch: async () => jsonResponse(401, { error: { message: "denied" } }),
      env: { DASHSCOPE_API_KEY: TEST_KEY },
    });
    await expect(embedder.embed("x")).rejects.toThrow(/HTTP/);
  });

  it("throws when embedding is empty", async () => {
    const embedder = new DashScopeEmbeddings({
      fetch: async () => jsonResponse(200, { data: [{ embedding: [] }] }),
      env: { DASHSCOPE_API_KEY: TEST_KEY },
    });
    await expect(embedder.embed("x")).rejects.toThrow(/empty/i);
  });

  it("throws when embedding length is not 1024", async () => {
    const embedder = new DashScopeEmbeddings({
      fetch: async () => jsonResponse(200, { data: [{ embedding: vectorOf(48) }] }),
      env: { DASHSCOPE_API_KEY: TEST_KEY },
    });
    await expect(embedder.embed("x")).rejects.toThrow(/1024/);
  });

  it("throws at construct when DASHSCOPE_API_KEY is missing", () => {
    expect(() => new DashScopeEmbeddings({ env: {} })).toThrow(/DASHSCOPE_API_KEY/);
    expect(() => new DashScopeEmbeddings({ env: { DASHSCOPE_API_KEY: "  " } })).toThrow(
      /DASHSCOPE_API_KEY/,
    );
  });

  it("error messages omit the secret value", async () => {
    try {
      new DashScopeEmbeddings({ env: { DASHSCOPE_API_KEY: "" } });
      throw new Error("expected construct to throw");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toMatch(/DASHSCOPE_API_KEY/);
      expect(message).not.toContain(TEST_KEY);
      expect(message).not.toMatch(/Bearer /);
    }

    const embedder = new DashScopeEmbeddings({
      fetch: async () => jsonResponse(500, { error: { message: "upstream" } }),
      env: { DASHSCOPE_API_KEY: TEST_KEY },
    });
    await embedder.embed("x").then(
      () => {
        throw new Error("expected embed to throw");
      },
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        expect(message).not.toContain(TEST_KEY);
        expect(message).not.toMatch(/Bearer /);
      },
    );
  });
});

describe("liveRetrievePorts", () => {
  it("throws on missing DASHSCOPE_API_KEY and does not return HashEmbeddings", () => {
    delete process.env.DASHSCOPE_API_KEY;
    delete process.env.QDRANT_URL;
    delete process.env.NEO4J_URI;
    let returned: unknown;
    try {
      returned = liveRetrievePorts();
      throw new Error("expected liveRetrievePorts to throw");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toMatch(/DASHSCOPE_API_KEY/);
      expect(returned).toBeUndefined();
      expect(returned instanceof HashEmbeddings).toBe(false);
    }
  });

  it("shares one DashScopeEmbeddings instance with IndependentReranker", async () => {
    process.env.DASHSCOPE_API_KEY = TEST_KEY;
    process.env.QDRANT_URL = process.env.QDRANT_URL ?? "http://127.0.0.1:6333";
    process.env.NEO4J_URI = process.env.NEO4J_URI ?? "bolt://127.0.0.1:7687";
    process.env.AGENT_RUNTIME_LLM_CONFIG = writeTempZhipuLlmJson();

    const fetchMock = vi.fn(async () =>
      jsonResponse(200, { data: [{ embedding: vectorOf(1024) }] }),
    );
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;
    try {
      const ports = liveRetrievePorts();
      expect(ports.embed).toBeInstanceOf(DashScopeEmbeddings);
      expect(ports.embed).not.toBeInstanceOf(HashEmbeddings);

      const originalEmbed = ports.embed.embed.bind(ports.embed);
      const spy = vi.fn(originalEmbed);
      ports.embed.embed = spy;

      await ports.rerank.rerank("query", [
        { clause_id: "c1", text: "candidate without stored vector" },
      ]);
      expect(spy.mock.calls.length).toBeGreaterThan(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
