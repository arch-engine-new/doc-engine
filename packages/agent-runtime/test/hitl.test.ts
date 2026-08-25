/**
 * HITL (Human-in-the-Loop) tests for agent-runtime.
 *
 * Tests cover:
 * - HITL node pauses run, returns token
 * - resumeHitl with valid token continues run
 * - resumeHitl idempotent (same token twice)
 * - expired token rejected
 * - AC-3: waiting_hitl -> resume -> terminal
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { RunManager } from "../src/runtime/run-manager.js";
import { compileGraph } from "../src/graph/compiler.js";
import { SQLiteStateStore } from "../src/persistence/sqlite-store.js";
import { HitlGateway, createHitlGateway } from "../src/hitl/gateway.js";
import type { GraphDefinition, CompiledGraph } from "../src/graph/types.js";
import type { HitlDecision } from "../src/hitl/gateway.js";

// Test helpers
function createHitlGraph(): GraphDefinition {
  return {
    graphId: "hitl-test-graph",
    nodes: [
      { id: "start", type: "start" },
      {
        id: "approval",
        type: "hitl",
        config: {
          payload: { question: "Approve this action?", options: ["approve", "reject"] },
        },
      },
      { id: "end", type: "end" },
    ],
    edges: [
      { from: "start", to: "approval" },
      { from: "approval", to: "end" },
    ],
  };
}

function createHitlGraphWithDecision(): GraphDefinition {
  return {
    graphId: "hitl-decision-graph",
    nodes: [
      { id: "start", type: "start" },
      {
        id: "approval",
        type: "hitl",
        config: {
          payload: { question: "Approve?", options: ["yes", "no"] },
        },
      },
      {
        id: "process",
        type: "fn",
        config: {
          inlineFn: async (inputs: Record<string, unknown>) => {
            const decision = inputs.hitl_decision_approval as { action: string } | undefined;
            return { processed: true, decision: decision?.action };
          },
          inputChannels: ["hitl_decision_approval"],
          outputChannel: "output",
        },
      },
      { id: "end", type: "end" },
    ],
    edges: [
      { from: "start", to: "approval" },
      { from: "approval", to: "process" },
      { from: "process", to: "end" },
    ],
  };
}

describe("HITL Gateway", () => {
  let store: SQLiteStateStore;
  let gateway: HitlGateway;

  beforeEach(async () => {
    store = new SQLiteStateStore(":memory:");
    await store.initialize();
    gateway = createHitlGateway(store);
  });

  it("should create an interrupt and return a token", async () => {
    const { token, interrupt } = await gateway.createInterrupt(
      "run-1",
      "node-1",
      { question: "Test?" },
    );

    expect(token).toBeDefined();
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
    expect(interrupt.runId).toBe("run-1");
    expect(interrupt.nodeId).toBe("node-1");
    expect(interrupt.status).toBe("pending");
    expect(interrupt.payload).toEqual({ question: "Test?" });
  });

  it("should retrieve interrupt by token", async () => {
    const { token, interrupt: created } = await gateway.createInterrupt(
      "run-1",
      "node-1",
      { question: "Test?" },
    );

    const retrieved = await gateway.getInterrupt(token);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.token).toBe(token);
    expect(retrieved!.runId).toBe("run-1");
    expect(retrieved!.payload).toEqual(created.payload);
  });

  it("should resume interrupt with decision (idempotent)", async () => {
    const { token } = await gateway.createInterrupt(
      "run-1",
      "node-1",
      { question: "Test?" },
    );

    const decision: HitlDecision = {
      action: "approve",
      data: { comment: "Looks good" },
      decidedAt: new Date().toISOString(),
    };

    const result1 = await gateway.resume(token, decision);
    expect(result1).toBe(true);

    // Second call should be idempotent
    const result2 = await gateway.resume(token, decision);
    expect(result2).toBe(true);
  });

  it("should reject expired token", async () => {
    const pastDate = new Date(Date.now() - 1000).toISOString();
    const { token } = await gateway.createInterrupt(
      "run-1",
      "node-1",
      { question: "Test?" },
      pastDate,
    );

    const decision: HitlDecision = {
      action: "approve",
      decidedAt: new Date().toISOString(),
    };

    const result = await gateway.resume(token, decision);
    expect(result).toBe(false);
  });

  it("should return false for non-existent token", async () => {
    const decision: HitlDecision = {
      action: "approve",
      decidedAt: new Date().toISOString(),
    };

    const result = await gateway.resume("non-existent-token", decision);
    expect(result).toBe(false);
  });
});

describe("RunManager HITL Integration", () => {
  let runManager: RunManager;
  let store: SQLiteStateStore;

  beforeEach(async () => {
    runManager = new RunManager();
    store = new SQLiteStateStore(":memory:");
    await store.initialize();
  });

  it("should pause run at HITL node and return token", async () => {
    const graph = createHitlGraph();
    const gateway = createHitlGateway(store);

    const startResult = await runManager.startRun(graph, {
      input: { data: "test" },
      hitlGateway: gateway,
      store,
    });

    expect(startResult.status).toBe("running");

    // Wait for the scheduler to pause at HITL
    const schedulerResult = await runManager.waitForRun(startResult.runId);
    expect(schedulerResult).toBeDefined();
    expect(schedulerResult!.status).toBe("waiting_hitl");
    expect(schedulerResult!.hitlInterrupt).toBeDefined();
    expect(schedulerResult!.hitlInterrupt!.token).toBeDefined();
    expect(schedulerResult!.hitlInterrupt!.nodeId).toBe("approval");

    const run = runManager.getRun(startResult.runId);
    expect(run).toBeDefined();
    expect(run!.status).toBe("waiting_hitl");
  });

  it("should resume run with valid token and complete", async () => {
    const graph = createHitlGraphWithDecision();
    const gateway = createHitlGateway(store);

    const startResult = await runManager.startRun(graph, {
      input: { data: "test" },
      hitlGateway: gateway,
      store,
    });

    // Wait for the scheduler to pause at HITL
    const schedulerResult = await runManager.waitForRun(startResult.runId);
    expect(schedulerResult!.status).toBe("waiting_hitl");
    const token = schedulerResult!.hitlInterrupt!.token;

    const decision: HitlDecision = {
      action: "approve",
      data: { comment: "Approved" },
      decidedAt: new Date().toISOString(),
    };

    const resumeResult = await runManager.resumeHitl(startResult.runId, token, decision);
    expect(resumeResult).toBeDefined();
    expect(resumeResult!.status).toBe("completed");
    expect(resumeResult!.output).toEqual({ processed: true, decision: "approve" });
  });

  it("should be idempotent when resuming with same token twice", async () => {
    const graph = createHitlGraphWithDecision();
    const gateway = createHitlGateway(store);

    const startResult = await runManager.startRun(graph, {
      input: { data: "test" },
      hitlGateway: gateway,
      store,
    });

    // Wait for the scheduler to pause at HITL
    const schedulerResult = await runManager.waitForRun(startResult.runId);
    expect(schedulerResult!.status).toBe("waiting_hitl");
    const token = schedulerResult!.hitlInterrupt!.token;

    const decision: HitlDecision = {
      action: "approve",
      decidedAt: new Date().toISOString(),
    };

    // First resume
    const result1 = await runManager.resumeHitl(startResult.runId, token, decision);
    expect(result1!.status).toBe("completed");

    // Second resume should be idempotent (no error, same result)
    const result2 = await runManager.resumeHitl(startResult.runId, token, decision);
    expect(result2!.status).toBe("completed");
    expect(result2!.output).toEqual(result1!.output);
  });

  it("should reject expired token", async () => {
    const graph = createHitlGraph();
    const gateway = createHitlGateway(store);

    // Create a run with a very short expiry
    const pastDate = new Date(Date.now() - 1000).toISOString();
    const { token } = await gateway.createInterrupt(
      "run-expired",
      "approval",
      { question: "Test?" },
      pastDate,
    );

    // Manually set up a run in waiting_hitl state with expired interrupt
    // For this test, we'll just verify the gateway rejects expired tokens
    const decision: HitlDecision = {
      action: "approve",
      decidedAt: new Date().toISOString(),
    };

    const result = await gateway.resume(token, decision);
    expect(result).toBe(false);
  });

  it("AC-3: waiting_hitl -> resume -> terminal (completed)", async () => {
    const graph = createHitlGraphWithDecision();
    const gateway = createHitlGateway(store);

    // Start run - should pause at HITL
    const startResult = await runManager.startRun(graph, {
      input: { data: "test" },
      hitlGateway: gateway,
      store,
    });
    expect(startResult.status).toBe("running");

    // Get the token
    const schedulerResult = await runManager.waitForRun(startResult.runId);
    expect(schedulerResult!.status).toBe("waiting_hitl");
    const token = schedulerResult!.hitlInterrupt!.token;

    // Resume with decision
    const decision: HitlDecision = {
      action: "approve",
      data: { reason: "test" },
      decidedAt: new Date().toISOString(),
    };

    const resumeResult = await runManager.resumeHitl(startResult.runId, token, decision);

    // Should reach terminal state (completed)
    expect(resumeResult).toBeDefined();
    expect(resumeResult!.status).toBe("completed");
    expect(resumeResult!.output).toBeDefined();
    expect(resumeResult!.output).toEqual({ processed: true, decision: "approve" });

    // Verify run metadata
    const finalRun = runManager.getRun(startResult.runId);
    expect(finalRun!.status).toBe("completed");
    expect(finalRun!.finishedAt).toBeDefined();
  });

  it("should handle multiple HITL nodes in sequence", async () => {
    const graph: GraphDefinition = {
      graphId: "multi-hitl-graph",
      nodes: [
        { id: "start", type: "start" },
        {
          id: "approval1",
          type: "hitl",
          config: { payload: { step: 1, question: "First approval?" } },
        },
        {
          id: "process1",
          type: "fn",
          config: {
            inlineFn: async () => ({ step: 1, done: true }),
            outputChannel: "output",
          },
        },
        {
          id: "approval2",
          type: "hitl",
          config: { payload: { step: 2, question: "Second approval?" } },
        },
        {
          id: "process2",
          type: "fn",
          config: {
            inlineFn: async () => ({ step: 2, done: true }),
            outputChannel: "output",
          },
        },
        { id: "end", type: "end" },
      ],
      edges: [
        { from: "start", to: "approval1" },
        { from: "approval1", to: "process1" },
        { from: "process1", to: "approval2" },
        { from: "approval2", to: "process2" },
        { from: "process2", to: "end" },
      ],
    };

    const gateway = createHitlGateway(store);

    // First HITL
    const result1 = await runManager.startRun(graph, {
      input: {},
      hitlGateway: gateway,
      store,
    });
    expect(result1.status).toBe("running");

    const sched1 = await runManager.waitForRun(result1.runId);
    expect(sched1!.status).toBe("waiting_hitl");
    const token1 = sched1!.hitlInterrupt!.token;
    expect(sched1!.hitlInterrupt!.nodeId).toBe("approval1");

    // Resume first
    const decision1: HitlDecision = { action: "approve", decidedAt: new Date().toISOString() };
    const resume1 = await runManager.resumeHitl(result1.runId, token1, decision1);
    expect(resume1!.status).toBe("waiting_hitl"); // Pauses at second HITL

    // Get second token
    const sched2 = await runManager.waitForRun(result1.runId);
    const token2 = sched2!.hitlInterrupt!.token;
    expect(sched2!.hitlInterrupt!.nodeId).toBe("approval2");

    // Resume second
    const decision2: HitlDecision = { action: "approve", decidedAt: new Date().toISOString() };
    const resume2 = await runManager.resumeHitl(result1.runId, token2, decision2);
    expect(resume2!.status).toBe("completed");
  });
});