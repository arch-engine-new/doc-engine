/**
 * GraphStore labels + queryPath kind (R5/R22, D7/M5).
 * MemoryGraphStore is enough: Neo4j uses the same endpointLabel rules.
 */

import { describe, expect, it } from "vitest";
import { MemoryGraphStore } from "../src/retrieve/memory-graph.js";

describe("MemoryGraphStore labels and queryPath", () => {
  it("PARENT_OF endpoints are both Clause nodes", async () => {
    const graph = new MemoryGraphStore();
    await graph.upsertEdge({ from: "8.5", to: "8.5.1", kind: "PARENT_OF" });
    expect(graph.nodeLabel("8.5")).toBe("Clause");
    expect(graph.nodeLabel("8.5.1")).toBe("Clause");
  });

  it("queryPath(kind=SUPERSEDES) is not replaced by a trailing PARENT_OF hop", async () => {
    const graph = new MemoryGraphStore();
    await graph.upsertEdge({ from: "2.1", to: "1.1", kind: "SUPERSEDES" });
    await graph.upsertEdge({ from: "2.1", to: "2.1.1", kind: "PARENT_OF" });

    const supersedes = await graph.queryPath("2.1", "SUPERSEDES");
    expect(supersedes).toEqual([{ from: "2.1", to: "1.1", kind: "SUPERSEDES" }]);
    expect(supersedes.some((edge) => edge.kind === "PARENT_OF")).toBe(false);

    const untyped = await graph.queryPath("2.1");
    expect(untyped).toEqual([{ from: "2.1", to: "1.1", kind: "SUPERSEDES" }]);
    expect(untyped.some((edge) => edge.kind === "PARENT_OF")).toBe(false);
  });

  it("SUPPORTS keeps from as LayoutUnit instead of MERGE into Clause", async () => {
    const graph = new MemoryGraphStore();
    await graph.upsertNode("LayoutUnit", "table-8.5.1-1", { chunk_kind: "table" });
    await graph.upsertClause("clause-1.1");
    await graph.upsertEdge({
      from: "table-8.5.1-1",
      to: "clause-1.1",
      kind: "SUPPORTS",
    });
    expect(graph.nodeLabel("table-8.5.1-1")).toBe("LayoutUnit");
    expect(graph.nodeLabel("clause-1.1")).toBe("Clause");
    const path = await graph.queryPath("table-8.5.1-1", "SUPPORTS");
    expect(path).toEqual([
      { from: "table-8.5.1-1", to: "clause-1.1", kind: "SUPPORTS" },
    ]);
  });

  it("upsertNode rejects labels outside Clause|LayoutUnit", async () => {
    const graph = new MemoryGraphStore();
    await expect(graph.upsertNode("Document", "x")).rejects.toThrow(/unsupported node label/);
  });
});
