/**
 * F-10 Task 8: HTTP confirm-skill / skill-dry-run gates (M3 M12 M13 / R8 R10 R12 R14 R15 R16 R25).
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { FakeLlmProvider, setDefaultLlmProvider, type LlmProvider } from "agent-runtime";
import { DemoHttpSession } from "../src/http/session.js";
import { handleDemoRequest } from "../src/http/handle-request.js";
import { upsertSkillDraft, XLSX_MIME, type SkillDraftPayload } from "../src/skill/index.js";

const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

class JsonLlmProvider implements LlmProvider {
  constructor(private readonly json: string) {}
  async complete(): Promise<string> {
    return this.json;
  }
}

async function call(
  session: DemoHttpSession,
  method: string,
  url: string,
  body?: unknown,
) {
  return handleDemoRequest(session, { method, url, body: body ?? {} });
}

async function makeXlsx(sheet: string, cell: string, value: string): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet(sheet);
  ws.getCell(cell).value = value;
  const out = await workbook.xlsx.writeBuffer();
  return new Uint8Array(out);
}

function taughtPayload(overrides: Partial<SkillDraftPayload> = {}): SkillDraftPayload {
  return {
    canonical_name: "混凝土浇筑施工记录",
    names: ["混凝土浇筑施工记录"],
    aliases: [],
    check_items: [{ label: "须有编号", keywords: ["编号"] }],
    fix_actions: [{ kind: "annotate_fail", on: "on_fail" }],
    ...overrides,
  };
}

describe("HTTP confirm-skill / skill-dry-run (F-10 Task 8)", () => {
  let session: DemoHttpSession;
  let tempRoot: string | undefined;
  const previousConfigEnv = process.env.AGENT_RUNTIME_LLM_CONFIG;
  let previousLlm: LlmProvider | undefined;

  beforeEach(() => {
    delete process.env.AGENT_RUNTIME_LLM_CONFIG;
    previousLlm = undefined;
    setDefaultLlmProvider(new FakeLlmProvider());
    tempRoot = mkdtempSync(join(tmpdir(), "skill-confirm-http-"));
    session = new DemoHttpSession({ projectRoot: tempRoot });
  });

  afterEach(async () => {
    await session.close();
    setDefaultLlmProvider(previousLlm ?? new FakeLlmProvider());
    if (previousConfigEnv === undefined) {
      delete process.env.AGENT_RUNTIME_LLM_CONFIG;
    } else {
      process.env.AGENT_RUNTIME_LLM_CONFIG = previousConfigEnv;
    }
    if (tempRoot) {
      rmSync(tempRoot, { recursive: true, force: true });
      tempRoot = undefined;
    }
  });

  async function resetDemo() {
    const reset = await call(session, "POST", "/api/demo/reset");
    expect(reset.status).toBe(200);
    const body = reset.body as {
      project: { project_id: string };
      pack: { pack_id: string };
    };
    return { projectId: body.project.project_id, packId: body.pack.pack_id };
  }

  async function uploadSkill(opts?: {
    packId: string;
    projectId: string;
    fileName?: string;
    mime?: string;
    bytes?: Uint8Array;
  }) {
    const demo = opts ?? (await resetDemo());
    const uploaded = await handleDemoRequest(session, {
      method: "POST",
      url: "/api/jobs/upload",
      body: {},
      multipart: {
        file: {
          bytes: opts?.bytes ?? JPEG_BYTES,
          fileName: opts?.fileName ?? "form.jpg",
          mime: opts?.mime ?? "image/jpeg",
        },
        fields: { project_id: demo.projectId, pack_id: demo.packId },
      },
    });
    expect(uploaded.status).toBe(200);
    const job = (
      uploaded.body as {
        job: { job_id: string; pack_id: string; skill_draft_id: string | null; track: string };
      }
    ).job;
    return { ...demo, job };
  }

  it("GET job returns skill_draft_id after skill upload (M12)", async () => {
    const { job } = await uploadSkill();
    expect(job.skill_draft_id).toBeTruthy();
    const res = await call(session, "GET", `/api/jobs/${job.job_id}`);
    expect(res.status).toBe(200);
    expect((res.body as { job: { skill_draft_id: string | null } }).job.skill_draft_id).toBe(
      job.skill_draft_id,
    );
  });

  it("confirm-skill without summary returns 409 (M3)", async () => {
    const { job, packId } = await uploadSkill();
    const res = await call(session, "POST", `/api/jobs/${job.job_id}/confirm-skill`);
    expect(res.status).toBe(409);
    expect((res.body as { error: string }).error).toMatch(/summary|check_items/);
    const index = await call(session, "GET", `/api/packs/${packId}/skills`);
    expect((index.body as { skills: unknown[] }).skills).toHaveLength(0);
  });

  it("upsert draft without confirm leaves GET index unchanged (M5/M9)", async () => {
    const { job, packId } = await uploadSkill();
    await upsertSkillDraft(session.ledger(), {
      job_id: job.job_id,
      pack_id: packId,
      payload: taughtPayload(),
    });
    const index = await call(session, "GET", `/api/packs/${packId}/skills`);
    expect((index.body as { skills: unknown[] }).skills).toHaveLength(0);
    const ledgers = await session.pipeline.listSkillLedgersByJob(job.job_id);
    expect(ledgers).toHaveLength(0);
  });

  it("skill-dry-run does not write index, ledger, or patched blob (M13/R25)", async () => {
    const { job, packId } = await uploadSkill();
    await upsertSkillDraft(session.ledger(), {
      job_id: job.job_id,
      pack_id: packId,
      payload: taughtPayload({
        check_items: [{ label: "永不可能", keywords: ["___never___"] }],
      }),
    });
    const before = await call(session, "GET", `/api/packs/${packId}/skills`);
    const dry = await call(session, "POST", `/api/jobs/${job.job_id}/skill-dry-run`);
    expect(dry.status).toBe(200);
    const preview = dry.body as { would_patch: boolean; check: { verdict: string } };
    expect(preview.check.verdict).toBe("fail");
    const after = await call(session, "GET", `/api/packs/${packId}/skills`);
    expect((after.body as { skills: unknown[] }).skills).toEqual(
      (before.body as { skills: unknown[] }).skills,
    );
    expect(await session.pipeline.listSkillLedgersByJob(job.job_id)).toHaveLength(0);
    const fetched = await call(session, "GET", `/api/jobs/${job.job_id}`);
    expect((fetched.body as { job: { status: string } }).job.status).toBe("uploaded");
  });

  it("confirm-skill writes index and ledger; dual names stay unprocessed (R8/R12/R16)", async () => {
    const { job, packId } = await uploadSkill();
    await upsertSkillDraft(session.ledger(), {
      job_id: job.job_id,
      pack_id: packId,
      payload: taughtPayload({
        names: ["混凝土浇筑施工记录", "钢筋隐蔽工程检查记录"],
        check_items: [{ label: "永不可能", keywords: ["___never___"] }],
      }),
    });
    const res = await call(session, "POST", `/api/jobs/${job.job_id}/confirm-skill`);
    expect(res.status).toBe(200);
    const body = res.body as {
      skill: { skill_id: string; canonical_name: string };
      ledger: {
        skill_id: string;
        original_blob_uri: string;
        patched_blob_uri: string | null;
        unprocessed_tables_json: string;
        verdict: string;
      };
    };
    expect(body.skill.canonical_name).toBe("混凝土浇筑施工记录");
    expect(body.ledger.skill_id).toBe(body.skill.skill_id);
    expect(body.ledger.verdict).toBe("fail");
    expect(JSON.parse(body.ledger.unprocessed_tables_json)).toEqual(["钢筋隐蔽工程检查记录"]);
    const index = await call(session, "GET", `/api/packs/${packId}/skills`);
    expect((index.body as { skills: { skill_id: string }[] }).skills).toHaveLength(1);
  });

  it("xlsx confirm-skill patches a different blob id with the same MIME (M2/R24)", async () => {
    const demo = await resetDemo();
    const bytes = await makeXlsx("检验批", "B4", "混凝土浇筑施工记录");
    const { job, packId } = await uploadSkill({
      ...demo,
      fileName: "batch.xlsx",
      mime: XLSX_MIME,
      bytes,
    });
    await upsertSkillDraft(session.ledger(), {
      job_id: job.job_id,
      pack_id: packId,
      payload: taughtPayload({
        check_items: [{ label: "永不可能", keywords: ["___never___"] }],
        fix_actions: [
          {
            kind: "patch_excel",
            on: "on_fail",
            payload: { mappings: [{ sheet: "检验批", cell: "B4", field_key: "project_name" }] },
          },
        ],
      }),
    });
    const res = await call(session, "POST", `/api/jobs/${job.job_id}/confirm-skill`, {
      field_values: { project_name: "技能映射项目" },
    });
    expect(res.status).toBe(200);
    const ledger = (
      res.body as {
        ledger: {
          original_blob_uri: string;
          patched_blob_uri: string | null;
          original_mime: string;
          patched_mime: string | null;
        };
      }
    ).ledger;
    expect(ledger.patched_blob_uri).toBeTruthy();
    expect(ledger.patched_blob_uri).not.toBe(ledger.original_blob_uri);
    expect(ledger.original_mime).toBe(XLSX_MIME);
    expect(ledger.patched_mime).toBe(XLSX_MIME);
  });

  it("second upload of an existing Skill still 409 until confirm-skill (R14)", async () => {
    const first = await uploadSkill();
    await upsertSkillDraft(session.ledger(), {
      job_id: first.job.job_id,
      pack_id: first.packId,
      payload: taughtPayload({
        check_items: [{ label: "永不可能", keywords: ["___never___"] }],
      }),
    });
    const confirmed = await call(session, "POST", `/api/jobs/${first.job.job_id}/confirm-skill`);
    expect(confirmed.status).toBe(200);

    const second = await uploadSkill({ projectId: first.projectId, packId: first.packId });
    const blocked = await call(session, "POST", `/api/jobs/${second.job.job_id}/confirm-skill`);
    expect(blocked.status).toBe(409);
    const indexBefore = await call(session, "GET", `/api/packs/${first.packId}/skills`);
    expect((indexBefore.body as { skills: unknown[] }).skills).toHaveLength(1);
    expect(await session.pipeline.listSkillLedgersByJob(second.job.job_id)).toHaveLength(0);

    await upsertSkillDraft(session.ledger(), {
      job_id: second.job.job_id,
      pack_id: first.packId,
      payload: taughtPayload({
        check_items: [{ label: "永不可能", keywords: ["___never___"] }],
      }),
    });
    const ok = await call(session, "POST", `/api/jobs/${second.job.job_id}/confirm-skill`);
    expect(ok.status).toBe(200);
    const indexAfter = await call(session, "GET", `/api/packs/${first.packId}/skills`);
    expect((indexAfter.body as { skills: unknown[] }).skills).toHaveLength(1);
  });

  it("multi-candidate confirm-skill is 409 until selected_skill_id (M6)", async () => {
    const { job, packId, projectId } = await uploadSkill();
    await session.ledger().insertSkillRecord({
      pack_id: packId,
      project_id: projectId,
      canonical_name: "混凝土浇筑施工记录表甲",
      names_json: JSON.stringify(["混凝土浇筑施工记录表甲"]),
      aliases_json: "[]",
      check_items_json: JSON.stringify([{ label: "甲", keywords: ["编号"] }]),
      fix_actions_json: "[]",
    });
    const picked = await session.ledger().insertSkillRecord({
      pack_id: packId,
      project_id: projectId,
      canonical_name: "混凝土浇筑施工记录表乙",
      names_json: JSON.stringify(["混凝土浇筑施工记录表乙"]),
      aliases_json: "[]",
      check_items_json: JSON.stringify([{ label: "乙", keywords: ["编号"] }]),
      fix_actions_json: "[]",
    });
    await upsertSkillDraft(session.ledger(), {
      job_id: job.job_id,
      pack_id: packId,
      payload: taughtPayload({
        canonical_name: "混凝土浇筑施工记录表",
        names: ["混凝土浇筑施工记录表"],
        check_items: [{ label: "永不可能", keywords: ["___never___"] }],
      }),
    });
    const blocked = await call(session, "POST", `/api/jobs/${job.job_id}/confirm-skill`);
    expect(blocked.status).toBe(409);
    expect((blocked.body as { error: string }).error).toMatch(/candidates/);
    const ok = await call(session, "POST", `/api/jobs/${job.job_id}/confirm-skill`, {
      selected_skill_id: picked.skill_id,
    });
    expect(ok.status).toBe(200);
  });

  it("matched check + FakeLlm parse fail does not repair (D9)", async () => {
    const { job, packId } = await uploadSkill();
    await upsertSkillDraft(session.ledger(), {
      job_id: job.job_id,
      pack_id: packId,
      payload: taughtPayload(),
    });
    const res = await call(session, "POST", `/api/jobs/${job.job_id}/confirm-skill`);
    expect(res.status).toBe(200);
    const ledger = (
      res.body as {
        ledger: { reason: string; patched_blob_uri: string | null; verdict: string };
      }
    ).ledger;
    expect(ledger.reason).toBe("check_parse_fail");
    expect(ledger.verdict).toBe("fail");
    expect(ledger.patched_blob_uri).toBeNull();
  });

  it("keeps POST /api/standards/search", async () => {
    const { packId } = await resetDemo();
    const res = await call(session, "POST", "/api/standards/search", {
      packId,
      query: "事假",
    });
    expect(res.status).toBe(200);
    expect(Array.isArray((res.body as { hits: unknown[] }).hits)).toBe(true);
  });

  it("JsonLlm fail still runs on_fail repair for xlsx", async () => {
    const demo = await resetDemo();
    setDefaultLlmProvider(new JsonLlmProvider('{"verdict":"fail","item_results":[]}'));
    const bytes = await makeXlsx("检验批", "A1", "编号：SH-002");
    const { job, packId } = await uploadSkill({
      ...demo,
      fileName: "batch.xlsx",
      mime: XLSX_MIME,
      bytes,
    });
    await upsertSkillDraft(session.ledger(), {
      job_id: job.job_id,
      pack_id: packId,
      payload: taughtPayload({
        check_items: [{ label: "须有编号", keywords: ["编号"] }],
        fix_actions: [
          {
            kind: "patch_excel",
            on: "on_fail",
            payload: { mappings: [{ sheet: "检验批", cell: "A1", field_key: "project_name" }] },
          },
        ],
      }),
    });
    const res = await call(session, "POST", `/api/jobs/${job.job_id}/confirm-skill`, {
      field_values: { project_name: "检查失败后填写" },
    });
    expect(res.status).toBe(200);
    const ledger = (res.body as { ledger: { patched_blob_uri: string | null; reason: string } }).ledger;
    expect(ledger.reason).toBe("fail");
    expect(ledger.patched_blob_uri).toBeTruthy();
  });
});
