/**
 * Independent reranker: cosine + lexical scores.
 * Must never call LlmProvider.complete / chat completion.
 */

import { HashEmbeddings } from "./embeddings.js";
import type { ChatComplete, Embeddings, RerankCandidate, Reranker } from "./ports.js";

function cosine(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function lexicalScore(query: string, text: string): number {
  const q = query.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
  const t = text.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
  if (q.length === 0 || t.length === 0) return 0;
  if (t.includes(q) || q.includes(t)) return 1;
  let overlap = 0;
  const seen = new Set<string>();
  for (let i = 0; i < q.length - 1; i++) {
    const gram = q.slice(i, i + 2);
    if (seen.has(gram)) continue;
    seen.add(gram);
    if (t.includes(gram)) overlap += 1;
  }
  return seen.size === 0 ? 0 : overlap / seen.size;
}

function isChatComplete(value: unknown): value is ChatComplete {
  return (
    typeof value === "object" &&
    value !== null &&
    "complete" in value &&
    typeof (value as ChatComplete).complete === "function" &&
    !("embed" in value)
  );
}

export interface IndependentRerankerOptions {
  /** Spy / production chat provider — must never be invoked by this reranker. */
  llm?: ChatComplete;
  embed?: Embeddings;
}

export class IndependentReranker implements Reranker {
  private readonly embed: Embeddings;

  constructor(options?: IndependentRerankerOptions | ChatComplete) {
    if (isChatComplete(options)) {
      this.embed = new HashEmbeddings();
      return;
    }
    this.embed = options?.embed ?? new HashEmbeddings();
    void options?.llm;
  }

  /**
   * Cosine is undefined until both sides are number[]; embed may be a Promise
   * (HTTP) so this path awaits even when Hash still returns synchronously.
   */
  async rerank(query: string, candidates: RerankCandidate[]): Promise<string[]> {
    const queryVector = await this.embed.embed(query);
    const scored = await Promise.all(
      candidates.map(async (candidate) => {
        const candidateVector =
          candidate.vector ?? (await this.embed.embed(candidate.text));
        const vectorScore = cosine(queryVector, candidateVector);
        const lex = lexicalScore(query, candidate.text);
        return { id: candidate.clause_id, score: 0.7 * vectorScore + 0.3 * lex };
      }),
    );
    scored.sort((a, b) => b.score - a.score);
    return scored.map((item) => item.id);
  }
}
