/**
 * Tests for ToolRuntime: registry, execution, validation, timeout, retry, idempotency.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ToolRegistry, getDefaultRegistry, setDefaultRegistry } from "../src/tools/registry.js";
import { ToolRuntime, ToolExecutionError, type RetryPolicy } from "../src/tools/runtime.js";
import { SQLiteStateStore } from "../src/persistence/sqlite-store.js";
import { runMigrationOnDb } from "../src/persistence/migrate.js";
import { ToolExecutor } from "../src/runtime/node-executors.js";
import {
  createInitialChannels,
  mergeChannels,
  type ExecutionContext,
} from "../src/runtime/state.js";
import type { CompiledGraph, GraphNode } from "../src/graph/types.js";

// Test helpers
function createTestStore(): SQLiteStateStore {
  const store = new SQLiteStateStore(":memory:");
  return store;
}

async function initializeStore(store: SQLiteStateStore): Promise<void> {
  await store.initialize();
}

// Simple schemas for testing
const addToolSchema = {
  input: {
    type: "object",
    properties: {
      a: { type: "number" },
      b: { type: "number" },
    },
    required: ["a", "b"],
    additionalProperties: false,
  },
  output: {
    type: "number",
  },
};

const echoToolSchema = {
  input: {
    type: "object",
    properties: {
      message: { type: "string" },
    },
    required: ["message"],
    additionalProperties: false,
  },
  output: {
    type: "object",
    properties: {
      echoed: { type: "string" },
    },
    required: ["echoed"],
    additionalProperties: false,
  },
};

describe("ToolRegistry", () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  it("registers and retrieves a tool", () => {
    const handler = vi.fn(async ({ a, b }: { a: number; b: number }) => a + b);
    registry.register("add", addToolSchema, handler);

    const tool = registry.get("add");
    expect(tool).toBeDefined();
    expect(tool?.name).toBe("add");
    expect(tool?.schema).toEqual(addToolSchema);
    expect(tool?.handler).toBe(handler);
  });

  it("throws on duplicate registration", () => {
    registry.register("add", addToolSchema, vi.fn());
    expect(() => registry.register("add", addToolSchema, vi.fn())).toThrow('Tool "add" is already registered');
  });

  it("lists all registered tools", () => {
    registry.register("add", addToolSchema, vi.fn());
    registry.register("echo", echoToolSchema, vi.fn());
    expect(registry.list()).toEqual(["add", "echo"]);
  });

  it("checks if tool exists", () => {
    registry.register("add", addToolSchema, vi.fn());
    expect(registry.has("add")).toBe(true);
    expect(registry.has("nonexistent")).toBe(false);
  });

  it("removes a tool", () => {
    registry.register("add", addToolSchema, vi.fn());
    expect(registry.remove("add")).toBe(true);
    expect(registry.has("add")).toBe(false);
    expect(registry.remove("add")).toBe(false);
  });

  it("clears all tools", () => {
    registry.register("add", addToolSchema, vi.fn());
    registry.register("echo", echoToolSchema, vi.fn());
    registry.clear();
    expect(registry.list()).toEqual([]);
  });

  it("gets all tools with details", () => {
    registry.register("add", addToolSchema, vi.fn(), "Add two numbers");
    const tools = registry.getAll();
    expect(tools).toHaveLength(1);
    expect(tools[0].description).toBe("Add two numbers");
  });
});

describe("ToolRuntime", () => {
  let registry: ToolRegistry;
  let runtime: ToolRuntime;

  beforeEach(() => {
    registry = new ToolRegistry();
    runtime = new ToolRuntime(registry);
  });

  describe("basic execution", () => {
    it("executes a registered tool successfully", async () => {
      const handler = vi.fn(async ({ a, b }: { a: number; b: number }) => a + b);
      registry.register("add", addToolSchema, handler);

      const result = await runtime.execute("add", { a: 2, b: 3 });

      expect(result.output).toBe(5);
      expect(result.attempts).toBe(1);
      expect(result.fromCache).toBe(false);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ a: 2, b: 3 });
    });

    it("throws NOT_FOUND for unknown tool", async () => {
      await expect(runtime.execute("unknown", {})).rejects.toThrow(ToolExecutionError);
      await expect(runtime.execute("unknown", {})).rejects.toMatchObject({
        code: "NOT_FOUND",
        toolName: "unknown",
      });
    });

    it("validates input schema", async () => {
      registry.register("add", addToolSchema, vi.fn());

      await expect(runtime.execute("add", { a: 1 })).rejects.toThrow(ToolExecutionError);
      await expect(runtime.execute("add", { a: 1 })).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      });

      await expect(runtime.execute("add", { a: 1, b: 2, c: 3 })).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      });

      await expect(runtime.execute("add", { a: "not a number", b: 2 })).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      });
    });

    it("validates output schema", async () => {
      const badHandler = vi.fn(async () => "not a number");
      registry.register("add", addToolSchema, badHandler);

      await expect(runtime.execute("add", { a: 1, b: 2 })).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      });
    });
  });

  describe("timeout", () => {
    it("times out when handler exceeds timeoutMs", async () => {
      const slowHandler = vi.fn(async () => {
        await new Promise((r) => setTimeout(r, 100));
        return 42;
      });
      registry.register("slow", {
        input: { type: "object", properties: {}, additionalProperties: false },
        output: { type: "number" },
      }, slowHandler);

      await expect(runtime.execute("slow", {}, { timeoutMs: 10 })).rejects.toMatchObject({
        code: "TIMEOUT",
        toolName: "slow",
      });
    });

    it("does not timeout when handler completes in time", async () => {
      const fastHandler = vi.fn(async () => {
        await new Promise((r) => setTimeout(r, 5));
        return 42;
      });
      registry.register("fast", {
        input: { type: "object", properties: {}, additionalProperties: false },
        output: { type: "number" },
      }, fastHandler);

      const result = await runtime.execute("fast", {}, { timeoutMs: 100 });
      expect(result.output).toBe(42);
    });
  });

  describe("retry", () => {
    it("retries on transient failure and succeeds", async () => {
      let attempts = 0;
      const flakyHandler = vi.fn(async () => {
        attempts++;
        if (attempts < 3) throw new Error("transient error");
        return "success";
      });
      registry.register("flaky", {
        input: { type: "object", properties: {}, additionalProperties: false },
        output: { type: "string" },
      }, flakyHandler);

      const result = await runtime.execute("flaky", {}, {
        retryPolicy: { maxAttempts: 3, backoffMs: 10, jitter: false },
      });

      expect(result.output).toBe("success");
      expect(result.attempts).toBe(3);
      expect(attempts).toBe(3);
    });

    it("exhausts retries and throws HANDLER_ERROR", async () => {
      const failingHandler = vi.fn(async () => {
        throw new Error("permanent error");
      });
      registry.register("fail", {
        input: { type: "object", properties: {}, additionalProperties: false },
        output: { type: "string" },
      }, failingHandler);

      await expect(runtime.execute("fail", {}, {
        retryPolicy: { maxAttempts: 3, backoffMs: 10, jitter: false },
      })).rejects.toMatchObject({
        code: "HANDLER_ERROR",
        attempt: 3,
      });
    });

    it("does not retry on validation error", async () => {
      const handler = vi.fn(async () => "output");
      registry.register("tool", {
        input: { type: "object", properties: { x: { type: "number" } }, required: ["x"], additionalProperties: false },
        output: { type: "string" },
      }, handler);

      // Missing required field - validation error
      await expect(runtime.execute("tool", {}, {
        retryPolicy: { maxAttempts: 3, backoffMs: 10, jitter: false },
      })).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      });

      expect(handler).not.toHaveBeenCalled();
    });

    it("retries on timeout", async () => {
      let attempts = 0;
      const slowHandler = vi.fn(async () => {
        attempts++;
        if (attempts < 2) {
          await new Promise((r) => setTimeout(r, 50));
        }
        return "ok";
      });
      registry.register("slow", {
        input: { type: "object", properties: {}, additionalProperties: false },
        output: { type: "string" },
      }, slowHandler);

      const result = await runtime.execute("slow", {}, {
        timeoutMs: 10,
        retryPolicy: { maxAttempts: 3, backoffMs: 5, jitter: false },
      });

      expect(result.output).toBe("ok");
      expect(result.attempts).toBe(2);
    });

    it("uses exponential backoff with jitter", async () => {
      const startTimes: number[] = [];
      const handler = vi.fn(async () => {
        startTimes.push(Date.now());
        if (startTimes.length < 3) throw new Error("fail");
        return "ok";
      });
      registry.register("retry", {
        input: { type: "object", properties: {}, additionalProperties: false },
        output: { type: "string" },
      }, handler);

      await runtime.execute("retry", {}, {
        retryPolicy: { maxAttempts: 3, backoffMs: 100, jitter: true },
      });

      // Check that delays are roughly exponential (100ms, ~200ms with jitter)
      const delay1 = startTimes[1] - startTimes[0];
      const delay2 = startTimes[2] - startTimes[1];
      expect(delay1).toBeGreaterThanOrEqual(50); // 100ms * 0.75
      expect(delay1).toBeLessThanOrEqual(150); // 100ms * 1.25
      expect(delay2).toBeGreaterThanOrEqual(150); // 200ms * 0.75
      expect(delay2).toBeLessThanOrEqual(350); // 200ms * 1.75 (more variance due to jitter)
    });
  });

  describe("idempotency", () => {
    let store: SQLiteStateStore;

    beforeEach(async () => {
      store = createTestStore();
      await initializeStore(store);
      runtime = new ToolRuntime(registry, store);
    });

    afterEach(async () => {
      await store.close();
    });

    it("returns cached result for same idempotencyKey", async () => {
      const handler = vi.fn(async ({ a, b }: { a: number; b: number }) => a + b);
      registry.register("add", addToolSchema, handler);

      const options = {
        idempotencyKey: "test-key-1",
        runId: "run-1",
        nodeExecutionId: 1,
      };

      const result1 = await runtime.execute("add", { a: 2, b: 3 }, options);
      const result2 = await runtime.execute("add", { a: 2, b: 3 }, options);

      expect(result1.output).toBe(5);
      expect(result2.output).toBe(5);
      expect(result1.fromCache).toBe(false);
      expect(result2.fromCache).toBe(true);
      expect(result2.attempts).toBe(1);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("does not use cache when idempotencyKey differs", async () => {
      const handler = vi.fn(async ({ a, b }: { a: number; b: number }) => a + b);
      registry.register("add", addToolSchema, handler);

      const result1 = await runtime.execute("add", { a: 2, b: 3 }, {
        idempotencyKey: "key-1",
        runId: "run-1",
        nodeExecutionId: 1,
      });
      const result2 = await runtime.execute("add", { a: 2, b: 3 }, {
        idempotencyKey: "key-2",
        runId: "run-1",
        nodeExecutionId: 1,
      });

      expect(result1.fromCache).toBe(false);
      expect(result2.fromCache).toBe(false);
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it("does not use cache when store is not provided", async () => {
      const handler = vi.fn(async ({ a, b }: { a: number; b: number }) => a + b);
      registry.register("add", addToolSchema, handler);

      const runtimeWithoutStore = new ToolRuntime(registry);

      const result1 = await runtimeWithoutStore.execute("add", { a: 2, b: 3 }, {
        idempotencyKey: "key-1",
      });
      const result2 = await runtimeWithoutStore.execute("add", { a: 2, b: 3 }, {
        idempotencyKey: "key-1",
      });

      expect(result1.fromCache).toBe(false);
      expect(result2.fromCache).toBe(false);
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it("stores failed attempts but does not return them from cache", async () => {
      let attempts = 0;
      const flakyHandler = vi.fn(async () => {
        attempts++;
        if (attempts === 1) throw new Error("first attempt fails");
        return 42;
      });
      registry.register("flaky", {
        input: { type: "object", properties: {}, additionalProperties: false },
        output: { type: "number" },
      }, flakyHandler);

      const options = {
        idempotencyKey: "flaky-key",
        runId: "run-1",
        nodeExecutionId: 1,
        retryPolicy: { maxAttempts: 2, backoffMs: 5, jitter: false },
      };

      // First call: fails once, retries, succeeds
      const result1 = await runtime.execute("flaky", {}, options);
      expect(result1.output).toBe(42);
      expect(result1.attempts).toBe(2);
      expect(result1.fromCache).toBe(false);

      // Second call: should return cached success
      const result2 = await runtime.execute("flaky", {}, options);
      expect(result2.output).toBe(42);
      expect(result2.fromCache).toBe(true);
      expect(result2.attempts).toBe(1);
    });

    it("persists idempotency key with tool call record", async () => {
      const handler = vi.fn(async () => "result");
      registry.register("echo", {
        input: { type: "object", properties: {}, additionalProperties: false },
        output: { type: "string" },
      }, handler);

      await runtime.execute("echo", {}, {
        idempotencyKey: "persist-key",
        runId: "run-1",
        nodeExecutionId: 1,
      });

      const toolCalls = await store.getToolCalls("run-1");
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].idempotencyKey).toBe("persist-key");
      expect(toolCalls[0].toolName).toBe("echo");
      expect(toolCalls[0].status).toBe("success");
      expect(toolCalls[0].requestJson).toEqual({});
      expect(toolCalls[0].responseJson).toBe("result");
    });
  });

  describe("AC-4: retry config + idempotency key persistence", () => {
    let store: SQLiteStateStore;

    beforeEach(async () => {
      store = createTestStore();
      await initializeStore(store);
      runtime = new ToolRuntime(registry, store);
    });

    afterEach(async () => {
      await store.close();
    });

    it("retries with idempotency key and persists final success", async () => {
      let attempts = 0;
      const handler = vi.fn(async () => {
        attempts++;
        if (attempts < 2) throw new Error("temporary failure");
        return { echoed: "hello" };
      });
      registry.register("echo", echoToolSchema, handler);

      const options = {
        idempotencyKey: "ac4-test",
        runId: "run-ac4",
        nodeExecutionId: 1,
        retryPolicy: { maxAttempts: 3, backoffMs: 10, jitter: false },
      };

      const result = await runtime.execute("echo", { message: "hello" }, options);

      expect(result.output).toEqual({ echoed: "hello" });
      expect(result.attempts).toBe(2);

      // Verify persistence
      const toolCalls = await store.getToolCalls("run-ac4");
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].idempotencyKey).toBe("ac4-test");
      expect(toolCalls[0].status).toBe("success");
      expect(toolCalls[0].responseJson).toEqual({ echoed: "hello" });
    });

    it("subsequent call with same key returns cached result without retry", async () => {
      let attempts = 0;
      const handler = vi.fn(async () => {
        attempts++;
        return { echoed: "cached" };
      });
      registry.register("echo2", echoToolSchema, handler);

      const options = {
        idempotencyKey: "ac4-cached",
        runId: "run-ac4",
        nodeExecutionId: 2,
      };

      // First call
      const result1 = await runtime.execute("echo2", { message: "cached" }, options);
      expect(result1.output).toEqual({ echoed: "cached" });
      expect(result1.fromCache).toBe(false);
      expect(attempts).toBe(1);

      // Second call - should use cache
      const result2 = await runtime.execute("echo2", { message: "cached" }, options);
      expect(result2.output).toEqual({ echoed: "cached" });
      expect(result2.fromCache).toBe(true);
      expect(result2.attempts).toBe(1);
      expect(attempts).toBe(1); // Handler not called again
    });
  });
});

describe("Default registry", () => {
  afterEach(() => {
    // Reset default registry
    const freshRegistry = new ToolRegistry();
    setDefaultRegistry(freshRegistry);
  });

  it("provides a singleton default registry", () => {
    const reg1 = getDefaultRegistry();
    const reg2 = getDefaultRegistry();
    expect(reg1).toBe(reg2);
  });

  it("allows setting custom default registry", () => {
    const custom = new ToolRegistry();
    setDefaultRegistry(custom);
    expect(getDefaultRegistry()).toBe(custom);
  });
});

const searchArgsSchema = {
  input: {
    type: "object",
    properties: {
      packId: { type: "string" },
      query: { type: "string" },
    },
    required: ["packId", "query"],
    additionalProperties: false,
  },
  output: {
    type: "object",
  },
};

const wrappedArgsSchema = {
  input: {
    type: "object",
    properties: {
      search_args: { type: "object" },
    },
    required: ["search_args"],
  },
  output: {
    type: "object",
  },
};

/** ToolExecutor does not walk graph topology; compiledGraph is a type stub. */
function stubCompiledGraph(): CompiledGraph {
  return {
    graphId: "test",
    nodes: new Map(),
    edges: [],
    entryNodeId: "start",
    terminalNodeIds: [],
    adjacency: new Map(),
    definition: { nodes: [], edges: [] },
  };
}

