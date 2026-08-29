/**
 * SLICE-1 seed: published R1 required(编号) and R2 compare(日期A, ≤, 日期B), blocking=1.
 * DocType demo: parent 编号/日期A, child 特殊批号 on PACK_ID.
 * Excel demo: 混凝土施工检验批 (GB 50204) with fixture xlsx + cell mappings.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { blobObjectUri, safeName } from "../blob/minio.js";
import type { BlobStore } from "../blob/port.js";
import type { DocTypeRow, FieldDefRow, TemplateRow } from "../types.js";

export interface DocTypeSeedStore {
  getDocType(docTypeId: string): DocTypeRow | null;
  insertDocType(input: {
    pack_id: string;
    name: string;
    parent_doc_type_id?: string | null;
    doc_type_id?: string;
  }): DocTypeRow;
  saveFieldDefs(
    docTypeId: string,
    defs: Array<{ field_key: string; value_type: string; required: number }>,
  ): FieldDefRow[];
}

export type ConcreteCellMappingWrite = {
  sheet_name: string;
  cell: string;
  field_key: string;
  value_type: string;
  signature_role: string | null;
};

export type ConcreteFillRuleWrite = {
  field_key: string;
  required: number;
  pattern: string | null;
  min_num: string | null;
  max_num: string | null;
  default_generator: string | null;
  default_literal: string | null;
};

export interface ConcreteExcelSeedStore extends DocTypeSeedStore {
  listDocTypesByPack(packId: string): DocTypeRow[];
  getTemplate(templateId: string): TemplateRow | null;
  listTemplatesByDocType(docTypeId: string): TemplateRow[];
  insertTemplate(input: {
    pack_id: string;
    name: string;
    page_image_uri?: string | null;
    doc_type_id?: string;
    layout_kind?: string;
    excel_template_uri?: string | null;
    excel_sheet_name?: string | null;
  }): TemplateRow;
  updateTemplateExcel(
    templateId: string,
    input: {
      layout_kind?: string;
      excel_template_uri?: string | null;
      excel_sheet_name?: string | null;
    },
  ): TemplateRow;
  saveExcelCellMappings(
    templateId: string,
    mappings: ConcreteCellMappingWrite[],
  ): unknown[];
  saveFieldFillRules(docTypeId: string, rules: ConcreteFillRuleWrite[]): unknown[];
  listExcelCellMappings(templateId: string): unknown[];
}

export const PACK_ID = "pack_slice1";
/** Seed shell only — never an industry pack name (公路/水利/房建). */
export const EMPTY_PACK_NAME = "空规范包";
export const SEED_PACK_PROJECT_ID = "prj_empty_pack";
export const EMPTY_PACK_VERSION = "0";

export const DOC_TYPE_PARENT_ID = "dt_demo_parent";
export const DOC_TYPE_CHILD_ID = "dt_demo_child";

/** Stable id from docs/fixtures/excel/concrete-inspection-batch-cell-mapping.json */
export const CONCRETE_DOC_TYPE_ID = "concrete_inspection_batch";
export const CONCRETE_TEMPLATE_NAME = "混凝土施工检验批质量验收记录";
export const CONCRETE_TEMPLATE_XLSX_FILE = "concrete-inspection-batch-gb50204-template.xlsx";

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(MODULE_DIR, "../../../..");

export const CONCRETE_FIXTURE_XLSX = join(
  REPO_ROOT,
  "docs/fixtures/excel/concrete-inspection-batch-gb50204-template.xlsx",
);
export const CONCRETE_FIXTURE_MAPPING_JSON = join(
  REPO_ROOT,
  "docs/fixtures/excel/concrete-inspection-batch-cell-mapping.json",
);

export const RULE_R1_ID = "R1";
export const RULE_R2_ID = "R2";
export const RULE_R1_VERSION_ID = "rv_R1_published";
export const RULE_R2_VERSION_ID = "rv_R2_published";

export const R1_DSL = { op: "required", field: "编号" } as const;
export const R2_DSL = {
  op: "compare",
  left: "日期A",
  operator: "≤",
  right: "日期B",
} as const;

export const FIXTURE_OK = {
  编号: "SH-001",
  日期A: "2026-08-01",
  日期B: "2026-08-20",
} as const;

export const FIXTURE_REVERSED = {
  编号: "SH-002",
  日期A: "2026-08-20",
  日期B: "2026-08-01",
} as const;

export type FixtureKind = "ok" | "reversed";

