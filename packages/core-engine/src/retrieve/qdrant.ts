/**
 * Production VectorStore adapter. Collection `clauses`.
 * Qdrant only accepts UUID or unsigned integer point ids, so unit_id strings
 * are hashed to a stable UUID; the original unit_id is kept in payload.
 * Throws if QDRANT_URL (or constructor url) is missing. Tests use MemoryVectorStore.
 */

import { createHash } from "node:crypto";
import { QdrantClient } from "@qdrant/js-client-rest";
import type { VectorHit, VectorPoint, VectorStore } from "./ports.js";
import {
  assertVectorPayload,
  requirePayloadUnitId,
  storedVectorPayload,
} from "./payload.js";

const COLLECTION = "clauses";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toQdrantPointId(id: string): string {
  if (UUID_RE.test(id)) return id.toLowerCase();
  const hex = createHash("sha1").update(id).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** Hit identity is payload.unit_id only — never clause_id or the hashed UUID. */
function originalPointId(payload: Record<string, unknown> | undefined): string {
  return requirePayloadUnitId(payload);
}

export class QdrantVectorStore implements VectorStore {
  private readonly client: QdrantClient;
  private ensuredDim: number | null = null;

  constructor(options?: { url?: string; apiKey?: string }) {
    const url = options?.url ?? process.env.QDRANT_URL;
    if (!url) {
      throw new Error("Qdrant URL not configured (set QDRANT_URL)");
    }
    this.client = new QdrantClient({
      url,
      apiKey: options?.apiKey ?? process.env.QDRANT_API_KEY,
    });
  }

  private async ensureCollection(dim: number): Promise<void> {
    if (this.ensuredDim === dim) return;
    const collections = await this.client.getCollections();
    const exists = collections.collections.some((item) => item.name === COLLECTION);
    if (!exists) {
      await this.client.createCollection(COLLECTION, {
        vectors: { size: dim, distance: "Cosine" },
      });
    }
    this.ensuredDim = dim;
  }

  /** Gate provenance first; hash unit_id for Qdrant; never backfill clause_id from point.id. */
  async upsert(point: VectorPoint): Promise<void> {
    assertVectorPayload(point.payload);
    const payload = storedVectorPayload(point.payload);
    const unitId = requirePayloadUnitId(payload);
    await this.ensureCollection(point.vector.length);
    await this.client.upsert(COLLECTION, {
      wait: true,
      points: [
        {
          id: toQdrantPointId(unitId),
          vector: point.vector,
          payload,
        },
      ],
    });
  }

  async search(
    vector: number[],
    opts?: { versionId?: string; topK?: number },
  ): Promise<VectorHit[]> {
    await this.ensureCollection(vector.length);
    const filter = opts?.versionId
      ? {
          must: [{ key: "versionId", match: { value: opts.versionId } }],
        }
      : undefined;
    const results = await this.client.query(COLLECTION, {
      query: vector,
      limit: opts?.topK ?? 8,
      filter,
      with_payload: true,
      with_vector: true,
    });
    return results.points.map((hit) => {
      const raw = hit.vector;
      const vec = Array.isArray(raw) ? raw : undefined;
      const payload = (hit.payload ?? undefined) as Record<string, unknown> | undefined;
      return {
        id: originalPointId(payload),
        score: hit.score,
        payload,
        vector: vec as number[] | undefined,
      };
    });
  }
}
