/**
 * Merge DocType ancestor FieldDefs with template ExcelCellMappings for fill.
 * Cell mapping wins sheet/cell/value_type/signature_role when the same field_key exists.
 */

import type {
  ExcelCellMappingRow,
  FieldDefRow,
  FieldFillRuleRow,
} from "../types.js";

/** Mapping row consumed by ExcelFillService after inheritance merge. */
export interface EffectiveExcelMapping {
  field_key: string;
  sheet_name: string | null;
  cell: string | null;
  value_type: string;
  signature_role: string | null;
  rule: FieldFillRuleRow | null;
  /** True when the key originates from a type-level FieldDef (including def+cell overlap). */
  inherited?: boolean;
}

export interface ExcelMappingStore {
  listEffectiveFieldDefs(docTypeId: string): FieldDefRow[] | Promise<FieldDefRow[]>;
  listExcelCellMappings(templateId: string): ExcelCellMappingRow[] | Promise<ExcelCellMappingRow[]>;
  listFieldFillRules(docTypeId: string): FieldFillRuleRow[] | Promise<FieldFillRuleRow[]>;
}

/**
 * Union inherited field defs with template cell mappings; template mapping wins coordinates
 * and value metadata for overlapping keys.
 */
export async function resolveEffectiveExcelMappings(
  docTypeId: string,
  templateId: string,
  store: ExcelMappingStore,
): Promise<EffectiveExcelMapping[]> {
  const [fieldDefs, cellMappings, fillRules] = await Promise.all([
    store.listEffectiveFieldDefs(docTypeId),
    store.listExcelCellMappings(templateId),
    store.listFieldFillRules(docTypeId),
  ]);

  const defByKey = new Map<string, FieldDefRow>();
  for (const def of fieldDefs ?? []) {
    const key = def?.field_key;
    if (typeof key === "string" && key.length > 0) {
      defByKey.set(key, def);
    }
  }

  const cellByKey = new Map<string, ExcelCellMappingRow>();
  for (const mapping of cellMappings ?? []) {
    const key = mapping?.field_key;
    if (typeof key === "string" && key.length > 0) {
      cellByKey.set(key, mapping);
    }
  }

  const rulesByKey = new Map<string, FieldFillRuleRow>();
  for (const rule of fillRules ?? []) {
    const key = rule?.field_key;
    if (typeof key === "string" && key.length > 0) {
      rulesByKey.set(key, rule);
    }
  }

  const keys = new Set<string>([...defByKey.keys(), ...cellByKey.keys()]);
  const result: EffectiveExcelMapping[] = [];

  for (const key of keys) {
    const cell = cellByKey.get(key);
    const def = defByKey.get(key);
    const rule = rulesByKey.get(key) ?? null;

    if (cell) {
      result.push({
        field_key: key,
        sheet_name: cell.sheet_name,
        cell: cell.cell,
        value_type: cell.value_type,
        signature_role: cell.signature_role,
        rule,
        inherited: def !== undefined,
      });
    } else if (def) {
      result.push({
        field_key: key,
        sheet_name: null,
        cell: null,
        value_type: def.value_type,
        signature_role: null,
        rule,
        inherited: true,
      });
    }
  }

  result.sort((a, b) => a.field_key.localeCompare(b.field_key, "zh"));
  return result;
}
