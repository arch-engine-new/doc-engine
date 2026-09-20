/**
 * F-10 Task 1: skill ledger schema + Job.track + pack-isolated skill records.
 */

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { LEDGER_TABLES, runMigrationOnDb } from "../persistence/migrate.js";
import { SqliteLedger } from "../persistence/ledger.js";
import { CoreEngineStore } from "../persistence/store.js";
import { LedgerConflictError } from "../pipeline/job-pipeline.js";

function pragmaColumns(db: Database.Database, table: string): string[] {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.map((row) => row.name);
}

function openLedger(): { db: Database.Database; store: CoreEngineStore; ledger: SqliteLedger } {
  const db = new Database(":memory:");
  runMigrationOnDb(db);
  const store = new CoreEngineStore(db);
  return { db, store, ledger: new SqliteLedger(store) };
}

function skillWrite(packId: string, canonicalName: string) {
  return {
    pack_id: packId,
    project_id: "prj_skill",
    canonical_name: canonicalName,
    names_json: JSON.stringify([canonicalName]),
    aliases_json: "[]",
    check_items_json: "[]",
    fix_actions_json: "[]",
  };
}

describe("skill ledger migrate and CRUD", () => {
  let opened: ReturnType<typeof openLedger> | undefined;

  afterEach(() => {
    opened?.db.close();
    opened = undefined;
  });

  it("adds t_job.track after migrate (default leftover rows stay legacy)", () => {
    opened = openLedger();
    const cols = pragmaColumns(opened.db, "t_job");
    expect(cols).toContain("track");
    expect(cols).toContain("skill_draft_id");
  });

  it("inserts skill records with the same canonical_name under different pack_id (R26)", async () => {
    opened = openLedger();
    const { ledger } = opened;
    const a = await ledger.insertSkillRecord(skillWrite("pack_a", "混凝土浇筑记录"));
    const b = await ledger.insertSkillRecord(skillWrite("pack_b", "混凝土浇筑记录"));
    expect(a.skill_id).not.toBe(b.skill_id);
    expect(a.pack_id).toBe("pack_a");
    expect(b.pack_id).toBe("pack_b");
  });

  it("rejects a second skill record in the same pack with the same canonical_name", async () => {
    opened = openLedger();
    const { ledger } = opened;
    await ledger.insertSkillRecord(skillWrite("pack_a", "混凝土浇筑记录"));
    await expect(ledger.insertSkillRecord(skillWrite("pack_a", "混凝土浇筑记录"))).rejects.toBeInstanceOf(
      LedgerConflictError,
    );
  });

  it("creates t_skill_ledger without external adapter columns (R15)", () => {
    opened = openLedger();
    const cols = pragmaColumns(opened.db, "t_skill_ledger");
    expect(cols).toContain("ledger_id");
    expect(cols).toContain("original_blob_uri");
    expect(cols).toContain("unprocessed_tables_json");
    expect(cols.some((name) => name.includes("adapter"))).toBe(false);
    expect(LEDGER_TABLES).toEqual(expect.arrayContaining(["t_skill_record", "t_skill_draft", "t_skill_ledger"]));
  });

  it("insertJob defaults track to legacy and listJobs({track}) filters", async () => {
    opened = openLedger();
    const { ledger } = opened;
    const project = await ledger.insertProject("skill-migrate");
    const leftover = await ledger.insertJob({
      project_id: project.project_id,
      pack_id: null,
      status: "uploaded",
    });
    const skillJob = await ledger.insertJob({
      project_id: project.project_id,
      pack_id: null,
      status: "uploaded",
      track: "skill",
      skill_draft_id: "draft_skill_1",
    });
    expect(leftover.track).toBe("legacy");
    expect(leftover.skill_draft_id).toBeNull();
    expect(skillJob.track).toBe("skill");
    expect(skillJob.skill_draft_id).toBe("draft_skill_1");
    const skillOnly = await ledger.listJobs({ track: "skill" });
    expect(skillOnly.map((row) => row.job_id)).toEqual([skillJob.job_id]);
    const leftoverOnly = await ledger.listJobs({ track: "legacy" });
    expect(leftoverOnly.map((row) => row.job_id)).toEqual([leftover.job_id]);
  });

  it("round-trips skill draft and ledger rows", async () => {
    opened = openLedger();
    const { ledger } = opened;
    const project = await ledger.insertProject("skill-crud");
    const job = await ledger.insertJob({
      project_id: project.project_id,
      pack_id: "pack_a",
      status: "uploaded",
      track: "skill",
    });
    const draft = await ledger.insertSkillDraft({
      job_id: job.job_id,
      pack_id: "pack_a",
      payload_json: '{"names":["表A"]}',
      summary_json: '{"names":["表A"],"check_labels":[],"fix_plain":[]}',
    });
    expect(draft.job_id).toBe(job.job_id);
    const byJob = await ledger.getSkillDraftByJob(job.job_id);
    expect(byJob?.draft_id).toBe(draft.draft_id);
    const updated = await ledger.updateSkillDraft(draft.draft_id, {
      selected_skill_id: "sk_picked",
      summary_json: '{"names":["表A"],"check_labels":["必填"],"fix_plain":[]}',
    });
    expect(updated.selected_skill_id).toBe("sk_picked");
    const ledgerRow = await ledger.insertSkillLedger({
      job_id: job.job_id,
      skill_id: null,
      original_blob_uri: "blob://orig",
      original_mime: "application/pdf",
      verdict: "fail",
      reason: "unreadable",
      fix_list_json: "[]",
      unprocessed_tables_json: "[]",
    });
    expect(ledgerRow.patched_blob_uri).toBeNull();
    const listed = await ledger.listSkillLedgersByJob(job.job_id);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.ledger_id).toBe(ledgerRow.ledger_id);
  });
});
