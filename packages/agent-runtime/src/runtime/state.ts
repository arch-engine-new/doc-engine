/**
 * Channel/Reducer state model for the in-memory scheduler.
 *
 * Why: Provides a predictable, serializable state container with
 * deterministic merge semantics for partial updates from node executors.
 * Avoids implicit mutation bugs and enables future checkpointing.
 */

import type { CompiledGraph, GraphNode } from "../graph/types.js";
import type { LlmProvider } from "../llm/provider.js";

/** A single named channel holding a JSON-serializable value. */
export interface Channel<T = unknown> {
  /** Current value; undefined means "not yet written". */
  value: T | undefined;
  /** Version counter incremented on every write for optimistic concurrency. */
  version: number;
}

/**
 * Map of channel name → channel state.
 * Channels are created lazily on first write.
 */
export type ChannelMap = Map<string, Channel>;

/**
 * Result of merging a partial update into the channel map.
 */
export interface MergeResult {
  /** Updated channel map (same reference mutated for performance). */
  channels: ChannelMap;
  /** Names of channels that changed. */
  changed: string[];
}

/**
 * Execution context passed to every node executor.
 * Contains immutable compiled graph + mutable channels + run metadata.
 */
export interface ExecutionContext {
  /** Compiled graph (immutable). */
  readonly compiledGraph: import("../graph/types.js").CompiledGraph;
  /** Mutable channel state. */
  channels: ChannelMap;
  /** Run-scoped metadata (runId, timestamps, etc.). */
  readonly metadata: RunMetadata;
  /** Abort signal for cooperative cancellation. */
  readonly abortSignal: AbortSignal;
  /** Unique run identifier (convenience alias for metadata.runId). */
  readonly runId: string;
  /** Optional thread identifier for conversation grouping. */
  readonly threadId: string | undefined;
  /** Current node execution database ID (set when persisted). */
  readonly nodeExecutionId?: number;
  /** Current attempt number for this node (1-based). */
  attempt: number;
  /** Resolve nested graph by id (subgraph nodes). */
  getCompiledGraph?: (graphId: string) => CompiledGraph | undefined;
  /** Optional LLM provider override for llm nodes. */
  llmProvider?: LlmProvider;
}

/**
 * Run metadata tracked by RunManager.
 */
export interface RunMetadata {
  /** Unique run identifier. */
  runId: string;
  /** Graph identifier this run executes. */
  graphId: string;
  /** Optional thread identifier for conversation grouping. */
  threadId?: string | null;
  /** Run status. */
  status: RunStatus;
  /** When the run was created (ISO string). */
  createdAt: string;
  /** When the run entered running state (ISO string). */
  startedAt?: string;
  /** When the run reached a terminal state (ISO string). */
  finishedAt?: string;
  /** Input provided to startRun. */
  input: unknown;
  /** Final output (set on completion). */
  output?: unknown;
  /** Error if failed. */
  error?: { message: string; code?: string; cause?: unknown };
  /** Node execution history for debugging. */
  nodeHistory: NodeExecutionRecord[];
}

/** Terminal and non-terminal run states. */
export type RunStatus =
  | "created"
  | "running"
  | "waiting_hitl"
  | "completed"
  | "failed"
  | "cancelled";

/** Record of a single node execution attempt. */
export interface NodeExecutionRecord {
  nodeId: string;
  nodeType: GraphNode["type"];
  startedAt: string;
  finishedAt?: string;
  status: "running" | "completed" | "failed" | "skipped";
  input?: unknown;
  output?: unknown;
  error?: { message: string; code?: string };
  attempt: number;
}

/**
 * Initial channel state derived from run input.
 * Creates a single "input" channel with the provided value.
 */
export function createInitialChannels(input: unknown): ChannelMap {
  const channels = new Map<string, Channel>();
  channels.set("input", { value: input, version: 1 });
  return channels;
}

/**
 * Merge a partial update into the channel map.
 * Each key in `updates` becomes/updates a channel.
 * Returns the mutated map and list of changed channel names.
 */
export function mergeChannels(
  channels: ChannelMap,
  updates: Record<string, unknown>,
): MergeResult {
  const changed: string[] = [];
  for (const [key, value] of Object.entries(updates)) {
    const existing = channels.get(key);
    if (existing) {
      existing.value = value;
      existing.version += 1;
    } else {
      channels.set(key, { value, version: 1 });
    }
    changed.push(key);
  }
  return { channels, changed };
}

/**
 * Read a channel value (undefined if not written yet).
 */
export function getChannel<T>(channels: ChannelMap, name: string): T | undefined {
  return channels.get(name)?.value as T | undefined;
}

/**
 * Check if a channel exists (has ever been written).
 */
export function hasChannel(channels: ChannelMap, name: string): boolean {
  return channels.has(name);
}

/**
 * Get all channel names.
 */
export function getChannelNames(channels: ChannelMap): string[] {
  return [...channels.keys()];
}

/**
 * Serialize channels to a plain object for checkpointing/debugging.
 */
export function serializeChannels(channels: ChannelMap): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, channel] of channels) {
    out[name] = channel.value;
  }
  return out;
}

/**
 * Deserialize plain object back into a ChannelMap.
 */
export function deserializeChannels(data: Record<string, unknown>): ChannelMap {
  const channels = new Map<string, Channel>();
  for (const [name, value] of Object.entries(data)) {
    channels.set(name, { value, version: 1 });
  }
  return channels;
}