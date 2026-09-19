/**
 * LLM provider abstraction for llm nodes.
 * Production integrations plug in real providers; tests use FakeLlmProvider.
 * Missing llm.json must not echo prompts — that leaked HITL system text into chat.
 */

import type { LlmRuntimeConfig } from "./config.js";
import { loadLlmRuntimeConfig } from "./config.js";
import { ZhipuLlmProvider } from "./zhipu-provider.js";

export interface LlmCompleteOptions {
  prompt: string;
  model?: string;
  temperature?: number;
}

export interface LlmProvider {
  complete(options: LlmCompleteOptions): Promise<string>;
}

/**
 * Shown when llm.json and arch.config.json chat are both absent or invalid.
 * Intentionally ignores the prompt so HITL system text cannot leak into the UI.
 */
export const UNCONFIGURED_LLM_MESSAGE =
  "尚未配置大语言模型。请在项目 .apt/agent-runtime.llm.json 中填写有效的模型与 API Key 后再使用助手。";

/**
 * User-facing fallback for an unconfigured model.
 * Separate from FakeLlmProvider so tests can still echo via explicit fake injection.
 */
export class UnconfiguredLlmProvider implements LlmProvider {
  async complete(_options: LlmCompleteOptions): Promise<string> {
    return UNCONFIGURED_LLM_MESSAGE;
  }
}

/** Deterministic fake provider — no network, no billing (spec: 非目标真实 LLM 联调). */
export class FakeLlmProvider implements LlmProvider {
  async complete(options: LlmCompleteOptions): Promise<string> {
    const model = options.model ?? "fake";
    return `[fake-llm:${model}] ${options.prompt}`;
  }
}

let defaultProvider: LlmProvider = new FakeLlmProvider();

export function getDefaultLlmProvider(): LlmProvider {
  return defaultProvider;
}

export function setDefaultLlmProvider(provider: LlmProvider): void {
  defaultProvider = provider;
}

/**
 * Create LLM provider from runtime config file, arch chat fallback, or explicit config.
 * Missing/invalid config is UnconfiguredLlmProvider (no prompt echo);
 * explicit provider:"fake" stays FakeLlmProvider for force-fake tests.
 */
export function createLlmProvider(config?: LlmRuntimeConfig | null, projectRoot?: string): LlmProvider {
  const cfg = config ?? loadLlmRuntimeConfig(projectRoot);
  if (!cfg) {
    return new UnconfiguredLlmProvider();
  }
  if (cfg.provider === "fake") {
    return new FakeLlmProvider();
  }
  return ZhipuLlmProvider.fromRuntimeConfig(cfg);
}

/**
 * Load llm.json or arch.config.json chat and set as default provider when valid.
 * Without a usable config this installs UnconfiguredLlmProvider instead of echoing prompts.
 */
export function initDefaultLlmProvider(projectRoot?: string): LlmProvider {
  const provider = createLlmProvider(null, projectRoot);
  setDefaultLlmProvider(provider);
  return provider;
}
