/**
 * Qdrant clauses collection: recreate when vectors.size !== upsert dim.
 * Mock client only — never hit a real Qdrant URL.
 */

import type { QdrantClient } from "@qdrant/js-client-rest";
import { describe, expect, it, vi } from "vitest";
import { QdrantVectorStore } from "../src/retrieve/qdrant.js";

const CLAUSE_PAYLOAD = {
  file_name: "JTG B01-2014.pdf",
  unit_id: "lu-clause-1.1",
  chunk_kind: "clause" as const,
  page_start: 1,
  page_end: 1,
};

function vectorOf(length: number): number[] {
  return new Array(length).fill(0);
}

function mockQdrantClient(existingSize: number) {
  return {
    getCollections: vi.fn(async () => ({
      collections: [{ name: "clauses" }],
    })),
    getCollection: vi.fn(async () => ({
      config: { params: { vectors: { size: existingSize, distance: "Cosine" } } },
    })),
    deleteCollection: vi.fn(async () => true),
    createCollection: vi.fn(async () => true),
    upsert: vi.fn(async () => ({ status: "completed" })),
  };
}

describe("QdrantVectorStore ensureCollection", () => {
  it("deletes and recreates clauses when existing size is 48 and upsert is 1024", async () => {
    const client = mockQdrantClient(48);
    const store = new QdrantVectorStore({ client: client as unknown as QdrantClient });
    await store.upsert({
      id: "ignored",
      vector: vectorOf(1024),
      payload: CLAUSE_PAYLOAD,
    });

    expect(client.getCollection).toHaveBeenCalledWith("clauses");
    expect(client.deleteCollection).toHaveBeenCalledWith("clauses");
    expect(client.createCollection).toHaveBeenCalledWith(
      "clauses",
      expect.objectContaining({
        vectors: { size: 1024, distance: "Cosine" },
      }),
    );
    expect(client.upsert).toHaveBeenCalledTimes(1);
    const deleteOrder = client.deleteCollection.mock.invocationCallOrder[0];
    const createOrder = client.createCollection.mock.invocationCallOrder[0];
    const upsertOrder = client.upsert.mock.invocationCallOrder[0];
    expect(deleteOrder).toBeLessThan(createOrder);
    expect(createOrder).toBeLessThan(upsertOrder);
    const upsertCall = client.upsert.mock.calls[0];
    expect(upsertCall?.[0]).toBe("clauses");
    const points = (
      upsertCall?.[1] as { points: Array<{ vector: number[]; payload: Record<string, unknown> }> }
    ).points;
    expect(points[0]?.vector).toHaveLength(1024);
    expect(points[0]?.payload).toMatchObject({
      file_name: CLAUSE_PAYLOAD.file_name,
      unit_id: CLAUSE_PAYLOAD.unit_id,
      chunk_kind: CLAUSE_PAYLOAD.chunk_kind,
      page_start: CLAUSE_PAYLOAD.page_start,
      page_end: CLAUSE_PAYLOAD.page_end,
    });
  });

  it("does not delete clauses when existing size already matches 1024", async () => {
    const client = mockQdrantClient(1024);
    const store = new QdrantVectorStore({ client: client as unknown as QdrantClient });
    await store.upsert({
      id: "ignored",
      vector: vectorOf(1024),
      payload: CLAUSE_PAYLOAD,
    });

    expect(client.getCollection).toHaveBeenCalledWith("clauses");
    expect(client.deleteCollection).not.toHaveBeenCalled();
    expect(client.createCollection).not.toHaveBeenCalled();
    expect(client.upsert).toHaveBeenCalledTimes(1);
  });
});
