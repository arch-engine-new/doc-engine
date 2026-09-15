/**
 * Vector payload gate: missing provenance fails; table hits stay unit_id, not clause_id.
 */

import { describe, it, expect } from "vitest";
import { MemoryVectorStore } from "../src/retrieve/memory-vector.js";
import { assertVectorPayload } from "../src/retrieve/payload.js";

function tablePayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    file_name: "GB50010.pdf",
    unit_id: "lu-table-8.5.1",
    chunk_kind: "table",
    page_start: 1,
    page_end: 2,
    ...overrides,
  };
}

describe("assertVectorPayload", () => {
  it("rejects missing page numbers", () => {
    const payload = tablePayload();
    delete payload.page_start;
    delete payload.page_end;
    expect(() => assertVectorPayload(payload)).toThrow(/page range/);
  });

  it("rejects table payload with a non-empty clause_id", () => {
    expect(() => assertVectorPayload(tablePayload({ clause_id: "c-1.1" }))).toThrow(
      /must not carry clause_id/,
    );
  });

  it("allows table payload with JSON null clause_id", () => {
    expect(() => assertVectorPayload(tablePayload({ clause_id: null }))).not.toThrow();
  });
});

describe("MemoryVectorStore payload gate", () => {
  it("fails upsert when page numbers are missing", async () => {
    const store = new MemoryVectorStore();
    const payload = tablePayload();
    delete payload.page_start;
    delete payload.page_end;
    await expect(
      store.upsert({ id: "caller-id", vector: [1, 0, 0], payload }),
    ).rejects.toThrow(/page range/);
  });

  it("returns unit_id and does not backfill clause_id for a table point", async () => {
    const store = new MemoryVectorStore();
    const unitId = "lu-table-8.5.1";
    await store.upsert({
      id: "caller-made-this-up",
      vector: [1, 0, 0],
      payload: tablePayload({ unit_id: unitId, clause_id: null }),
    });
    const hits = await store.search([1, 0, 0], { topK: 1 });
    expect(hits[0]?.id).toBe(unitId);
    const clauseId = hits[0]?.payload?.clause_id;
    expect(typeof clauseId === "string" && clauseId.length > 0).toBe(false);
    expect(hits[0]?.payload).not.toHaveProperty("clause_id");
  });
});
