/**
 * F-10 Task 5: SkillRunner declarative repair + patch_excel (R7 R24 / D9 D11).
 * Mappings come from Skill JSON; PDF/image must not change MIME.
 */

import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { MemoryBlobStore } from "../src/blob/memory.js";
import { ExcelFillService } from "../src/excel/fill-service.js";
import type { ExcelFillInput } from "../src/excel/fill-service.js";
import { SkillRunner, XLSX_MIME } from "../src/skill/index.js";
import type { SkillFixAction, SkillRecord } from "../src/skill/record.js";

const PDF_MIME = "application/pdf";
const PNG_MIME = "image/png";

class SpyExcelFillService extends ExcelFillService {
  lastInput: ExcelFillInput | undefined;
  calls = 0;

  override async fill(input: ExcelFillInput): Promise<Buffer> {
    this.calls += 1;
    this.lastInput = input;
    return super.fill(input);
  }
}

function skillWith(fix_actions: SkillFixAction[]): Pick<SkillRecord, "fix_actions"> {
  return { fix_actions };
}

async function makeXlsx(sheet: string, cell: string, value: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet(sheet);
  ws.getCell(cell).value = value;
  const out = await workbook.xlsx.writeBuffer();
  return Buffer.from(out);
}

async function readCell(buffer: Uint8Array, sheetName: string, address: string): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(buffer));
  const sheet = workbook.getWorksheet(sheetName) ?? workbook.worksheets[0];
  const value = sheet.getCell(address).value;
  if (value == null) return "";
  return String(value);
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;
}

