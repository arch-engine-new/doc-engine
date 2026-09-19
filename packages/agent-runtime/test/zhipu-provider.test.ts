import { describe, it, expect, vi, afterEach } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ZhipuLlmProvider } from "../src/llm/zhipu-provider.js";
import { loadLlmRuntimeConfig } from "../src/llm/config.js";
import { createLlmProvider, FakeLlmProvider } from "../src/llm/provider.js";

describe("ZhipuLlmProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls chat/completions and returns message content", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "你好" } }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new ZhipuLlmProvider({
      baseUrl: "https://open.bigmodel.cn/api/coding/paas/v4",
      apiKey: "test-key",
      model: "glm-5.3",
      timeoutMs: 5000,
    });

    const text = await provider.complete({ prompt: "ping" });
    expect(text).toBe("你好");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://open.bigmodel.cn/api/coding/paas/v4/chat/completions");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer test-key",
    });
    const body = JSON.parse(init?.body as string);
    expect(body.model).toBe("glm-5.3");
    expect(body.messages[0].content).toBe("ping");
  });

  it("throws on API error response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: "invalid key" } }),
      }),
    );

    const provider = new ZhipuLlmProvider({
      baseUrl: "https://open.bigmodel.cn/api/coding/paas/v4",
      apiKey: "bad",
      model: "glm-5.3",
    });

    await expect(provider.complete({ prompt: "x" })).rejects.toThrow(/invalid key/);
  });
});

describe("loadLlmRuntimeConfig", () => {
  it("loads .apt/agent-runtime.llm.json from repo root when present", () => {
    const repoRoot = findRepoRoot();
    if (!repoRoot) return;
    const cfg = loadLlmRuntimeConfig(repoRoot);
    expect(cfg).not.toBeNull();
    expect(cfg!.baseUrl).toContain("open.bigmodel.cn");
    expect(cfg!.model).toBe("glm-5.3");
    expect(cfg!.apiKey).not.toBe("YOUR_ZHIPU_API_KEY");
  });

  it("createLlmProvider returns Fake when provider is fake", () => {
    const provider = createLlmProvider({
      provider: "fake",
      baseUrl: "http://localhost",
      model: "x",
      apiKey: "y",
    });
    expect(provider).toBeInstanceOf(FakeLlmProvider);
  });
});

function findRepoRoot(): string | undefined {
  const candidates = [
    process.env.APT_PROJECT_ROOT,
    join(process.cwd(), "..", ".."),
    process.cwd(),
  ].filter(Boolean) as string[];
  for (const root of candidates) {
    if (existsSync(join(root, ".apt", "agent-runtime.llm.json"))) {
      return root;
    }
  }
  return undefined;
}
