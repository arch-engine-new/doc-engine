import type { JobView, SkillCandidateView, SkillSummaryView } from "../../services/types";

/** Hidden file input must include xlsx so Skill uploads can skip OCR and read cells. */
export const SKILL_UPLOAD_ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.xlsx,application/pdf,image/*,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const EMPTY_FILE_TAG = "未选择 · 允许 PDF/图片/xlsx · 不强制 DocType";

function isSkillSummaryView(value: unknown): value is SkillSummaryView {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return Array.isArray(row.names) && Array.isArray(row.check_labels) && Array.isArray(row.fix_plain);
}

function nonEmpty(values: string[] | undefined): string[] {
  return (values ?? []).map((item) => item.trim()).filter(Boolean);
}

/**
 * WHY: Confirm must stay locked until the engine-rendered three blocks exist.
 * Chat utterances like「可以确认了」are not a SkillSummary and must not unlock (M4).
 */
export function canConfirmSkillUi(summary: unknown): boolean {
  if (!isSkillSummaryView(summary)) return false;
  if (summary.can_confirm === false) return false;
  return (
    nonEmpty(summary.names).length >= 1 &&
    nonEmpty(summary.check_labels).length >= 1 &&
    nonEmpty(summary.fix_plain).length >= 1
  );
}

/**
 * WHY: Skill-track upload is the default workbench path; binding it to DocType
 * would revive leftover C2 and fail M12 / A20.
 */
export function canUploadSkill(input: { busy: boolean; selectedDocTypeId?: string }): boolean {
  return !input.busy;
}

/**
 * leftover C2 jobs omit track; only an explicit skill row is the teach path.
 * WHY: findings links and leftover confirm-next must not treat a missing track as Skill.
 */
export function isSkillTrack(job: { track?: string } | null | undefined): boolean {
  return job?.track === "skill";
}

/**
 * WHY: `isSkillTeachStep` only accepts `job_upload`. Reusing leftover
 * uploaded/inspecting steps would skip teaching and drop `skill_summary`.
 */
export function chatStepForJob(job: { track?: string; status?: string } | null | undefined): string {
  if (isSkillTrack(job)) return "job_upload";
  return job?.status || "inspecting";
}

/**
 * WHY: Backend treats `track=all` as leftover; the page merges two GETs so
 * findings can keep the default-legacy contract (M16).
 */
export function mergeJobLists(legacyJobs: JobView[], skillJobs: JobView[]): JobView[] {
  const seen = new Set<string>();
  const out: JobView[] = [];
  for (const job of [...skillJobs, ...legacyJobs]) {
    if (seen.has(job.job_id)) continue;
    seen.add(job.job_id);
    out.push(job);
  }
  return out;
}

/** File chip copy when the picker is empty vs after a Skill upload — not a confirm gate. */
export function skillFileTag(fileName?: string | null): string {
  return fileName ? `${fileName} · skill 轨已建草稿` : EMPTY_FILE_TAG;
}

/** Render one engine block; empty arrays stay「摘要未出」so speech cannot fill the slot. */
export function joinSummaryLine(values: string[] | undefined, emptyText: string): string {
  const items = nonEmpty(values);
  return items.length > 0 ? items.join("；") : emptyText;
}

/** Dry-run candidates feed the select; confirm still needs a click when length > 1. */
export function rememberCandidates(rows: SkillCandidateView[] | undefined): SkillCandidateView[] {
  return (rows ?? []).filter((row) => row.skill_id);
}
