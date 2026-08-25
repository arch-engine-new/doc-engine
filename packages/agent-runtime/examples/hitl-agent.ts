import { createControlPlane, SQLiteStateStore, type GraphDefinition } from "agent-runtime";

const store = new SQLiteStateStore("agent-runtime.db");
await store.initialize();

const definition: GraphDefinition = {
  graphId: "hitl-agent",
  nodes: [
    { id: "start", type: "start" },
    { id: "review", type: "hitl", config: { payload: { message: "Approve the document?" } } },
    {
      id: "finish",
      type: "fn",
      config: {
        inlineFn: async (inputs: {
          input?: { doc?: string };
          hitl_decision_review?: { action: string };
        }) => ({
          approved: inputs.hitl_decision_review?.action === "approve",
        }),
        inputChannels: ["input", "hitl_decision_review"],
        outputChannel: "output",
      },
    },
    { id: "end", type: "end" },
  ],
  edges: [
    { from: "start", to: "review" },
    { from: "review", to: "finish" },
    { from: "finish", to: "end" },
  ],
};

const plane = await createControlPlane(store);
plane.compileGraph({ definition });

const { runId, status, hitlInterrupt } = await plane.startRun({
  graphId: "hitl-agent",
  input: { doc: "contract.docx" },
});

if (status !== "waiting_hitl" || !hitlInterrupt) {
  throw new Error(`Expected HITL pause, got ${status}`);
}
console.log("review:", hitlInterrupt.payload, "token:", `${hitlInterrupt.token.slice(0, 8)}...`);

const resume = await plane.resumeHitl({
  runId,
  token: hitlInterrupt.token,
  decision: { action: "approve", data: { reviewer: "alice" }, decidedAt: new Date().toISOString() },
});

console.log("status:", resume.status);
console.log("output:", resume.result?.output);

await store.close();
