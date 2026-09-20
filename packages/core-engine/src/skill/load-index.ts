/**
 * Hydrate the in-memory SkillIndex from t_skill_record and run confirm / dry-run.
 * Chat must never call this persist path; HTTP confirm-skill is the only writer (R12).
 */

import type { LlmProvider } from "agent-runtime";
import type { BlobStore } from "../blob/port.js";
import { blobObjectUri, safeName } from "../blob/minio.js";
import type { LedgerStore } from "../persistence/ledger.js";
import { LedgerConflictError } from "../pipeline/job-pipeline.js";
import type {
  JobRow,
  SkillLedgerRow,
  SkillRecordRow,
} from "../types.js";
import {
  canConfirmSkill,
  matchCheckItems,
  SkillIndex,
  SkillRunner,
  skillDraftFromRow,
  type MatchCheckItemsResult,
  type SkillCheckItem,
  type SkillDraft,
  type SkillFixStepResult,
  type SkillRecord,
  type SkillRunnerVerdict,
} from "./index.js";

const DEFAULT_BLOB_BUCKET = "docengine";

/**
 * WHY: confirm-skill 409 must not look like leftover HITL `no_open_hitl`;
 * empty summary / missing check_items / unpicked candidates are gates, not 404.
 */
export class SkillConfirmGateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SkillConfirmGateError";
  }
}

/**
 * WHY: Persistence stores JSON strings; lookup/put need domain SkillRecord
 * or pack isolation would miss names sitting in names_json (R26).
 */
export function skillRecordFromRow(row: SkillRecordRow): SkillRecord {
  return {
    skill_id: row.skill_id,
    pack_id: row.pack_id,
    project_id: row.project_id,
    canonical_name: row.canonical_name,
    names: asStringArray(parseJson(row.names_json)),
    aliases: asStringArray(parseJson(row.aliases_json)),
    check_items: asCheckItems(parseJson(row.check_items_json)),
    fix_actions: asFixActions(parseJson(row.fix_actions_json)),
    version: row.version,
  };
}

/**
 * WHY: SkillIndex is memory-only and empty after construct; confirm-skill must
 * reload t_skill_record or a restart would look like an empty engine (R1/R12).
 */
export async function loadSkillIndexFromLedger(
  ledger: Pick<LedgerStore, "listSkillRecords">,
  packId: string,
): Promise<SkillIndex> {
  const index = new SkillIndex();
  for (const row of await ledger.listSkillRecords(packId)) {
    index.put(skillRecordFromRow(row));
  }
  return index;
}

/** Shared match+check+repair snapshot so dry-run cannot diverge from confirm (D7). */
export type SkillProcessPreview = {
  skill_id: string | null;
  match: MatchCheckItemsResult;
  check: { verdict: "pass" | "fail"; reason: string; parse_fail: boolean };
  steps: SkillFixStepResult[];
  would_patch: boolean;
  original_mime: string;
  patched_mime: string;
  unprocessed_tables: string[];
  candidates: Array<{ skill_id: string; canonical_name: string }>;
};

/** Confirm response adds the committed Skill and internal ledger row (R15). */
export type SkillConfirmResult = {
  job: JobRow;
  skill: SkillRecord;
  ledger: SkillLedgerRow;
  preview: SkillProcessPreview;
};

/** Dry-run returns the preview only; callers must not treat it as a write receipt. */
export type SkillDryRunResult = {
  preview: SkillProcessPreview;
};

/**
 * WHY: persist=false is the D7 dry-run contract (no index, ledger, or patched blob).
 * persist=true is the only path that commits this pack and writes t_skill_ledger.
 */
export type RunSkillJobInput = {
  persist: boolean;
  jobId: string;
  ledger: LedgerStore;
  blob: BlobStore;
  llm: LlmProvider;
  selectedSkillId?: string | null;
  fieldValues?: Record<string, string | number | boolean | null | undefined>;
};

/**
 * WHY: persist=false omits job/skill/ledger so callers cannot mistake a dry-run
 * preview for a write receipt (D7/R25).
 */
export type RunSkillJobResult = {
  preview: SkillProcessPreview;
  job?: JobRow;
  skill?: SkillRecord;
  ledger?: SkillLedgerRow;
};

