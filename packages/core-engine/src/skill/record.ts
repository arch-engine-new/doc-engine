/**
 * Production Skill shape. Persistence stores JSON strings; this is the parsed domain record.
 */

/** Engine-owned check clause; matching happens later in matchCheckItems, never in lookup. */
export type SkillCheckItem = {
  label: string;
  keywords: string[];
};

/** Closed enum of engine-owned repair kinds; unknown values are leftovers, never a script slot (spec: no arbitrary code). */
export type SkillFixKind = "noop" | "annotate_fail" | "patch_fields" | "patch_excel" | "copy_original";

/** Default on_fail so a passing check does not mutate the artifact; always is explicit opt-in to avoid accidental repairs. */
export type SkillFixOn = "on_fail" | "always";

/** Cell mapping lives on the Skill so Excel fill never needs DocType/Template. */
export type SkillExcelMapping = {
  sheet: string;
  cell: string;
  field_key: string;
};

export type SkillFixAction = {
  kind: SkillFixKind;
  /** Default on_fail: only run when the check verdict is fail. */
  on: SkillFixOn;
  payload?: {
    mappings?: SkillExcelMapping[];
  };
};

/**
 * One table → one Skill. Uniqueness is (pack_id, canonical_name), not a global name,
 * so two packs can teach the same table without colliding (R26).
 */
export type SkillRecord = {
  skill_id: string;
  pack_id: string;
  project_id: string;
  canonical_name: string;
  names: string[];
  aliases: string[];
  check_items: SkillCheckItem[];
  fix_actions: SkillFixAction[];
  version: number;
};
