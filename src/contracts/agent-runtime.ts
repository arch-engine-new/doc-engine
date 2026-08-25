/**
 * agent-runtime 对外契约（source carrier）
 *
 * Why: 本文件是 plan Task 9 要求的「对外 TS 契约」源码载体 —— 明确包
 * `packages/agent-runtime` 对外暴露的类型契约面，供嵌入方（宿主应用）与
 * 契约检索（register_contract / query_contract）对照。运行时类型 SSOT 仍在
 * `packages/agent-runtime/src/index.ts` 的 barrel 中；本文件仅做聚合与说明，
 * 不承载实现。
 *
 * 契约名称：AgentRuntime
 * 关联实现：packages/agent-runtime（包导出见 src/index.ts）
 * 登记动作（closeout）：由 /finish-feature 执行 register_contract
 */
export type {
  /**
   * 图定义：作者侧输入（节点 + 边）。
   */
  GraphDefinition,
  /**
   * 编译产物：校验后的不可变图（邻接、终端、入口已计算）。
   */
  CompiledGraph,
  /**
   * 节点类型（start/fn/branch/tool/llm/hitl/subgraph/end）。
   */
  NodeType,
  /**
   * 重试策略（maxAttempts/backoffMs/jitter）。
   */
  RetryPolicy,
} from "agent-runtime";

export type {
  /**
   * Run 生命周期状态机：created | running | waiting_hitl | completed | failed | cancelled。
   */
  RunStatus,
  /**
   * Run 元数据（id/status/input/output/nodeHistory）。
   */
  RunMetadata,
  /**
   * 调度结果（终态 + channels + history + hitlInterrupt）。
   */
  SchedulerResult,
  /**
   * 通道状态模型（channel/reducer 合并语义）。
   */
  ChannelMap,
} from "agent-runtime";

export type {
  /**
   * HITL 决策（action/data/decidedAt），由人工回填。
   */
  HitlDecision,
  /**
   * HITL 中断状态（pending/resumed/expired/cancelled）。
   */
  HitlInterruptStatus,
} from "agent-runtime";

export type {
  /**
   * 持久化接口：Run/NodeExecution/Checkpoint/ToolCall/Event/HitlInterrupt CRUD。
   * 默认实现 SQLiteStateStore。
   */
  StateStore,
} from "agent-runtime";

export type {
  /**
   * 事件行（seq 单调递增，runId 内唯一）。
   */
  EventRow,
  /**
   * 事件类型（node_start/node_end/tool_call/checkpoint/hitl/run_*）。
   */
  EventType,
} from "agent-runtime";

export type {
  /**
   * 控制面视图：metadata + trace。
   */
  RunView,
  /**
   * 工具执行结果（output/durationMs/attempts/fromCache）。
   */
  ToolExecutionResult,
} from "agent-runtime";
