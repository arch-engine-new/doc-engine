/**
 * Merge type-level FieldDef rows with template FieldBox rows for extraction.
 * Caller supplies fieldDefs already flattened along the DocType ancestor chain (child wins on duplicate keys).
 */

import type { FieldBoxRow, FieldDefRow } from "../types.js";

/** Box shape consumed by extractByTemplate / extractOcrByTemplate after inheritance merge. */
export interface EffectiveFieldBox {
  field_key: string;
  value_type: string;
  page: number;
  x: string;
  y: string;
  w: string;
  h: string;
  /** True when the key originates from a type-level FieldDef (including def+box overlap). */
  inherited?: boolean;
}

/**
 * Union inherited field defs with template boxes: template box wins coords and value_type;
 * def-only keys get synthetic zero coords so extraction still projects the key.
 */
export function resolveEffectiveBoxes(
  fieldDefs: FieldDefRow[],
  templateBoxes: FieldBoxRow[],
): EffectiveFieldBox[] {
  const defByKey = new Map<string, FieldDefRow>();
  for (const def of fieldDefs ?? []) {
    const key = def?.field_key;
    if (typeof key === "string" && key.length > 0) {
      defByKey.set(key, def);
    }
  }

  const boxByKey = new Map<string, FieldBoxRow>();
  for (const box of templateBoxes ?? []) {
    const key = box?.field_key;
    if (typeof key === "string" && key.length > 0) {
      boxByKey.set(key, box);
    }
  }

  const keys = new Set<string>([...defByKey.keys(), ...boxByKey.keys()]);
  const result: EffectiveFieldBox[] = [];

  for (const key of keys) {
    const box = boxByKey.get(key);
    const def = defByKey.get(key);

    if (box) {
      result.push({
        field_key: key,
        value_type: box.value_type,
        page: box.page,
        x: box.x,
        y: box.y,
        w: box.w,
        h: box.h,
        inherited: def !== undefined,
      });
    } else if (def) {
      result.push({
        field_key: key,
        value_type: def.value_type,
        page: 0,
        x: "0",
        y: "0",
        w: "0",
        h: "0",
        inherited: true,
      });
    }
  }

  result.sort((a, b) => a.field_key.localeCompare(b.field_key, "zh"));
  return result;
}
