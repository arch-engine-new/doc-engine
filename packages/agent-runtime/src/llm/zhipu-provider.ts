/**
 * Zhipu (智谱) GLM — OpenAI-compatible Chat Completions API.
 * Base URL: https://open.bigmodel.cn/api/coding/paas/v4 (Coding Plan)
 */

import type { LlmCompleteOptions, LlmProvider } from "./provider.js";
import type { LlmRuntimeConfig } from "./config.js";

export interface ZhipuLlmProviderOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs?: number;
}

export class ZhipuLlmProvider implements LlmProvider {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly defaultModel: string;
  private readonly timeoutMs: number;

  constructor(options: ZhipuLlmProviderOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.defaultModel = options.model;
    this.timeoutMs = options.timeoutMs ?? 60000;
  }

  static fromRuntimeConfig(config: LlmRuntimeConfig): ZhipuLlmProvider {
    return new ZhipuLlmProvider({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.model,
      timeoutMs: config.timeoutMs,
    });
  }

  async complete(options: LlmCompleteOptions): Promise<string> {
    const url = `${this.baseUrl}/chat/completions`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: options.model ?? this.defaultModel,
          messages: [{ role: "user", content: options.prompt }],
          temperature: options.temperature,
        }),
        signal: controller.signal,
      });

      const body = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        error?: { message?: string; code?: string };
      };

      if (!response.ok) {
        const msg = body.error?.message ?? `Zhipu API HTTP ${response.status}`;
        throw new Error(`Zhipu LLM request failed: ${msg}`);
      }

      const text = body.choices?.[0]?.message?.content;
      if (text === undefined || text === "") {
        throw new Error("Zhipu LLM returned empty completion");
      }

      return text;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Zhipu LLM request timed out after ${this.timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
