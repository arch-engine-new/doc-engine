/**
 * Tests for SQLiteStateStore and migration.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync, unlinkSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runMigration, isMigrated } from "../src/persistence/migrate.js";
import { SQLiteStateStore } from "../src/persistence/sqlite-store.js";
import type { StoredRun, StoredCheckpoint, StoredRunEvent } from "../src/persistence/types.js";

describe("SQLite Migration", () => {
  let dbPath: string;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "agent-runtime-test-"));
    dbPath = join(tempDir, "test.db");
  });

  afterEach(() => {
    try { unlinkSync(dbPath); } catch {}
    try { unlinkSync(tempDir); } catch {}
  });

  it("should create all 7 tables", async () => {
    await runMigration(dbPath);
    const migrated = await isMigrated(dbPath);
    expect(migrated).toBe(true);
  });

  it("should be idempotent (safe to run twice)", async () => {
    await runMigration(dbPath);
    await runMigration(dbPath); // Should not throw
    const migrated = await isMigrated(dbPath);
    expect(migrated).toBe(true);
  });
});

describe("SQLiteStateStore", () => {
  let store: SQLiteStateStore;
  let dbPath: string;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "agent-runtime-test-"));
    dbPath = join(tempDir, "test.db");
    store = new SQLiteStateStore(dbPath);
    await store.initialize();
  });

  afterEach(async () => {
    await store.close();
    try { unlinkSync(dbPath); } catch {}
    try { unlinkSync(tempDir); } catch {}
  });

  describe("Run CRUD", () => {
    it("should create and get a run", async () => {
      const run: Omit<StoredRun, "createdAt" | "updatedAt" | "creator" | "updater" | "deleted"> = {
        runId: "run_123",
        graphId: "graph_1",
        threadId: "thread_1",
        status: "created",
        inputJson: { foo: "bar" },
        outputJson: null,
        errorJson: null,
        currentNodeId: null,
        parentRunId: null,
        startedAt: null,
        finishedAt: null,
      };

      await store.createRun(run);
      const retrieved = await store.getRun("run_123");

      expect(retrieved).not.toBeNull();
      expect(retrieved!.runId).toBe("run_123");
      expect(retrieved!.graphId).toBe("graph_1");
      expect(retrieved!.threadId).toBe("thread_1");
      expect(retrieved!.status).toBe("created");
      expect(retrieved!.inputJson).toEqual({ foo: "bar" });
    });

    it("should update run status and output", async () => {
      await store.createRun({
        runId: "run_456",
        graphId: "graph_1",
        threadId: null,
        status: "running",
        inputJson: { input: "test" },
        outputJson: null,
        errorJson: null,
        currentNodeId: "node_1",
        parentRunId: null,
        startedAt: new Date().toISOString(),
        finishedAt: null,
      });

      await store.updateRun("run_456", {
        status: "completed",
        outputJson: { result: "success" },
        finishedAt: new Date().toISOString(),
      });

      const retrieved = await store.getRun("run_456");
      expect(retrieved!.status).toBe("completed");
      expect(retrieved!.outputJson).toEqual({ result: "success" });
      expect(retrieved!.finishedAt).not.toBeNull();
    });

    it("should list runs with filters", async () => {
      await store.createRun({
        runId: "run_a",
        graphId: "graph_1",
        threadId: "thread_1",
        status: "completed",
        inputJson: {},
        outputJson: {},
        errorJson: null,
        currentNodeId: null,
        parentRunId: null,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      });

      await store.createRun({
        runId: "run_b",
        graphId: "graph_2",
        threadId: "thread_1",
        status: "running",
        inputJson: {},
        outputJson: null,
        errorJson: null,
        currentNodeId: "node_1",
        parentRunId: null,
        startedAt: new Date().toISOString(),
        finishedAt: null,
      });

      // Filter by graphId
      const byGraph = await store.listRuns({ graphId: "graph_1" });
      expect(byGraph.length).toBe(1);
      expect(byGraph[0].runId).toBe("run_a");

      // Filter by threadId
      const byThread = await store.listRuns({ threadId: "thread_1" });
      expect(byThread.length).toBe(2);

      // Filter by status
      const byStatus = await store.listRuns({ status: "completed" });
      expect(byStatus.length).toBe(1);
      expect(byStatus[0].runId).toBe("run_a");
    });

    it("should soft delete a run", async () => {
      await store.createRun({
        runId: "run_del",
        graphId: "graph_1",
        threadId: null,
        status: "created",
        inputJson: {},
        outputJson: null,
        errorJson: null,
        currentNodeId: null,
        parentRunId: null,
        startedAt: null,
        finishedAt: null,
      });

      await store.deleteRun("run_del");
      const retrieved = await store.getRun("run_del");
      expect(retrieved).toBeNull();
    });
  });

  describe("Checkpoint CRUD", () => {
    it("should create and get checkpoints", async () => {
      await store.createRun({
        runId: "run_cp",
        graphId: "graph_1",
        threadId: null,
        status: "running",
        inputJson: {},
        outputJson: null,
        errorJson: null,
        currentNodeId: "node_1",
        parentRunId: null,
        startedAt: new Date().toISOString(),
        finishedAt: null,
      });

      await store.createCheckpoint({
        runId: "run_cp",
        seq: 1,
        nodeId: "node_1",
        stateJson: { channels: { input: "test" } },
        metadataJson: { step: 1 },
      });

      await store.createCheckpoint({
        runId: "run_cp",
        seq: 2,
        nodeId: "node_2",
        stateJson: { channels: { input: "test", output: "result" } },
        metadataJson: { step: 2 },
      });

      const latest = await store.getLatestCheckpoint("run_cp");
      expect(latest).not.toBeNull();
      expect(latest!.seq).toBe(2);
      expect(latest!.stateJson).toEqual({ channels: { input: "test", output: "result" } });

      const bySeq = await store.getCheckpoint("run_cp", 1);
      expect(bySeq!.seq).toBe(1);

      const all = await store.listCheckpoints("run_cp");
      expect(all.length).toBe(2);
    });
  });

  describe("Event Log (Trace)", () => {
    it("should append events and get trace", async () => {
      await store.createRun({
        runId: "run_events",
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

      await store.appendEvent({
        runId: "run_events",
        seq: 1,
        eventType: "run.start",
        payloadJson: { runId: "run_events" },
      });

      await store.appendEvent({
        runId: "run_events",
        seq: 2,
        eventType: "node.start",
        payloadJson: { nodeId: "node_1" },
      });

      await store.appendEvent({
        runId: "run_events",
        seq: 3,
        eventType: "node.complete",
        payloadJson: { nodeId: "node_1", output: "result" },
      });

      const events = await store.getEvents("run_events");
      expect(events.length).toBe(3);
      expect(events[0].eventType).toBe("run.start");
      expect(events[1].eventType).toBe("node.start");
      expect(events[2].eventType).toBe("node.complete");

      // Get from sequence
      const fromSeq = await store.getEvents("run_events", 2);
      expect(fromSeq.length).toBe(2);
      expect(fromSeq[0].seq).toBe(2);
    });
  });

  describe("Node Execution", () => {
    it("should create and query node executions", async () => {
      await store.createRun({
        runId: "run_ne",
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

      const id1 = await store.createNodeExecution({
        runId: "run_ne",
        nodeId: "node_1",
        nodeType: "llm",
        attempt: 1,
        status: "completed",
        inputJson: { prompt: "hello" },
        outputJson: { text: "world" },
        errorJson: null,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      });

      expect(id1).toBeGreaterThan(0);

      const id2 = await store.createNodeExecution({
        runId: "run_ne",
        nodeId: "node_1",
        nodeType: "llm",
        attempt: 2,
        status: "failed",
        inputJson: { prompt: "hello" },
        outputJson: null,
        errorJson: { message: "rate limited" },
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      });

      expect(id2).toBeGreaterThan(id1);

      const executions = await store.getNodeExecutions("run_ne");
      expect(executions.length).toBe(2);
      expect(executions[0].attempt).toBe(1);
      expect(executions[1].attempt).toBe(2);

      const specific = await store.getNodeExecution("run_ne", "node_1", 1);
      expect(specific).not.toBeNull();
      expect(specific!.status).toBe("completed");
    });
  });

  describe("Tool Calls", () => {
    it("should create tool calls and lookup by idempotency key", async () => {
      await store.createRun({
        runId: "run_tc",
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

      await store.createToolCall({
        runId: "run_tc",
        nodeExecutionId: 1,
        toolName: "search",
        idempotencyKey: "idem_123",
        requestJson: { query: "test" },
        responseJson: null,
        status: "pending",
        errorJson: null,
        durationMs: null,
      });

      const byKey = await store.getToolCallByIdempotencyKey("idem_123");
      expect(byKey).not.toBeNull();
      expect(byKey!.toolName).toBe("search");
      expect(byKey!.idempotencyKey).toBe("idem_123");

      // Update with response
      await store.updateToolCall(byKey!.id, {
        responseJson: { results: ["a", "b"] },
        status: "completed",
        durationMs: 150,
      });

      const updated = await store.getToolCallByIdempotencyKey("idem_123");
      expect(updated!.status).toBe("completed");
      expect(updated!.responseJson).toEqual({ results: ["a", "b"] });
      expect(updated!.durationMs).toBe(150);
    });
  });

  describe("HITL Interrupts", () => {
    it("should create and resume interrupts", async () => {
      await store.createRun({
        runId: "run_hitl",
        graphId: "graph_1",
        threadId: null,
        status: "running",
        inputJson: {},
        outputJson: null,
        errorJson: null,
        currentNodeId: "hitl_node",
        parentRunId: null,
        startedAt: new Date().toISOString(),
        finishedAt: null,
      });

      await store.createHitlInterrupt({
        runId: "run_hitl",
        nodeId: "hitl_node",
        token: "token_abc",
        status: "pending",
        payloadJson: { question: "Approve?" },
        decisionJson: null,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        resumedAt: null,
      });

      const interrupt = await store.getHitlInterruptByToken("token_abc");
      expect(interrupt).not.toBeNull();
      expect(interrupt!.status).toBe("pending");

      await store.updateHitlInterrupt("token_abc", {
        status: "resolved",
        decisionJson: { approved: true },
        resumedAt: new Date().toISOString(),
      });

      const resolved = await store.getHitlInterruptByToken("token_abc");
      expect(resolved!.status).toBe("resolved");
      expect(resolved!.decisionJson).toEqual({ approved: true });
      expect(resolved!.resumedAt).not.toBeNull();
    });
  });

  describe("Graph Operations", () => {
    it("should upsert and get graphs", async () => {
      await store.upsertGraph({
        graphId: "graph_test",
        name: "Test Graph",
        version: 1,
        defJson: { nodes: [], edges: [] },
        status: 1,
      });

      const graph = await store.getGraph("graph_test");
      expect(graph).not.toBeNull();
      expect(graph!.name).toBe("Test Graph");
      expect(graph!.defJson).toEqual({ nodes: [], edges: [] });

      // Update
      await store.upsertGraph({
        graphId: "graph_test",
        name: "Updated Graph",
        version: 2,
        defJson: { nodes: [{ id: "n1" }], edges: [] },
        status: 1,
      });

      const updated = await store.getGraph("graph_test");
      expect(updated!.name).toBe("Updated Graph");
      expect(updated!.version).toBe(2);
    });
  });
});