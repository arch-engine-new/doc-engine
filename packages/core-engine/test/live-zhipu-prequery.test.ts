/**
 * Live retrieve prequery must be ZhipuPrequery (glm), never silent FakePrequery.
 * Fixture apiKey is the literal test-key only; no real LLM HTTP.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FakePrequery,
  HashEmbeddings,
  IndependentReranker,
  liveRetrievePorts,
  ZhipuPrequery,
} from "../src/index.js";

const TEST_KEY = "test-key";

const envSnapshot = {
  DASHSCOPE_API_KEY: process.env.DASHSCOPE_API_KEY,
  QDRANT_URL: process.env.QDRANT_URL,
  NEO4J_URI: process.env.NEO4J_URI,
  AGENT_RUNTIME_LLM_CONFIG: process.env.AGENT_RUNTIME_LLM_CONFIG,
  APT_PROJECT_ROOT: process.env.APT_PROJECT_ROOT,
};

const tempDirs: string[] = [];

afterEach(() => {
  restoreEnv("DASHSCOPE_API_KEY", envSnapshot.DASHSCOPE_API_KEY);
  restoreEnv("QDRANT_URL", envSnapshot.QDRANT_URL);
  restoreEnv("NEO4J_URI", envSnapshot.NEO4J_URI);
  restoreEnv("AGENT_RUNTIME_LLM_CONFIG", envSnapshot.AGENT_RUNTIME_LLM_CONFIG);
  restoreEnv("APT_PROJECT_ROOT", envSnapshot.APT_PROJECT_ROOT);
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
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

function applyLiveStoreEnv(): void {
  process.env.DASHSCOPE_API_KEY = TEST_KEY;
  process.env.QDRANT_URL = process.env.QDRANT_URL ?? "http://127.0.0.1:6333";
  process.env.NEO4J_URI = process.env.NEO4J_URI ?? "bolt://127.0.0.1:7687";
}

function writeTempZhipuLlmJson(): string {
  const dir = mkdtempSync(join(tmpdir(), "live-zhipu-prequery-"));
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

describe("liveRetrievePorts ZhipuPrequery", () => {
  it("assembles ZhipuPrequery when LLM config is present, not FakePrequery", () => {
    applyLiveStoreEnv();
    process.env.AGENT_RUNTIME_LLM_CONFIG = writeTempZhipuLlmJson();

    const ports = liveRetrievePorts();
    expect(ports.prequery).toBeInstanceOf(ZhipuPrequery);
    expect(ports.prequery).not.toBeInstanceOf(FakePrequery);
  });

  it("throws when LLM is unconfigured and does not return FakePrequery", () => {
    applyLiveStoreEnv();
    const isolatedRoot = mkdtempSync(join(tmpdir(), "live-zhipu-unconfigured-"));
    tempDirs.push(isolatedRoot);
    process.env.APT_PROJECT_ROOT = isolatedRoot;
    process.env.AGENT_RUNTIME_LLM_CONFIG = join(
      isolatedRoot,
      "missing-agent-runtime.llm.json",
    );

    let returned: unknown;
    try {
      returned = liveRetrievePorts();
      throw new Error("expected liveRetrievePorts to throw");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toMatch(/Unconfigured|LLM|llm\.json/i);
      expect(message).not.toContain(TEST_KEY);
      expect(returned).toBeUndefined();
      expect(returned instanceof FakePrequery).toBe(false);
    }
  });

  it("still allows FakePrequery in unit tests", () => {
    const fake = new FakePrequery();
    const result = fake.rewrite("表 8.5.1-1");
    expect(result.intent).toBe("semantic");
    expect(result.rewritten).toBe("表 8.5.1-1");
  });

  it("keeps IndependentReranker on embed only and never chat-completes", async () => {
    applyLiveStoreEnv();
    process.env.AGENT_RUNTIME_LLM_CONFIG = writeTempZhipuLlmJson();

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      expect(url).not.toMatch(/chat\/completions/);
      return jsonResponse(200, { data: [{ embedding: vectorOf(1024) }] });
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;
    try {
      const ports = liveRetrievePorts();
      expect(ports.rerank).toBeInstanceOf(IndependentReranker);
      expect(ports.embed).not.toBeInstanceOf(HashEmbeddings);

      const originalEmbed = ports.embed.embed.bind(ports.embed);
      const spy = vi.fn(originalEmbed);
      ports.embed.embed = spy;

      await ports.rerank.rerank("query", [
        { clause_id: "c1", text: "candidate without stored vector" },
      ]);
      expect(spy.mock.calls.length).toBeGreaterThan(0);
      for (const call of fetchMock.mock.calls) {
        expect(String(call[0])).not.toMatch(/chat\/completions/);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
