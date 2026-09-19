/**
 * Project fixture JSON onto template FieldBox keys.
 * Missing keys become JSON null so Job extraction never throws.
 */

import type { FieldBoxRow } from "../types.js";

export type FieldBoxKey = Pick<FieldBoxRow, "field_key">;

/**
 * Copy each box field_key from fixture fields, or null when the key is absent.
 * Never throws: a bad fixture/box list yields an empty object so Job continues.
 */
export function extractByTemplate(
  fields: Record<string, unknown>,
  boxes: FieldBoxKey[],
): Record<string, unknown> {
  try {
    const source = fields && typeof fields === "object" ? fields : {};
    const projected: Record<string, unknown> = {};
    for (const box of boxes ?? []) {
      const key = box?.field_key;
      if (typeof key !== "string" || key.length === 0) continue;
      projected[key] = Object.prototype.hasOwnProperty.call(source, key) ? source[key] : null;
    }
    return projected;
  } catch {
    return {};
  }
}
