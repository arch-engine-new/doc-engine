/**
 * SLICE-1 seed: published R1 required(编号) and R2 compare(日期A, ≤, 日期B), blocking=1.
 * DocType demo: parent 编号/日期A, child 特殊批号 on PACK_ID.
 */

import type { DocTypeRow, FieldDefRow } from "../types.js";

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

export const PACK_ID = "pack_slice1";
/** Seed shell only — never an industry pack name (公路/水利/房建). */
export const EMPTY_PACK_NAME = "空规范包";
export const SEED_PACK_PROJECT_ID = "prj_empty_pack";
export const EMPTY_PACK_VERSION = "0";

export const DOC_TYPE_PARENT_ID = "dt_demo_parent";
export const DOC_TYPE_CHILD_ID = "dt_demo_child";

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
