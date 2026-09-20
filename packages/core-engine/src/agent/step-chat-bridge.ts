import {
  getDefaultLlmProvider,
  initDefaultLlmProvider,
  loadLlmRuntimeConfig,
  UNCONFIGURED_LLM_MESSAGE,
  type ControlPlane,
  type GraphDefinition,
  type GraphEdge,
  type GraphNode,
  type LlmProvider,
  type ToolRegistry,
} from "agent-runtime";
import type { LedgerStore } from "../persistence/ledger.js";
import type { JobPipeline } from "../pipeline/job-pipeline.js";
import {
  canConfirmSkill,
  emptySkillDraftPayload,
  matchCheckItems,
  parseSkillDraftPayload,
  skillDraftFromRow,
  upsertSkillDraft,
  type SkillDraft,
  type SkillDraftPayload,
  type SkillSummary,
} from "../skill/index.js";
import { AgentRuntimeFactory, type AgentRuntimeFactoryOptions } from "./agent-runtime-factory.js";
import {
  buildJobContext,
  formatJobContextForPrompt,
  formatRetrieveHitsForPrompt,
  packChatTraceId,
} from "./context.js";
import {
  buildSkillTeachPrompt,
  isSkillTeachStep,
  shouldDraftWording,
  shouldSearchClause,
  stepSystemPrompt,
} from "./prompts.js";
import { resolveRepoRoot } from "./repo-root.js";
import type { RetrieveHit } from "../retrieve/ports.js";

export interface StepChatInput {
  traceId?: string;
  step: string;
  userMessage: string;
  /** Required for retrieve/standard_lib when there is no Job trace. */
  packId?: string;
  /** Current-page RetrieveHits; search_clause may still run from the user question. */
  hits?: RetrieveHit[];
}

/**
 * WHY: Confirm unlocks from engine match flags on draft JSON, never from the
 * last assistant sentence that might claim 「已确认」 (R10/R11).
 */
export interface SkillTeachSummary extends SkillSummary {
  check_match: Array<{
    label: string;
    matched: boolean;
    reason: "unmatched" | null;
  }>;
  can_confirm: boolean;
}

export interface StepChatReply {
  reply: string;
  agentRunId: string;
  proposalId?: string;
  skill_summary?: SkillTeachSummary;
}

/**
 * WHY: Teaching upserts t_skill_draft only. Passing ledger in avoids opening a
 * second store that would miss the hung upload row (R8).
 */
export interface TeachSkillFromChatInput {
  pipeline: JobPipeline;
  ledger: Pick<LedgerStore, "getSkillDraftByJob" | "insertSkillDraft" | "updateSkillDraft">;
  llm: LlmProvider;
  traceId: string;
  userMessage: string;
}

export type LlmHealth = "ok" | "skip" | "fail";

export type StepChatBridgeOptions = AgentRuntimeFactoryOptions;

interface StepChatPrep {
  jobId: string;
  packId: string | null;
  step: string;
  userMessage: string;
  contextText: string;
  system: string;
  should_search: "search" | "skip";
  should_draft: "draft" | "skip";
  search_args: { packId: string; query: string; jobId: string };
}

interface StepChatWordingArgs {
  jobId: string;
  wording: string;
  agentRunId: string;
}

interface StepChatAssembleInputs {
  prep?: unknown;
  llm_text?: unknown;
  wording_result?: { proposal_id?: string };
  search_hits?: unknown;
}

const WORDING_CAP = 500;
const EMPTY_HITS_TEXT = "未检索到条款";
const NO_HIT_REPLY_LINE = "未命中条款，禁止编造条款号。";

/**
 * Kahn scheduling counts every normal incoming edge. Exclusive branch arms that
 * later join (search|skip → llm, draft|skip → assemble) would leave the join
 * at in-degree 1 forever. onError bypasses in-degree, so the unused arm is a
 * throw stub whose onError edge is the join.
 */
function throwSkipJoin(nodeId: string): never {
  throw new Error(`step-chat-v1:${nodeId}`);
}

function capWording(text: string): string {
  if (text.length <= WORDING_CAP) {
    return text;
  }
  return `${text.slice(0, WORDING_CAP - 3)}...`;
}

function formatHitsForPrompt(hits: unknown): string {
  if (!Array.isArray(hits) || hits.length === 0) {
    return EMPTY_HITS_TEXT;
  }
  return formatRetrieveHitsForPrompt(hits as RetrieveHit[]);
}

function replyAlreadyMentionsMiss(text: string): boolean {
  return text.includes("未命中") || text.includes("未检索");
}

function didAttemptSearch(prep: unknown): boolean {
  return Boolean(
    prep && typeof prep === "object" && (prep as StepChatPrep).should_search === "search",
  );
}

