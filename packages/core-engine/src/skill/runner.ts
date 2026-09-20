/**
 * Declared-action repair only. Teaching must not grow a script slot (R7/D9).
 */

import { ExcelFillService } from "../excel/fill-service.js";
import type { SkillExcelMapping, SkillFixAction, SkillFixKind, SkillRecord } from "./record.js";

/** OpenXML xlsx is the only MIME family patch_excel may rewrite; anything else would violate 修后件 MIME=原件 (R24). */
export const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const XLSX_MIME_ALIASES = new Set([
  XLSX_MIME.toLowerCase(),
  "application/vnd.ms-excel",
  "application/x-xlsx",
]);

const DECLARED_KINDS = new Set<SkillFixKind>([
  "noop",
  "annotate_fail",
  "patch_fields",
  "patch_excel",
  "copy_original",
]);

/**
 * ExcelFillService is injectable so tests can prove fill used Skill JSON mappings,
 * not DocType/Template merge, without replacing the real xlsx writer.
 */
export type SkillRunnerDeps = {
  excel?: ExcelFillService;
};

/**
 * Bytes and MIME travel together so a successful Excel fill cannot relabel the
 * blob; BlobStore.put later must reuse this MIME (R24).
 */
export type SkillRunnerArtifact = {
  bytes: Uint8Array;
  mime: string;
};

/**
 * Check pass must not trigger default on_fail repairs; otherwise a green check
 * would still mutate the original (D9).
 */
export type SkillRunnerVerdict = "pass" | "fail";

/**
 * Why a declared action was not applied: either the `on` gate, or a MIME that
 * would make patch_excel emit a different format than the original.
 */
export type SkillFixSkipReason = "on_not_met" | "patch_excel_forbidden_mime" | "unknown_kind";

/**
 * Per-action trace so confirm/dry-run can show why a declared repair did not
 * run, instead of silently rewriting the blob.
 */
export type SkillFixStepResult = {
  kind: SkillFixKind | string;
  applied: boolean;
  skip_reason?: SkillFixSkipReason;
};

/**
 * Input is Skill-owned actions plus the original blob. Field values come from
 * this job's extraction, not a DocType/Template mapping merger.
 */
export type SkillRunnerInput = {
  skill: Pick<SkillRecord, "fix_actions">;
  original: SkillRunnerArtifact;
  verdict: SkillRunnerVerdict;
  fieldValues?: Record<string, string | number | boolean | null | undefined>;
};

/**
 * Result MIME is always the original's so ledger/BlobStore cannot record a
 * converted type after repair (R24).
 */
export type SkillRunnerResult = {
  artifact: SkillRunnerArtifact;
  annotated_fail: boolean;
  fields: Record<string, string | number | boolean | null | undefined>;
  steps: SkillFixStepResult[];
};

function copyBytes(bytes: Uint8Array): Uint8Array {
  return Uint8Array.from(bytes);
}

function isXlsxMime(mime: string): boolean {
  return XLSX_MIME_ALIASES.has(mime.trim().toLowerCase());
}

/** Default on_fail so a passing check does not mutate; `always` is explicit opt-in (D9). */
function shouldApplyOn(action: SkillFixAction, verdict: SkillRunnerVerdict): boolean {
  const on = action.on === "always" ? "always" : "on_fail";
  return on === "always" || verdict === "fail";
}

/**
 * Skill JSON uses `sheet`; ExcelFillService uses `sheet_name`. Mapping here
 * keeps Skill 轨 off the DocType/Template merger.
 */
function mappingsFromSkill(rows: SkillExcelMapping[] | undefined): Array<{
  field_key: string;
  sheet_name: string | null;
  cell: string | null;
  value_type: string;
  signature_role: null;
  rule: null;
}> {
  return (rows ?? []).map((row) => ({
    field_key: row.field_key,
    sheet_name: row.sheet || null,
    cell: row.cell,
    value_type: "string",
    signature_role: null,
    rule: null,
  }));
}

type ActionContext = {
  /** copy_original must restore this, not the in-loop buffer, or a prior patch would stick. */
  originalBytes: Uint8Array;
  bytes: Uint8Array;
  mime: string;
  fieldValues: Record<string, string | number | boolean | null | undefined>;
};

/**
 * Closed enum dispatcher: unknown leftover kinds are skipped, never eval'd.
 */
export class SkillRunner {
  private readonly excel: ExcelFillService;

  constructor(deps: SkillRunnerDeps = {}) {
    this.excel = deps.excel ?? new ExcelFillService();
  }

  /**
   * Runs only Skill-declared actions whose `on` matches the check verdict.
   * Inventing an extra kind at call time would re-open the script slot D9 closed.
   */
  async run(input: SkillRunnerInput): Promise<SkillRunnerResult> {
    const originalMime = input.original.mime;
    const originalBytes = copyBytes(input.original.bytes);
    let bytes = copyBytes(originalBytes);
    let annotatedFail = false;
    const fields: Record<string, string | number | boolean | null | undefined> = {
      ...(input.fieldValues ?? {}),
    };
    const steps: SkillFixStepResult[] = [];

    for (const action of input.skill.fix_actions) {
      const step = await this.applyDeclaredAction(
        action,
        {
          originalBytes,
          bytes,
          mime: originalMime,
          fieldValues: input.fieldValues ?? {},
        },
        input.verdict,
      );
      steps.push(step.record);
      if (!step.record.applied) {
        continue;
      }
      if (step.bytes) {
        bytes = step.bytes;
      }
      if (action.kind === "annotate_fail") {
        annotatedFail = true;
      }
      if (action.kind === "patch_fields") {
        Object.assign(fields, input.fieldValues ?? {});
      }
    }

    return {
      artifact: { bytes, mime: originalMime },
      annotated_fail: annotatedFail,
      fields,
      steps,
    };
  }

  private async applyDeclaredAction(
    action: SkillFixAction,
    ctx: ActionContext,
    verdict: SkillRunnerVerdict,
  ): Promise<{ record: SkillFixStepResult; bytes?: Uint8Array }> {
    if (!DECLARED_KINDS.has(action.kind)) {
      return { record: { kind: action.kind, applied: false, skip_reason: "unknown_kind" } };
    }
    if (!shouldApplyOn(action, verdict)) {
      return { record: { kind: action.kind, applied: false, skip_reason: "on_not_met" } };
    }
    if (action.kind === "patch_excel") {
      return this.applyPatchExcel(action, ctx);
    }
    if (action.kind === "copy_original") {
      return {
        record: { kind: action.kind, applied: true },
        bytes: copyBytes(ctx.originalBytes),
      };
    }
    return { record: { kind: action.kind, applied: true } };
  }

  /**
   * PDF/image must keep their MIME; filling them as xlsx would mint a new type (D11/R24).
   */
  private async applyPatchExcel(
    action: SkillFixAction,
    ctx: ActionContext,
  ): Promise<{ record: SkillFixStepResult; bytes?: Uint8Array }> {
    if (!isXlsxMime(ctx.mime)) {
      return {
        record: {
          kind: "patch_excel",
          applied: false,
          skip_reason: "patch_excel_forbidden_mime",
        },
      };
    }
    const filled = await this.excel.fill({
      template: Buffer.from(ctx.bytes),
      mappings: mappingsFromSkill(action.payload?.mappings),
      fieldValues: ctx.fieldValues,
    });
    return {
      record: { kind: "patch_excel", applied: true },
      bytes: Uint8Array.from(filled),
    };
  }
}