/**
 * WHY: HTTP confirm-skill and skill-dry-run must share one engine path so a
 * preview cannot invent a pass that confirm would fail-close (D2/D7).
 */
export async function runSkillJob(input: RunSkillJobInput): Promise<RunSkillJobResult> {
  const ctx = await loadSkillJobContext(input);
  if (input.persist) {
    assertConfirmGate(ctx.draft, ctx.candidates, input.selectedSkillId ?? ctx.draft.selected_skill_id);
  }
  const evaluated = await evaluateSkillJob(ctx, input);
  if (!input.persist) {
    return { preview: evaluated.preview };
  }
  const committed = await persistSkillJob(ctx, input, evaluated);
  return {
    preview: { ...evaluated.preview, skill_id: committed.skill.skill_id },
    job: committed.job,
    skill: committed.skill,
    ledger: committed.ledger,
  };
}

type SkillJobContext = {
  job: JobRow;
  draft: SkillDraft;
  document: { file_uri: string; file_name: string; mime: string | null };
  text: string;
  extractionFields: Record<string, string | number | boolean | null | undefined>;
  candidates: SkillRecord[];
};

type EvaluatedSkillJob = {
  preview: SkillProcessPreview;
  artifact: { bytes: Uint8Array; mime: string };
  originalBytes: Uint8Array;
  skipRepair: boolean;
};

async function loadSkillJobContext(input: RunSkillJobInput): Promise<SkillJobContext> {
  const job = await input.ledger.getJob(input.jobId);
  if (!job) {
    throw new Error(`job not found: ${input.jobId}`);
  }
  if (job.track !== "skill") {
    throw new SkillConfirmGateError("cannot confirm-skill from track=legacy");
  }
  const row = await input.ledger.getSkillDraftByJob(job.job_id);
  if (!row) {
    throw new SkillConfirmGateError("skill draft is required");
  }
  const document = await input.ledger.getDocumentForJob(job.job_id);
  if (!document) {
    throw new Error(`document not found for job: ${job.job_id}`);
  }
  const extraction = await input.ledger.getExtraction(job.job_id);
  const draft = skillDraftFromRow(row);
  const index = await loadSkillIndexFromLedger(input.ledger, draft.pack_id);
  const query = lookupQueryFromDraft(draft);
  const looked = query ? index.lookup(draft.pack_id, query) : { hit: null, candidates: [] };
  return {
    job,
    draft,
    document,
    text: extraction?.ocr_text ?? "",
    extractionFields: parseFieldValues(extraction?.fields_json),
    candidates: looked.candidates,
  };
}

function assertConfirmGate(
  draft: SkillDraft,
  candidates: SkillRecord[],
  selectedSkillId: string | null | undefined,
): void {
  if (!canConfirmSkill({ summary: draft.summary, check_items: draft.payload.check_items })) {
    throw new SkillConfirmGateError("cannot confirm-skill without summary or check_items");
  }
  if (candidates.length > 1 && !selectedSkillId) {
    throw new SkillConfirmGateError("skill candidates require selection");
  }
}

async function evaluateSkillJob(
  ctx: SkillJobContext,
  input: RunSkillJobInput,
): Promise<EvaluatedSkillJob> {
  const match = matchCheckItems(ctx.text, ctx.draft.payload.check_items);
  const check = await runMatchedCheck(input.llm, ctx.text, match);
  const overall = overallCheck(match, check);
  const originalBytes = await input.blob.get(blobKeyFromUri(ctx.document.file_uri));
  const originalMime = ctx.document.mime ?? "application/octet-stream";
  const runner = new SkillRunner();
  const ran = overall.skipRepair
    ? {
        artifact: { bytes: originalBytes, mime: originalMime },
        steps: [] as SkillFixStepResult[],
      }
    : await runner.run({
        skill: { fix_actions: ctx.draft.payload.fix_actions },
        original: { bytes: originalBytes, mime: originalMime },
        verdict: overall.verdict,
        fieldValues: { ...ctx.extractionFields, ...(input.fieldValues ?? {}) },
      });
  const would_patch = !bytesEqual(ran.artifact.bytes, originalBytes);
  return {
    originalBytes,
    skipRepair: overall.skipRepair,
    artifact: ran.artifact,
    preview: {
      skill_id: null,
      match,
      check: { verdict: overall.verdict, reason: overall.reason, parse_fail: check.parse_fail },
      steps: ran.steps,
      would_patch,
      original_mime: originalMime,
      patched_mime: ran.artifact.mime,
      unprocessed_tables: unprocessedTablesFromDraft(ctx.draft),
      candidates: ctx.candidates.map((row) => ({
        skill_id: row.skill_id,
        canonical_name: row.canonical_name,
      })),
    },
  };
}

