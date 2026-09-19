/**
 * Deterministic hash / n-gram embeddings for tests.
 * Same paraphrases share n-grams → similar vectors so semantic rerank can pass.
 * Not a production embedding service and not `.ai/arch/vectors.db`.
 */

import type { Embeddings } from "./ports.js";

export const HASH_EMBED_DIM = 48;
/** v3 default size; Qdrant clauses must match this, never Hash 48. */
export const DASHSCOPE_EMBED_DIM = 1024;
/** Compatible-mode model id; chat completions must not be used as embed. */
export const DASHSCOPE_EMBED_MODEL = "text-embedding-v3";
/** OpenAI-compatible embeddings root; POST /embeddings on this origin. */
export const DASHSCOPE_DEFAULT_BASE_URL =
  "https://dashscope.aliyuncs.com/compatible-mode/v1";

function tokenize(text: string): string[] {
  const normalized = text.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
  const grams: string[] = [];
  for (let i = 0; i < normalized.length; i++) {
    grams.push(normalized[i]!);
    if (i + 1 < normalized.length) grams.push(normalized.slice(i, i + 2));
    if (i + 2 < normalized.length) grams.push(normalized.slice(i, i + 3));
  }
  return grams;
}

function bucket(token: string, dim: number): number {
  let h = 2166136261;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % dim;
}

/** Hash-vector embeddings: overlapping character n-grams into a fixed dense vector. */
export class HashEmbeddings implements Embeddings {
  constructor(private readonly dim = HASH_EMBED_DIM) {}

  /**
   * CI/default ports need a fixed 48-dim space without calling a live embedder.
   * Stays sync so await is a no-op in tests.
   */
  embed(text: string): number[] {
    const vector = new Array<number>(this.dim).fill(0);
    const tokens = tokenize(text);
    if (tokens.length === 0) return vector;
    for (const token of tokens) {
      vector[bucket(token, this.dim)]! += 1;
    }
    let norm = 0;
    for (const value of vector) norm += value * value;
    const scale = norm > 0 ? 1 / Math.sqrt(norm) : 1;
    return vector.map((value) => value * scale);
  }
}

/** Optional fixture map: exact strings override hash so tests can pin a clause. */
export class FixtureEmbeddings implements Embeddings {
  private readonly hash = new HashEmbeddings();

  constructor(private readonly fixtures: Record<string, number[]> = {}) {}

  /**
   * Tests pin an exact string to a vector so a clause can be forced without
   * swapping the whole embedder or changing HASH_EMBED_DIM.
   */
  embed(text: string): number[] {
    const pinned = this.fixtures[text];
    if (pinned) return [...pinned];
    return this.hash.embed(text);
  }
}

export interface DashScopeEmbeddingsOptions {
  /** Injected so CI never hits dashscope.aliyuncs.com. */
  fetch?: typeof fetch;
  /** Injected so tests can strip DASHSCOPE_API_KEY without mutating process.env. */
  env?: Record<string, string | undefined>;
  /** Override only in tests; production stays on the compatible-mode host. */
  baseUrl?: string;
}

/**
 * Live clause vectors must come from DashScope v3, not Hash 48-dim.
 * Fail at construct when DASHSCOPE_API_KEY is absent so live cannot silently
 * assemble HashEmbeddings.
 */
export class DashScopeEmbeddings implements Embeddings {
  private readonly fetchImpl: typeof fetch;
  private readonly secret: string;
  private readonly baseUrl: string;

  constructor(options?: DashScopeEmbeddingsOptions) {
    const env = options?.env ?? process.env;
    const secret = env.DASHSCOPE_API_KEY?.trim() ?? "";
    if (secret.length === 0) {
      throw new Error("DASHSCOPE_API_KEY is required");
    }
    this.secret = secret;
    this.fetchImpl = options?.fetch ?? fetch;
    this.baseUrl = (options?.baseUrl ?? DASHSCOPE_DEFAULT_BASE_URL).replace(/\/$/, "");
  }

  /**
   * HTTP embedding is async; callers await. Dimension is pinned at 1024 so
   * Qdrant clauses cannot mix Hash 48-dim points.
   */
  async embed(text: string): Promise<number[]> {
    const response = await this.fetchImpl(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.secret}`,
      },
      body: JSON.stringify({
        model: DASHSCOPE_EMBED_MODEL,
        input: text,
        dimensions: DASHSCOPE_EMBED_DIM,
        encoding_format: "float",
      }),
    });
    return parseDashScopeEmbedding(response);
  }
}

async function parseDashScopeEmbedding(response: Response): Promise<number[]> {
  if (!response.ok) {
    throw new Error(`DashScope embeddings HTTP ${response.status}`);
  }
  const body = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>;
  };
  const embedding = body.data?.[0]?.embedding;
  if (!embedding || embedding.length === 0) {
    throw new Error("DashScope embeddings returned empty embedding");
  }
  if (embedding.length !== DASHSCOPE_EMBED_DIM) {
    throw new Error(
      `DashScope embeddings dimension mismatch: expected ${DASHSCOPE_EMBED_DIM}, got ${embedding.length}`,
    );
  }
  return embedding;
}
