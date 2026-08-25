import { existsSync, unlinkSync } from "node:fs";
import {
  createControlPlane,
  SQLiteStateStore,
  type GraphDefinition,
} from "agent-runtime";

// 崩溃前状态：进程内计数器 —— resume 成功后不应被再次执行（副作用幂等）
let sideEffectRuns = 0;

// 每次演示从全新存储开始（真实场景为进程被杀后复用同一 DB 文件）
const DB_FILE = "agent-runtime-crash.db";
if (existsSync(DB_FILE)) {
  unlinkSync(DB_FILE);
}

const store = new SQLiteStateStore(DB_FILE);
await store.initialize();

const definition: GraphDefinition = {
  graphId: "crash-recovery-demo",
  nodes: [
    { id: "start", type: "start" },
    {
      id: "work",
      type: "fn",
      config: {
        inlineFn: async () => {
          sideEffectRuns += 1;
          return { stage: "done" };
        },
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

const plane = await createControlPlane(store);
plane.compileGraph({ definition });

// 第一段：正常执行，每个节点边界已写 checkpoint
const RUN_ID = "crash-demo-run";
const first = await plane.startRun({ graphId: "crash-recovery-demo", input: {}, runId: RUN_ID });
await plane.getRunManager().waitForRun(first.runId);
console.log("first run:", first.runId, "side-effect runs:", sideEffectRuns);

// 模拟崩溃后重启：同一 runId + resume:true 续跑。
// 真实事故场景为「进程被杀后重启」；此处以同 runId 重放等价验证
// checkpoint 恢复语义：已完成的节点被跳过，副作用不重复。
const resumed = await plane.startRun({ graphId: "crash-recovery-demo", input: {}, runId: RUN_ID, resume: true });
await plane.getRunManager().waitForRun(resumed.runId);
console.log("resumed run status:", resumed.status, "side-effect runs:", sideEffectRuns);

if (sideEffectRuns !== 1) {
  throw new Error(`expected 1 side-effect execution after resume, got ${sideEffectRuns}`);
}

console.log("checkpoint resume OK: side effects were not duplicated");
await store.close();