async function persistSkillJob(
  ctx: SkillJobContext,
  input: RunSkillJobInput,
  evaluated: EvaluatedSkillJob,
): Promise<{ job: JobRow; skill: SkillRecord; ledger: SkillLedgerRow }> {
  const skill = await commitSkillDraftToIndex(input.ledger, ctx.job, ctx.draft);
  let patchedUri: string | null = null;
  let patchedMime: string | null = null;
  if (!evaluated.skipRepair && evaluated.preview.would_patch) {
    const key = `jobs/${ctx.job.job_id}/patched/${safeName(ctx.document.file_name)}`;
    await input.blob.ensureBucket();
    await input.blob.put({
      key,
      bytes: evaluated.artifact.bytes,
      mime: evaluated.artifact.mime,
    });
    patchedUri = blobObjectUri(blobBucketName(input.blob), key);
    patchedMime = evaluated.artifact.mime;
  }
  const ledger = await input.ledger.insertSkillLedger({
    job_id: ctx.job.job_id,
    skill_id: skill.skill_id,
    original_blob_uri: ctx.document.file_uri,
    original_mime: evaluated.preview.original_mime,
    patched_blob_uri: patchedUri,
    patched_mime: patchedMime,
    verdict: evaluated.preview.check.verdict,
    reason: evaluated.preview.check.reason,
    fix_list_json: JSON.stringify(evaluated.preview.steps),
    unprocessed_tables_json: JSON.stringify(evaluated.preview.unprocessed_tables),
  });
  const job = await input.ledger.updateJobStatus(ctx.job.job_id, "checked");
  return { job, skill, ledger };
}

/**
 * WHY: Same (pack, canonical_name) must reuse the live row so a second upload
 * cannot mint a duplicate Skill; overwrite is later, R14 still requires confirm.
 */
async function commitSkillDraftToIndex(
  ledger: LedgerStore,
  job: JobRow,
  draft: SkillDraft,
): Promise<SkillRecord> {
  const canonical =
    draft.payload.canonical_name.trim() || draft.payload.names.find((name) => name.trim()) || "";
  const write = {
    pack_id: draft.pack_id,
    project_id: job.project_id,
    canonical_name: canonical,
    names_json: JSON.stringify(draft.payload.names),
    aliases_json: JSON.stringify(draft.payload.aliases),
    check_items_json: JSON.stringify(draft.payload.check_items),
    fix_actions_json: JSON.stringify(draft.payload.fix_actions),
  };
  try {
    return skillRecordFromRow(await ledger.insertSkillRecord(write));
  } catch (err) {
    if (!(err instanceof LedgerConflictError)) {
      throw err;
    }
    const existing = await ledger.getSkillRecordByPackName(draft.pack_id, canonical);
    if (!existing) {
      throw err;
    }
    return skillRecordFromRow(existing);
  }
}

type CheckOutcome = { verdict: SkillRunnerVerdict; parse_fail: boolean };

async function runMatchedCheck(
  llm: LlmProvider,
  text: string,
  match: MatchCheckItemsResult,
): Promise<CheckOutcome> {
  if (match.matched.length === 0) {
    return { verdict: "fail", parse_fail: false };
  }
  const prompt = buildCheckPrompt(text, match.matched);
  const raw = await llm.complete({ prompt });
  const parsed = parseCheckLlmJson(raw);
  if (!parsed) {
    return { verdict: "fail", parse_fail: true };
  }
  return { verdict: parsed.verdict, parse_fail: false };
}

