import type { SkillCheckItem } from "./record.js";

/**
 * Matching is not checking: this step never yields pass, because unmatched
 * rows already lost and matched rows still need the check LLM (R6).
 */
export type MatchCheckVerdict = "fail" | null;

/**
 * Per-item engine outcome. Unmatched must stay fail here so a later model
 * complete() cannot rewrite a miss into 过 (D2).
 */
export type MatchCheckItemResult = {
  item: SkillCheckItem;
  matched: boolean;
  /** fail when unmatched; null when matched (LLM still pending). */
  verdict: MatchCheckVerdict;
  reason: "unmatched" | null;
};

/**
 * Confirm is a later gate (canConfirmSkill / HTTP). This result only answers
 * matching: empty hits with ≥1 items are overall fail, but callers must still
 * be allowed to persist the Skill — just not as 过 (R20).
 */
export type MatchCheckItemsResult = {
  /** Only these items may be sent to the check LLM (R6). */
  matched: SkillCheckItem[];
  unmatched: SkillCheckItem[];
  item_results: MatchCheckItemResult[];
  verdict: MatchCheckVerdict;
};

/** Blank keywords would otherwise vacuously ⊆ any body and wash a miss into a hit. */
function keywordsSubsetOfText(text: string, keywords: string[]): boolean {
  const needles = keywords.map((keyword) => keyword.trim()).filter(Boolean);
  if (needles.length === 0) {
    return false;
  }
  return needles.every((needle) => text.includes(needle));
}

/**
 * Engine match only (关键词 ⊆ 正文). Calling an LLM here would let the model
 * invent hits and skip D2 fail-closed unmatched rows.
 */
export function matchCheckItems(text: string, items: SkillCheckItem[]): MatchCheckItemsResult {
  const item_results: MatchCheckItemResult[] = items.map((item) => {
    const matched = keywordsSubsetOfText(text, item.keywords);
    if (matched) {
      return { item, matched: true, verdict: null, reason: null };
    }
    return { item, matched: false, verdict: "fail", reason: "unmatched" };
  });
  const matched = item_results.filter((row) => row.matched).map((row) => row.item);
  const unmatched = item_results.filter((row) => !row.matched).map((row) => row.item);
  // Any miss is already fail; empty match with ≥1 items is the same D2 wash case.
  const failClosed = unmatched.length > 0 || (matched.length === 0 && items.length >= 1);
  return {
    matched,
    unmatched,
    item_results,
    verdict: failClosed ? "fail" : null,
  };
}