export interface ConcreteFixtureMapping {
  docTypeId: string;
  title: string;
  standard: string;
  sheet: string;
  fields: Array<{
    fieldKey: string;
    cell: string;
    valueType: string;
    required?: boolean;
    role?: string;
  }>;
}

export interface SeedConcreteInspectionBatchInput {
  packId: string;
  blob?: BlobStore;
}

export interface SeedConcreteInspectionBatchResult {
  docTypeId: string;
  templateId: string;
  mappingCount: number;
}

export function fieldsForKind(kind: FixtureKind): Record<string, string> {
  return kind === "ok" ? { ...FIXTURE_OK } : { ...FIXTURE_REVERSED };
}

export interface SeedDemoDocTypesInput {
  packId: string;
  parentId: string;
  childId: string;
}

/** Idempotent parent/child DocType + FieldDef seed for demo pack (AC-2 / AC-5). */
export function seedDemoDocTypes(store: DocTypeSeedStore, input: SeedDemoDocTypesInput): void {
  const existing = store.getDocType(input.parentId);
  if (existing) {
    return;
  }

  store.insertDocType({
    pack_id: input.packId,
    doc_type_id: input.parentId,
    name: "夹具父类型",
    parent_doc_type_id: null,
  });
  store.saveFieldDefs(input.parentId, [
    { field_key: "编号", value_type: "string", required: 0 },
    { field_key: "日期A", value_type: "date", required: 0 },
  ]);

  store.insertDocType({
    pack_id: input.packId,
    doc_type_id: input.childId,
    name: "夹具子类型",
    parent_doc_type_id: input.parentId,
  });
  store.saveFieldDefs(input.childId, [{ field_key: "特殊批号", value_type: "string", required: 0 }]);
}

/** Load concrete inspection batch cell-mapping fixture (AC-3 SSOT). */
export function loadConcreteFixtureMapping(
  jsonPath: string = CONCRETE_FIXTURE_MAPPING_JSON,
): ConcreteFixtureMapping {
  return JSON.parse(readFileSync(jsonPath, "utf8")) as ConcreteFixtureMapping;
}

export function concreteFieldDefsFromFixture(
  fixture: ConcreteFixtureMapping,
): Array<{ field_key: string; value_type: string; required: number }> {
  return fixture.fields.map((field) => ({
    field_key: field.fieldKey,
    value_type: field.valueType,
    required: field.required ? 1 : 0,
  }));
}

export function concreteCellMappingsFromFixture(
  fixture: ConcreteFixtureMapping,
): ConcreteCellMappingWrite[] {
  return fixture.fields.map((field) => ({
    sheet_name: fixture.sheet,
    cell: field.cell,
    field_key: field.fieldKey,
    value_type: field.valueType,
    signature_role: field.role ?? null,
  }));
}

/** Basic FieldFillRule entries for the concrete inspection batch demo. */
export function concreteFillRulesFromFixture(fixture: ConcreteFixtureMapping): ConcreteFillRuleWrite[] {
  const overrides: Record<string, Partial<ConcreteFillRuleWrite>> = {
    acceptance_basis: {
      default_generator: "literal",
      default_literal: "GB 50204-2015",
    },
    construction_basis: {
      default_generator: "literal",
      default_literal: "混凝土结构工程施工质量验收规范 GB 50204-2015",
    },
    project_name: { default_generator: "project_field" },
    constructor_org: { default_generator: "project_field" },
    division_name: { default_generator: "project_field" },
    sub_item_name: { default_generator: "project_field" },
    batch_no: {
      default_generator: "compliance_sample",
      pattern: "^[A-Z0-9-]+$",
    },
    strength_sampling_record: {
      default_generator: "compliance_sample",
      min_num: "30",
      max_num: "50",
    },
    batch_capacity: {
      default_generator: "compliance_sample",
      pattern: "^\\d+(\\.\\d+)?m3$",
    },
  };

  return fixture.fields.map((field) => {
    const override = overrides[field.fieldKey] ?? {};
    return {
      field_key: field.fieldKey,
      required: field.required ? 1 : 0,
      pattern: override.pattern ?? null,
      min_num: override.min_num ?? null,
      max_num: override.max_num ?? null,
      default_generator: override.default_generator ?? null,
      default_literal: override.default_literal ?? null,
    };
  });
}

async function findConcreteTemplate(
  store: ConcreteExcelSeedStore,
  docTypeId: string,
): Promise<TemplateRow | null> {
  const templates = await Promise.resolve(store.listTemplatesByDocType(docTypeId));
  return pickConcreteTemplate(templates);
}