/** When search ran but produced no citeable hits, say so instead of inventing clause_id. */
function appendEmptySearchNotice(reply: string, inputs: StepChatAssembleInputs): string {
  if (!didAttemptSearch(inputs.prep)) {
    return reply;
  }
  if (formatHitsForPrompt(inputs.search_hits) !== EMPTY_HITS_TEXT) {
    return reply;
  }
  if (replyAlreadyMentionsMiss(reply)) {
    return reply;
  }
  return reply ? `${reply}\n${NO_HIT_REPLY_LINE}` : NO_HIT_REPLY_LINE;
}

function asPrep(value: unknown): StepChatPrep {
  if (!value || typeof value !== "object") {
    throw new Error("step-chat-v1 missing prep");
  }
  return value as StepChatPrep;
}

function resolveStepChatInput(payload: StepChatInput): StepChatInput & { traceId: string } {
  const packId = payload.packId;
  const traceId = payload.traceId || (packId ? packChatTraceId(packId) : "");
  return { ...payload, traceId };
}

/**
 * Load HITL context. retrieve/standard_lib uses pack hits, not Job findings.
 */
export async function prepareStepChat(
  pipeline: JobPipeline,
  inputs: { input?: StepChatInput },
): Promise<StepChatPrep> {
  const raw = inputs.input;
  if (!raw?.step || !raw.userMessage) {
    throw new Error("step-chat-v1 requires step, userMessage");
  }
  const payload = resolveStepChatInput(raw);
  if (!payload.traceId) {
    throw new Error("step-chat-v1 requires traceId, step, userMessage");
  }

  const ctx = await buildJobContext(pipeline, payload.traceId, payload.step, {
    packId: payload.packId,
    hits: payload.hits,
  });
  const packId = payload.packId ?? ctx.pack_id;
  const should_search: StepChatPrep["should_search"] = shouldSearchClause(
    payload.step,
    payload.userMessage,
    packId,
  )
    ? "search"
    : "skip";
  const should_draft: StepChatPrep["should_draft"] = shouldDraftWording(
    payload.step,
    payload.userMessage,
  )
    ? "draft"
    : "skip";

  return {
    jobId: ctx.job_id,
    packId,
    step: payload.step,
    userMessage: payload.userMessage,
    contextText: formatJobContextForPrompt(ctx),
    system: stepSystemPrompt(payload.step),
    should_search,
    should_draft,
    search_args: {
      packId: packId ?? "",
      query: payload.userMessage,
      jobId: ctx.job_id,
    },
  };
}

function bindSearchArgs(inputs: { prep?: unknown }): StepChatPrep["search_args"] {
  return asPrep(inputs.prep).search_args;
}

function mapWordingArgs(
  inputs: { prep?: unknown; llm_text?: unknown },
  context: { runId: string },
): StepChatWordingArgs {
  const prep = asPrep(inputs.prep);
  const raw = typeof inputs.llm_text === "string" ? inputs.llm_text : "";
  return {
    jobId: prep.jobId,
    wording: capWording(raw.trim()),
    agentRunId: context.runId,
  };
}

function assembleReply(inputs: StepChatAssembleInputs): {
  reply: string;
  proposalId?: string;
} {
  const replyBase = appendEmptySearchNotice(
    typeof inputs.llm_text === "string" ? inputs.llm_text : "",
    inputs,
  );
  const proposalId = inputs.wording_result?.proposal_id;
  if (!proposalId) {
    return { reply: replyBase, proposalId: undefined };
  }
  return {
    reply: `${replyBase}\n\n已生成待审提案（proposal_id=${proposalId}）。请在待审页确认，对话不能代替确认。`,
    proposalId,
  };
}

const TEACH_UNCONFIGURED = UNCONFIGURED_LLM_MESSAGE;
const TEACH_PARSE_FAIL_REPLY =
  "未能解析教学草稿。请用自然语言说明表名、检查项和修法。对话不能代替确认。";
const TEACH_OK_REPLY =
  "草稿已更新。请核对人话摘要后使用主按钮确认完成并处理；对话里声称已确认不会写入索引。";

function pipelineLedger(pipeline: JobPipeline): LedgerStore {
  return (pipeline as unknown as { store: LedgerStore }).store;
}

