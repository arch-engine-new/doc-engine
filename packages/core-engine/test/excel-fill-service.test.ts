/**
 * AC-3: concrete inspection batch fixture → B4 / E13 / C27 filled.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import ExcelJS from "exceljs";
import { describe, it, expect } from "vitest";
import { runMigrationOnDb } from "../src/persistence/migrate.js";
import { CoreEngineStore } from "../src/persistence/store.js";
import { resolveEffectiveExcelMappings } from "../src/excel/effective-mappings.js";
import { ExcelFillService } from "../src/excel/fill-service.js";
import type { EffectiveExcelMapping } from "../src/excel/effective-mappings.js";
import type { ExcelCellMappingWrite } from "../src/persistence/store.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "../../..");
const FIXTURE_XLSX = join(
  REPO_ROOT,
  "docs/fixtures/excel/concrete-inspection-batch-gb50204-template.xlsx",
);
const FIXTURE_MAPPING_JSON = join(
  REPO_ROOT,
  "docs/fixtures/excel/concrete-inspection-batch-cell-mapping.json",
);

interface FixtureMappingJson {
  sheet: string;
  fields: Array<{
    fieldKey: string;
    cell: string;
    valueType: string;
    role?: string;
  }>;
}

function openTestStore(): CoreEngineStore {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrationOnDb(db);
  return new CoreEngineStore(db);
}

function fixtureMappingsFromJson(json: FixtureMappingJson): EffectiveExcelMapping[] {
  return json.fields.map((field) => ({
    field_key: field.fieldKey,
    sheet_name: json.sheet,
    cell: field.cell,
    value_type: field.valueType,
    signature_role: field.role ?? null,
    rule: null,
  }));
}

function cellMappingsFromJson(
  templateId: string,
  json: FixtureMappingJson,
): ExcelCellMappingWrite[] {
  return json.fields.map((field) => ({
    sheet_name: json.sheet,
    cell: field.cell,
    field_key: field.fieldKey,
    value_type: field.valueType,
    signature_role: field.role ?? null,
  }));
}

async function readCell(buffer: Buffer, sheetName: string, address: string): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet(sheetName) ?? workbook.worksheets[0];
  const value = sheet.getCell(address).value;
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "object" && "richText" in value && Array.isArray(value.richText)) {
    return value.richText.map((part) => part.text ?? "").join("");
  }
  return String(value);
}

describe("resolveEffectiveExcelMappings", () => {
  it("merges ancestor field defs with template cell mappings; cell wins on overlap", async () => {
    const store = openTestStore();
    const pack = store.insertSpecPack({
      project_id: store.insertProject("Excel Demo").project_id,
      name: "检验批",
      version: "1",
    });
    const parent = store.insertDocType({
      pack_id: pack.pack_id,
      name: "检验批父类",
    });
    const child = store.insertDocType({
      pack_id: pack.pack_id,
      parent_doc_type_id: parent.doc_type_id,
      name: "混凝土检验批",
    });
    store.saveFieldDefs(parent.doc_type_id, [
      { field_key: "project_name", value_type: "string", required: 1 },
      { field_key: "batch_no", value_type: "string", required: 1 },
    ]);
    store.saveFieldDefs(child.doc_type_id, [
      { field_key: "project_name", value_type: "text", required: 1 },
      { field_key: "strength_sampling_record", value_type: "text", required: 1 },
    ]);

    const template = store.insertTemplate({
      pack_id: pack.pack_id,
      doc_type_id: child.doc_type_id,
      name: "混凝土模板",
      layout_kind: "excel",
      excel_sheet_name: "检验批记录",
    });
    store.saveExcelCellMappings(template.template_id, [
      {
        sheet_name: "检验批记录",
        cell: "B4",
        field_key: "project_name",
        value_type: "string",
        signature_role: null,
      },
      {
        sheet_name: "检验批记录",
        cell: "E13",
        field_key: "strength_sampling_record",
        value_type: "text",
        signature_role: null,
      },
    ]);

    const effective = await resolveEffectiveExcelMappings(
      child.doc_type_id,
      template.template_id,
      store,
    );
    const byKey = Object.fromEntries(effective.map((row) => [row.field_key, row]));

    expect(Object.keys(byKey).sort()).toEqual([
      "batch_no",
      "project_name",
      "strength_sampling_record",
    ]);
    expect(byKey.batch_no).toMatchObject({
      cell: null,
      value_type: "string",
      inherited: true,
    });
    expect(byKey.project_name).toMatchObject({
      cell: "B4",
      value_type: "string",
      inherited: true,
    });
    expect(byKey.strength_sampling_record).toMatchObject({
      cell: "E13",
      value_type: "text",
      inherited: true,
    });
  });
});

describe("ExcelFillService", () => {
  const fixtureJson = JSON.parse(readFileSync(FIXTURE_MAPPING_JSON, "utf8")) as FixtureMappingJson;
  const demoValues = {
    project_name: "滨江综合体一期工程",
    strength_sampling_record:
      "C30混凝土试块留置1组，28d抗压强度代表值35.2MPa，符合设计及GB50204-2015要求。",
    supervisor_engineer_sign: "王监理",
  };

  it("AC-3 fills project_name at B4, strength text at E13, supervisor sign at C27", async () => {
    const mappings = fixtureMappingsFromJson(fixtureJson);
    const service = new ExcelFillService();

    const buffer = await service.fill({
      template: FIXTURE_XLSX,
      sheetName: fixtureJson.sheet,
      mappings,
      fieldValues: demoValues,
    });

    expect(await readCell(buffer, fixtureJson.sheet, "B4")).toBe(demoValues.project_name);
    expect(await readCell(buffer, fixtureJson.sheet, "E13")).toBe(
      demoValues.strength_sampling_record,
    );
    expect(await readCell(buffer, fixtureJson.sheet, "C27")).toBe(
      demoValues.supervisor_engineer_sign,
    );
  });

  it("accepts template buffer and replaces {{fieldKey}} placeholders", async () => {
    const templateBuffer = readFileSync(FIXTURE_XLSX);
    const mappings = fixtureMappingsFromJson(fixtureJson);
    const service = new ExcelFillService();

    const buffer = await service.fill({
      template: templateBuffer,
      sheetName: fixtureJson.sheet,
      mappings,
      fieldValues: { project_name: "缓冲模板项目" },
    });

    expect(await readCell(buffer, fixtureJson.sheet, "B4")).toBe("缓冲模板项目");
    expect(await readCell(buffer, fixtureJson.sheet, "C4")).toBe("缓冲模板项目");
  });

  it("end-to-end via store effective mappings", async () => {
    const store = openTestStore();
    const pack = store.insertSpecPack({
      project_id: store.insertProject("Concrete Demo").project_id,
      name: "GB50204",
      version: "1",
    });
    const docType = store.insertDocType({
      pack_id: pack.pack_id,
      name: "混凝土施工检验批质量验收记录",
    });
    const template = store.insertTemplate({
      pack_id: pack.pack_id,
      doc_type_id: docType.doc_type_id,
      name: "混凝土检验批模板",
      layout_kind: "excel",
      excel_sheet_name: fixtureJson.sheet,
    });
    store.saveExcelCellMappings(
      template.template_id,
      cellMappingsFromJson(template.template_id, fixtureJson),
    );

    const effective = await resolveEffectiveExcelMappings(
      docType.doc_type_id,
      template.template_id,
      store,
    );
    expect(effective.length).toBeGreaterThanOrEqual(20);

    const buffer = await new ExcelFillService().fill({
      template: FIXTURE_XLSX,
      sheetName: fixtureJson.sheet,
      mappings: effective,
      fieldValues: demoValues,
    });

    expect(await readCell(buffer, fixtureJson.sheet, "B4")).toBe(demoValues.project_name);
    expect(await readCell(buffer, fixtureJson.sheet, "E13")).toBe(
      demoValues.strength_sampling_record,
    );
    expect(await readCell(buffer, fixtureJson.sheet, "C27")).toBe(
      demoValues.supervisor_engineer_sign,
    );
  });
});
