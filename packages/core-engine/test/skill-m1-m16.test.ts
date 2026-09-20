/**
 * F-10 Task 12: HTTP/unit evidence for skill-track M1–M16 (no UI probes).
 * Upload → chat → engine summary → confirm-skill is the production path;
 * grepping SkillIndex.ts is not M1.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import {
  FakeLlmProvider,
  ToolRegistry,
  setDefaultLlmProvider,
  type LlmProvider,
} from "agent-runtime";
import { MemoryBlobStore } from "../src/blob/memory.js";
import { handleDemoRequest } from "../src/http/handle-request.js";
import { DemoHttpSession } from "../src/http/session.js";
import { FakeOcr } from "../src/ocr/fake.js";
import { JobPipeline } from "../src/pipeline/job-pipeline.js";
import {
  SkillIndex,
  XLSX_MIME,
  parseSkillDraftPayload,
  type SkillDraftPayload,
  type SkillRecord,
} from "../src/skill/index.js";

const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

/** Never-seeded table names so M1 cannot pass by hitting leftover fixtures. */
const TABLE_A = "M12甲组隐蔽验收记录表";
const TABLE_B = "M12乙组材料进场记录表";

type SkillSummaryBody = {
  names: string[];
  check_labels: string[];
  fix_plain: string[];
  check_match: Array<{ label: string; matched: boolean; reason: "unmatched" | null }>;
  can_confirm: boolean;
};

type ListedJob = { job_id: string; track: string; file_name: string | null };

class ScriptedTeachLlm implements LlmProvider {
  prompts: string[] = [];
  constructor(private readonly draft: SkillDraftPayload) {}
  async complete(options: { prompt: string }): Promise<string> {
    this.prompts.push(options.prompt);
    if (options.prompt.includes("Matched check items")) {
      return JSON.stringify({ verdict: "fail", item_results: [] });
    }
    return JSON.stringify(this.draft);
  }
}

