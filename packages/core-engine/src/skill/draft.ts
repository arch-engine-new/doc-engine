import type { LedgerStore } from "../persistence/ledger.js";
import type { SkillDraftRow } from "../types.js";
import type { SkillCheckItem, SkillFixAction, SkillFixKind, SkillRecord } from "./record.js";
import { renderSkillSummary, type SkillSummary } from "./summary.js";

/**
 * One live draft per job so chat cannot fork a second index candidate;
 * confirm later commits this row, not the chat transcript (R8/R13).
 */
export type SkillDraft = {
  draft_id: string;
  job_id: string;
  pack_id: string;
  payload: SkillDraftPayload;
  /** Always derived from payload JSON; stored summary_json is only a cache. */
  summary: SkillSummary;
  selected_skill_id: string | null;
};

/**
 * The three Skill blocks live in JSON so the engine can re-render the human
 * summary after each chat turn without trusting model speech (R3/R11).
 */
export type SkillDraftPayload = {
  canonical_name: string;
  names: string[];
  aliases: string[];
  check_items: SkillCheckItem[];
  fix_actions: SkillFixAction[];
};

const FIX_KINDS = new Set<SkillFixKind>([
  "noop",
  "annotate_fail",
  "patch_fields",
  "patch_excel",
  "copy_original",
]);

function asObject(raw: unknown): Record<string, unknown> {
  if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
    return {};
  }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function asCheckItems(value: unknown): SkillCheckItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const items: SkillCheckItem[] = [];
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

/**
 * WHY: Chat and ledger JSON must share one mapper so patch_excel.mappings
 * taught over /api/chat still reach SkillRunner; a second mapper that dropped
 * payload would make xlsx repair look unimplemented (R24).
 */
export function parseSkillFixActions(value: unknown): SkillFixAction[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const actions: SkillFixAction[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const rec = item as Record<string, unknown>;
    if (typeof rec.kind !== "string" || !FIX_KINDS.has(rec.kind as SkillFixKind)) {
      continue;
    }
    const action: SkillFixAction = {
      kind: rec.kind as SkillFixKind,
      on: rec.on === "always" ? "always" : "on_fail",
    };
    if (rec.payload && typeof rec.payload === "object" && !Array.isArray(rec.payload)) {
      const payload = rec.payload as { mappings?: unknown };
      if (Array.isArray(payload.mappings)) {
        action.payload = {
          mappings: payload.mappings.flatMap((mapping) => {
            if (!mapping || typeof mapping !== "object") {
              return [];
            }
            const row = mapping as Record<string, unknown>;
            if (
              typeof row.sheet !== "string" ||
              typeof row.cell !== "string" ||
              typeof row.field_key !== "string"
            ) {
              return [];
            }
            return [{ sheet: row.sheet, cell: row.cell, field_key: row.field_key }];
          }),
        };
      }
    }
    actions.push(action);
  }
  return actions;
}

/**
 * WHY: Teach chat must not invent a slimmer parser than the draft row.
 * Losing fix_actions.payload.mappings here is how xlsx confirm would skip
 * the Skill JSON mappings and fall back to DocType (R24/D11).
 */
export function parseSkillDraftPayload(raw: unknown): SkillDraftPayload {
  const obj = asObject(raw);
  return {
    canonical_name: typeof obj.canonical_name === "string" ? obj.canonical_name : "",
    names: asStringArray(obj.names),
    aliases: asStringArray(obj.aliases),
    check_items: asCheckItems(obj.check_items),
    fix_actions: parseSkillFixActions(obj.fix_actions),
  };
}

/**
 * Upload hangs a draft before chat; empty three blocks keep confirm locked
 * so a blank job cannot be committed as a Skill (M3/R11).
 */
export function emptySkillDraftPayload(): SkillDraftPayload {
  return {
    canonical_name: "",
    names: [],
    aliases: [],
    check_items: [],
    fix_actions: [],
  };
}

/**
 * R13 copies a live Skill into the job draft so chat can edit without
 * rewriting the pack index until confirm-skill.
 */
export function draftPayloadFromRecord(record: SkillRecord): SkillDraftPayload {
  return {
    canonical_name: record.canonical_name,
    names: [...record.names],
    aliases: [...record.aliases],
    check_items: record.check_items.map((item) => ({
      label: item.label,
      keywords: [...item.keywords],
    })),
    fix_actions: record.fix_actions.map((action) => ({
      kind: action.kind,
      on: action.on,
      payload: action.payload
        ? { mappings: action.payload.mappings?.map((mapping) => ({ ...mapping })) }
        : undefined,
    })),
  };
}

/**
 * Persistence stores JSON strings; domain code must re-render summary from
 * payload so a stuffed chat sentence in summary_json cannot unlock confirm.
 */
export function skillDraftFromRow(row: SkillDraftRow): SkillDraft {
  const payload = parseSkillDraftPayload(row.payload_json);
  return {
    draft_id: row.draft_id,
    job_id: row.job_id,
    pack_id: row.pack_id,
    payload,
    summary: renderSkillSummary(payload),
    selected_skill_id: row.selected_skill_id,
  };
}

/**
 * Chat must patch the same job row: a second insert would violate
 * uk_t_skill_draft_job and could look like a second Skill candidate (R8).
 */
export async function upsertSkillDraft(
  ledger: Pick<LedgerStore, "getSkillDraftByJob" | "insertSkillDraft" | "updateSkillDraft">,
  input: {
    job_id: string;
    pack_id: string;
    payload: SkillDraftPayload;
    selected_skill_id?: string | null;
  },
): Promise<SkillDraft> {
  const summary = renderSkillSummary(input.payload);
  const payload_json = JSON.stringify(input.payload);
  const summary_json = JSON.stringify(summary);
  const existing = await ledger.getSkillDraftByJob(input.job_id);
  const row = existing
    ? await ledger.updateSkillDraft(existing.draft_id, {
        payload_json,
        summary_json,
        selected_skill_id: input.selected_skill_id,
      })
    : await ledger.insertSkillDraft({
        job_id: input.job_id,
        pack_id: input.pack_id,
        payload_json,
        summary_json,
        selected_skill_id: input.selected_skill_id,
      });
  return skillDraftFromRow(row);
}
