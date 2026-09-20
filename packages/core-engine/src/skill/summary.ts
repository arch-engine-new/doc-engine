import type { SkillCheckItem, SkillFixAction, SkillFixKind, SkillRecord } from "./record.js";

/**
 * Confirm unlocks from these three engine-rendered blocks, never from the last
 * assistant sentence (R11/M4).
 */
export type SkillSummary = {
  names: string[];
  check_labels: string[];
  /** One human sentence per fix_action so the UI can show「会怎么修」without model speech. */
  fix_plain: string[];
};

type SkillSummarySource = Pick<SkillRecord, "names" | "check_items" | "fix_actions"> &
  Partial<Pick<SkillRecord, "canonical_name">>;

const FIX_KIND_PLAIN: Record<SkillFixKind, string> = {
  noop: "不修改原件",
  annotate_fail: "在结论上标记不过",
  patch_fields: "按字段补丁修改",
  patch_excel: "按 Skill 上的单元格映射填写 Excel",
  copy_original: "修后件保持原件",
};

function formatFixPlain(action: SkillFixAction): string {
  const when = action.on === "always" ? "无论检查是否通过" : "检查不过时";
  return `${when}${FIX_KIND_PLAIN[action.kind]}`;
}

function isEmptySummary(summary: SkillSummary): boolean {
  return (
    summary.names.length === 0 &&
    summary.check_labels.length === 0 &&
    summary.fix_plain.length === 0
  );
}

/**
 * Chat transcripts must not be the summary source: changing draft JSON (not the
 * last user sentence) is what the UI and confirm gate observe (M4).
 */
export function renderSkillSummary(source: SkillSummarySource): SkillSummary {
  const names = source.names.map((name) => name.trim()).filter(Boolean);
  const canonical = source.canonical_name?.trim();
  if (names.length === 0 && canonical) {
    names.push(canonical);
  }
  return {
    names,
    check_labels: source.check_items.map((item) => item.label),
    fix_plain: source.fix_actions.map(formatFixPlain),
  };
}

/**
 * Model speech cannot unlock confirm: empty engine summary or zero check_items
 * keep the button disabled until the draft JSON actually has the three blocks.
 */
export function canConfirmSkill(input: {
  summary: SkillSummary | null | undefined;
  check_items: SkillCheckItem[];
}): boolean {
  if (!input.summary || isEmptySummary(input.summary)) {
    return false;
  }
  return input.check_items.length >= 1;
}