function isUnconfiguredLlmText(text: string): boolean {
  return text.includes("尚未配置大语言模型");
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(text.slice(start, end + 1));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseTeachDraftPayload(raw: string): SkillDraftPayload | null {
  const obj = extractJsonObject(raw);
  if (!obj) {
    return null;
  }
  const hasDraftKey =
    typeof obj.canonical_name === "string" ||
    Array.isArray(obj.names) ||
    Array.isArray(obj.check_items) ||
    Array.isArray(obj.fix_actions);
  if (!hasDraftKey) {
    return null;
  }
  return parseSkillDraftPayload(obj);
}

function renderTeachSummary(draft: SkillDraft, documentText: string): SkillTeachSummary {
  const match = matchCheckItems(documentText, draft.payload.check_items);
  return {
    ...draft.summary,
    check_match: match.item_results.map((row) => ({
      label: row.item.label,
      matched: row.matched,
      reason: row.reason,
    })),
    can_confirm: canConfirmSkill({
      summary: draft.summary,
      check_items: draft.payload.check_items,
    }),
  };
}

function emptyTeachDraft(jobId: string, packId: string): SkillDraft {
  const payload = emptySkillDraftPayload();
  return {
    draft_id: "",
    job_id: jobId,
    pack_id: packId,
    payload,
    summary: {
      names: [],
      check_labels: [],
      fix_plain: [],
    },
    selected_skill_id: null,
  };
}

/**
 * WHY: Teaching is not a graph run. Going through step-chat-v1 would register
 * and call search_clause; chat must never write the pack index (R9/R10).
 */
export async function teachSkillFromChat(input: TeachSkillFromChatInput): Promise<StepChatReply> {
  const job = await input.pipeline.getJobByTrace(input.traceId);
  if (!job) {
    throw new Error(`skill teach requires job for trace ${input.traceId}`);
  }
  const extraction = await input.pipeline.getExtraction(job.job_id);
  const documentText = extraction?.ocr_text ?? "";
  const row = await input.pipeline.getSkillDraftByJob(job.job_id);
  const current = row
    ? skillDraftFromRow(row)
    : emptyTeachDraft(job.job_id, job.pack_id ?? "");
  const raw = await input.llm.complete({
    prompt: buildSkillTeachPrompt({
      documentText,
      userMessage: input.userMessage,
      draftNames: current.summary.names,
      draftCheckLabels: current.summary.check_labels,
    }),
  });
  const agentRunId = `skill-teach:${job.job_id}`;
  if (isUnconfiguredLlmText(raw)) {
    return {
      reply: TEACH_UNCONFIGURED,
      agentRunId,
      skill_summary: renderTeachSummary(current, documentText),
    };
  }
  const parsed = parseTeachDraftPayload(raw);
  if (!parsed) {
    return {
      reply: TEACH_PARSE_FAIL_REPLY,
      agentRunId,
      skill_summary: renderTeachSummary(current, documentText),
    };
  }
  const next = await upsertSkillDraft(input.ledger, {
    job_id: job.job_id,
    pack_id: current.pack_id || job.pack_id || "",
    payload: parsed,
    selected_skill_id: current.selected_skill_id,
  });
  return {
    reply: TEACH_OK_REPLY,
    agentRunId,
    skill_summary: renderTeachSummary(next, documentText),
  };
}

async function buildLlmPrompt(channels: Record<string, unknown>): Promise<string> {
  const prep = asPrep(channels.prep);
  return [
    prep.system,
    "",
    "## 当前任务上下文",
    prep.contextText,
    "",
    "## 检索条款",
    formatHitsForPrompt(channels.search_hits),
    "",
    "## 用户消息",
    prep.userMessage,
    "",
    "请用中文简要回答（2-6 句）。不要声称已确认、已提交或已取消 blocking。",
  ].join("\n");
}

function searchBranchCondition(channels: Record<string, unknown>): string {
  return asPrep(channels.prep).should_search;
}

function draftBranchCondition(channels: Record<string, unknown>): string {
  return asPrep(channels.prep).should_draft;
}

function buildStepChatNodes(pipeline: JobPipeline): GraphNode[] {
  return [
    { id: "start", type: "start" },
    {
      id: "prepare",
      type: "fn",
      config: {
        inputChannels: ["input"],
        outputChannel: "prep",
        inlineFn: (inputs: { input?: StepChatInput }) => prepareStepChat(pipeline, inputs),
      },
    },
    {
      id: "map_search",
      type: "fn",
      config: {
        inputChannels: ["prep"],
        outputChannel: "search_args",
        inlineFn: bindSearchArgs,
      },
    },
    {
      id: "branch_search",
      type: "branch",
      config: { condition: searchBranchCondition },
    },
    {
      id: "skip_search",
      type: "fn",
      config: { inlineFn: () => throwSkipJoin("skip_search") },
    },
    {
      id: "call_search",
      type: "tool",
      config: {
        toolName: "search_clause",
        inputFrom: "search_args",
        outputChannel: "search_hits",
        idempotencyKey: "{{runId}}-search_clause",
      },
    },
    {
      id: "llm",
      type: "llm",
      config: {
        outputChannel: "llm_text",
        promptTemplate: buildLlmPrompt,
      },
    },
    {
      id: "map_wording",
      type: "fn",
      config: {
        inputChannels: ["prep", "llm_text"],
        outputChannel: "wording_args",
        inlineFn: mapWordingArgs,
      },
    },
    {
      id: "branch_draft",
      type: "branch",
      config: { condition: draftBranchCondition },
    },
    {
      id: "skip_draft",
      type: "fn",
      config: { inlineFn: () => throwSkipJoin("skip_draft") },
    },
    {
      id: "call_wording",
      type: "tool",
      config: {
        toolName: "check_wording",
        inputFrom: "wording_args",
        outputChannel: "wording_result",
        idempotencyKey: "{{runId}}-check_wording",
      },
    },
    {
      id: "assemble",
      type: "fn",
      config: {
        inputChannels: ["prep", "llm_text", "wording_result", "search_hits"],
        outputChannel: "output",
        inlineFn: assembleReply,
      },
    },
    { id: "end", type: "end" },
  ];
}

function buildStepChatEdges(): GraphEdge[] {
  return [
    { from: "start", to: "prepare" },
    { from: "prepare", to: "map_search" },
    { from: "map_search", to: "branch_search" },
    { from: "branch_search", to: "call_search", condition: "search" },
    { from: "branch_search", to: "skip_search" },
    { from: "call_search", to: "llm" },
    { from: "call_search", to: "llm", onError: true },
    { from: "skip_search", to: "llm", onError: true },
    { from: "llm", to: "map_wording" },
    { from: "map_wording", to: "branch_draft" },
    { from: "branch_draft", to: "call_wording", condition: "draft" },
    { from: "branch_draft", to: "skip_draft" },
    { from: "call_wording", to: "assemble" },
    { from: "skip_draft", to: "assemble", onError: true },
    { from: "assemble", to: "end" },
  ];
}

/**
 * Native step-chat-v1 graph: prepare → branch search/tool → llm → branch draft/tool → assemble.
 * `registry` is accepted for factory compatibility; tools resolve via ControlPlane default registry.
 */
export function buildStepChatGraphDefinition(
  pipeline: JobPipeline,
  _registry: ToolRegistry,
): GraphDefinition {
  return {
    graphId: "step-chat-v1",
    nodes: buildStepChatNodes(pipeline),
    edges: buildStepChatEdges(),
  };
}

/**
 * Embeds agent-runtime ControlPlane for per-message step chat runs.
 * Each POST /api/chat triggers one short graph run (step-chat-v1).
 */
export class StepChatBridge {
  constructor(
    private readonly plane: ControlPlane,
    private readonly pipeline: JobPipeline,
    private readonly projectRoot: string,
    private readonly registry: ToolRegistry,
  ) {}

  static async create(options: StepChatBridgeOptions): Promise<StepChatBridge> {
    const factory = await AgentRuntimeFactory.getOrCreate(options);
    return factory.getStepChatBridge();
  }

  /** Probe whether live Zhipu config is loaded (Fake → skip). */
  static probeLlmHealth(projectRoot?: string): LlmHealth {
    const root = projectRoot ?? resolveRepoRoot();
    const cfg = loadLlmRuntimeConfig(root);
    if (!cfg) return "skip";
    try {
      initDefaultLlmProvider(root);
      return "ok";
    } catch {
      return "fail";
    }
  }

  async reply(input: StepChatInput): Promise<StepChatReply> {
    const payload = resolveStepChatInput(input);
    if (isSkillTeachStep(payload.step)) {
      return teachSkillFromChat({
        pipeline: this.pipeline,
        ledger: pipelineLedger(this.pipeline),
        llm: getDefaultLlmProvider(),
        traceId: payload.traceId,
        userMessage: payload.userMessage,
      });
    }
    const started = await this.plane.startRun({
      graphId: "step-chat-v1",
      input: payload,
      threadId: `${payload.traceId}:${payload.step}`,
    });

    const result = await this.plane.waitForRun(started.runId);
    if (!result || result.status === "failed") {
      const message =
        typeof result?.error === "object" && result.error && "message" in result.error
          ? String((result.error as { message: string }).message)
          : "agent run failed";
      throw new Error(message);
    }

    const output = result.output as { reply?: string; proposalId?: string } | undefined;
    const reply = output?.reply?.trim();
    if (!reply) {
      throw new Error("step-chat-v1 produced empty reply");
    }

    return {
      reply,
      agentRunId: started.runId,
      proposalId: output?.proposalId,
    };
  }
}
