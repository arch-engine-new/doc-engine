/**
 * F-10 Task 3: SkillDraft upsert + engine SkillSummary (M4 / R3 R8 R11 R13).
 */

import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { runMigrationOnDb } from "../src/persistence/migrate.js";
import { SqliteLedger } from "../src/persistence/ledger.js";
import { CoreEngineStore } from "../src/persistence/store.js";
import {
  SkillIndex,
  canConfirmSkill,
  draftPayloadFromRecord,
  emptySkillDraftPayload,
  renderSkillSummary,
  skillDraftFromRow,
  upsertSkillDraft,
  type SkillDraftPayload,
  type SkillRecord,
} from "../src/skill/index.js";

function openLedger(): { db: Database.Database; ledger: SqliteLedger } {
  const db = new Database(":memory:");
  runMigrationOnDb(db);
  return { db, ledger: new SqliteLedger(new CoreEngineStore(db)) };
}

function record(
  partial: Pick<SkillRecord, "skill_id" | "pack_id" | "canonical_name"> & Partial<SkillRecord>,
): SkillRecord {
  return {
    project_id: "prj_skill",
    names: [partial.canonical_name],
    aliases: [],
    check_items: [],
    fix_actions: [],
    version: 1,
    ...partial,
  };
}

function taughtPayload(): SkillDraftPayload {
  return {
    canonical_name: "混凝土浇筑施工记录",
    names: ["混凝土浇筑施工记录"],
    aliases: [],
    check_items: [{ label: "混凝土强度等级须写 C30", keywords: ["C30"] }],
    fix_actions: [{ kind: "annotate_fail", on: "on_fail" }],
  };
}

describe("SkillSummary engine render (M4)", () => {
  it("renders three blocks from Record/Draft JSON, not from chat text (R3/R11)", () => {
    const payload = taughtPayload();
    const chat = "用户说这是浇筑表，按你刚才说的规则来";
    const fromDraft = renderSkillSummary(payload);
    const fromRecord = renderSkillSummary(
      record({
        skill_id: "sk_1",
        pack_id: "pack_a",
        canonical_name: payload.canonical_name,
        names: payload.names,
        check_items: payload.check_items,
        fix_actions: payload.fix_actions,
      }),
    );
    expect(fromDraft.names).toEqual(["混凝土浇筑施工记录"]);
    expect(fromDraft.check_labels).toEqual(["混凝土强度等级须写 C30"]);
    expect(fromDraft.fix_plain.length).toBeGreaterThanOrEqual(1);
    expect(fromDraft.fix_plain[0]).toContain("标记不过");
    expect(fromRecord).toEqual(fromDraft);
    expect(chat.includes(fromDraft.check_labels[0]!)).toBe(false);
    expect(chat.includes(fromDraft.fix_plain[0]!)).toBe(false);
  });

  it("changes check_labels when draft check_items change (M4)", () => {
    const payload = taughtPayload();
    const before = renderSkillSummary(payload);
    payload.check_items = [{ label: "坍落度须填实测值", keywords: ["坍落度"] }];
    const after = renderSkillSummary(payload);
    expect(after.check_labels).toEqual(["坍落度须填实测值"]);
    expect(after.check_labels).not.toEqual(before.check_labels);
    const chat = "把检查项改一下";
    expect(chat.includes("坍落度须填实测值")).toBe(false);
    expect(after.check_labels[0]).toBe("坍落度须填实测值");
  });

  it("sets canConfirm=false when summary is missing or check_items is empty", () => {
    const empty = renderSkillSummary(emptySkillDraftPayload());
    expect(canConfirmSkill({ summary: null, check_items: [{ label: "x", keywords: [] }] })).toBe(
      false,
    );
    expect(canConfirmSkill({ summary: empty, check_items: [] })).toBe(false);
    const namedOnly: SkillDraftPayload = {
      ...emptySkillDraftPayload(),
      names: ["混凝土浇筑施工记录"],
      canonical_name: "混凝土浇筑施工记录",
    };
    expect(canConfirmSkill({ summary: renderSkillSummary(namedOnly), check_items: [] })).toBe(false);
    const ready = taughtPayload();
    expect(canConfirmSkill({ summary: renderSkillSummary(ready), check_items: ready.check_items })).toBe(
      true,
    );
  });
});

