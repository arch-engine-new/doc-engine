# agent-runtime

Self-contained graph runtime for agent workflows: author graphs, run them serially, pause for human input, and replay traces — all persisted in SQLite.

## Install

```bash
npm install agent-runtime
```

Requires Node 18+ (ES2022). The package ships TypeScript sources (`main: ./src/index.ts`); run with a TS loader such as `tsx` until a build step is wired up.

## Quick start

```ts
import { createControlPlane, type GraphDefinition } from "agent-runtime";

const definition: GraphDefinition = {
  graphId: "basic-agent",
  nodes: [
    { id: "start", type: "start" },
    {
      id: "greet",
      type: "fn",
      config: {
        inlineFn: async (inputs) => ({ message: `Hello, ${inputs.input?.name ?? "world"}!` }),
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
plane.compileGraph({ definition }); // validates the graph, caches it by graphId

const { runId } = await plane.startRun({ graphId: "basic-agent", input: { name: "Ada" } });
const result = await plane.waitForRun(runId); // resolves once the run settles

console.log(result?.status, result?.output);
console.log(await plane.getTrace(runId)); // ordered events for replay
```

`startRun` is non-blocking: it returns `{ runId, status: "running" }` immediately (or `"waiting_hitl"` with a token when a HITL node pauses the run). Use `waitForRun`, `getRun`, or poll `getTrace`.

## API surface

| Export | Kind | Purpose |
| --- | --- | --- |
| `compileGraph` / `GraphCompileError` | fn / class | Validate a `GraphDefinition` up front — fails fast on cycles, dangling edges, missing terminals |
| `GraphDefinition`, `CompiledGraph`, `GraphNode`, `GraphEdge`, `NodeType`, `RetryPolicy` | types | Graph authoring types |
| `startRun`, `getRun`, `waitForRun`, `cancelRun`, `RunManager`, `defaultRunManager` | fns / class | Non-blocking run lifecycle, cancellation via AbortController |
| `resumeHitl` | method | Resume a `"waiting_hitl"` run with a human decision |
| `getTrace`, `getRun` | methods | Ordered event trace (`node_start`, `node_end`, `tool_call`, `checkpoint`, `hitl`, `run_completed/failed/cancelled`) |
| `listRunsFromStore` | method | List persisted runs with `graphId` / `status` filters |
| `SQLiteStateStore` | class | Durable state store (runs, nodes, checkpoints, tool calls, events, HITL interrupts) |
| `runMigration`, `isMigrated` | fns | Apply / check the SQLite schema |
| `CheckpointService`, `createCheckpointService` | class / fn | Crash-recovery checkpoint read/write |
| `HitlGateway`, `createHitlGateway`, `HitlDecision` | class / fn / type | Interrupt lifecycle: create / retrieve / resume / expire |
| `ToolRegistry`, `ToolRuntime`, `createToolRuntime` | classes / fn | Tool validation, timeout, retry, idempotent execution |
| `EventLog`, `createEventLog`, `registerOtelHooks` | class / fn / fn | Event logging and OpenTelemetry hooks |
| `ControlPlane`, `createControlPlane` | class / fn | In-process control API — the main embedder entry point |
| `createHttpServer`, `createFetchHandler` | fns | Optional REST adapter (`/graphs`, `/runs`, `/runs/:id/cancel|resume|trace`) |

## Persistence

```ts
import { createControlPlane, SQLiteStateStore } from "agent-runtime";

const store = new SQLiteStateStore("agent-runtime.db");
await store.initialize(); // applies the schema migration idempotently

const plane = await createControlPlane(store);
```

Passing a `StateStore` to `createControlPlane` persists runs, node executions, checkpoints, tool calls, events, and HITL interrupts. Without one, the control plane uses an in-memory store.

## Checkpoint resume

The scheduler writes a checkpoint before each node and when a HITL pause occurs. Start a run with `runId`, then resume the same `runId` after a crash:

```ts
await plane.startRun({ graphId: "basic-agent", input: { doc: "x" }, runId: "run_abc", store });
const resumed = await plane.startRun({
  graphId: "basic-agent",
  input: {},          // initial input is not replayed; channels come from the checkpoint
  runId: "run_abc",   // same runId: latest checkpoint is loaded
  resume: true,
  store,
});
```

## HITL (Human-in-the-Loop)

A `hitl` node stops the run and returns a token; resume with a `HitlDecision` (`{ action, data?, decidedAt }` — the decision lands in the `hitl_decision_<nodeId>` channel).

```ts
const { status, hitlInterrupt } = await plane.startRun({ graphId: "hitl-agent", input: { doc: "x" }, store });
// status === "waiting_hitl"; show hitlInterrupt.payload to a human

await plane.resumeHitl({
  runId,
  token: hitlInterrupt.token,
  decision: { action: "approve", data: { reviewer: "alice" }, decidedAt: new Date().toISOString() },
});
```

## Tools

Register tools in the default registry (or a `ToolRegistry` passed to `ToolRuntime`), then reference them from `tool` nodes:

```ts
import { getDefaultRegistry, createControlPlane, type GraphDefinition } from "agent-runtime";

const registry = getDefaultRegistry();
registry.register(
  "add",
  {
    input: { type: "object", properties: { a: { type: "number" }, b: { type: "number" } }, required: ["a", "b"] },
    output: { type: "number" },
  },
  async ({ a, b }) => a + b,
);
```

Tool invocation is validated against the schema and deduplicated by `idempotencyKey` when a `StateStore` is present, so retries never double-apply. Succeeded, failed, and cache-hit calls are recorded as `tool_call` events in the run trace.

## Examples

```bash
npx tsc -p packages/agent-runtime/examples --noEmit  # typecheck
tsx packages/agent-runtime/examples/basic-agent.ts   # run (needs tsx)
tsx packages/agent-runtime/examples/hitl-agent.ts
```

- `examples/basic-agent.ts` — compile → start → wait → print result and trace.
- `examples/hitl-agent.ts` — HITL node, token, resume with a decision, final output.
