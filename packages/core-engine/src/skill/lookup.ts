import type { SkillRecord } from "./record.js";

/** Names at or below this length never substring-match; OCR headings must not steal "钢筋表". */
export const EXACT_NAME_MAX_CHARS = 5;

export type SkillLookupResult = {
  /** Set only when exactly one record matches; 0 or many stay null so the user must pick. */
  hit: SkillRecord | null;
  candidates: SkillRecord[];
};

/** Count Unicode code points so CJK table names are "字", not UTF-16 units. */
export function charCount(value: string): number {
  return Array.from(value).length;
}

/**
 * ≤5 字 is an exact key. >5 may substring-match, but only when the stored name is also >5;
 * a short stored name must not hit a long heading that merely contains it.
 */
export function nameMatchesQuery(query: string, stored: string): boolean {
  const q = query.trim();
  const s = stored.trim();
  if (!q || !s) {
    return false;
  }
  if (q === s) {
    return true;
  }
  if (charCount(q) <= EXACT_NAME_MAX_CHARS || charCount(s) <= EXACT_NAME_MAX_CHARS) {
    return false;
  }
  return q.includes(s) || s.includes(q);
}

function searchableNames(record: SkillRecord): string[] {
  return [record.canonical_name, ...record.names, ...record.aliases];
}

function recordMatchesQuery(record: SkillRecord, query: string): boolean {
  return searchableNames(record).some((name) => nameMatchesQuery(query, name));
}

/**
 * Filter already pack-scoped records. Callers must not pass mixed packs;
 * isolation is SkillIndex's job, not this function's.
 */
export function lookupSkillRecords(records: SkillRecord[], query: string): SkillLookupResult {
  const candidates = records.filter((record) => recordMatchesQuery(record, query));
  return {
    hit: candidates.length === 1 ? candidates[0]! : null,
    candidates,
  };
}
