/**
 * Task 4: concrete inspection batch excel demo seed (≥20 cell mappings).
 */

import Database from "better-sqlite3";
import { describe, it, expect } from "vitest";
import { MemoryBlobStore } from "../src/blob/memory.js";
import { runMigrationOnDb } from "../src/persistence/migrate.js";
import { CoreEngineStore } from "../src/persistence/store.js";
import {
  CONCRETE_DOC_TYPE_ID,
  PACK_ID,
  loadConcreteFixtureMapping,
  seedConcreteInspectionBatchExcelDemo,
  seedConcreteInspectionBatchLedger,
} from "../src/pipeline/seed.js";

function openTestStore(): CoreEngineStore {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  runMigrationOnDb(db);
  const store = new CoreEngineStore(db);
  store.seedPublishedRules();
  return store;
}

describe("seedConcreteInspectionBatch", () => {
  it("seedPublishedRules creates ≥20 excel cell mappings on PACK_ID", () => {
    const store = openTestStore();
    const docType = store.getDocType(CONCRETE_DOC_TYPE_ID);
    expect(docType).toBeTruthy();
    expect(docType!.name).toBe("混凝土施工检验批");

    const templates = store.listTemplatesByDocType(CONCRETE_DOC_TYPE_ID);
    expect(templates.length).toBeGreaterThan(0);
    const template = templates[0]!;
    expect(template.layout_kind).toBe("excel");
    expect(template.excel_sheet_name).toBe(loadConcreteFixtureMapping().sheet);

    const mappings = store.listExcelCellMappings(template.template_id);
    expect(mappings.length).toBeGreaterThanOrEqual(20);

    const rules = store.listFieldFillRules(CONCRETE_DOC_TYPE_ID);
    const acceptance = rules.find((row) => row.field_key === "acceptance_basis");
    expect(acceptance).toMatchObject({
      default_generator: "literal",
      default_literal: "GB 50204-2015",
    });
    const projectName = rules.find((row) => row.field_key === "project_name");
    expect(projectName).toMatchObject({ default_generator: "project_field" });
  });

  it("seedConcreteInspectionBatchLedger is idempotent", () => {
    const store = openTestStore();
    const first = seedConcreteInspectionBatchLedger(store, { packId: PACK_ID });
    const second = seedConcreteInspectionBatchLedger(store, { packId: PACK_ID });
    expect(second.templateId).toBe(first.templateId);
    expect(store.listExcelCellMappings(first.templateId).length).toBeGreaterThanOrEqual(20);
  });

  it("seedConcreteInspectionBatchExcelDemo uploads fixture xlsx to blob", async () => {
    const store = openTestStore();
    const blob = new MemoryBlobStore();
    const result = await seedConcreteInspectionBatchExcelDemo(store, { packId: PACK_ID, blob });
    expect(result.mappingCount).toBeGreaterThanOrEqual(20);

    const template = store.getTemplate(result.templateId);
    expect(template?.excel_template_uri).toMatch(/^s3:\/\//);
    expect(template?.layout_kind).toBe("excel");

    const key = template!.excel_template_uri!.replace(/^s3:\/\/[^/]+\//, "");
    const bytes = await blob.get(key);
    expect(bytes.byteLength).toBeGreaterThan(0);
  });
});
