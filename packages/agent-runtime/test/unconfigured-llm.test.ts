import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createLlmProvider,
  FakeLlmProvider,
  getDefaultLlmProvider,
  initDefaultLlmProvider,
  setDefaultLlmProvider,
  UnconfiguredLlmProvider,
} from "../src/llm/provider.js";

const HITL_PROMPT = "禁止：确认提案。请根据系统提示完成审核。";

describe("unconfigured LLM user path", () => {
  const previousConfigEnv = process.env.AGENT_RUNTIME_LLM_CONFIG;
  const previousDefault = getDefaultLlmProvider();
  let tempRoot: string | undefined;

  afterEach(() => {
    setDefaultLlmProvider(previousDefault);
    if (previousConfigEnv === undefined) {
      delete process.env.AGENT_RUNTIME_LLM_CONFIG;
    } else {
      process.env.AGENT_RUNTIME_LLM_CONFIG = previousConfigEnv;
    }
    if (tempRoot) {
      rmSync(tempRoot, { recursive: true, force: true });
      tempRoot = undefined;
    }
  });

  it("createLlmProvider(null) without llm.json returns Chinese unconfigured copy", async () => {
    delete process.env.AGENT_RUNTIME_LLM_CONFIG;
    tempRoot = mkdtempSync(join(tmpdir(), "agent-runtime-unconfigured-"));
    const provider = createLlmProvider(null, tempRoot);
    const text = await provider.complete({ prompt: HITL_PROMPT });

    expect(provider).toBeInstanceOf(UnconfiguredLlmProvider);
    expect(provider).not.toBeInstanceOf(FakeLlmProvider);
    expect(text).toMatch(/未配置/);
    expect(text).not.toContain("[fake-llm");
    expect(text).not.toContain("禁止：确认提案");
  });

  it("initDefaultLlmProvider does not echo HITL system prompt when config file is missing", async () => {
    delete process.env.AGENT_RUNTIME_LLM_CONFIG;
    tempRoot = mkdtempSync(join(tmpdir(), "agent-runtime-unconfigured-init-"));
    const provider = initDefaultLlmProvider(tempRoot);
    const text = await provider.complete({ prompt: HITL_PROMPT });

    expect(text).toMatch(/未配置/);
    expect(text).not.toContain("[fake-llm");
    expect(text).not.toContain("禁止：确认提案");
  });

  it("explicit FakeLlmProvider keeps deterministic echo for tests", async () => {
    const provider = new FakeLlmProvider();
    const text = await provider.complete({ prompt: HITL_PROMPT, model: "unit" });

    expect(text).toContain("[fake-llm:unit]");
    expect(text).toContain(HITL_PROMPT);
  });
});