function pickConcreteTemplate(templates: TemplateRow[]): TemplateRow | null {
  return (
    templates.find((row) => row.layout_kind === "excel" || row.name === CONCRETE_TEMPLATE_NAME) ??
    null
  );
}

function findConcreteDocTypeInPack(store: ConcreteExcelSeedStore, packId: string): DocTypeRow | null {
  return (
    store.listDocTypesByPack(packId).find((row) => row.name === "混凝土施工检验批") ?? null
  );
}

function resolveConcreteDocTypeId(store: ConcreteExcelSeedStore, packId: string): string | undefined {
  const inPack = findConcreteDocTypeInPack(store, packId);
  if (inPack) {
    return inPack.doc_type_id;
  }
  const byStableId = store.getDocType(CONCRETE_DOC_TYPE_ID);
  if (!byStableId) {
    return CONCRETE_DOC_TYPE_ID;
  }
  if (byStableId.pack_id === packId) {
    return CONCRETE_DOC_TYPE_ID;
  }
  return undefined;
}

async function resolveConcreteDocTypeIdAsync(
  store: ConcreteExcelSeedStore,
  packId: string,
): Promise<string | undefined> {
  const inPackList = await Promise.resolve(store.listDocTypesByPack(packId));
  const inPack = inPackList.find((row) => row.name === "混凝土施工检验批") ?? null;
  if (inPack) {
    return inPack.doc_type_id;
  }
  const byStableId = await Promise.resolve(store.getDocType(CONCRETE_DOC_TYPE_ID));
  if (!byStableId) {
    return CONCRETE_DOC_TYPE_ID;
  }
  if (byStableId.pack_id === packId) {
    return CONCRETE_DOC_TYPE_ID;
  }
  return undefined;
}

async function tryExistingConcreteSeed(
  store: ConcreteExcelSeedStore,
  packId: string,
): Promise<SeedConcreteInspectionBatchResult | null> {
  const inPack = await Promise.resolve(store.listDocTypesByPack(packId));
  const docType = inPack.find((row) => row.name === "混凝土施工检验批") ?? null;
  if (!docType) {
    return null;
  }
  const templates = await Promise.resolve(store.listTemplatesByDocType(docType.doc_type_id));
  const template = pickConcreteTemplate(templates);
  if (!template) {
    return null;
  }
  const mappings = await Promise.resolve(store.listExcelCellMappings(template.template_id));
  if (mappings.length < 20) {
    return null;
  }
  return {
    docTypeId: docType.doc_type_id,
    templateId: template.template_id,
    mappingCount: mappings.length,
  };
}

function tryExistingConcreteSeedSync(
  store: ConcreteExcelSeedStore,
  packId: string,
): SeedConcreteInspectionBatchResult | null {
  const docType = findConcreteDocTypeInPack(store, packId);
  if (!docType) {
    return null;
  }
  const template = pickConcreteTemplate(store.listTemplatesByDocType(docType.doc_type_id));
  if (!template) {
    return null;
  }
  const mappings = store.listExcelCellMappings(template.template_id);
  if (mappings.length < 20) {
    return null;
  }
  return {
    docTypeId: docType.doc_type_id,
    templateId: template.template_id,
    mappingCount: mappings.length,
  };
}

async function applyConcreteLedgerSeed(
  store: ConcreteExcelSeedStore,
  input: SeedConcreteInspectionBatchInput,
): Promise<SeedConcreteInspectionBatchResult> {
  const existing = await tryExistingConcreteSeed(store, input.packId);
  if (existing) {
    return existing;
  }

  const fixture = loadConcreteFixtureMapping();
  const resolvedDocTypeId = await resolveConcreteDocTypeIdAsync(store, input.packId);
  let docType = resolvedDocTypeId
    ? await Promise.resolve(store.getDocType(resolvedDocTypeId))
    : null;
  if (!docType) {
    docType = await Promise.resolve(
      store.insertDocType({
        pack_id: input.packId,
        ...(resolvedDocTypeId ? { doc_type_id: resolvedDocTypeId } : {}),
        name: "混凝土施工检验批",
        parent_doc_type_id: null,
      }),
    );
  }
  await Promise.resolve(store.saveFieldDefs(docType.doc_type_id, concreteFieldDefsFromFixture(fixture)));
  await Promise.resolve(
    store.saveFieldFillRules(docType.doc_type_id, concreteFillRulesFromFixture(fixture)),
  );

  let template = await findConcreteTemplate(store, docType.doc_type_id);
  if (!template) {
    template = await Promise.resolve(
      store.insertTemplate({
        pack_id: input.packId,
        doc_type_id: docType.doc_type_id,
        name: CONCRETE_TEMPLATE_NAME,
        layout_kind: "excel",
        excel_sheet_name: fixture.sheet,
      }),
    );
  } else if (template.layout_kind !== "excel" || !template.excel_sheet_name) {
    template = await Promise.resolve(
      store.updateTemplateExcel(template.template_id, {
        layout_kind: "excel",
        excel_sheet_name: fixture.sheet,
      }),
    );
  }

  const mappings = concreteCellMappingsFromFixture(fixture);
  await Promise.resolve(store.saveExcelCellMappings(template.template_id, mappings));

  return {
    docTypeId: docType.doc_type_id,
    templateId: template.template_id,
    mappingCount: mappings.length,
  };
}

