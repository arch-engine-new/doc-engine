/**
 * Read an Excel template, apply effective mappings and placeholder substitution, return xlsx buffer.
 */

import ExcelJS from "exceljs";
import type { FieldFillRuleRow } from "../types.js";
import type { EffectiveExcelMapping } from "./effective-mappings.js";

/** Path, Node Buffer, or bytes. exceljs `load` wants ArrayBuffer, not `Buffer<ArrayBufferLike>`. */
export type ExcelFillTemplate = string | Buffer | Uint8Array;

export interface ExcelFillInput {
  template: ExcelFillTemplate;
  sheetName?: string | null;
  mappings: EffectiveExcelMapping[];
  fieldValues: Record<string, string | number | boolean | null | undefined>;
  rules?: FieldFillRuleRow[];
}

const PLACEHOLDER_RE = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;

/** Deterministic Excel fill: explicit fieldValues beat fill rules, then empty. */
export class ExcelFillService {
  async fill(input: ExcelFillInput): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    if (typeof input.template === "string") {
      await workbook.xlsx.readFile(input.template);
    } else {
      await workbook.xlsx.load(toExcelLoadBytes(input.template));
    }

    const rulesByKey = buildRulesIndex(input.rules, input.mappings);
    const resolvedValues = buildResolvedValues(input.mappings, input.fieldValues, rulesByKey);

    for (const mapping of input.mappings) {
      if (!mapping.cell) continue;
      const sheet = resolveWorksheet(workbook, mapping.sheet_name, input.sheetName);
      if (!sheet) continue;
      const value = resolvedValues.get(mapping.field_key);
      if (value === undefined) continue;
      sheet.getCell(mapping.cell).value = value;
    }

    const sheetsToScan = collectSheetsToScan(workbook, input.mappings, input.sheetName);
    for (const sheet of sheetsToScan) {
      replacePlaceholdersInSheet(sheet, resolvedValues);
    }

    const out = await workbook.xlsx.writeBuffer();
    return Buffer.from(out);
  }
}

/** Copy into a standalone ArrayBuffer so exceljs Buffer (extends ArrayBuffer) type-checks. */
function toExcelLoadBytes(template: Buffer | Uint8Array): ArrayBuffer {
  const copy = Uint8Array.from(template);
  return copy.buffer.slice(0, copy.byteLength);
}

function buildRulesIndex(
  rules: FieldFillRuleRow[] | undefined,
  mappings: EffectiveExcelMapping[],
): Map<string, FieldFillRuleRow> {
  const byKey = new Map<string, FieldFillRuleRow>();
  for (const mapping of mappings) {
    if (mapping.rule) {
      byKey.set(mapping.field_key, mapping.rule);
    }
  }
  for (const rule of rules ?? []) {
    if (rule?.field_key) {
      byKey.set(rule.field_key, rule);
    }
  }
  return byKey;
}

function buildResolvedValues(
  mappings: EffectiveExcelMapping[],
  fieldValues: Record<string, string | number | boolean | null | undefined>,
  rulesByKey: Map<string, FieldFillRuleRow>,
): Map<string, string> {
  const keys = new Set<string>([
    ...mappings.map((m) => m.field_key),
    ...Object.keys(fieldValues ?? {}),
    ...rulesByKey.keys(),
  ]);

  const resolved = new Map<string, string>();
  for (const key of keys) {
    const value = resolveFieldValue(key, fieldValues, rulesByKey.get(key));
    if (value !== null) {
      resolved.set(key, value);
    }
  }
  return resolved;
}

function resolveFieldValue(
  fieldKey: string,
  fieldValues: Record<string, string | number | boolean | null | undefined>,
  rule: FieldFillRuleRow | undefined,
): string | null {
  if (Object.prototype.hasOwnProperty.call(fieldValues, fieldKey)) {
    const explicit = fieldValues[fieldKey];
    if (explicit !== null && explicit !== undefined && explicit !== "") {
      return String(explicit);
    }
  }

  if (rule?.default_literal != null && rule.default_literal !== "") {
    return rule.default_literal;
  }

  return null;
}

function resolveWorksheet(
  workbook: ExcelJS.Workbook,
  mappingSheetName: string | null,
  fallbackSheetName: string | null | undefined,
): ExcelJS.Worksheet | undefined {
  const name = mappingSheetName ?? fallbackSheetName ?? null;
  if (name) {
    return workbook.getWorksheet(name) ?? undefined;
  }
  return workbook.worksheets[0];
}

function collectSheetsToScan(
  workbook: ExcelJS.Workbook,
  mappings: EffectiveExcelMapping[],
  fallbackSheetName: string | null | undefined,
): ExcelJS.Worksheet[] {
  const names = new Set<string>();
  for (const mapping of mappings) {
    if (mapping.sheet_name) {
      names.add(mapping.sheet_name);
    }
  }
  if (fallbackSheetName) {
    names.add(fallbackSheetName);
  }

  if (names.size === 0) {
    return workbook.worksheets.slice(0, 1);
  }

  const sheets: ExcelJS.Worksheet[] = [];
  for (const name of names) {
    const sheet = workbook.getWorksheet(name);
    if (sheet) {
      sheets.push(sheet);
    }
  }
  return sheets.length > 0 ? sheets : workbook.worksheets.slice(0, 1);
}

function replacePlaceholdersInSheet(
  sheet: ExcelJS.Worksheet,
  resolvedValues: Map<string, string>,
): void {
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      const text = cellText(cell.value);
      if (!text.includes("{{")) return;
      const next = text.replace(PLACEHOLDER_RE, (_match, key: string) => resolvedValues.get(key) ?? "");
      if (next !== text) {
        cell.value = next;
      }
    });
  });
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text ?? "").join("");
    }
    if ("text" in value && typeof value.text === "string") {
      return value.text;
    }
    if ("result" in value && value.result != null) {
      return String(value.result);
    }
  }
  return "";
}
