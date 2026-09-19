/**
 * Scheduler tests: serial execution of fn + branch nodes.
 *
 * Verifies:
 * - 5+ node graph with fn and branch nodes completes
 * - Channel updates propagate correctly
 * - Branch routing works
 * - Run metadata captured
 * - Cancellation works
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  compileGraph,
  type GraphDefinition,
} from "../src/graph/compiler.js";
import {
  runGraph,
  type SchedulerOptions,
} from "../src/runtime/scheduler.js";
import {
  RunManager,
  type StartRunOptions,
} from "../src/runtime/run-manager.js";
import {
  createInitialChannels,
  mergeChannels,
  getChannel,
  serializeChannels,
  deserializeChannels,
} from "../src/runtime/state.js";
import { FnExecutor, BranchExecutor } from "../src/runtime/node-executors.js";

describe("state.ts - channel/reducer model", () => {
  it("createInitialChannels creates input channel", () => {
    const channels = createInitialChannels({ foo: "bar" });
    expect(getChannel(channels, "input")).toEqual({ foo: "bar" });
    expect(getChannel(channels, "missing")).toBeUndefined();
  });

  it("mergeChannels updates existing and creates new", () => {
    const channels = createInitialChannels({ a: 1 });
    mergeChannels(channels, { a: 2, b: 3 });
    expect(getChannel(channels, "a")).toBe(2);
    expect(getChannel(channels, "b")).toBe(3);
  });

  it("serializeChannels/deserializeChannels roundtrip", () => {
    const channels = createInitialChannels({ x: 1 });
    mergeChannels(channels, { y: 2 });
    const serialized = serializeChannels(channels);
    const restored = deserializeChannels(serialized);
    // createInitialChannels creates "input" channel, mergeChannels creates "y"
    expect(getChannel(restored, "input")).toEqual({ x: 1 });
    expect(getChannel(restored, "y")).toBe(2);
  });
});

describe("node-executors.ts", () => {
  let mockContext: any;

  beforeEach(() => {
    mockContext = {
      channels: createInitialChannels({ test: "input" }),
      compiledGraph: {
        nodes: new Map(),
        edges: [],
        adjacency: new Map(),
      },
      metadata: { runId: "test", graphId: "test", status: "running", createdAt: new Date().toISOString(), input: {}, nodeHistory: [] },
      abortSignal: { aborted: false },
    };
  });

  it("FnExecutor runs inline function and writes output", async () => {
    const executor = new FnExecutor();
    const node = {
      id: "fn1",
      type: "fn" as const,
      config: {
        inlineFn: async (inputs: any) => ({ result: inputs.input.test + "-processed" }),
        outputChannel: "fn1_output",
      },
    };
    const result = await executor.execute(node, mockContext);
    expect(result.updates.fn1_output).toEqual({ result: "input-processed" });
  });

  it("FnExecutor throws on missing function", async () => {
    const executor = new FnExecutor();
    const node = { id: "fn1", type: "fn" as const, config: {} };
    await expect(executor.execute(node, mockContext)).rejects.toThrow("requires config.fn");
  });

  it("BranchExecutor routes to matching condition edge", async () => {
    const executor = new BranchExecutor();
    const node = {
      id: "branch1",
      type: "branch" as const,
      config: {
        condition: (channels: any) => channels.decision,
      },
    };
    mockContext.channels = createInitialChannels({});
    mergeChannels(mockContext.channels, { decision: "pathA" });
    mockContext.compiledGraph.edges = [
      { from: "branch1", to: "nodeA", condition: "pathA" },
      { from: "branch1", to: "nodeB", condition: "pathB" },
    ];
    const result = await executor.execute(node, mockContext);
    expect(result.nextNodeIds).toEqual(["nodeA"]);
  });

  it("BranchExecutor uses default edge when no condition matches", async () => {
    const executor = new BranchExecutor();
    const node = {
      id: "branch1",
      type: "branch" as const,
      config: {
        condition: () => "unknown",
      },
    };
    mockContext.channels = createInitialChannels({});
    mockContext.compiledGraph.edges = [
      { from: "branch1", to: "nodeA", condition: "pathA" },
      { from: "branch1", to: "nodeDefault" }, // default (no condition)
    ];
    const result = await executor.execute(node, mockContext);
    expect(result.nextNodeIds).toEqual(["nodeDefault"]);
  });

  it("LLMExecutor uses FakeLlmProvider", async () => {
    const { LLMExecutor } = await import("../src/runtime/node-executors.js");
    const { FakeLlmProvider } = await import("../src/llm/provider.js");
    const executor = new LLMExecutor(new FakeLlmProvider());
    const result = await executor.execute(
      { id: "x", type: "llm", config: { prompt: "hi", outputChannel: "out" } },
      mockContext,
    );
    expect(result.updates.out).toContain("[fake-llm");
  });

  it("getExecutor returns built-in executors", async () => {
    const { getExecutor, StartExecutor, EndExecutor } = await import("../src/runtime/node-executors.js");
    expect(getExecutor("fn")).toBeInstanceOf(FnExecutor);
    expect(getExecutor("branch")).toBeInstanceOf(BranchExecutor);
    expect(getExecutor("start")).toBeInstanceOf(StartExecutor);
    expect(getExecutor("end")).toBeInstanceOf(EndExecutor);
  });
});

describe("scheduler.ts - serial execution", () => {
  it("runs linear 5-node fn chain", async () => {
    const def: GraphDefinition = {
      nodes: [
        { id: "start", type: "start" },
        { id: "fn1", type: "fn", config: { inlineFn: async (i) => ({ v: (i.input?.v ?? 0) + 1 }), outputChannel: "fn1" } },
        { id: "fn2", type: "fn", config: { inlineFn: async (i) => ({ v: (i.fn1?.v ?? 0) + 1 }), outputChannel: "fn2", inputChannels: ["fn1"] } },
        { id: "fn3", type: "fn", config: { inlineFn: async (i) => ({ v: (i.fn2?.v ?? 0) + 1 }), outputChannel: "fn3", inputChannels: ["fn2"] } },
        { id: "end", type: "end" },
      ],
      edges: [
        { from: "start", to: "fn1" },
        { from: "fn1", to: "fn2" },
        { from: "fn2", to: "fn3" },
        { from: "fn3", to: "end" },
      ],
    };

    const compiled = compileGraph(def);
    const result = await runGraph(compiled, { v: 0 }, { aborted: false });

    expect(result.status).toBe("completed");
    expect(result.history).toHaveLength(5);
    expect(getChannel(result.channels, "fn3")).toEqual({ v: 3 });
  });

  it("runs graph with branch routing", async () => {
    const def: GraphDefinition = {
      nodes: [
        { id: "start", type: "start" },
        { id: "branch", type: "branch", config: { condition: (ch: any) => ch.input?.route } },
        { id: "pathA", type: "fn", config: { inlineFn: async () => ({ path: "A" }), outputChannel: "output" } },
        { id: "pathB", type: "fn", config: { inlineFn: async () => ({ path: "B" }), outputChannel: "output" } },
        { id: "end", type: "end" },
      ],
      edges: [
        { from: "start", to: "branch" },
        { from: "branch", to: "pathA", condition: "A" },
        { from: "branch", to: "pathB", condition: "B" },
        { from: "pathA", to: "end" },
        { from: "pathB", to: "end" },
      ],
    };

    const compiled = compileGraph(def);

    // Test path A
    const resultA = await runGraph(compiled, { route: "A" }, { aborted: false });
    expect(resultA.status).toBe("completed");
    expect(getChannel(resultA.channels, "output")).toEqual({ path: "A" });

    // Test path B
    const resultB = await runGraph(compiled, { route: "B" }, { aborted: false });
    expect(resultB.status).toBe("completed");
    expect(getChannel(resultB.channels, "output")).toEqual({ path: "B" });
  });

  it("handles onError edge when node fails", async () => {
    const def: GraphDefinition = {
      nodes: [
        { id: "start", type: "start" },
        { id: "fn_fail", type: "fn", config: { inlineFn: async () => { throw new Error("boom"); } } },
        { id: "error_handler", type: "fn", config: { inlineFn: async () => ({ recovered: true }), outputChannel: "output" } },
        { id: "end", type: "end" },
      ],
      edges: [
        { from: "start", to: "fn_fail" },
        { from: "fn_fail", to: "error_handler", onError: true },
        { from: "error_handler", to: "end" },
      ],
    };

    const compiled = compileGraph(def);
    const result = await runGraph(compiled, {}, { aborted: false });

    expect(result.status).toBe("completed");
    expect(getChannel(result.channels, "output")).toEqual({ recovered: true });
  });

  it("respects maxSteps limit", async () => {
    const def: GraphDefinition = {
      nodes: [
        { id: "start", type: "start" },
        { id: "fn1", type: "fn", config: { inlineFn: async () => ({}), outputChannel: "fn1" } },
        { id: "end", type: "end" },
      ],
      edges: [
        { from: "start", to: "fn1" },
        { from: "fn1", to: "end" },
      ],
    };

    const compiled = compileGraph(def);
    const result = await runGraph(compiled, {}, { aborted: false }, { maxSteps: 1 });

    expect(result.status).toBe("failed");
    expect(result.error?.code).toBe("MAX_STEPS");
  });

  it("cancels on abort signal", async () => {
    const def: GraphDefinition = {
      nodes: [
        { id: "start", type: "start" },
        { id: "fn1", type: "fn", config: { inlineFn: async () => { await new Promise(r => setTimeout(r, 100)); return {}; }, outputChannel: "fn1" } },
        { id: "end", type: "end" },
      ],
      edges: [
        { from: "start", to: "fn1" },
        { from: "fn1", to: "end" },
      ],
    };

    const compiled = compileGraph(def);
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 10);
    const result = await runGraph(compiled, {}, controller.signal);

    expect(result.status).toBe("cancelled");
    expect(result.error?.code).toBe("CANCELLED");
  });

  it("records node history with timing", async () => {
    const def: GraphDefinition = {
      nodes: [
        { id: "start", type: "start" },
        { id: "fn1", type: "fn", config: { inlineFn: async () => ({ x: 1 }), outputChannel: "fn1" } },
        { id: "end", type: "end" },
      ],
      edges: [
        { from: "start", to: "fn1" },
        { from: "fn1", to: "end" },
      ],
    };

    const compiled = compileGraph(def);
    const result = await runGraph(compiled, {}, { aborted: false });

    expect(result.history.length).toBeGreaterThanOrEqual(3);
    const fnRecord = result.history.find(r => r.nodeId === "fn1");
    expect(fnRecord).toBeDefined();
    expect(fnRecord?.status).toBe("completed");
    expect(fnRecord?.startedAt).toBeDefined();
    expect(fnRecord?.finishedAt).toBeDefined();
    expect(fnRecord?.attempt).toBe(1);
  });
});

describe("run-manager.ts - lifecycle", () => {
  let manager: RunManager;

  beforeEach(() => {
    manager = new RunManager();
  });

  it("startRun compiles definition and returns runId", async () => {
    const def: GraphDefinition = {
      nodes: [
        { id: "start", type: "start" },
        { id: "fn1", type: "fn", config: { inlineFn: async () => ({ done: true }), outputChannel: "output" } },
        { id: "end", type: "end" },
      ],
      edges: [
        { from: "start", to: "fn1" },
        { from: "fn1", to: "end" },
      ],
    };

    const { runId, status } = await manager.startRun(def, { input: { test: true } });
    expect(runId).toMatch(/^run_/);
    expect(status).toBe("running");
  });

  it("getRun returns metadata", async () => {
    const def: GraphDefinition = {
      nodes: [
        { id: "start", type: "start" },
        { id: "fn1", type: "fn", config: { inlineFn: async () => ({}), outputChannel: "out" } },
        { id: "end", type: "end" },
      ],
      edges: [{ from: "start", to: "fn1" }, { from: "fn1", to: "end" }],
    };

    const { runId } = await manager.startRun(def, { input: {} });
    const meta = manager.getRun(runId);
    expect(meta).toBeDefined();
    expect(meta?.runId).toBe(runId);
    expect(meta?.graphId).toBeDefined();
    expect(meta?.status).toBe("running");
  });

  it("waitForRun returns full result", async () => {
    const def: GraphDefinition = {
      nodes: [
        { id: "start", type: "start" },
        { id: "fn1", type: "fn", config: { inlineFn: async () => ({ value: 42 }), outputChannel: "output" } },
        { id: "end", type: "end" },
      ],
      edges: [{ from: "start", to: "fn1" }, { from: "fn1", to: "end" }],
    };

    const { runId } = await manager.startRun(def, { input: {} });
    const result = await manager.waitForRun(runId);
    expect(result).toBeDefined();
    expect(result?.status).toBe("completed");
    expect(result?.output).toEqual({ value: 42 });
  });

  it("cancelRun aborts running execution", async () => {
    const def: GraphDefinition = {
      nodes: [
        { id: "start", type: "start" },
        { id: "fn1", type: "fn", config: { inlineFn: async () => { await new Promise(r => setTimeout(r, 500)); return {}; }, outputChannel: "out" } },
        { id: "end", type: "end" },
      ],
      edges: [{ from: "start", to: "fn1" }, { from: "fn1", to: "end" }],
    };

    const { runId } = await manager.startRun(def, { input: {} });
    // Cancel immediately
    const cancelled = manager.cancelRun(runId);
    expect(cancelled).toBe(true);

    const result = await manager.waitForRun(runId);
    expect(result?.status).toBe("cancelled");
  });

  it("listRuns filters by status", async () => {
    const def: GraphDefinition = {
      nodes: [{ id: "start", type: "start" }, { id: "end", type: "end" }],
      edges: [{ from: "start", to: "end" }],
    };

    await manager.startRun(def, { input: {} });
    await manager.startRun(def, { input: {} });

    const running = manager.listRuns("running");
    expect(running.length).toBeGreaterThanOrEqual(2);
  });

  it("caches compiled graphs", async () => {
    const def: GraphDefinition = {
      graphId: "cached-graph",
      nodes: [{ id: "start", type: "start" }, { id: "end", type: "end" }],
      edges: [{ from: "start", to: "end" }],
    };

    await manager.startRun(def, { input: {} });
    const cached = manager.getCompiledGraph("cached-graph");
    expect(cached).toBeDefined();
    expect(cached?.graphId).toBe("cached-graph");
  });

  it("startRun with CompiledGraph skips compilation", async () => {
    const def: GraphDefinition = {
      nodes: [{ id: "start", type: "start" }, { id: "fn1", type: "fn", config: { inlineFn: async () => ({}), outputChannel: "out" } }, { id: "end", type: "end" }],
      edges: [{ from: "start", to: "fn1" }, { from: "fn1", to: "end" }],
    };
    const compiled = compileGraph(def);

    const { runId } = await manager.startRun(compiled, { input: {} });
    const result = await manager.waitForRun(runId);
    expect(result?.status).toBe("completed");
  });

  it("defaultRunManager singleton works", async () => {
    const { defaultRunManager, startRun, getRun, waitForRun } = await import("../src/runtime/run-manager.js");
    const def: GraphDefinition = {
      nodes: [{ id: "start", type: "start" }, { id: "fn1", type: "fn", config: { inlineFn: async () => ({ ok: true }), outputChannel: "output" } }, { id: "end", type: "end" }],
      edges: [{ from: "start", to: "fn1" }, { from: "fn1", to: "end" }],
    };

    const { runId } = await startRun(def, { input: {} });
    const meta = getRun(runId);
    expect(meta).toBeDefined();
    const result = await waitForRun(runId);
    expect(result?.output).toEqual({ ok: true });
  });
});

describe("integration - compileGraph + scheduler + runManager", () => {
  it("end-to-end: 6-node graph with fn, branch, error handling", async () => {
    const def: GraphDefinition = {
      name: "test-pipeline",
      version: "1.0.0",
      nodes: [
        { id: "start", type: "start" },
        { id: "validate", type: "fn", config: { inlineFn: async (i) => ({ valid: !!i.input?.data }), outputChannel: "validate" } },
        { id: "route", type: "branch", config: { condition: (ch: any) => ch.validate?.valid ? "valid" : "invalid" } },
        { id: "process", type: "fn", config: { inlineFn: async (i) => ({ result: "processed-" + i.validate?.valid }), outputChannel: "output", inputChannels: ["validate"] } },
        { id: "handle_error", type: "fn", config: { inlineFn: async () => ({ error: "invalid input" }), outputChannel: "output" } },
        { id: "end", type: "end" },
      ],
      edges: [
        { from: "start", to: "validate" },
        { from: "validate", to: "route" },
        { from: "route", to: "process", condition: "valid" },
        { from: "route", to: "handle_error", condition: "invalid" },
        { from: "process", to: "end" },
        { from: "handle_error", to: "end" },
      ],
    };

    const manager = new RunManager();

    // Valid input
    const { runId: runId1 } = await manager.startRun(def, { input: { data: "hello" } });
    const result1 = await manager.waitForRun(runId1);
    expect(result1?.status).toBe("completed");
    expect(result1?.output).toEqual({ result: "processed-true" });

    // Invalid input
    const { runId: runId2 } = await manager.startRun(def, { input: {} });
    const result2 = await manager.waitForRun(runId2);
    expect(result2?.status).toBe("completed");
    expect(result2?.output).toEqual({ error: "invalid input" });
  });
});