describe("SkillDraft upsert", () => {
  let opened: ReturnType<typeof openLedger> | undefined;

  afterEach(() => {
    opened?.db.close();
    opened = undefined;
  });

  async function seedJob(packId = "pack_a") {
    opened = openLedger();
    const { ledger } = opened;
    const project = await ledger.insertProject("skill-draft");
    const job = await ledger.insertJob({
      project_id: project.project_id,
      pack_id: packId,
      status: "uploaded",
      track: "skill",
    });
    return { ledger, job };
  }

  it("hangs one draft on job_id and chat upserts the same row (R8)", async () => {
    const { ledger, job } = await seedJob();
    const first = await upsertSkillDraft(ledger, {
      job_id: job.job_id,
      pack_id: "pack_a",
      payload: emptySkillDraftPayload(),
    });
    expect(first.job_id).toBe(job.job_id);
    expect(canConfirmSkill({ summary: first.summary, check_items: first.payload.check_items })).toBe(
      false,
    );
    const second = await upsertSkillDraft(ledger, {
      job_id: job.job_id,
      pack_id: "pack_a",
      payload: taughtPayload(),
    });
    expect(second.draft_id).toBe(first.draft_id);
    expect(second.summary.check_labels).toEqual(["混凝土强度等级须写 C30"]);
    const byJob = await ledger.getSkillDraftByJob(job.job_id);
    expect(byJob?.draft_id).toBe(first.draft_id);
    expect(skillDraftFromRow(byJob!).summary.check_labels).toEqual(["混凝土强度等级须写 C30"]);
  });

  it("re-renders summary from payload even if summary_json was stuffed with chat text (M4)", async () => {
    const { ledger, job } = await seedJob();
    const payload = taughtPayload();
    const inserted = await ledger.insertSkillDraft({
      job_id: job.job_id,
      pack_id: "pack_a",
      payload_json: JSON.stringify(payload),
      summary_json: JSON.stringify({
        names: ["模型口述的表名"],
        check_labels: ["模型说已经教完了"],
        fix_plain: ["模型说点确认即可"],
      }),
    });
    const draft = skillDraftFromRow(inserted);
    expect(draft.summary.names).toEqual(["混凝土浇筑施工记录"]);
    expect(draft.summary.check_labels).toEqual(["混凝土强度等级须写 C30"]);
    expect(draft.summary.fix_plain[0]).toContain("标记不过");
    expect(draft.summary.check_labels).not.toContain("模型说已经教完了");
  });

  it("lets chat edit an existing Skill only on the draft; index stays the old version (R13)", async () => {
    const { ledger, job } = await seedJob();
    const live = record({
      skill_id: "sk_live",
      pack_id: "pack_a",
      canonical_name: "混凝土浇筑施工记录",
      check_items: [{ label: "旧检查：强度等级 C30", keywords: ["C30"] }],
      fix_actions: [{ kind: "noop", on: "on_fail" }],
    });
    await ledger.insertSkillRecord({
      skill_id: live.skill_id,
      pack_id: live.pack_id,
      project_id: live.project_id,
      canonical_name: live.canonical_name,
      names_json: JSON.stringify(live.names),
      aliases_json: JSON.stringify(live.aliases),
      check_items_json: JSON.stringify(live.check_items),
      fix_actions_json: JSON.stringify(live.fix_actions),
      version: live.version,
    });
    const index = new SkillIndex();
    index.put(live);
    const payload = draftPayloadFromRecord(live);
    payload.check_items = [{ label: "新检查：坍落度须填实测值", keywords: ["坍落度"] }];
    const draft = await upsertSkillDraft(ledger, {
      job_id: job.job_id,
      pack_id: "pack_a",
      payload,
    });
    expect(draft.summary.check_labels).toEqual(["新检查：坍落度须填实测值"]);
    expect(index.lookup("pack_a", "混凝土浇筑施工记录").hit?.check_items[0]?.label).toBe(
      "旧检查：强度等级 C30",
    );
    const listed = await ledger.listSkillRecords("pack_a");
    expect(JSON.parse(String(listed[0]!.check_items_json))).toEqual(live.check_items);
  });
});
