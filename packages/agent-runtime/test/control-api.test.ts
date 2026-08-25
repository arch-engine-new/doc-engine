/**
 * Control API tests: compileGraph + startRun + getRun + getTrace flow,
 * HITL resume through control API, event log contains all event types,
 * AC-5: trace replay by runId, AC-7: public API has types + tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { compileGraph, type GraphDefinition } from "../src/graph/compiler.js";
import { SQLiteStateStore } from "../src/persistence/sqlite-store.js";
import { runMigrationOnDb } from "../src/persistence/migrate.js";
import { ControlPlane, createControlPlane } from "../src/api/control.js";
import { EventLog, type EventRow, type EventType } from "../src/obs/event-log.js";
import { HitlGateway, type HitlDecision } from "../src/hitl/gateway.js";
import { getDefaultRegistry } from "../src/tools/runtime.js";
import type { StateStore } from "../src/persistence/types.js";
import type { RunStatus, SchedulerResult, NodeExecutionRecord } from "../src/runtime/state.js";

const TEST_DB = ":memory:";

async function createTestStore(): Promise<SQLiteStateStore> {
  const store = new SQLiteStateStore(TEST_DB);
  await store.initialize();
  runMigrationOnDb(store["db"]);
  return store;
}

/** Poll until an event of the given type appears in the run trace (max ~400ms). */
async function waitForEvent(
  plane: ControlPlane,
  runId: string,
  eventType: EventType,
): Promise<EventRow | undefined> {
  for (let i = 0; i < 80; i++) {
    const trace = await plane.getTrace(runId);
    const row = trace.find((e) => e.eventType === eventType);
    if (row) return row;
    await new Promise((r) => setTimeout(r, 5));
  }
  return undefined;
}

describe("obs/event-log.ts - EventLog", () => {
  let store: StateStore;
  let eventLog: EventLog;

  beforeEach(async () => {
    store = await createTestStore();
    eventLog = new EventLog(store);
  });

  afterEach(async () => {
    await store.close();
  });

  it("appends and retrieves events in order", async () => {
    const runId = "test-run-1";

    await eventLog.append({ runId, eventType: "node_start", payload: { nodeId: "n1", nodeType: "fn" } });
    await eventLog.append({ runId, eventType: "node_end", payload: { nodeId: "n1", nodeType: "fn", status: "completed" } });
    await eventLog.append({ runId, eventType: "run_completed", payload: { output: { result: 42 } } });

    const trace = await eventLog.getTrace(runId);
    expect(trace).toHaveLength(3);
    expect(trace[0].eventType).toBe("node_start");
    expect(trace[1].eventType).toBe("node_end");
    expect(trace[2].eventType).toBe("run_completed");
    expect(trace[0].seq).toBe(1);
    expect(trace[1].seq).toBe(2);
    expect(trace[2].seq).toBe(3);
  });

  it("convenience methods append correct event types", async () => {
    const runId = "test-run-2";

    await eventLog.appendNodeStart(runId, "n1", "fn", { input: "test" }, 1);
    await eventLog.appendNodeEnd(runId, "n1", "fn", { output: "done" }, "completed", undefined, 1);
    await eventLog.appendToolCall(runId, "n1", "myTool", { arg: 1 }, { result: 2 }, "completed", undefined, 10, "idem-1");
    await eventLog.appendCheckpoint(runId, "n1", 5, { phase: "node_complete" });
    await eventLog.appendHitl(runId, "hitl1", "token-123", "created", { message: "Please approve" });
    await eventLog.appendRunCompleted(runId, { final: true }, 1000, 3);
    await eventLog.appendRunFailed(runId, { message: "Error", code: "ERR" }, 500, 2);
    await eventLog.appendRunCancelled(runId, "User cancelled", 300, 1);

    const trace = await eventLog.getTrace(runId);
    const types = trace.map((e) => e.eventType);
    expect(types).toEqual([
      "node_start",
      "node_end",
      "tool_call",
      "checkpoint",
      "hitl",
      "run_completed",
      "run_failed",
      "run_cancelled",
    ]);
  });

  it("getEventsFrom returns events from sequence", async () => {
    const runId = "test-run-3";

    for (let i = 1; i <= 5; i++) {
      await eventLog.append({ runId, eventType: "node_start", payload: { seq: i } });
    }

    const from3 = await eventLog.getEventsFrom(runId, 3);
    expect(from3).toHaveLength(3);
    expect(from3[0].seq).toBe(3);
    expect(from3[2].seq).toBe(5);
  });

  it("getLatestSeq returns highest sequence", async () => {
    const runId = "test-run-4";

    expect(await eventLog.getLatestSeq(runId)).toBe(0);

    await eventLog.append({ runId, eventType: "node_start", payload: {} });
    await eventLog.append({ runId, eventType: "node_end", payload: {} });

    expect(await eventLog.getLatestSeq(runId)).toBe(2);
  });

  it("resetSeqCache loads latest sequence from store", async () => {
    const runId = "test-run-5";

    await eventLog.append({ runId, eventType: "node_start", payload: {} });
    await eventLog.append({ runId, eventType: "node_end", payload: {} });

    // Create new EventLog instance (simulating restart)
    const newEventLog = new EventLog(store);
    await newEventLog.resetSeqCache(runId);

    // Next append should continue from 3
    const row = await newEventLog.append({ runId, eventType: "checkpoint", payload: {} });
    expect(row.seq).toBe(3);
  });
});

