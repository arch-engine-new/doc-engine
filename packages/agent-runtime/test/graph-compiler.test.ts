import { describe, expect, it } from "vitest";
import { compileGraph, GraphCompileError } from "../src/graph/compiler.js";
import type { GraphDefinition } from "../src/graph/types.js";

function linearDef(overrides: Partial<GraphDefinition> = {}): GraphDefinition {
  return {
    graphId: "g1",
    name: "linear",
    nodes: [
      { id: "s", type: "start" },
      { id: "a", type: "fn", config: { op: "noop" } },
      { id: "e", type: "end" },
    ],
    edges: [
      { from: "s", to: "a" },
      { from: "a", to: "e" },
    ],
    ...overrides,
  };
}

describe("compileGraph", () => {
  it("compiles a valid linear graph (happy path)", () => {
    const compiled = compileGraph(linearDef());
    expect(compiled.graphId).toBe("g1");
    expect(compiled.entryNodeId).toBe("s");
    expect(compiled.terminalNodeIds).toContain("e");
    expect(compiled.nodes.size).toBe(3);
    expect(compiled.adjacency.get("s")).toEqual(["a"]);
    expect(compiled.adjacency.get("a")).toEqual(["e"]);
    expect(compiled.adjacency.get("e")).toEqual([]);
    expect(compiled.definition.graphId).toBe("g1");
  });

  it("assigns graphId when missing", () => {
    const def = linearDef();
    delete def.graphId;
    const compiled = compileGraph(def);
    expect(compiled.graphId).toMatch(/^graph_/);
    expect(compiled.definition.graphId).toBe(compiled.graphId);
  });

  it("treats nodes with no outgoing edges as terminals", () => {
    const compiled = compileGraph({
      nodes: [
        { id: "s", type: "start" },
        { id: "work", type: "llm" },
      ],
      edges: [{ from: "s", to: "work" }],
    });
    expect(compiled.terminalNodeIds).toEqual(["work"]);
  });

  it("supports branch / hitl / tool / subgraph node types", () => {
    const compiled = compileGraph({
      graphId: "mixed",
      nodes: [
        { id: "s", type: "start" },
        { id: "b", type: "branch" },
        { id: "t", type: "tool" },
        { id: "h", type: "hitl" },
        { id: "sg", type: "subgraph" },
        { id: "e", type: "end" },
      ],
      edges: [
        { from: "s", to: "b" },
        { from: "b", to: "t", condition: "yes" },
        { from: "b", to: "h", condition: "no" },
        { from: "t", to: "sg" },
        { from: "h", to: "e" },
        { from: "sg", to: "e" },
      ],
    });
    expect(compiled.nodes.get("b")?.type).toBe("branch");
    expect(compiled.terminalNodeIds).toContain("e");
  });

  it("excludes onError edges from normal adjacency", () => {
    const compiled = compileGraph({
      nodes: [
        { id: "s", type: "start" },
        { id: "a", type: "fn" },
        { id: "err", type: "end" },
        { id: "ok", type: "end" },
      ],
      edges: [
        { from: "s", to: "a" },
        { from: "a", to: "ok" },
        { from: "a", to: "err", onError: true },
      ],
    });
    expect(compiled.adjacency.get("a")).toEqual(["ok"]);
  });

  it("rejects empty graph", () => {
    expect(() => compileGraph({ nodes: [], edges: [] })).toThrow(GraphCompileError);
    try {
      compileGraph({ nodes: [], edges: [] });
    } catch (e) {
      expect(e).toBeInstanceOf(GraphCompileError);
      expect((e as GraphCompileError).code).toBe("EMPTY_GRAPH");
    }
  });

  it("rejects unknown node types", () => {
    expect(() =>
      compileGraph({
        nodes: [{ id: "x", type: "magic" as "fn" }],
        edges: [],
      }),
    ).toThrow(/unknown node type/);
    try {
      compileGraph({
        nodes: [{ id: "x", type: "magic" as "fn" }],
        edges: [],
      });
    } catch (e) {
      expect((e as GraphCompileError).code).toBe("UNKNOWN_NODE_TYPE");
    }
  });

  it("rejects edges referencing missing nodes", () => {
    try {
      compileGraph({
        nodes: [{ id: "a", type: "fn" }],
        edges: [{ from: "a", to: "missing" }],
      });
      expect.fail("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(GraphCompileError);
      expect((e as GraphCompileError).code).toBe("MISSING_NODE");
    }

    try {
      compileGraph({
        nodes: [{ id: "a", type: "fn" }],
        edges: [{ from: "ghost", to: "a" }],
      });
      expect.fail("should throw");
    } catch (e) {
      expect((e as GraphCompileError).code).toBe("MISSING_NODE");
    }
  });

  it("rejects graphs with no terminal path (full cycle)", () => {
    try {
      compileGraph({
        nodes: [
          { id: "a", type: "fn" },
          { id: "b", type: "fn" },
        ],
        edges: [
          { from: "a", to: "b" },
          { from: "b", to: "a" },
        ],
        entryNodeId: "a",
      });
      expect.fail("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(GraphCompileError);
      expect((e as GraphCompileError).code).toBe("NO_TERMINAL");
    }
  });

  it("rejects duplicate node ids", () => {
    try {
      compileGraph({
        nodes: [
          { id: "a", type: "fn" },
          { id: "a", type: "end" },
        ],
        edges: [],
      });
      expect.fail("should throw");
    } catch (e) {
      expect((e as GraphCompileError).code).toBe("DUPLICATE_NODE");
    }
  });

  it("rejects invalid retry policy", () => {
    try {
      compileGraph({
        nodes: [{ id: "a", type: "fn", retry: { maxAttempts: 0 } }],
        edges: [],
      });
      expect.fail("should throw");
    } catch (e) {
      expect((e as GraphCompileError).code).toBe("INVALID_RETRY");
    }
  });

  it("uses explicit entryNodeId when provided", () => {
    const compiled = compileGraph({
      nodes: [
        { id: "a", type: "fn" },
        { id: "b", type: "fn" },
        { id: "e", type: "end" },
      ],
      edges: [
        { from: "a", to: "e" },
        { from: "b", to: "e" },
      ],
      entryNodeId: "b",
    });
    expect(compiled.entryNodeId).toBe("b");
  });
});