function createExecutorContext(channelUpdates: Record<string, unknown>): ExecutionContext {
  const channels = createInitialChannels({});
  mergeChannels(channels, channelUpdates);
  return {
    compiledGraph: stubCompiledGraph(),
    channels,
    metadata: {
      runId: "run-1",
      graphId: "test",
      status: "running",
      createdAt: new Date().toISOString(),
      input: {},
      nodeHistory: [],
    },
    abortSignal: new AbortController().signal,
    runId: "run-1",
    threadId: undefined,
    attempt: 1,
  };
}

describe("ToolExecutor inputFrom", () => {
  it("passes the channel object as tool args when inputFrom is set", async () => {
    const registry = new ToolRegistry();
    const handler = vi.fn(async (input: { packId: string; query: string }) => input);
    registry.register("search_clause", searchArgsSchema, handler);

    const executor = new ToolExecutor(new ToolRuntime(registry));
    const args = { packId: "p1", query: "1.1" };
    const node: GraphNode = {
      id: "search",
      type: "tool",
      config: { toolName: "search_clause", inputFrom: "search_args" },
    };

    const result = await executor.execute(node, createExecutorContext({ search_args: args }));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(args);
    expect(result.updates.search).toEqual(args);
  });

  it("wraps channel values by name when inputFrom is unset", async () => {
    const registry = new ToolRegistry();
    const handler = vi.fn(async (input: { search_args: { packId: string; query: string } }) => input);
    registry.register("search_clause", wrappedArgsSchema, handler);

    const executor = new ToolExecutor(new ToolRuntime(registry));
    const args = { packId: "p1", query: "1.1" };
    const node: GraphNode = {
      id: "search",
      type: "tool",
      config: { toolName: "search_clause", inputChannels: ["search_args"] },
    };

    const result = await executor.execute(node, createExecutorContext({ search_args: args }));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ search_args: args });
    expect(result.updates.search).toEqual({ search_args: args });
  });
});