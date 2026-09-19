import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadLlmRuntimeConfig } from "../src/llm/config.js";
import {
  createLlmProvider,
  FakeLlmProvider,
  UnconfiguredLlmProvider,
} from "../src/llm/provider.js";
import { ZhipuLlmProvider } from "../src/llm/zhipu-provider.js";

const ZHPU_BASE = "https://open.bigmodel.cn/api/coding/paas/v4";
const TEST_KEY = "test-key";
const API_KEY_ENV_NAME = "AGENT_RUNTIME_TEST_ARCH_CHAT_KEY";

function writeArchChat(root: string, chat: Record<string, unknown>): void {
  mkdirSync(join(root, ".ai", "arch"), { recursive: true });
  writeFileSync(
    join(root, ".ai", "arch", "arch.config.json"),
    JSON.stringify({ chat }),
    "utf8",
  );
}

function writeLlmJson(root: string, cfg: Record<string, unknown>): void {
  mkdirSync(join(root, ".apt"), { recursive: true });
  writeFileSync(join(root, ".apt", "agent-runtime.llm.json"), JSON.stringify(cfg), "utf8");
}

describe("arch.config.json chat fallback", () => {
  const previousConfigEnv = process.env.AGENT_RUNTIME_LLM_CONFIG;
  const previousApiKeyEnv = process.env[API_KEY_ENV_NAME];
  let tempRoot: string | undefined;

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (previousConfigEnv === undefined) {
      delete process.env.AGENT_RUNTIME_LLM_CONFIG;
    } else {
      process.env.AGENT_RUNTIME_LLM_CONFIG = previousConfigEnv;
    }
    if (previousApiKeyEnv === undefined) {
      delete process.env[API_KEY_ENV_NAME];
    } else {
      process.env[API_KEY_ENV_NAME] = previousApiKeyEnv;
    }
    if (tempRoot) {
      rmSync(tempRoot, { recursive: true, force: true });
      tempRoot = undefined;
    }
  });

  it("createLlmProvider(null) uses arch chat when llm.json is missing", async () => {
    delete process.env.AGENT_RUNTIME_LLM_CONFIG;
    tempRoot = mkdtempSync(join(tmpdir(), "agent-runtime-arch-chat-"));
    writeArchChat(tempRoot, {
      baseUrl: ZHPU_BASE,
      model: "glm-5.3-flash",
      apiKey: TEST_KEY,
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "来自 glm-5.3-flash 的回复" } }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = createLlmProvider(null, tempRoot);
    expect(provider).toBeInstanceOf(ZhipuLlmProvider);
    expect(provider).not.toBeInstanceOf(FakeLlmProvider);
    expect(provider).not.toBeInstanceOf(UnconfiguredLlmProvider);

    const text = await provider.complete({ prompt: "ping" });
    expect(text).toBe("来自 glm-5.3-flash 的回复");
    expect(text).not.toContain("[fake-llm");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${ZHPU_BASE}/chat/completions`);
    expect(init?.headers).toMatchObject({
      Authorization: `Bearer ${TEST_KEY}`,
    });
    const body = JSON.parse(init?.body as string);
    expect(body.model).toBe("glm-5.3-flash");
  });

  it("resolves chat.apiKeyEnv from process.env", async () => {
    delete process.env.AGENT_RUNTIME_LLM_CONFIG;
    process.env[API_KEY_ENV_NAME] = TEST_KEY;
    tempRoot = mkdtempSync(join(tmpdir(), "agent-runtime-arch-env-"));
    writeArchChat(tempRoot, {
      baseUrl: ZHPU_BASE,
      model: "glm-5.3-flash",
      apiKeyEnv: API_KEY_ENV_NAME,
    });

    const cfg = loadLlmRuntimeConfig(tempRoot);
    expect(cfg).not.toBeNull();
    expect(cfg!.apiKey).toBe(TEST_KEY);
    expect(cfg!.model).toBe("glm-5.3-flash");

    const provider = createLlmProvider(null, tempRoot);
    expect(provider).toBeInstanceOf(ZhipuLlmProvider);
    expect(provider).not.toBeInstanceOf(FakeLlmProvider);
    expect(provider).not.toBeInstanceOf(UnconfiguredLlmProvider);
  });

  it("stays Unconfigured when both llm.json and arch chat are absent", async () => {
    delete process.env.AGENT_RUNTIME_LLM_CONFIG;
    tempRoot = mkdtempSync(join(tmpdir(), "agent-runtime-arch-none-"));
    const provider = createLlmProvider(null, tempRoot);
    const text = await provider.complete({ prompt: "任意提问" });

    expect(provider).toBeInstanceOf(UnconfiguredLlmProvider);
    expect(provider).not.toBeInstanceOf(FakeLlmProvider);
    expect(text).toMatch(/未配置/);
    expect(text).not.toContain("[fake-llm");
  });

  it("prefers valid llm.json over arch chat", () => {
    delete process.env.AGENT_RUNTIME_LLM_CONFIG;
    tempRoot = mkdtempSync(join(tmpdir(), "agent-runtime-arch-priority-"));
    writeArchChat(tempRoot, {
      baseUrl: ZHPU_BASE,
      model: "glm-5.3-flash",
      apiKey: TEST_KEY,
    });
    writeLlmJson(tempRoot, {
      provider: "zhipu",
      baseUrl: ZHPU_BASE,
      model: "from-llm-json",
      apiKey: "llm-json-key",
    });

    const cfg = loadLlmRuntimeConfig(tempRoot);
    expect(cfg).not.toBeNull();
    expect(cfg!.model).toBe("from-llm-json");
    expect(cfg!.apiKey).toBe("llm-json-key");

    const provider = createLlmProvider(null, tempRoot);
    expect(provider).toBeInstanceOf(ZhipuLlmProvider);
    expect(provider).not.toBeInstanceOf(UnconfiguredLlmProvider);
  });
});
