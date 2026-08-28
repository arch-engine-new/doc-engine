/**
 * Hard-parse OCR full text into 编号/日期A/日期B so Job can project onto FieldBox
 * without inventing missing keys or swapping inverted dates for DSL compare.
 */

import { extractByTemplate, type FieldBoxKey } from "./field-box.js";

const NUMBER_LABELS = ["编号", "文号"] as const;
const DATE_A_LABELS = ["日期A", "开始日期", "起始日期"] as const;
const DATE_B_LABELS = ["日期B", "结束日期", "截止日期"] as const;

const ISO_DATE_RE = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/;
const CN_DATE_RE = /^(\d{4})年(\d{1,2})月(\d{1,2})日/;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toIsoDate(year: string, month: string, day: string): string | undefined {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isInteger(y) || y < 1000 || y > 9999) return undefined;
  if (!Number.isInteger(m) || m < 1 || m > 12) return undefined;
  if (!Number.isInteger(d) || d < 1 || d > 31) return undefined;
  return `${String(y).padStart(4, "0")}-${pad2(m)}-${pad2(d)}`;
}

function rawAfterLabel(text: string, label: string): string | undefined {
  const re = new RegExp(`${escapeRegExp(label)}\\s*[：:]\\s*(.+)`, "u");
  const match = text.match(re);
  const raw = match?.[1]?.trim();
  return raw && raw.length > 0 ? raw : undefined;
}

function firstLabeledRaw(text: string, labels: readonly string[]): string | undefined {
  for (const label of labels) {
    const raw = rawAfterLabel(text, label);
    if (raw !== undefined) return raw;
  }
  return undefined;
}

function parseDocNumber(raw: string): string | undefined {
  const token = raw.split(/\s+/)[0]?.replace(/[，。；;,]+$/u, "");
  if (!token || token.length === 0) return undefined;
  return token;
}

function parseIsoDate(raw: string): string | undefined {
  const iso = raw.match(ISO_DATE_RE);
  if (iso) {
    return toIsoDate(iso[1]!, iso[2]!, iso[3]!);
  }
  const cn = raw.match(CN_DATE_RE);
  if (cn) {
    return toIsoDate(cn[1]!, cn[2]!, cn[3]!);
  }
  return undefined;
}

/**
 * Parse OCR full text into 编号/日期A/日期B so R1/R2 can run without guessing
 * absent keys or rewriting inverted date ranges that DSL compare must still fail.
 */
export function parseOcrFields(text: string): Record<string, string> {
  const source = typeof text === "string" ? text : "";
  const fields: Record<string, string> = {};
  if (source.length === 0) {
    return fields;
  }

  const numberRaw = firstLabeledRaw(source, NUMBER_LABELS);
  if (numberRaw !== undefined) {
    const number = parseDocNumber(numberRaw);
    if (number !== undefined) {
      fields["编号"] = number;
    }
  }

  const dateARaw = firstLabeledRaw(source, DATE_A_LABELS);
  if (dateARaw !== undefined) {
    const dateA = parseIsoDate(dateARaw);
    if (dateA !== undefined) {
      fields["日期A"] = dateA;
    }
  }

  const dateBRaw = firstLabeledRaw(source, DATE_B_LABELS);
  if (dateBRaw !== undefined) {
    const dateB = parseIsoDate(dateBRaw);
    if (dateB !== undefined) {
      fields["日期B"] = dateB;
    }
  }

  return fields;
}

/**
 * Project OCR-parsed fields onto FieldBox keys so missing boxes stay JSON null
 * and Job extraction never throws or fabricates clause_id.
 */
export function extractOcrByTemplate(
  text: string,
  boxes: FieldBoxKey[],
): Record<string, unknown> {
  return extractByTemplate(parseOcrFields(text), boxes);
}
