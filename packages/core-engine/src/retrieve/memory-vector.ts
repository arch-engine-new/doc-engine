import type { VectorHit, VectorPoint, VectorStore } from "./ports.js";
import {
  assertVectorPayload,
  requirePayloadUnitId,
  storedVectorPayload,
} from "./payload.js";

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

/** In-memory VectorStore for tests. Same interface as QdrantVectorStore. */
export class MemoryVectorStore implements VectorStore {
  private readonly points = new Map<string, VectorPoint>();

  /** Identity is payload.unit_id; a caller-supplied point.id must not win. */
  async upsert(point: VectorPoint): Promise<void> {
    assertVectorPayload(point.payload);
    const payload = storedVectorPayload(point.payload);
    const unitId = requirePayloadUnitId(payload);
    this.points.set(unitId, {
      id: unitId,
      vector: [...point.vector],
      payload,
    });
  }

  async search(
    vector: number[],
    opts?: { versionId?: string; topK?: number },
  ): Promise<VectorHit[]> {
    const topK = opts?.topK ?? 8;
    const versionId = opts?.versionId;
    const scored: VectorHit[] = [];
    for (const point of this.points.values()) {
      if (versionId && point.payload?.versionId !== versionId) continue;
      scored.push({
        id: point.id,
        score: cosine(vector, point.vector),
        payload: point.payload,
        vector: point.vector,
      });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }
}
