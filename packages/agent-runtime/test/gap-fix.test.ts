/**
 * Gap-fix tests: LLM node, subgraph, parallel fan-out/fan-in.
 */

import { describe, it, expect } from "vitest";
import { compileGraph, type GraphDefinition } from "../src/graph/compiler.js";
import { runGraph } from "../src/runtime/scheduler.js";
import { LLMExecutor, SubgraphExecutor } from "../src/runtime/node-executors.js";
import { createInitialChannels } from "../src/runtime/state.js";
import { FakeLlmProvider } from "../src/llm/provider.js";

describe("LLMExecutor", () => {
  it("completes with FakeLlmProvider", async () => {
    const executor = new LLMExecutor(new FakeLlmProvider());
    const channels = createInitialChannels({ topic: "agents" });
    const result = await executor.execute(
      {
        id: "llm1",
        type: "llm",
        config: { prompt: "Summarize {{topic}}", outputChannel: "llm_out" },
      },
      {
        channels,
        compiledGraph: { nodes: new Map(), edges: [], adjacency: new Map(), graphId: "g", entryNodeId: "s", terminalNodeIds: [], definition: { nodes: [], edges: [] } },
        metadata: { runId: "r", graphId: "g", status: "running", createdAt: "", input: {}, nodeHistory: [] },
        abortSignal: { aborted: false },
        runId: "r",
        threadId: undefined,
        attempt: 1,
      },
    );
    expect(result.updates.llm_out).toContain("[fake-llm");
    expect(result.updates.llm_out).toContain("Summarize");
  });
});

describe("fan-out / fan-in graph", () => {
  const def: GraphDefinition = {
    graphId: "fan-graph",
    nodes: [
      { id: "start", type: "start" },
      {
        id: "a",
        type: "fn",
        config: {
          inlineFn: async () => ({ branch: "a" }),
          outputChannel: "a_out",
        },
      },
      {
        id: "b",
        type: "fn",
        config: {
          inlineFn: async () => ({ branch: "b" }),
          outputChannel: "b_out",
        },
      },
      {
        id: "join",
        type: "fn",
        config: {
          inlineFn: async (inputs: Record<string, unknown>) => ({
            merged: [inputs.a_out, inputs.b_out],
          }),
          outputChannel: "output",
          inputChannels: ["a_out", "b_out"],
        },
      },
      { id: "end", type: "end" },
    ],
    edges: [
      { from: "start", to: "a" },
      { from: "start", to: "b" },
      { from: "a", to: "join" },
      { from: "b", to: "join" },
      { from: "join", to: "end" },
    ],
  };

  it("completes fan-out then fan-in (serial)", async () => {
    const compiled = compileGraph(def);
    const result = await runGraph(compiled, {}, { aborted: false });
    expect(result.status).toBe("completed");
    expect(result.output).toEqual({ merged: [{ branch: "a" }, { branch: "b" }] });
    expect(result.history.map((h) => h.nodeId)).toContain("join");
  });

  it("parallelExecution runs fan-out batch", async () => {
    const compiled = compileGraph(def);
    const order: string[] = [];
    const result = await runGraph(compiled, {}, { aborted: false }, {
      parallelExecution: true,
      onNodeStart: (r) => {
        order.push(r.nodeId);
      },
    });
    expect(result.status).toBe("completed");
    // a and b should both start before join (parallel batch after start)
    const aIdx = order.indexOf("a");
    const bIdx = order.indexOf("b");
    const joinIdx = order.indexOf("join");
    expect(aIdx).toBeGreaterThan(-1);
    expect(bIdx).toBeGreaterThan(-1);
    expect(joinIdx).toBeGreaterThan(aIdx);
    expect(joinIdx).toBeGreaterThan(bIdx);
  });
});

describe("SubgraphExecutor", () => {
  it("runs nested graph and maps output", async () => {
    const inner: GraphDefinition = {
      graphId: "inner-graph",
      nodes: [
        { id: "start", type: "start" },
        {
          id: "work",
          type: "fn",
          config: {
            inlineFn: async (inputs: { input?: { x?: number } }) => ({ y: (inputs.input?.x ?? 0) * 2 }),
            outputChannel: "output",
          },
        },
        { id: "end", type: "end" },
      ],
      edges: [
        { from: "start", to: "work" },
        { from: "work", to: "end" },
      ],
    };
    const innerCompiled = compileGraph(inner);
    const cache = new Map([[innerCompiled.graphId, innerCompiled]]);

    const executor = new SubgraphExecutor();
    const channels = createInitialChannels({ x: 5 });
    const result = await executor.execute(
      {
        id: "sg",
        type: "subgraph",
        config: { graphId: "inner-graph", outputChannel: "sg_out" },
      },
      {
        channels,
        compiledGraph: innerCompiled,
        metadata: { runId: "r", graphId: "outer", status: "running", createdAt: "", input: {}, nodeHistory: [] },
        abortSignal: { aborted: false },
        runId: "r",
        threadId: undefined,
        attempt: 1,
        getCompiledGraph: (id) => cache.get(id),
      },
    );
    expect(result.updates.sg_out).toEqual({ y: 10 });
  });
});

describe("LLM node in full graph", () => {
  it("runs llm node end-to-end", async () => {
    const def: GraphDefinition = {
      graphId: "llm-graph",
      nodes: [
        { id: "start", type: "start" },
        { id: "ask", type: "llm", config: { prompt: "ping", outputChannel: "output" } },
        { id: "end", type: "end" },
      ],
      edges: [
        { from: "start", to: "ask" },
        { from: "ask", to: "end" },
      ],
    };
    const compiled = compileGraph(def);
    const result = await runGraph(compiled, {}, { aborted: false });
    expect(result.status).toBe("completed");
    expect(String(result.output)).toContain("[fake-llm");
  });
});
