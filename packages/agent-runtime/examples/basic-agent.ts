import { createControlPlane, type GraphDefinition } from "agent-runtime";

const definition: GraphDefinition = {
  graphId: "basic-agent",
  nodes: [
    { id: "start", type: "start" },
    {
      id: "greet",
      type: "fn",
      config: {
        inlineFn: async (inputs: { input?: { name?: string } }) => ({
          message: `Hello, ${inputs.input?.name ?? "world"}!`,
        }),
        outputChannel: "output",
      },
    },
    { id: "end", type: "end" },
  ],
  edges: [
    { from: "start", to: "greet" },
    { from: "greet", to: "end" },
  ],
};

const plane = await createControlPlane();
plane.compileGraph({ definition });

const { runId } = await plane.startRun({ graphId: "basic-agent", input: { name: "Ada" } });

const result = await plane.waitForRun(runId);
console.log("status:", result?.status);
console.log("output:", result?.output);

const trace = await plane.getTrace(runId);
console.log("events:", trace.map((event) => event.eventType));