describe("SkillRunner declarative patch_excel (R7/R24/D9)", () => {
  it("fills xlsx from Skill payload.mappings and keeps xlsx MIME (R24)", async () => {
    const original = await makeXlsx("检验批", "B4", "原项目");
    const excel = new SpyExcelFillService();
    const runner = new SkillRunner({ excel });
    const result = await runner.run({
      skill: skillWith([
        {
          kind: "patch_excel",
          on: "on_fail",
          payload: {
            mappings: [{ sheet: "检验批", cell: "B4", field_key: "project_name" }],
          },
        },
      ]),
      original: { bytes: original, mime: XLSX_MIME },
      verdict: "fail",
      fieldValues: { project_name: "技能映射项目" },
    });

    expect(result.artifact.mime).toBe(XLSX_MIME);
    expect(await readCell(result.artifact.bytes, "检验批", "B4")).toBe("技能映射项目");
    expect(excel.calls).toBe(1);
    expect(Buffer.compare(Buffer.from(excel.lastInput?.template as Buffer), original)).toBe(0);
    expect(excel.lastInput?.mappings).toEqual([
      {
        field_key: "project_name",
        sheet_name: "检验批",
        cell: "B4",
        value_type: "string",
        signature_role: null,
        rule: null,
      },
    ]);
    expect(result.steps).toEqual([{ kind: "patch_excel", applied: true }]);
  });

  it("rejects patch_excel on PDF, does not call fill, and keeps PDF MIME (R24)", async () => {
    const original = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
    const excel = new SpyExcelFillService();
    const runner = new SkillRunner({ excel });
    const result = await runner.run({
      skill: skillWith([
        {
          kind: "patch_excel",
          on: "on_fail",
          payload: {
            mappings: [{ sheet: "检验批", cell: "B4", field_key: "project_name" }],
          },
        },
      ]),
      original: { bytes: original, mime: PDF_MIME },
      verdict: "fail",
      fieldValues: { project_name: "不得写进 PDF" },
    });

    expect(excel.calls).toBe(0);
    expect(result.artifact.mime).toBe(PDF_MIME);
    expect(sameBytes(result.artifact.bytes, original)).toBe(true);
    expect(result.steps[0]).toEqual({
      kind: "patch_excel",
      applied: false,
      skip_reason: "patch_excel_forbidden_mime",
    });
  });

  it("rejects patch_excel on image/png and leaves MIME unchanged", async () => {
    const original = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const excel = new SpyExcelFillService();
    const result = await new SkillRunner({ excel }).run({
      skill: skillWith([{ kind: "patch_excel", on: "always" }]),
      original: { bytes: original, mime: PNG_MIME },
      verdict: "pass",
    });
    expect(excel.calls).toBe(0);
    expect(result.artifact.mime).toBe(PNG_MIME);
    expect(sameBytes(result.artifact.bytes, original)).toBe(true);
  });

  it("skips on_fail actions when the check passed (D9)", async () => {
    const original = await makeXlsx("检验批", "B4", "原项目");
    const excel = new SpyExcelFillService();
    const result = await new SkillRunner({ excel }).run({
      skill: skillWith([
        {
          kind: "patch_excel",
          on: "on_fail",
          payload: {
            mappings: [{ sheet: "检验批", cell: "B4", field_key: "project_name" }],
          },
        },
      ]),
      original: { bytes: original, mime: XLSX_MIME },
      verdict: "pass",
      fieldValues: { project_name: "不该填" },
    });
    expect(excel.calls).toBe(0);
    expect(result.artifact.mime).toBe(XLSX_MIME);
    expect(await readCell(result.artifact.bytes, "检验批", "B4")).toBe("原项目");
    expect(result.steps[0]?.skip_reason).toBe("on_not_met");
  });

  it("runs always actions even when the check passed (D9)", async () => {
    const original = await makeXlsx("检验批", "B4", "原项目");
    const result = await new SkillRunner().run({
      skill: skillWith([
        {
          kind: "patch_excel",
          on: "always",
          payload: {
            mappings: [{ sheet: "检验批", cell: "B4", field_key: "project_name" }],
          },
        },
      ]),
      original: { bytes: original, mime: XLSX_MIME },
      verdict: "pass",
      fieldValues: { project_name: "始终填写" },
    });
    expect(result.artifact.mime).toBe(XLSX_MIME);
    expect(await readCell(result.artifact.bytes, "检验批", "B4")).toBe("始终填写");
  });

  it("does not invent repairs when Skill declared no fix_actions (D9)", async () => {
    const original = new Uint8Array([1, 2, 3]);
    const excel = new SpyExcelFillService();
    const result = await new SkillRunner({ excel }).run({
      skill: skillWith([]),
      original: { bytes: original, mime: PDF_MIME },
      verdict: "fail",
    });
    expect(excel.calls).toBe(0);
    expect(result.steps).toEqual([]);
    expect(result.artifact.mime).toBe(PDF_MIME);
    expect(sameBytes(result.artifact.bytes, original)).toBe(true);
  });

  it("copy_original keeps PDF bytes and MIME so ledger can store a same-type 修后件", async () => {
    const original = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    const result = await new SkillRunner().run({
      skill: skillWith([{ kind: "copy_original", on: "on_fail" }]),
      original: { bytes: original, mime: PDF_MIME },
      verdict: "fail",
    });
    expect(result.artifact.mime).toBe(PDF_MIME);
    expect(sameBytes(result.artifact.bytes, original)).toBe(true);
    expect(result.steps[0]?.applied).toBe(true);
  });

  it("noop and annotate_fail never rewrite bytes; annotate_fail only marks the conclusion", async () => {
    const original = new Uint8Array([9, 8, 7]);
    const result = await new SkillRunner().run({
      skill: skillWith([
        { kind: "noop", on: "on_fail" },
        { kind: "annotate_fail", on: "on_fail" },
      ]),
      original: { bytes: original, mime: PNG_MIME },
      verdict: "fail",
    });
    expect(result.annotated_fail).toBe(true);
    expect(result.artifact.mime).toBe(PNG_MIME);
    expect(sameBytes(result.artifact.bytes, original)).toBe(true);
  });

  it("patch_fields overlays values on PDF without changing MIME (sidecar, not ExcelFill)", async () => {
    const original = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    const excel = new SpyExcelFillService();
    const result = await new SkillRunner({ excel }).run({
      skill: skillWith([{ kind: "patch_fields", on: "on_fail" }]),
      original: { bytes: original, mime: PDF_MIME },
      verdict: "fail",
      fieldValues: { site_name: "补丁后的部位" },
    });
    expect(excel.calls).toBe(0);
    expect(result.artifact.mime).toBe(PDF_MIME);
    expect(sameBytes(result.artifact.bytes, original)).toBe(true);
    expect(result.fields.site_name).toBe("补丁后的部位");
  });

  it("BlobStore.put of 修后件 uses the original MIME so object store type matches the ledger", async () => {
    const original = await makeXlsx("检验批", "B4", "原项目");
    const blob = new MemoryBlobStore();
    await blob.put({ key: "orig", bytes: original, mime: XLSX_MIME });
    const result = await new SkillRunner().run({
      skill: skillWith([
        {
          kind: "patch_excel",
          on: "on_fail",
          payload: {
            mappings: [{ sheet: "检验批", cell: "B4", field_key: "project_name" }],
          },
        },
      ]),
      original: { bytes: await blob.get("orig"), mime: XLSX_MIME },
      verdict: "fail",
      fieldValues: { project_name: "入库映射" },
    });
    await blob.put({ key: "patched", bytes: result.artifact.bytes, mime: result.artifact.mime });
    expect(result.artifact.mime).toBe(XLSX_MIME);
    expect(await readCell(await blob.get("patched"), "检验批", "B4")).toBe("入库映射");
  });

  it("does not import resolveEffectiveExcelMappings or eval (Skill mappings only)", () => {
    const src = readFileSync(new URL("../src/skill/runner.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/from ["'][^"']*effective-mappings/);
    expect(src).not.toMatch(/^\s*import[\s\S]*resolveEffectiveExcelMappings/m);
    expect(src).not.toMatch(/\beval\s*\(/);
    expect(src).not.toMatch(/new Function/);
  });
});
