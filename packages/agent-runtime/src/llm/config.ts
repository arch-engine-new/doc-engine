/**
 * Runtime LLM configuration loader.
 * Prefer `.apt/agent-runtime.llm.json` (or AGENT_RUNTIME_LLM_CONFIG).
 * If that file is missing/invalid, fall back to `.ai/arch/arch.config.json` `chat`.
 * Does not use `.ai/arch/arch.secrets.json`.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface LlmRuntimeConfig {
  /** Provider id. File with "fake" loads as null (unconfigured UI). Explicit createLlmProvider({provider:"fake"}) still builds FakeLlmProvider for tests. */
  provider?: "zhipu" | "fake";
  baseUrl: string;
  model: string;
  apiKey: string;
  timeoutMs?: number;
}

interface ArchChatBlock {
  baseUrl?: unknown;
  model?: unknown;
  apiKey?: unknown;
  apiKeyEnv?: unknown;
  timeoutMs?: unknown;
}

const DEFAULT_CONFIG_REL = ".apt/agent-runtime.llm.json";
const ARCH_CONFIG_REL = ".ai/arch/arch.config.json";
const PLACEHOLDER_API_KEY = "YOUR_ZHIPU_API_KEY";

function resolveProjectRoot(explicit?: string): string {
  if (explicit) return explicit;
  if (process.env.APT_PROJECT_ROOT) return process.env.APT_PROJECT_ROOT;

  let dir = process.cwd();
  for (let i = 0; i < 12; i++) {
    if (existsSync(join(dir, DEFAULT_CONFIG_REL)) || existsSync(join(dir, ARCH_CONFIG_REL))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return process.cwd();
}

function isUsableApiKey(value: string | undefined): value is string {
  return Boolean(value && value.trim() !== "" && value.trim() !== PLACEHOLDER_API_KEY);
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function asTimeoutMs(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function resolveApiKey(apiKey: unknown, apiKeyEnv: unknown): string | undefined {
  const direct = asNonEmptyString(apiKey);
  if (isUsableApiKey(direct)) return direct;
  const envName = asNonEmptyString(apiKeyEnv);
  if (!envName) return undefined;
  const fromEnv = process.env[envName];
  return isUsableApiKey(fromEnv) ? fromEnv.trim() : undefined;
}

function parseLlmJsonFile(configPath: string): LlmRuntimeConfig | null {
  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const raw = JSON.parse(readFileSync(configPath, "utf8")) as LlmRuntimeConfig;
    if (!raw.baseUrl || !raw.model || !isUsableApiKey(raw.apiKey)) {
      return null;
    }
    if (raw.provider === "fake") {
      return null;
    }
    return raw;
  } catch {
    return null;
  }
}

function parseArchChatConfig(archPath: string): LlmRuntimeConfig | null {
  if (!existsSync(archPath)) {
    return null;
  }

  try {
    const raw = JSON.parse(readFileSync(archPath, "utf8")) as { chat?: ArchChatBlock };
    const chat = raw?.chat;
    if (!chat || typeof chat !== "object") {
      return null;
    }
    const baseUrl = asNonEmptyString(chat.baseUrl);
    const model = asNonEmptyString(chat.model);
    const apiKey = resolveApiKey(chat.apiKey, chat.apiKeyEnv);
    if (!baseUrl || !model || !apiKey) {
      return null;
    }
    const timeoutMs = asTimeoutMs(chat.timeoutMs);
    return {
      provider: "zhipu",
      baseUrl,
      model,
      apiKey,
      ...(timeoutMs !== undefined ? { timeoutMs } : {}),
    };
  } catch {
    return null;
  }
}

/**
 * Load LLM runtime config: valid llm.json first, then arch.config.json chat.
 * @returns Config or null if both sources are missing / invalid / placeholder key
 */
export function loadLlmRuntimeConfig(projectRoot?: string): LlmRuntimeConfig | null {
  const root = resolveProjectRoot(projectRoot);
  const llmJsonPath =
    process.env.AGENT_RUNTIME_LLM_CONFIG ?? join(root, DEFAULT_CONFIG_REL);
  const fromLlmJson = parseLlmJsonFile(llmJsonPath);
  if (fromLlmJson) return fromLlmJson;
  return parseArchChatConfig(join(root, ARCH_CONFIG_REL));
}