/**
 * Idempotent ledger seed: DocType, excel template row, cell mappings (≥20), fill rules.
 * Sync wrapper for CoreEngineStore.seedPublishedRules.
 */
export function seedConcreteInspectionBatchLedger(
  store: ConcreteExcelSeedStore,
  input: Pick<SeedConcreteInspectionBatchInput, "packId">,
): SeedConcreteInspectionBatchResult {
  const existing = tryExistingConcreteSeedSync(store, input.packId);
  if (existing) {
    return existing;
  }

  const fixture = loadConcreteFixtureMapping();
  const resolvedDocTypeId = resolveConcreteDocTypeId(store, input.packId);
  let docType = resolvedDocTypeId ? store.getDocType(resolvedDocTypeId) : null;
  if (!docType) {
    docType = store.insertDocType({
      pack_id: input.packId,
      ...(resolvedDocTypeId ? { doc_type_id: resolvedDocTypeId } : {}),
      name: "混凝土施工检验批",
      parent_doc_type_id: null,
    });
  }
  store.saveFieldDefs(docType.doc_type_id, concreteFieldDefsFromFixture(fixture));
  store.saveFieldFillRules(docType.doc_type_id, concreteFillRulesFromFixture(fixture));

  let template = pickConcreteTemplate(store.listTemplatesByDocType(docType.doc_type_id));
  if (!template) {
    template = store.insertTemplate({
      pack_id: input.packId,
      doc_type_id: docType.doc_type_id,
      name: CONCRETE_TEMPLATE_NAME,
      layout_kind: "excel",
      excel_sheet_name: fixture.sheet,
    });
  } else if (template.layout_kind !== "excel" || !template.excel_sheet_name) {
    template = store.updateTemplateExcel(template.template_id, {
      layout_kind: "excel",
      excel_sheet_name: fixture.sheet,
    });
  }

  const mappings = concreteCellMappingsFromFixture(fixture);
  store.saveExcelCellMappings(template.template_id, mappings);

  return {
    docTypeId: docType.doc_type_id,
    templateId: template.template_id,
    mappingCount: mappings.length,
  };
}

async function uploadConcreteTemplateBytes(
  store: ConcreteExcelSeedStore,
  blob: BlobStore,
  templateId: string,
  sheetName: string,
): Promise<TemplateRow> {
  const xlsxBytes = readFileSync(CONCRETE_FIXTURE_XLSX);
  const key = `templates/${templateId}/${safeName(CONCRETE_TEMPLATE_XLSX_FILE)}`;
  const bucket =
    typeof (blob as { bucket?: string }).bucket === "string"
      ? (blob as { bucket: string }).bucket
      : "docengine";
  await blob.ensureBucket();
  await blob.put({
    key,
    bytes: new Uint8Array(xlsxBytes),
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  return await Promise.resolve(
    store.updateTemplateExcel(templateId, {
      layout_kind: "excel",
      excel_template_uri: blobObjectUri(bucket, key),
      excel_sheet_name: sheetName,
    }),
  );
}

/**
 * Full excel demo seed: ledger rows + optional fixture xlsx upload to BlobStore.
 * Async — use from DemoHttpSession.seedFixtures (MemoryBlobStore in test/dev).
 */
export async function seedConcreteInspectionBatchExcelDemo(
  store: ConcreteExcelSeedStore,
  input: SeedConcreteInspectionBatchInput,
): Promise<SeedConcreteInspectionBatchResult> {
  const ledger = await applyConcreteLedgerSeed(store, input);
  if (!input.blob) {
    return ledger;
  }

  const fixture = loadConcreteFixtureMapping();
  const template = await Promise.resolve(store.getTemplate(ledger.templateId));
  if (template && !template.excel_template_uri) {
    await uploadConcreteTemplateBytes(store, input.blob, ledger.templateId, fixture.sheet);
  }
  return ledger;
}
