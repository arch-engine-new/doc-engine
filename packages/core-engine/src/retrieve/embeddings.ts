/**
 * Deterministic hash / n-gram embeddings for tests.
 * Same paraphrases share n-grams → similar vectors so semantic rerank can pass.
 * Not a production embedding service and not `.ai/arch/vectors.db`.
 */

import type { Embeddings } from "./ports.js";

export const HASH_EMBED_DIM = 48;

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
