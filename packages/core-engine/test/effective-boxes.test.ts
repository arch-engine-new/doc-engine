/**
 * AC-2: parent defs 编号/日期A + child 特殊批号 + template box → 3 effective keys.
 */

import { describe, it, expect } from "vitest";
import { resolveEffectiveBoxes } from "../src/extract/effective-boxes.js";
import type { FieldBoxRow, FieldDefRow } from "../src/types.js";

function makeDef(field_key: string, value_type: string): FieldDefRow {
  return {
    id: 1,
    doc_type_id: "dt-child",
    field_key,
    value_type,
    required: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    creator: "system",
    updater: "system",
    deleted: 0,
  };
}

function makeBox(
  field_key: string,
  value_type: string,
  page: number,
  x: string,
  y: string,
  w: string,
  h: string,
): FieldBoxRow {
  return {
    id: 1,
    template_id: "tpl-1",
    field_key,
    value_type,
    page,
    x,
    y,
    w,
    h,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    creator: "system",
    updater: "system",
    deleted: 0,
  };
}

describe("resolveEffectiveBoxes", () => {
  it("AC-2 merges parent+child field defs with template box into 3 keys", () => {
    // Ancestor chain already flattened: parent 编号/日期A + child 特殊批号.
    const fieldDefs: FieldDefRow[] = [
      makeDef("编号", "string"),
      makeDef("日期A", "date"),
      makeDef("特殊批号", "string"),
    ];

    const templateBoxes: FieldBoxRow[] = [
      makeBox("特殊批号", "string", 1, "10", "20", "80", "12"),
    ];

    const effective = resolveEffectiveBoxes(fieldDefs, templateBoxes);

    expect(effective.map((b) => b.field_key).sort()).toEqual(["日期A", "特殊批号", "编号"]);

    const byKey = Object.fromEntries(effective.map((b) => [b.field_key, b]));

    expect(byKey["编号"]).toMatchObject({
      value_type: "string",
      page: 0,
      x: "0",
      y: "0",
      w: "0",
      h: "0",
      inherited: true,
    });

    expect(byKey["日期A"]).toMatchObject({
      value_type: "date",
      page: 0,
      inherited: true,
    });

    expect(byKey["特殊批号"]).toMatchObject({
      value_type: "string",
      page: 1,
      x: "10",
      y: "20",
      w: "80",
      h: "12",
      inherited: true,
    });
  });

  it("template-only extension keys are not marked inherited", () => {
    const fieldDefs: FieldDefRow[] = [makeDef("编号", "string")];
    const templateBoxes: FieldBoxRow[] = [
      makeBox("编号", "string", 1, "0", "0", "12", "8"),
      makeBox("备注", "string", 1, "0", "40", "100", "8"),
    ];

    const effective = resolveEffectiveBoxes(fieldDefs, templateBoxes);
    const remark = effective.find((b) => b.field_key === "备注");

    expect(remark).toMatchObject({
      page: 1,
      inherited: false,
    });
  });
});
