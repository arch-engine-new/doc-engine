import { lookupSkillRecords, type SkillLookupResult } from "./lookup.js";
import type { SkillRecord } from "./record.js";

export type { SkillLookupResult } from "./lookup.js";
export { EXACT_NAME_MAX_CHARS, charCount, lookupSkillRecords, nameMatchesQuery } from "./lookup.js";
export type {
  SkillCheckItem,
  SkillExcelMapping,
  SkillFixAction,
  SkillFixKind,
  SkillFixOn,
  SkillRecord,
} from "./record.js";
export type { SkillDraft, SkillDraftPayload } from "./draft.js";
export {
  draftPayloadFromRecord,
  emptySkillDraftPayload,
  skillDraftFromRow,
  upsertSkillDraft,
} from "./draft.js";
export type { SkillSummary } from "./summary.js";
export { canConfirmSkill, renderSkillSummary } from "./summary.js";
export type {
  MatchCheckItemResult,
  MatchCheckItemsResult,
  MatchCheckVerdict,
} from "./match-check-items.js";
export { matchCheckItems } from "./match-check-items.js";
export type {
  SkillFixSkipReason,
  SkillFixStepResult,
  SkillRunnerArtifact,
  SkillRunnerDeps,
  SkillRunnerInput,
  SkillRunnerResult,
  SkillRunnerVerdict,
} from "./runner.js";
export { SkillRunner, XLSX_MIME } from "./runner.js";

/** Same-pack duplicate canonical_name is a conflict; other packs may reuse the name. */
export class SkillIndexConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SkillIndexConflictError";
  }
}

/**
 * In-memory table Skill index. Empty on construct — no seed table names (R1).
 * Persistence is LedgerStore; this layer only enforces lookup rules and pack isolation.
 */
export class SkillIndex {
  private readonly records: SkillRecord[] = [];

  /** List production Skills for one pack; other packs are invisible here. */
  list(packId: string): SkillRecord[] {
    return this.records.filter((record) => record.pack_id === packId);
  }

  /**
   * Insert a production Skill. Unique key is (pack_id, canonical_name) while live;
   * a second insert in the same pack is a conflict, not an overwrite (confirm-skill covers later).
   */
  put(record: SkillRecord): void {
    const exists = this.records.some(
      (row) => row.pack_id === record.pack_id && row.canonical_name === record.canonical_name,
    );
    if (exists) {
      throw new SkillIndexConflictError("skill canonical_name already exists in pack");
    }
    this.records.push(record);
  }

  /**
   * Look up by table name / alias inside one pack. 0 or many matches never become a hit;
   * the UI must point-select from candidates (R19).
   */
  lookup(packId: string, query: string): SkillLookupResult {
    return lookupSkillRecords(this.list(packId), query);
  }
}