function payloadFor(
  canonical: string,
  overrides: Partial<SkillDraftPayload> = {},
): SkillDraftPayload {
  return {
    canonical_name: canonical,
    names: [canonical],
    aliases: [],
    check_items: [{ label: "须有编号", keywords: ["编号"] }],
    fix_actions: [{ kind: "annotate_fail", on: "on_fail" }],
    ...overrides,
  };
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

/** One blank page, no ToUnicode / Tj — scan-like fixture for M8. */
function emptyPagePdf(): Uint8Array {
  const header = "%PDF-1.4\n";
  const obj1 = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
  const obj2 = "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";
  const obj3 = "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>\nendobj\n";
  const o1 = Buffer.byteLength(header);
  const o2 = o1 + Buffer.byteLength(obj1);
  const o3 = o2 + Buffer.byteLength(obj2);
  const after = o3 + Buffer.byteLength(obj3);
  const pad = (n: number) => `${String(n).padStart(10, "0")} 00000 n \n`;
  const xref = "xref\n0 4\n0000000000 65535 f \n" + pad(o1) + pad(o2) + pad(o3);
  const trailer = `trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${after}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(header + obj1 + obj2 + obj3 + xref + trailer));
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

describe("skill-track M1–M16 HTTP/unit (F-10 Task 12)", () => {
  let session: DemoHttpSession;
  let tempRoot: string | undefined;
  const previousConfigEnv = process.env.AGENT_RUNTIME_LLM_CONFIG;
  let previousLlm: LlmProvider | undefined;

  beforeEach(() => {
    delete process.env.AGENT_RUNTIME_LLM_CONFIG;
    previousLlm = undefined;
    setDefaultLlmProvider(new FakeLlmProvider());
    tempRoot = mkdtempSync(join(tmpdir(), "skill-m1-m16-"));
    session = new DemoHttpSession({ projectRoot: tempRoot });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
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

  async function uploadSkill(opts: {
    projectId: string;
    packId: string;
    fileName?: string;
    mime?: string;
    bytes?: Uint8Array;
  }) {
    const uploaded = await handleDemoRequest(session, {
      method: "POST",
      url: "/api/jobs/upload",
      body: {},
      multipart: {
        file: {
          bytes: opts.bytes ?? JPEG_BYTES,
          fileName: opts.fileName ?? "form.jpg",
          mime: opts.mime ?? "image/jpeg",
        },
        fields: { project_id: opts.projectId, pack_id: opts.packId },
      },
    });
    expect(uploaded.status).toBe(200);
    const job = (
      uploaded.body as {
        job: {
          job_id: string;
          pack_id: string;
          trace_id: string;
          skill_draft_id: string | null;
          track: string;
          status: string;
        };
      }
    ).job;
    return job;
  }

  async function teachAndConfirm(
    job: { job_id: string; trace_id: string },
    draft: SkillDraftPayload,
    confirmBody: Record<string, unknown> = {},
  ) {
    const llm = new ScriptedTeachLlm(draft);
    setDefaultLlmProvider(llm);
    const chat = await call(session, "POST", "/api/chat", {
      trace_id: job.trace_id,
      step: "job_upload",
      body: `表名是${draft.canonical_name}，按检查项教学`,
    });
    expect(chat.status).toBe(200);
    const summary = (chat.body as { skill_summary: SkillSummaryBody }).skill_summary;
    const confirm = await call(session, "POST", `/api/jobs/${job.job_id}/confirm-skill`, confirmBody);
    return { llm, chat, summary, confirm };
  }

  it("two never-seeded tables get distinct skill_ids via HTTP chat+confirm (M1/M2/M9)", async () => {
    const demo = await resetDemo();
    const emptyIndex = await call(session, "GET", `/api/packs/${demo.packId}/skills`);
    expect((emptyIndex.body as { skills: unknown[] }).skills).toHaveLength(0);

    const jobA = await uploadSkill({ ...demo, fileName: "table-a.jpg" });
    expect(jobA.track).toBe("skill");
    expect(jobA.skill_draft_id).toBeTruthy();

    const taughtA = await teachAndConfirm(jobA, payloadFor(TABLE_A));
    expect(taughtA.summary.names).toEqual([TABLE_A]);
    expect(taughtA.summary.can_confirm).toBe(true);
    expect(taughtA.confirm.status).toBe(200);
    const bodyA = taughtA.confirm.body as {
      skill: { skill_id: string; canonical_name: string };
      ledger: {
        skill_id: string;
        original_blob_uri: string;
        patched_blob_uri: string | null;
        verdict: string;
      };
    };
    expect(bodyA.skill.canonical_name).toBe(TABLE_A);
    expect(bodyA.ledger.skill_id).toBe(bodyA.skill.skill_id);
    expect(bodyA.ledger.original_blob_uri).toBeTruthy();
    expect(bodyA.ledger.verdict).toMatch(/pass|fail/);

    const jobB = await uploadSkill({ ...demo, fileName: "table-b.jpg" });
    const taughtB = await teachAndConfirm(jobB, payloadFor(TABLE_B));
    expect(taughtB.confirm.status).toBe(200);
    const bodyB = taughtB.confirm.body as {
      skill: { skill_id: string; canonical_name: string };
      ledger: { skill_id: string; original_blob_uri: string };
    };
    expect(bodyB.skill.canonical_name).toBe(TABLE_B);
    expect(bodyB.skill.skill_id).not.toBe(bodyA.skill.skill_id);
    expect(bodyB.ledger.skill_id).toBe(bodyB.skill.skill_id);

    const index = await call(session, "GET", `/api/packs/${demo.packId}/skills`);
    const skills = (
      index.body as { skills: Array<{ skill_id: string; canonical_name: string }> }
    ).skills;
    expect(skills).toHaveLength(2);
    const ids = new Set(skills.map((row) => row.skill_id));
    expect(ids.size).toBe(2);
    expect(ids.has(bodyA.skill.skill_id)).toBe(true);
    expect(ids.has(bodyB.skill.skill_id)).toBe(true);
    expect(skills.map((row) => row.canonical_name).sort()).toEqual([TABLE_A, TABLE_B].sort());

    const ledgersA = await session.pipeline.listSkillLedgersByJob(jobA.job_id);
    const ledgersB = await session.pipeline.listSkillLedgersByJob(jobB.job_id);
    expect(ledgersA).toHaveLength(1);
    expect(ledgersB).toHaveLength(1);
    expect(ledgersA[0]?.skill_id).toBe(bodyA.skill.skill_id);
    expect(ledgersB[0]?.skill_id).toBe(bodyB.skill.skill_id);
    expect(ledgersA[0]?.skill_id).not.toBe(ledgersB[0]?.skill_id);
  });

  it("chat without confirm leaves GET index empty (M5/M9)", async () => {
    const demo = await resetDemo();
    const job = await uploadSkill(demo);
    const llm = new ScriptedTeachLlm(payloadFor(TABLE_A));
    setDefaultLlmProvider(llm);
    const chat = await call(session, "POST", "/api/chat", {
      trace_id: job.trace_id,
      step: "job_upload",
      body: "已确认，写入索引并修文件",
    });
    expect(chat.status).toBe(200);
    expect((chat.body as { skill_summary: SkillSummaryBody }).skill_summary.names).toEqual([TABLE_A]);
    const index = await call(session, "GET", `/api/packs/${demo.packId}/skills`);
    expect((index.body as { skills: unknown[] }).skills).toHaveLength(0);
    expect(await session.pipeline.listSkillLedgersByJob(job.job_id)).toHaveLength(0);
  });

  it("confirm-skill without summary returns 409 (M3)", async () => {
    const demo = await resetDemo();
    const job = await uploadSkill(demo);
    const res = await call(session, "POST", `/api/jobs/${job.job_id}/confirm-skill`);
    expect(res.status).toBe(409);
    const index = await call(session, "GET", `/api/packs/${demo.packId}/skills`);
    expect((index.body as { skills: unknown[] }).skills).toHaveLength(0);
  });

  it("GET job after upload has skill_draft_id without doc_type_id (M12)", async () => {
    const demo = await resetDemo();
    const job = await uploadSkill(demo);
    expect(job.skill_draft_id).toBeTruthy();
    const fetched = await call(session, "GET", `/api/jobs/${job.job_id}`);
    expect(fetched.status).toBe(200);
    const body = fetched.body as { job: { skill_draft_id: string | null; doc_type_id: string | null } };
    expect(body.job.skill_draft_id).toBe(job.skill_draft_id);
    expect(body.job.doc_type_id).toBeNull();
  });

  it("skill-dry-run does not write index or ledger (M13)", async () => {
    const demo = await resetDemo();
    const job = await uploadSkill(demo);
    setDefaultLlmProvider(new ScriptedTeachLlm(payloadFor(TABLE_A)));
    await call(session, "POST", "/api/chat", {
      trace_id: job.trace_id,
      step: "job_upload",
      body: "教学甲表",
    });
    const before = await call(session, "GET", `/api/packs/${demo.packId}/skills`);
    const dry = await call(session, "POST", `/api/jobs/${job.job_id}/skill-dry-run`);
    expect(dry.status).toBe(200);
    const after = await call(session, "GET", `/api/packs/${demo.packId}/skills`);
    expect((after.body as { skills: unknown[] }).skills).toEqual(
      (before.body as { skills: unknown[] }).skills,
    );
    expect(await session.pipeline.listSkillLedgersByJob(job.job_id)).toHaveLength(0);
  });

  it("confirm-next is 409 and default GET /api/jobs omits skill jobs (M16)", async () => {
    const demo = await resetDemo();
    const job = await uploadSkill(demo);
    const next = await call(session, "POST", `/api/jobs/${job.job_id}/confirm-next`);
    expect(next.status).toBe(409);
    const listed = await call(session, "GET", "/api/jobs");
    expect(listed.status).toBe(200);
    const jobs = (listed.body as { jobs: ListedJob[] }).jobs;
    expect(jobs.every((row) => row.track === "legacy")).toBe(true);
    expect(jobs.some((row) => row.job_id === job.job_id)).toBe(false);
  });

  it("multi-candidate selected_skill_id binds that row, not a third name (M6)", async () => {
    const demo = await resetDemo();
    const job = await uploadSkill(demo);
    await session.ledger().insertSkillRecord({
      pack_id: demo.packId,
      project_id: demo.projectId,
      canonical_name: `${TABLE_A}甲`,
      names_json: JSON.stringify([`${TABLE_A}甲`]),
      aliases_json: "[]",
      check_items_json: JSON.stringify([{ label: "甲", keywords: ["编号"] }]),
      fix_actions_json: "[]",
    });
    const picked = await session.ledger().insertSkillRecord({
      pack_id: demo.packId,
      project_id: demo.projectId,
      canonical_name: `${TABLE_A}乙`,
      names_json: JSON.stringify([`${TABLE_A}乙`]),
      aliases_json: "[]",
      check_items_json: JSON.stringify([{ label: "乙", keywords: ["编号"] }]),
      fix_actions_json: "[]",
    });
    setDefaultLlmProvider(new ScriptedTeachLlm(payloadFor(TABLE_A)));
    await call(session, "POST", "/api/chat", {
      trace_id: job.trace_id,
      step: "job_upload",
      body: "点选乙表",
    });
    const blocked = await call(session, "POST", `/api/jobs/${job.job_id}/confirm-skill`);
    expect(blocked.status).toBe(409);
    const bogus = await call(session, "POST", `/api/jobs/${job.job_id}/confirm-skill`, {
      selected_skill_id: "sk_not_a_candidate",
    });
    expect(bogus.status).toBe(409);
    const ok = await call(session, "POST", `/api/jobs/${job.job_id}/confirm-skill`, {
      selected_skill_id: picked.skill_id,
    });
    expect(ok.status).toBe(200);
    const body = ok.body as {
      skill: { skill_id: string; canonical_name: string; version: number; check_items: unknown[] };
      ledger: { skill_id: string };
    };
    expect(body.skill.skill_id).toBe(picked.skill_id);
    expect(body.ledger.skill_id).toBe(picked.skill_id);
    expect(body.skill.canonical_name).toBe(`${TABLE_A}乙`);
    expect(body.skill.version).toBeGreaterThanOrEqual(2);
    const draft = await session.pipeline.getSkillDraftByJob(job.job_id);
    expect(draft?.selected_skill_id).toBe(picked.skill_id);
    const index = await call(session, "GET", `/api/packs/${demo.packId}/skills`);
    const skills = (index.body as { skills: Array<{ skill_id: string }> }).skills;
    expect(skills).toHaveLength(2);
    expect(skills.some((row) => row.skill_id === picked.skill_id)).toBe(true);
  });

  it("same-name second confirm overlays check_items and bumps version (R13)", async () => {
    const demo = await resetDemo();
    const first = await uploadSkill({ ...demo, fileName: "first.jpg" });
    const firstConfirm = await teachAndConfirm(first, payloadFor(TABLE_A));
    expect(firstConfirm.confirm.status).toBe(200);
    const firstSkill = (firstConfirm.confirm.body as { skill: { skill_id: string; version: number } })
      .skill;

    const second = await uploadSkill({ ...demo, fileName: "second.jpg" });
    const relabeled = payloadFor(TABLE_A, {
      check_items: [{ label: "坍落度须填实测值", keywords: ["坍落度"] }],
    });
    const secondConfirm = await teachAndConfirm(second, relabeled);
    expect(secondConfirm.confirm.status).toBe(200);
    const updated = (
      secondConfirm.confirm.body as {
        skill: { skill_id: string; version: number; check_items: Array<{ label: string }> };
      }
    ).skill;
    expect(updated.skill_id).toBe(firstSkill.skill_id);
    expect(updated.version).toBeGreaterThan(firstSkill.version);
    expect(updated.check_items.map((item) => item.label)).toEqual(["坍落度须填实测值"]);
    const index = await call(session, "GET", `/api/packs/${demo.packId}/skills`);
    expect((index.body as { skills: unknown[] }).skills).toHaveLength(1);
  });

  it("chat keeps patch_excel.mappings and xlsx confirm writes a new blob (M2/R24)", async () => {
    const demo = await resetDemo();
    const bytes = await makeXlsx("检验批", "B4", `${TABLE_A} 编号：SH-002`);
    const job = await uploadSkill({
      ...demo,
      fileName: "batch.xlsx",
      mime: XLSX_MIME,
      bytes,
    });
    const draft = payloadFor(TABLE_A, {
      check_items: [{ label: "永不可能", keywords: ["___never_m12___"] }],
      fix_actions: [
        {
          kind: "patch_excel",
          on: "on_fail",
          payload: { mappings: [{ sheet: "检验批", cell: "B4", field_key: "project_name" }] },
        },
      ],
    });
    const llm = new ScriptedTeachLlm(draft);
    setDefaultLlmProvider(llm);
    const chat = await call(session, "POST", "/api/chat", {
      trace_id: job.trace_id,
      step: "job_upload",
      body: "xlsx 按单元格映射填写",
    });
    expect(chat.status).toBe(200);
    const stored = await session.pipeline.getSkillDraftByJob(job.job_id);
    const parsed = parseSkillDraftPayload(stored?.payload_json);
    expect(parsed.fix_actions[0]?.kind).toBe("patch_excel");
    expect(parsed.fix_actions[0]?.payload?.mappings).toEqual([
      { sheet: "检验批", cell: "B4", field_key: "project_name" },
    ]);

    const confirm = await call(session, "POST", `/api/jobs/${job.job_id}/confirm-skill`, {
      field_values: { project_name: "技能映射项目" },
    });
    expect(confirm.status).toBe(200);
    const ledger = (
      confirm.body as {
        ledger: {
          original_blob_uri: string;
          patched_blob_uri: string | null;
          original_mime: string;
          patched_mime: string | null;
          skill_id: string;
          verdict: string;
        };
      }
    ).ledger;
    expect(ledger.patched_blob_uri).toBeTruthy();
    expect(ledger.patched_blob_uri).not.toBe(ledger.original_blob_uri);
    expect(ledger.original_mime).toBe(XLSX_MIME);
    expect(ledger.patched_mime).toBe(XLSX_MIME);
    expect(ledger.skill_id).toBeTruthy();
  });

  it("unmatched check_items fail-close and still confirm (R20/D2)", async () => {
    const demo = await resetDemo();
    const job = await uploadSkill(demo);
    const taught = await teachAndConfirm(
      job,
      payloadFor(TABLE_A, {
        check_items: [{ label: "永不可能", keywords: ["___never_m12___"] }],
      }),
    );
    expect(taught.confirm.status).toBe(200);
    const ledger = (taught.confirm.body as { ledger: { verdict: string; reason: string } }).ledger;
    expect(ledger.verdict).toBe("fail");
    expect(ledger.reason).toBe("unmatched");
  });

  it("check LLM prompt has no fix_actions script (M10)", async () => {
    const demo = await resetDemo();
    const job = await uploadSkill(demo);
    const taught = await teachAndConfirm(job, payloadFor(TABLE_A));
    expect(taught.confirm.status).toBe(200);
    const checkPrompts = taught.llm.prompts.filter((prompt) => prompt.includes("Matched check items"));
    expect(checkPrompts.length).toBeGreaterThan(0);
    for (const prompt of checkPrompts) {
      expect(prompt).not.toContain("fix_actions");
      expect(prompt).not.toContain("annotate_fail");
      expect(prompt).not.toContain("patch_excel");
      expect(prompt).not.toContain("canonical_name");
    }
  });

  it("Skill upload/confirm does not call searchStandard; standards/search still hits (M11)", async () => {
    const demo = await resetDemo();
    const search = vi.spyOn(session.pipeline, "searchStandard");
    const attach = vi.spyOn(session.pipeline, "attachStandardFitFinding");
    const getSpy = vi.spyOn(ToolRegistry.prototype, "get");
    const job = await uploadSkill(demo);
    const taught = await teachAndConfirm(job, payloadFor(TABLE_A));
    expect(taught.confirm.status).toBe(200);
    expect(search).not.toHaveBeenCalled();
    expect(attach).not.toHaveBeenCalled();
    expect(getSpy.mock.calls.some(([name]) => name === "search_clause")).toBe(false);

    const res = await call(session, "POST", "/api/standards/search", {
      packId: demo.packId,
      query: "事假",
    });
    expect(res.status).toBe(200);
    expect(Array.isArray((res.body as { hits: unknown[] }).hits)).toBe(true);
    expect(((res.body as { hits: unknown[] }).hits.length ?? 0) > 0).toBe(true);
  });

  it("same canonical_name in another pack is isolated (R26)", async () => {
    const demo = await resetDemo();
    const job = await uploadSkill(demo);
    const taught = await teachAndConfirm(job, payloadFor(TABLE_A));
    expect(taught.confirm.status).toBe(200);
    const skillA = (taught.confirm.body as { skill: { skill_id: string } }).skill;
    const other = await session.pipeline.createSpecPack({
      projectId: demo.projectId,
      name: "隔离包",
      version: "1",
    });
    const twin = await session.ledger().insertSkillRecord({
      pack_id: other.pack_id,
      project_id: demo.projectId,
      canonical_name: TABLE_A,
      names_json: JSON.stringify([TABLE_A]),
      aliases_json: "[]",
      check_items_json: "[]",
      fix_actions_json: "[]",
    });
    expect(twin.skill_id).not.toBe(skillA.skill_id);
    const packA = await call(session, "GET", `/api/packs/${demo.packId}/skills`);
    const packB = await call(session, "GET", `/api/packs/${other.pack_id}/skills`);
    expect((packA.body as { skills: Array<{ skill_id: string }> }).skills.map((row) => row.skill_id)).toEqual([
      skillA.skill_id,
    ]);
    expect((packB.body as { skills: Array<{ skill_id: string }> }).skills.map((row) => row.skill_id)).toEqual([
      twin.skill_id,
    ]);
  });

  it("FakeOcr empty + PDF text-layer miss is unreadable original-only (M8)", async () => {
    const pipeline = JobPipeline.open(":memory:");
    const blob = new MemoryBlobStore();
    const llm = new ScriptedTeachLlm(payloadFor(TABLE_A));
    setDefaultLlmProvider(llm);
    try {
      const project = await pipeline.createProject();
      const pack = await pipeline.createSpecPack({
        projectId: project.project_id,
        name: "坏件包",
        version: "1",
      });
      const result = await pipeline.openUploadJob(
        {
          projectId: project.project_id,
          packId: pack.pack_id,
          fileName: "scan.pdf",
          mime: "application/pdf",
          bytes: emptyPagePdf(),
        },
        { blob, ocr: new FakeOcr("") },
      );
      expect(result.job.status).toBe("failed");
      expect(result.job.skill_draft_id).toBeNull();
      expect(await pipeline.listSkillRecords(pack.pack_id)).toHaveLength(0);
      const ledgers = await pipeline.listSkillLedgersByJob(result.job.job_id);
      expect(ledgers).toHaveLength(1);
      expect(ledgers[0]?.verdict).toBe("fail");
      expect(ledgers[0]?.reason).toBe("unreadable");
      expect(ledgers[0]?.original_blob_uri).toBe(result.document.file_uri);
      expect(ledgers[0]?.patched_blob_uri).toBeNull();
      expect(ledgers[0]?.skill_id).toBeNull();
      expect(llm.prompts).toHaveLength(0);
    } finally {
      await pipeline.close();
    }
  });

  it("≤5 exact / >5 substring lookup (M7)", () => {
    const index = new SkillIndex();
    expect(index.list("pack_a")).toEqual([]);
    index.put(record({ skill_id: "sk_short", pack_id: "pack_a", canonical_name: "钢筋表" }));
    expect(index.lookup("pack_a", "钢筋表").hit?.skill_id).toBe("sk_short");
    expect(index.lookup("pack_a", "钢筋").hit).toBeNull();
    index.put(record({ skill_id: "sk_long", pack_id: "pack_a", canonical_name: TABLE_A }));
    expect(index.lookup("pack_a", TABLE_A).hit?.skill_id).toBe("sk_long");
    expect(index.lookup("pack_a", `${TABLE_A}附页`).hit?.skill_id).toBe("sk_long");
    expect(index.lookup("pack_b", TABLE_A).hit).toBeNull();
  });

  it("parseSkillDraftPayload keeps patch_excel.mappings (R24)", () => {
    const parsed = parseSkillDraftPayload({
      canonical_name: TABLE_A,
      names: [TABLE_A],
      aliases: [],
      check_items: [{ label: "编号", keywords: ["编号"] }],
      fix_actions: [
        {
          kind: "patch_excel",
          on: "on_fail",
          payload: { mappings: [{ sheet: "检验批", cell: "B4", field_key: "project_name" }] },
        },
      ],
    });
    expect(parsed.fix_actions[0]?.payload?.mappings).toEqual([
      { sheet: "检验批", cell: "B4", field_key: "project_name" },
    ]);
  });
});
