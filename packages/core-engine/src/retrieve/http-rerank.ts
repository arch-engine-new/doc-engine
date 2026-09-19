/**
 * Live independent rerank over HTTP. Scores must come from the remote
 * ranker, not from local vector similarity or the v3 embedding path.
 */

import type { RerankCandidate, Reranker } from "./ports.js";

/** compatible-api /reranks — not compatible-mode /embeddings. */
const DEFAULT_RERANK_URL =
  "https://dashscope.aliyuncs.com/compatible-api/v1/reranks";
const DEFAULT_RERANK_MODEL = "qwen3-rerank";

export interface HttpRerankerOptions {
  /** Injected so CI never hits dashscope.aliyuncs.com. */
  fetch?: typeof fetch;
  /** Injected so tests can strip keys without mutating process.env. */
  env?: Record<string, string | undefined>;
  /** Full URL override (RERANK_URL); must not reuse the embed compatible-mode base. */
  url?: string;
  /** Model id override; default is the dedicated ranker, not text-embedding-v3. */
  model?: string;
  /** Prefer this over env; still never logged or put in Error messages. */
  apiKey?: string;
}

interface RerankResultItem {
  index?: number;
  relevance_score?: number;
  score?: number;
}

interface RerankResponseBody {
  results?: RerankResultItem[];
  output?: { results?: RerankResultItem[] };
}

/**
 * Live retrieve must call a dedicated rerank HTTP path.
 * Reusing embed cosine would keep ranking inside the v3 vector space.
 */
export class HttpReranker implements Reranker {
  private readonly fetchImpl: typeof fetch;
  private readonly secret: string;
  private readonly url: string;
  private readonly model: string;

  constructor(options?: HttpRerankerOptions) {
    const env = options?.env ?? process.env;
    const secret =
      (options?.apiKey ?? env.RERANK_API_KEY ?? env.DASHSCOPE_API_KEY)?.trim() ??
      "";
    if (secret.length === 0) {
      throw new Error("RERANK_API_KEY or DASHSCOPE_API_KEY is required");
    }
    this.secret = secret;
    this.fetchImpl = options?.fetch ?? fetch;
    this.url = options?.url ?? env.RERANK_URL ?? DEFAULT_RERANK_URL;
    this.model = options?.model ?? env.RERANK_MODEL ?? DEFAULT_RERANK_MODEL;
  }

  /**
   * Empty candidates skip the network so a zero-hit search does not POST
   * an empty documents list or pay for a ranker call.
   */
  async rerank(query: string, candidates: RerankCandidate[]): Promise<string[]> {
    if (candidates.length === 0) return [];
    const response = await this.fetchImpl(this.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.secret}`,
      },
      body: JSON.stringify({
        model: this.model,
        query,
        documents: candidates.map((candidate) => candidate.text),
      }),
    });
    return orderClauseIds(response, candidates);
  }
}

async function orderClauseIds(
  response: Response,
  candidates: RerankCandidate[],
): Promise<string[]> {
  if (!response.ok) {
    throw new Error(`Rerank HTTP ${response.status}`);
  }
  const body = (await response.json()) as RerankResponseBody;
  const results = body.results ?? body.output?.results;
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error("Rerank HTTP returned empty results");
  }
  return rankByRemoteScores(results, candidates);
}

function rankByRemoteScores(
  results: RerankResultItem[],
  candidates: RerankCandidate[],
): string[] {
  const scored: Array<{ index: number; score: number }> = [];
  const seen = new Set<number>();
  for (const item of results) {
    const index = item.index;
    if (typeof index !== "number" || index < 0 || index >= candidates.length) {
      continue;
    }
    if (seen.has(index)) continue;
    const score = item.relevance_score ?? item.score;
    if (typeof score !== "number") continue;
    seen.add(index);
    scored.push({ index, score });
  }
  if (scored.length === 0) {
    throw new Error("Rerank HTTP returned no in-range results");
  }
  scored.sort((left, right) => right.score - left.score);
  const ordered = scored.map((row) => candidates[row.index]!.clause_id);
  for (let i = 0; i < candidates.length; i++) {
    if (!seen.has(i)) ordered.push(candidates[i]!.clause_id);
  }
  return ordered;
}