describe("api/control.ts - ControlPlane", () => {
  let store: SQLiteStateStore;
  let controlPlane: ControlPlane;

  beforeEach(async () => {
    store = await createTestStore();
    controlPlane = await createControlPlane(store);
  });

  afterEach(async () => {
    await store.close();
  });

  describe("compileGraph", () => {
    it("compiles a valid graph definition and returns graphId", () => {
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

      const result = controlPlane.compileGraph({ definition: def });

      expect(result.graphId).toBeDefined();
      expect(result.compiled).toBeDefined();
      expect(result.compiled.graphId).toBe(result.graphId);
      expect(result.compiled.nodes.size).toBe(3);
    });

    it("uses provided graphId", () => {
      const def: GraphDefinition = {
        graphId: "my-custom-graph",
        nodes: [{ id: "start", type: "start" }, { id: "end", type: "end" }],
        edges: [{ from: "start", to: "end" }],
      };

      const result = controlPlane.compileGraph({ definition: def });
      expect(result.graphId).toBe("my-custom-graph");
    });

    it("throws GraphCompileError for invalid graph", () => {
      const def: GraphDefinition = {
        nodes: [
          { id: "start", type: "start" },
          { id: "fn1", type: "fn", config: { inlineFn: async () => ({}), outputChannel: "out" } },
          { id: "fn2", type: "fn", config: { inlineFn: async () => ({}), outputChannel: "out" } },
        ],
        edges: [
          { from: "start", to: "fn1" },
          { from: "fn1", to: "fn2" },
          { from: "fn2", to: "fn1" }, // Cycle
        ],
      };

      expect(() => controlPlane.compileGraph({ definition: def })).toThrow();
    });

    it("caches compiled graph", () => {
      const def: GraphDefinition = {
        graphId: "cached-graph",
        nodes: [{ id: "start", type: "start" }, { id: "end", type: "end" }],
        edges: [{ from: "start", to: "end" }],
      };

      controlPlane.compileGraph({ definition: def });
      const cached = controlPlane.getCompiledGraph("cached-graph");

      expect(cached).toBeDefined();
      expect(cached?.graphId).toBe("cached-graph");
    });
  });

  describe("startRun + getRun + getTrace flow", () => {
    it("starts a run, gets metadata, and retrieves trace", async () => {
      const def: GraphDefinition = {
        graphId: "test-graph-1",
        nodes: [
          { id: "start", type: "start" },
          { id: "fn1", type: "fn", config: { inlineFn: async (i) => ({ value: (i.input?.x ?? 0) + 1 }), outputChannel: "output" } },
          { id: "end", type: "end" },
        ],
        edges: [
          { from: "start", to: "fn1" },
          { from: "fn1", to: "end" },
        ],
      };

      controlPlane.compileGraph({ definition: def });

      const startResult = await controlPlane.startRun({
        graphId: "test-graph-1",
        input: { x: 5 },
      });

      expect(startResult.runId).toMatch(/^run_/);
      expect(startResult.status).toBe("running");

      // Wait for completion
      const runManager = controlPlane.getRunManager();
      const schedulerResult = await runManager.waitForRun(startResult.runId);
      expect(schedulerResult?.status).toBe("completed");
      expect(schedulerResult?.output).toEqual({ value: 6 });

      // Get run view with trace
      const runView = await controlPlane.getRun(startResult.runId);
      expect(runView).toBeDefined();
      expect(runView?.metadata.runId).toBe(startResult.runId);
      expect(runView?.metadata.status).toBe("completed");
      expect(runView?.metadata.output).toEqual({ value: 6 });

      // Verify trace contains all event types
      const trace = runView?.trace ?? [];
      const eventTypes = trace.map((e) => e.eventType);
      expect(eventTypes).toContain("node_start");
      expect(eventTypes).toContain("node_end");
      expect(eventTypes).toContain("run_completed");
    });

    it("startRun with threadId stores threadId", async () => {
      const def: GraphDefinition = {
        graphId: "test-graph-thread",
        nodes: [{ id: "start", type: "start" }, { id: "end", type: "end" }],
        edges: [{ from: "start", to: "end" }],
      };

      controlPlane.compileGraph({ definition: def });

      const result = await controlPlane.startRun({
        graphId: "test-graph-thread",
        input: {},
        threadId: "thread-123",
      });

      const runManager = controlPlane.getRunManager();
      await runManager.waitForRun(result.runId);

      const runView = await controlPlane.getRun(result.runId);
      expect(runView?.metadata.threadId).toBe("thread-123");
    });

    it("startRun with custom runId uses provided ID", async () => {
      const def: GraphDefinition = {
        graphId: "test-graph-custom-id",
        nodes: [{ id: "start", type: "start" }, { id: "end", type: "end" }],
        edges: [{ from: "start", to: "end" }],
      };

      controlPlane.compileGraph({ definition: def });

      const result = await controlPlane.startRun({
        graphId: "test-graph-custom-id",
        input: {},
        runId: "my-custom-run-id",
      });

      const runManager = controlPlane.getRunManager();
      await runManager.waitForRun(result.runId);

      expect(result.runId).toBe("my-custom-run-id");
    });
  });

  describe("cancelRun", () => {
    it("cancels a running run", async () => {
      const def: GraphDefinition = {
        graphId: "test-graph-cancel",
        nodes: [
          { id: "start", type: "start" },
          { id: "fn1", type: "fn", config: { inlineFn: async () => { await new Promise(r => setTimeout(r, 500)); return {}; }, outputChannel: "out" } },
          { id: "end", type: "end" },
        ],
        edges: [{ from: "start", to: "fn1" }, { from: "fn1", to: "end" }],
      };

      controlPlane.compileGraph({ definition: def });

      const { runId } = await controlPlane.startRun({ graphId: "test-graph-cancel", input: {} });

      // Cancel immediately
      const cancelled = await controlPlane.cancelRun(runId);
      expect(cancelled).toBe(true);

      const runManager = controlPlane.getRunManager();
      const result = await runManager.waitForRun(runId);
      expect(result?.status).toBe("cancelled");

      // Verify cancellation event in trace
      const cancelledEvent = await waitForEvent(controlPlane, runId, "run_cancelled");
      expect(cancelledEvent).toBeDefined();
      const runView = await controlPlane.getRun(runId);
      const trace = runView?.trace ?? [];
      expect(trace.filter((e) => e.eventType === "run_cancelled")).toHaveLength(1);
    });

    it("returns false for non-existent run", async () => {
      const cancelled = await controlPlane.cancelRun("non-existent-run");
      expect(cancelled).toBe(false);
    });

    it("returns false for already completed run", async () => {
      const def: GraphDefinition = {
        graphId: "test-graph-completed",
        nodes: [{ id: "start", type: "start" }, { id: "end", type: "end" }],
        edges: [{ from: "start", to: "end" }],
      };

      controlPlane.compileGraph({ definition: def });

      const { runId } = await controlPlane.startRun({ graphId: "test-graph-completed", input: {} });
      const runManager = controlPlane.getRunManager();
      await runManager.waitForRun(runId);

      const cancelled = await controlPlane.cancelRun(runId);
      expect(cancelled).toBe(false);
    });
  });

  describe("HITL resume through control API", () => {
    it("creates HITL interrupt and resumes via control API", async () => {
      const def: GraphDefinition = {
        graphId: "test-graph-hitl",
        nodes: [
          { id: "start", type: "start" },
          { id: "hitl1", type: "hitl", config: { payload: { message: "Approve?" } } },
          { id: "fn1", type: "fn", config: { inlineFn: async (i) => ({ approved: i.hitl_decision_hitl1?.action === "approve" }), inputChannels: ["input", "hitl_decision_hitl1"], outputChannel: "output" } },
          { id: "end", type: "end" },
        ],
        edges: [
          { from: "start", to: "hitl1" },
          { from: "hitl1", to: "fn1" },
          { from: "fn1", to: "end" },
        ],
      };

      controlPlane.compileGraph({ definition: def });

      const { runId, status, hitlInterrupt } = await controlPlane.startRun({
        graphId: "test-graph-hitl",
        input: {},
      });

      expect(status).toBe("waiting_hitl");
      expect(hitlInterrupt).toBeDefined();
      expect(hitlInterrupt?.nodeId).toBe("hitl1");

      // Resume with decision
      const decision: HitlDecision = { action: "approve", data: { note: "OK" }, decidedAt: new Date().toISOString() };
      const resumeResult = await controlPlane.resumeHitl({ runId, token: hitlInterrupt!.token, decision });

      expect(resumeResult.status).toBe("completed");
      expect(resumeResult.result.output).toEqual({ approved: true });

      // Verify HITL events in trace
      const runView = await controlPlane.getRun(runId);
      const trace = runView?.trace ?? [];
      const hitlEvents = trace.filter((e) => e.eventType === "hitl");
      expect(hitlEvents.length).toBeGreaterThanOrEqual(2); // created + resumed
      const createdEvent = hitlEvents.find((e) => (e.payload as any).action === "created");
      const resumedEvent = hitlEvents.find((e) => (e.payload as any).action === "resumed");
      expect(createdEvent).toBeDefined();
      expect(resumedEvent).toBeDefined();
      expect((resumedEvent?.payload as any).decision).toEqual(decision);
    });

    it("resumeHitl throws for invalid token", async () => {
      const def: GraphDefinition = {
        graphId: "test-graph-hitl-2",
        nodes: [{ id: "start", type: "start" }, { id: "end", type: "end" }],
        edges: [{ from: "start", to: "end" }],
      };

      controlPlane.compileGraph({ definition: def });

      const { runId } = await controlPlane.startRun({ graphId: "test-graph-hitl-2", input: {} });

      await expect(
        controlPlane.resumeHitl({ runId, token: "invalid-token", decision: { action: "approve", decidedAt: new Date().toISOString() } })
      ).rejects.toThrow("HITL interrupt not found");
    });

    it("resumeHitl throws for mismatched runId", async () => {
      const def: GraphDefinition = {
        graphId: "test-graph-hitl-3",
        nodes: [
          { id: "start", type: "start" },
          { id: "hitl1", type: "hitl", config: { payload: {} } },
          { id: "end", type: "end" },
        ],
        edges: [{ from: "start", to: "hitl1" }, { from: "hitl1", to: "end" }],
      };

      controlPlane.compileGraph({ definition: def });

      const { runId: runId1, hitlInterrupt } = await controlPlane.startRun({ graphId: "test-graph-hitl-3", input: {} });

      // Create another run
      const { runId: runId2 } = await controlPlane.startRun({ graphId: "test-graph-hitl-3", input: {} });
      const runManager = controlPlane.getRunManager();
      await runManager.waitForRun(runId2);

      // Try to resume runId1's interrupt with runId2
      await expect(
        controlPlane.resumeHitl({ runId: runId2, token: hitlInterrupt!.token, decision: { action: "approve", decidedAt: new Date().toISOString() } })
      ).rejects.toThrow("does not match runId");
    });
  });

  describe("getTrace (AC-5: trace replay by runId)", () => {
    it("returns full trace ordered by seq", async () => {
      const def: GraphDefinition = {
        graphId: "test-graph-trace",
        nodes: [
          { id: "start", type: "start" },
          { id: "fn1", type: "fn", config: { inlineFn: async () => ({ a: 1 }), outputChannel: "fn1" } },
          { id: "fn2", type: "fn", config: { inlineFn: async () => ({ b: 2 }), outputChannel: "output" } },
          { id: "end", type: "end" },
        ],
        edges: [{ from: "start", to: "fn1" }, { from: "fn1", to: "fn2" }, { from: "fn2", to: "end" }],
      };

      controlPlane.compileGraph({ definition: def });

      const { runId } = await controlPlane.startRun({ graphId: "test-graph-trace", input: {} });
      const runManager = controlPlane.getRunManager();
      await runManager.waitForRun(runId);

      const trace = await controlPlane.getTrace(runId);

      // Should have events for each node + run events
      expect(trace.length).toBeGreaterThanOrEqual(6); // start, fn1, fn2, end + run start/complete
      expect(trace[0].seq).toBe(1);

      // Verify ordering
      for (let i = 1; i < trace.length; i++) {
        expect(trace[i].seq).toBeGreaterThan(trace[i - 1].seq);
      }

      // Verify all required event types present
      const types = trace.map((e) => e.eventType);
      expect(types).toContain("node_start");
      expect(types).toContain("node_end");
      expect(types).toContain("run_completed");
    });

    it("getTrace with fromSeq returns subset", async () => {
      const def: GraphDefinition = {
        graphId: "test-graph-trace-2",
        nodes: [{ id: "start", type: "start" }, { id: "fn1", type: "fn", config: { inlineFn: async () => ({}), outputChannel: "out" } }, { id: "end", type: "end" }],
        edges: [{ from: "start", to: "fn1" }, { from: "fn1", to: "end" }],
      };

      controlPlane.compileGraph({ definition: def });

      const { runId } = await controlPlane.startRun({ graphId: "test-graph-trace-2", input: {} });
      const runManager = controlPlane.getRunManager();
      await runManager.waitForRun(runId);

      const fullTrace = await controlPlane.getTrace(runId);
      const fromSeq3 = await controlPlane.getTrace(runId, 3);

      expect(fromSeq3.length).toBeLessThan(fullTrace.length);
      expect(fromSeq3[0].seq).toBeGreaterThanOrEqual(3);
    });
  });

  describe("event log contains all event types (AC-7)", () => {
    it("success run with tool and HITL produces tool/hitl/checkpoint/completed events", async () => {
      const registry = getDefaultRegistry();
      if (!registry.has("ac7-echo")) {
        registry.register("ac7-echo", { input: { type: "object" }, output: { type: "object" } }, async (input) => ({ echo: input }));
      }

      const def: GraphDefinition = {
        graphId: "test-graph-all-events",
        nodes: [
          { id: "start", type: "start" },
          { id: "tool1", type: "tool", config: { toolName: "ac7-echo", inputChannels: ["input"], outputChannel: "toolResult" } },
          { id: "hitl1", type: "hitl", config: { payload: { message: "Continue?" } } },
          { id: "fn2", type: "fn", config: { inlineFn: async () => ({ ok: true }), outputChannel: "output" } },
          { id: "end", type: "end" },
        ],
        edges: [
          { from: "start", to: "tool1" },
          { from: "tool1", to: "hitl1" },
          { from: "hitl1", to: "fn2" },
          { from: "fn2", to: "end" },
        ],
      };

      controlPlane.compileGraph({ definition: def });

      const { runId, hitlInterrupt } = await controlPlane.startRun({ graphId: "test-graph-all-events", input: { msg: "hi" } });
      await controlPlane.resumeHitl({ runId, token: hitlInterrupt!.token, decision: { action: "approve", decidedAt: new Date().toISOString() } });

      const runManager = controlPlane.getRunManager();
      await runManager.waitForRun(runId);

      const trace = await controlPlane.getTrace(runId);
      const types = new Set(trace.map((e) => e.eventType));

      expect(types.has("node_start")).toBe(true);
      expect(types.has("node_end")).toBe(true);
      expect(types.has("tool_call")).toBe(true);
      expect(types.has("checkpoint")).toBe(true);
      expect(types.has("hitl")).toBe(true);
      expect(types.has("run_completed")).toBe(true);

      const toolEvents = trace.filter((e) => e.eventType === "tool_call");
      expect(toolEvents.length).toBe(1);
      expect((toolEvents[0]!.payload as any).toolName).toBe("ac7-echo");
    });

    it("failed run produces run_failed event", async () => {
      const def: GraphDefinition = {
        graphId: "test-graph-failed-events",
        nodes: [
          { id: "start", type: "start" },
          { id: "fn1", type: "fn", config: { inlineFn: async () => { throw new Error("boom"); }, outputChannel: "out" } },
          { id: "end", type: "end" },
        ],
        edges: [{ from: "start", to: "fn1" }, { from: "fn1", to: "end" }],
      };

      controlPlane.compileGraph({ definition: def });
      const { runId } = await controlPlane.startRun({ graphId: "test-graph-failed-events", input: {} });
      try {
        await controlPlane.getRunManager().waitForRun(runId);
      } catch {
        // failed runs may reject or resolve with failed status; either way the
        // terminal event must exist.
      }
      const event = await waitForEvent(controlPlane, runId, "run_failed");
      expect(event).toBeDefined();
    });

    it("cancelled run produces run_cancelled event", async () => {
      const def: GraphDefinition = {
        graphId: "test-graph-cancel-events",
        nodes: [
          { id: "start", type: "start" },
          { id: "fn1", type: "fn", config: { inlineFn: async () => { await new Promise((r) => setTimeout(r, 500)); return {}; }, outputChannel: "out" } },
          { id: "end", type: "end" },
        ],
        edges: [{ from: "start", to: "fn1" }, { from: "fn1", to: "end" }],
      };

      controlPlane.compileGraph({ definition: def });
      const { runId } = await controlPlane.startRun({ graphId: "test-graph-cancel-events", input: {} });
      await controlPlane.cancelRun(runId);
      await controlPlane.getRunManager().waitForRun(runId);

      const event = await waitForEvent(controlPlane, runId, "run_cancelled");
      expect(event).toBeDefined();
    });
  });

  describe("listRunsFromStore", () => {
    it("lists runs from persistent store", async () => {
      const def: GraphDefinition = {
        graphId: "test-graph-list",
        nodes: [{ id: "start", type: "start" }, { id: "end", type: "end" }],
        edges: [{ from: "start", to: "end" }],
      };

      controlPlane.compileGraph({ definition: def });

      await controlPlane.startRun({ graphId: "test-graph-list", input: { a: 1 } });
      await controlPlane.startRun({ graphId: "test-graph-list", input: { a: 2 } });

      const runs = await controlPlane.listRunsFromStore({ graphId: "test-graph-list" });
      expect(runs.length).toBe(2);
      expect(runs[0].graphId).toBe("test-graph-list");
    });

    it("filters by status", async () => {
      const def: GraphDefinition = {
        graphId: "test-graph-list-status",
        nodes: [{ id: "start", type: "start" }, { id: "end", type: "end" }],
        edges: [{ from: "start", to: "end" }],
      };

      controlPlane.compileGraph({ definition: def });

      const { runId } = await controlPlane.startRun({ graphId: "test-graph-list-status", input: {} });
      const runManager = controlPlane.getRunManager();
      await runManager.waitForRun(runId);

      const completed = await controlPlane.listRunsFromStore({ status: "completed" });
      expect(completed.length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe.skip("api/http.ts - HTTP adapter", () => {
  let store: SQLiteStateStore;
  let controlPlane: ControlPlane;
  let server: any;
  const PORT = 34567;
  const BASE_URL = `http://localhost:${PORT}/api/v1`;

  beforeEach(async () => {
    store = await createTestStore();
    controlPlane = await createControlPlane(store);
    const { createHttpServer } = await import("../src/api/http.js");
    server = await createHttpServer(controlPlane, { port: PORT, logger: () => {} });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await store.close();
  });

  async function fetchJson(path: string, options: RequestInit = {}): Promise<{ status: number; data: any }> {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  it("GET /health returns ok", async () => {
    const { status, data } = await fetchJson("/health");
    expect(status).toBe(200);
    expect(data.status).toBe("ok");
  });

  it("POST /graphs compiles graph", async () => {
    const { status, data } = await fetchJson("/graphs", {
      method: "POST",
      body: JSON.stringify({
        definition: {
          nodes: [{ id: "start", type: "start" }, { id: "end", type: "end" }],
          edges: [{ from: "start", to: "end" }],
        },
      }),
    });
    expect(status).toBe(201);
    expect(data.graphId).toBeDefined();
  });

  it("POST /graphs returns 400 for invalid graph", async () => {
    const { status, data } = await fetchJson("/graphs", {
      method: "POST",
      body: JSON.stringify({ definition: { nodes: [{ id: "start", type: "start" }], edges: [] } }),
    });
    expect(status).toBe(400);
    expect(data.error.code).toBe("GRAPH_COMPILE_ERROR");
  });

  it("POST /runs starts a run", async () => {
    // First compile a graph
    const { data: graphData } = await fetchJson("/graphs", {
      method: "POST",
      body: JSON.stringify({
        definition: {
          graphId: "http-test-graph",
          nodes: [
            { id: "start", type: "start" },
            { id: "fn1", type: "fn", config: { inlineFn: async () => ({ ok: true }), outputChannel: "output" } },
            { id: "end", type: "end" },
          ],
          edges: [{ from: "start", to: "fn1" }, { from: "fn1", to: "end" }],
        },
      }),
    });

    const { status, data } = await fetchJson("/runs", {
      method: "POST",
      body: JSON.stringify({ graphId: graphData.graphId, input: { test: true } }),
    });
    expect(status).toBe(201);
    expect(data.runId).toBeDefined();
    expect(data.status).toBe("running");
  });

  it("GET /runs lists runs", async () => {
    const { status, data } = await fetchJson("/runs");
    expect(status).toBe(200);
    expect(Array.isArray(data.runs)).toBe(true);
  });

  it("GET /runs/:runId returns run view", async () => {
    const { data: graphData } = await fetchJson("/graphs", {
      method: "POST",
      body: JSON.stringify({
        definition: {
          graphId: "http-test-graph-2",
          nodes: [{ id: "start", type: "start" }, { id: "end", type: "end" }],
          edges: [{ from: "start", to: "end" }],
        },
      }),
    });

    const { data: runData } = await fetchJson("/runs", {
      method: "POST",
      body: JSON.stringify({ graphId: graphData.graphId, input: {} }),
    });

    const { status, data } = await fetchJson(`/runs/${runData.runId}`);
    expect(status).toBe(200);
    expect(data.metadata.runId).toBe(runData.runId);
    expect(data.trace).toBeDefined();
  });

  it("POST /runs/:runId/cancel cancels run", async () => {
    const { data: graphData } = await fetchJson("/graphs", {
      method: "POST",
      body: JSON.stringify({
        definition: {
          graphId: "http-test-graph-cancel",
          nodes: [
            { id: "start", type: "start" },
            { id: "fn1", type: "fn", config: { inlineFn: async () => { await new Promise(r => setTimeout(r, 500)); return {}; }, outputChannel: "out" } },
            { id: "end", type: "end" },
          ],
          edges: [{ from: "start", to: "fn1" }, { from: "fn1", to: "end" }],
        },
      }),
    });

    const { data: runData } = await fetchJson("/runs", {
      method: "POST",
      body: JSON.stringify({ graphId: graphData.graphId, input: {} }),
    });

    const { status, data } = await fetchJson(`/runs/${runData.runId}/cancel`, { method: "POST" });
    expect(status).toBe(200);
    expect(data.cancelled).toBe(true);
  });

it("GET /runs/:runId/trace returns trace", async () => {
    const { data: graphData } = await fetchJson("/graphs", {
      method: "POST",
      body: JSON.stringify({
        definition: {
          graphId: "http-test-graph-trace",
          nodes: [
            { id: "start", type: "start" },
            { id: "fn1", type: "fn", config: { inlineFn: async () => ({ x: 1 }), outputChannel: "output" } },
            { id: "end", type: "end" },
          ],
          edges: [{ from: "start", to: "fn1" }, { from: "fn1", to: "end" }],
        },
      }),
    });

    const { data: runData } = await fetchJson("/runs", {
      method: "POST",
      body: JSON.stringify({ graphId: graphData.graphId, input: {} }),
    });

    const runManager = controlPlane.getRunManager();
    await runManager.waitForRun(runData.runId);

    const { status, data } = await fetchJson(`/runs/${runData.runId}/trace`);
    expect(status).toBe(200);
    expect(data.runId).toBe(runData.runId);
    expect(Array.isArray(data.trace)).toBe(true);
    expect(data.trace.length).toBeGreaterThan(0);
  });
});