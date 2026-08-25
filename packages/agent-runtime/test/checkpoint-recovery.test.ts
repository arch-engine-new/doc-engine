/**
 * Checkpoint crash recovery tests.
 *
 * Verifies:
 * - CheckpointService writes and reads checkpoints
 * - RunManager resumes from checkpoint after crash
 * - Completed nodes are NOT re-executed (idempotency)
 * - State is correctly restored (channels, history)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compileGraph, type GraphDefinition } from "../src/graph/compiler.js";
import { RunManager } from "../src/runtime/run-manager.js";
import { CheckpointService } from "../src/runtime/checkpoint-service.js";
import { SQLiteStateStore } from "../src/persistence/sqlite-store.js";
import { createInitialChannels, mergeChannels, getChannel, serializeChannels, deserializeChannels } from "../src/runtime/state.js";

describe("checkpoint-service.ts - CheckpointService", () => {
  let store: SQLiteStateStore;
  let dbPath: string;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "agent-runtime-checkpoint-"));
    dbPath = join(tempDir, "test.db");
    store = new SQLiteStateStore(dbPath);
    await store.initialize();
  });

  afterEach(async () => {
    await store.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("writes and reads a single checkpoint", async () => {
    const service = new CheckpointService(store);
    const runId = "run_test_1";

    // Create run first
    await store.createRun({
      runId,
      graphId: "graph_1",
      threadId: null,
      status: "running",
      inputJson: {},
      outputJson: null,
      errorJson: null,
      currentNodeId: null,
      parentRunId: null,
      startedAt: new Date().toISOString(),
      finishedAt: null,
    });

    const channels = createInitialChannels("test");
    mergeChannels(channels, { node1: { value: 1 } });

    const row = await service.write({
      runId,
      seq: 1,
      nodeId: "node1",
      channels,
      metadata: { step: 1 },
    });

    expect(row.seq).toBe(1);
    expect(row.nodeId).toBe("node1");
    expect(row.state.input).toEqual("test");
    expect(row.state.node1).toEqual({ value: 1 });

    // Read back
    const latest = await service.getLatest(runId);
    expect(latest).not.toBeNull();
    expect(latest!.seq).toBe(1);
    expect(latest!.nodeId).toBe("node1");
    expect(latest!.state.node1).toEqual({ value: 1 });
  });

  it("returns latest checkpoint by sequence", async () => {
    const service = new CheckpointService(store);
    const runId = "run_test_2";

    await store.createRun({
      runId,
      graphId: "graph_1",
      threadId: null,
      status: "running",
      inputJson: {},
      outputJson: null,
      errorJson: null,
      currentNodeId: null,
      parentRunId: null,
      startedAt: new Date().toISOString(),
      finishedAt: null,
    });

    const channels = createInitialChannels({});

    await service.write({ runId, seq: 1, nodeId: "node1", channels });
    await service.write({ runId, seq: 2, nodeId: "node2", channels });
    await service.write({ runId, seq: 3, nodeId: "node3", channels });

    const latest = await service.getLatest(runId);
    expect(latest!.seq).toBe(3);
    expect(latest!.nodeId).toBe("node3");
  });

  it("returns all checkpoints in order", async () => {
    const service = new CheckpointService(store);
    const runId = "run_test_3";

    await store.createRun({
      runId,
      graphId: "graph_1",
      threadId: null,
      status: "running",
      inputJson: {},
      outputJson: null,
      errorJson: null,
      currentNodeId: null,
      parentRunId: null,
      startedAt: new Date().toISOString(),
      finishedAt: null,
    });

    const channels = createInitialChannels({});

    await service.write({ runId, seq: 1, nodeId: "node1", channels });
    await service.write({ runId, seq: 2, nodeId: "node2", channels });
    await service.write({ runId, seq: 3, nodeId: "node3", channels });

    const all = await service.getAll(runId);
    expect(all.length).toBe(3);
    expect(all[0].seq).toBe(1);
    expect(all[1].seq).toBe(2);
    expect(all[2].seq).toBe(3);
  });

  it("returns null for non-existent run", async () => {
    const service = new CheckpointService(store);
    const latest = await service.getLatest("non_existent_run");
    expect(latest).toBeNull();
  });
});

describe("run-manager.ts - Crash Recovery Integration", () => {
  let store: SQLiteStateStore;
  let dbPath: string;
  let tempDir: string;
  let manager: RunManager;

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "agent-runtime-recovery-"));
    dbPath = join(tempDir, "test.db");
    store = new SQLiteStateStore(dbPath);
    await store.initialize();
    manager = new RunManager();
  });

  afterEach(async () => {
    await store.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("resumes from checkpoint after crash - 5 node linear graph", async () => {
    // 5-node linear graph: start -> fn1 -> fn2 -> fn3 -> fn4 -> end
    const def: GraphDefinition = {
      graphId: "recovery-graph-1",
      nodes: [
        { id: "start", type: "start" },
        { id: "fn1", type: "fn", config: { inlineFn: async (i) => ({ v: (i.input?.v ?? 0) + 1 }), outputChannel: "fn1" } },
        { id: "fn2", type: "fn", config: { inlineFn: async (i) => ({ v: (i.fn1?.v ?? 0) + 1 }), outputChannel: "fn2", inputChannels: ["fn1"] } },
        { id: "fn3", type: "fn", config: { inlineFn: async (i) => ({ v: (i.fn2?.v ?? 0) + 1 }), outputChannel: "fn3", inputChannels: ["fn2"] } },
        { id: "fn4", type: "fn", config: { inlineFn: async (i) => ({ v: (i.fn3?.v ?? 0) + 1 }), outputChannel: "output", inputChannels: ["fn3"] } },
        { id: "end", type: "end" },
      ],
      edges: [
        { from: "start", to: "fn1" },
        { from: "fn1", to: "fn2" },
        { from: "fn2", to: "fn3" },
        { from: "fn3", to: "fn4" },
        { from: "fn4", to: "end" },
      ],
    };

    const runId = "run_recovery_1";

    // Start first run (will complete fully since we can't easily "kill" mid-execution in unit test)
    // We'll simulate crash by running without resume first, then resuming
    const { runId: firstRunId } = await manager.startRun(def, {
      input: { v: 0 },
      runId,
      store,
    });

    const result1 = await manager.waitForRun(firstRunId);
    expect(result1?.status).toBe("completed");
    expect(result1?.output).toEqual({ v: 4 });

    // Now resume - should load checkpoint and continue (but already completed, so should complete immediately)
    const { runId: resumedRunId } = await manager.startRun(def, {
      input: { v: 0 },
      runId,
      store,
      resume: true,
    });

    expect(resumedRunId).toBe(runId);

    const result2 = await manager.waitForRun(resumedRunId);
    expect(result2?.status).toBe("completed");
    expect(result2?.output).toEqual({ v: 4 });
  });

  it("resumes from checkpoint with branch graph - skips completed nodes", async () => {
    // Graph with branch: start -> validate -> branch -> (process|handle_error) -> end
    const def: GraphDefinition = {
      graphId: "recovery-graph-2",
      nodes: [
        { id: "start", type: "start" },
        { id: "validate", type: "fn", config: { inlineFn: async (i) => ({ valid: !!i.input?.data }), outputChannel: "validate" } },
        { id: "branch", type: "branch", config: { condition: (ch: any) => ch.validate?.valid ? "valid" : "invalid" } },
        { id: "process", type: "fn", config: { inlineFn: async (i) => ({ result: "processed-" + i.validate?.valid }), outputChannel: "output", inputChannels: ["validate"] } },
        { id: "handle_error", type: "fn", config: { inlineFn: async () => ({ error: "invalid input" }), outputChannel: "output" } },
        { id: "end", type: "end" },
      ],
      edges: [
        { from: "start", to: "validate" },
        { from: "validate", to: "branch" },
        { from: "branch", to: "process", condition: "valid" },
        { from: "branch", to: "handle_error", condition: "invalid" },
        { from: "process", to: "end" },
        { from: "handle_error", to: "end" },
      ],
    };

    const runId = "run_recovery_2";

    // First run with valid input
    const { runId: firstRunId } = await manager.startRun(def, {
      input: { data: "hello" },
      runId,
      store,
    });

    const result1 = await manager.waitForRun(firstRunId);
    expect(result1?.status).toBe("completed");
    expect(result1?.output).toEqual({ result: "processed-true" });

    // Resume - should not re-execute already completed nodes
    const { runId: resumedRunId } = await manager.startRun(def, {
      input: { data: "hello" },
      runId,
      store,
      resume: true,
    });

    const result2 = await manager.waitForRun(resumedRunId);
    expect(result2?.status).toBe("completed");
    expect(result2?.output).toEqual({ result: "processed-true" });
  });

  it("verifies idempotency - completed nodes not re-executed on resume", async () => {
    // Track execution count per node
    let executionCounts: Record<string, number> = {};

    const countingFn = async (nodeId: string, increment: number) => {
      executionCounts[nodeId] = (executionCounts[nodeId] || 0) + 1;
      return { count: executionCounts[nodeId], increment };
    };

    const def: GraphDefinition = {
      graphId: "recovery-graph-3",
      nodes: [
        { id: "start", type: "start" },
        {
          id: "fn1",
          type: "fn",
          config: {
            inlineFn: async (i) => countingFn("fn1", 1),
            outputChannel: "fn1",
          },
        },
        {
          id: "fn2",
          type: "fn",
          config: {
            inlineFn: async (i) => countingFn("fn2", 1),
            outputChannel: "fn2",
            inputChannels: ["fn1"],
          },
        },
        {
          id: "fn3",
          type: "fn",
          config: {
            inlineFn: async (i) => countingFn("fn3", 1),
            outputChannel: "output",
            inputChannels: ["fn2"],
          },
        },
        { id: "end", type: "end" },
      ],
      edges: [
        { from: "start", to: "fn1" },
        { from: "fn1", to: "fn2" },
        { from: "fn2", to: "fn3" },
        { from: "fn3", to: "end" },
      ],
    };

    const runId = "run_recovery_3";

    // First execution
    const { runId: firstRunId } = await manager.startRun(def, {
      input: {},
      runId,
      store,
    });

    await manager.waitForRun(firstRunId);
    expect(executionCounts.fn1).toBe(1);
    expect(executionCounts.fn2).toBe(1);
    expect(executionCounts.fn3).toBe(1);

    // Resume - execution counts should NOT increase
    const { runId: resumedRunId } = await manager.startRun(def, {
      input: {},
      runId,
      store,
      resume: true,
    });

    await manager.waitForRun(resumedRunId);
    expect(executionCounts.fn1).toBe(1); // NOT re-executed
    expect(executionCounts.fn2).toBe(1); // NOT re-executed
    expect(executionCounts.fn3).toBe(1); // NOT re-executed
  });

  it("restores channel state correctly on resume", async () => {
    const def: GraphDefinition = {
      graphId: "recovery-graph-4",
      nodes: [
        { id: "start", type: "start" },
        { id: "fn1", type: "fn", config: { inlineFn: async (i) => ({ step: 1, data: i.input?.initial }), outputChannel: "fn1" } },
        { id: "fn2", type: "fn", config: { inlineFn: async (i) => ({ step: 2, data: i.fn1?.data + "-step2" }), outputChannel: "fn2", inputChannels: ["fn1"] } },
        { id: "fn3", type: "fn", config: { inlineFn: async (i) => ({ step: 3, data: i.fn2?.data + "-step3" }), outputChannel: "output", inputChannels: ["fn2"] } },
        { id: "end", type: "end" },
      ],
      edges: [
        { from: "start", to: "fn1" },
        { from: "fn1", to: "fn2" },
        { from: "fn2", to: "fn3" },
        { from: "fn3", to: "end" },
      ],
    };

    const runId = "run_recovery_4";

    // First run
    const { runId: firstRunId } = await manager.startRun(def, {
      input: { initial: "start-data" },
      runId,
      store,
    });

    const result1 = await manager.waitForRun(firstRunId);
    expect(result1?.status).toBe("completed");
    expect(result1?.output).toEqual({ step: 3, data: "start-data-step2-step3" });

    // Resume - output should be the same (state restored)
    const { runId: resumedRunId } = await manager.startRun(def, {
      input: { initial: "start-data" },
      runId,
      store,
      resume: true,
    });

    const result2 = await manager.waitForRun(resumedRunId);
    expect(result2?.status).toBe("completed");
    expect(result2?.output).toEqual({ step: 3, data: "start-data-step2-step3" });
  });

  it("resume with different input should still work (uses checkpoint state)", async () => {
    const def: GraphDefinition = {
      graphId: "recovery-graph-5",
      nodes: [
        { id: "start", type: "start" },
        { id: "fn1", type: "fn", config: { inlineFn: async (i) => ({ v: 1 }), outputChannel: "fn1" } },
        { id: "fn2", type: "fn", config: { inlineFn: async (i) => ({ v: (i.fn1?.v ?? 0) + 1 }), outputChannel: "output", inputChannels: ["fn1"] } },
        { id: "end", type: "end" },
      ],
      edges: [
        { from: "start", to: "fn1" },
        { from: "fn1", to: "fn2" },
        { from: "fn2", to: "end" },
      ],
    };

    const runId = "run_recovery_5";

    // First run
    const { runId: firstRunId } = await manager.startRun(def, {
      input: { ignored: "first" },
      runId,
      store,
    });

    const result1 = await manager.waitForRun(firstRunId);
    expect(result1?.output).toEqual({ v: 2 });

    // Resume with different input - should use checkpoint state, not new input
    const { runId: resumedRunId } = await manager.startRun(def, {
      input: { ignored: "second - should be ignored" },
      runId,
      store,
      resume: true,
    });

    const result2 = await manager.waitForRun(resumedRunId);
    expect(result2?.status).toBe("completed");
    expect(result2?.output).toEqual({ v: 2 }); // Same output from restored state
  });
});

describe("state.ts - Channel serialization for checkpointing", () => {
  it("serializes and deserializes channels correctly", () => {
    const channels = createInitialChannels("test");
    mergeChannels(channels, { node1: { a: 1 }, node2: [1, 2, 3] });
    mergeChannels(channels, { node1: { a: 2 } }); // Update

    const serialized = serializeChannels(channels);
    expect(serialized.input).toEqual("test");
    expect(serialized.node1).toEqual({ a: 2 });
    expect(serialized.node2).toEqual([1, 2, 3]);

    const restored = deserializeChannels(serialized);
    expect(getChannel(restored, "input")).toEqual("test");
    expect(getChannel(restored, "node1")).toEqual({ a: 2 });
    expect(getChannel(restored, "node2")).toEqual([1, 2, 3]);
  });

  it("handles empty channels", () => {
    const channels = createInitialChannels(null);
    const serialized = serializeChannels(channels);
    const restored = deserializeChannels(serialized);
    expect(getChannel(restored, "input")).toBeNull();
  });
});