function overallCheck(
  match: MatchCheckItemsResult,
  check: CheckOutcome,
): { verdict: SkillRunnerVerdict; reason: string; skipRepair: boolean } {
  if (check.parse_fail) {
    return { verdict: "fail", reason: "check_parse_fail", skipRepair: true };
  }
  if (match.verdict === "fail") {
    const reason = match.unmatched.length > 0 ? "unmatched" : "fail";
    return { verdict: "fail", reason, skipRepair: false };
  }
  if (check.verdict === "fail") {
    return { verdict: "fail", reason: "fail", skipRepair: false };
  }
  return { verdict: "pass", reason: "pass", skipRepair: false };
}

/**
 * WHY: Check LLM may only see matched items + body. A JSON example object in
 * the prompt would leak a parseable blob into FakeLlm echo and skip fail-closed.
 */
function buildCheckPrompt(text: string, items: SkillCheckItem[]): string {
  const lines = items.map((item) => `- ${item.label} :: ${item.keywords.join("、")}`);
  return [
    "Evaluate matched check items against the document.",
    "Reply with keys verdict (pass or fail) and item_results only.",
    "Document:",
    text,
    "Matched check items:",
    ...lines,
  ].join("\n");
}

function parseCheckLlmJson(text: string): { verdict: SkillRunnerVerdict } | null {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(trimmed.slice(start, end + 1));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    const verdict = (parsed as { verdict?: unknown }).verdict;
    if (verdict !== "pass" && verdict !== "fail") {
      return null;
    }
    return { verdict };
  } catch {
    return null;
  }
}

function lookupQueryFromDraft(draft: SkillDraft): string {
  return draft.payload.canonical_name.trim() || draft.payload.names.find((name) => name.trim()) || "";
}

function unprocessedTablesFromDraft(draft: SkillDraft): string[] {
  const closed = lookupQueryFromDraft(draft);
  const seen = new Set<string>();
  const extra: string[] = [];
  for (const name of draft.payload.names) {
    const trimmed = name.trim();
    if (!trimmed || trimmed === closed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    extra.push(trimmed);
  }
  return extra;
}

function parseJson(raw: unknown): unknown {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }
  return raw;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function asCheckItems(value: unknown): SkillRecord["check_items"] {
  if (!Array.isArray(value)) {
    return [];
  }
  const items: SkillRecord["check_items"] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const rec = item as Record<string, unknown>;
    items.push({
      label: typeof rec.label === "string" ? rec.label : "",
      keywords: asStringArray(rec.keywords),
    });
  }
  return items;
}

function asFixActions(value: unknown): SkillRecord["fix_actions"] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }
    const rec = item as Record<string, unknown>;
    if (typeof rec.kind !== "string") {
      return [];
    }
    return [
      {
        kind: rec.kind as SkillRecord["fix_actions"][number]["kind"],
        on: rec.on === "always" ? "always" : "on_fail",
        payload:
          rec.payload && typeof rec.payload === "object" && !Array.isArray(rec.payload)
            ? (rec.payload as SkillRecord["fix_actions"][number]["payload"])
            : undefined,
      },
    ];
  });
}

function parseFieldValues(
  raw: unknown,
): Record<string, string | number | boolean | null | undefined> {
  const parsed = parseJson(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }
  const out: Record<string, string | number | boolean | null | undefined> = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      out[key] = value;
    }
  }
  return out;
}

function blobKeyFromUri(uri: string): string {
  if (!uri.startsWith("s3://")) {
    throw new Error(`unsupported file_uri scheme: ${uri}`);
  }
  const withoutScheme = uri.slice(5);
  const slash = withoutScheme.indexOf("/");
  if (slash < 0) {
    throw new Error(`invalid file_uri: ${uri}`);
  }
  return withoutScheme.slice(slash + 1);
}

function blobBucketName(blob: BlobStore): string {
  const maybe = blob as { bucket?: string };
  return typeof maybe.bucket === "string" ? maybe.bucket : DEFAULT_BLOB_BUCKET;
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  return Buffer.compare(Buffer.from(left), Buffer.from(right)) === 0;
}
