/**
 * Rule interpreter for sourceDoc §4.3: all | any | required | exists | compare | regex | eq.
 * Invalid or unsupported DSL yields a fail finding and never throws.
 */

import type { FindingRow, RuleVersionRow } from "../types.js";

export type ExtractionFields = Record<string, unknown>;

export type EvaluableRule = Pick<RuleVersionRow, "version_id" | "dsl_json" | "blocking">;

export type EvaluatedFinding = Pick<FindingRow, "rule_version_id" | "result" | "blocking" | "detail">;

type AllDsl = { op: "all"; args: RuleDsl[] };
type AnyDsl = { op: "any"; args: RuleDsl[] };
type RequiredDsl = { op: "required"; field: string };
type ExistsDsl = { op: "exists"; field: string };
type CompareDsl = { op: "compare"; left: string; operator: string; right: string };
type RegexDsl = { op: "regex"; field: string; pattern: string };
type EqDsl = { op: "eq"; field: string; literal: string };
export type RuleDsl = AllDsl | AnyDsl | RequiredDsl | ExistsDsl | CompareDsl | RegexDsl | EqDsl;

function fieldValue(fields: ExtractionFields, key: string): string | null {
  const value = fields[key];
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length === 0 ? null : text;
}

function parseDsl(raw: unknown): RuleDsl | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  if (rec.op === "all" || rec.op === "any") {
    if (!Array.isArray(rec.args)) return null;
    const args: RuleDsl[] = [];
    for (const item of rec.args) {
      const child = parseDsl(item);
      if (!child) return null;
      args.push(child);
    }
    return { op: rec.op, args };
  }
  if (rec.op === "required" && typeof rec.field === "string") {
    return { op: "required", field: rec.field };
  }
  if (rec.op === "exists" && typeof rec.field === "string") {
    return { op: "exists", field: rec.field };
  }
  if (
    rec.op === "compare" &&
    typeof rec.left === "string" &&
    typeof rec.operator === "string" &&
    typeof rec.right === "string"
  ) {
    return { op: "compare", left: rec.left, operator: rec.operator, right: rec.right };
  }
  if (rec.op === "regex" && typeof rec.field === "string" && typeof rec.pattern === "string") {
    return { op: "regex", field: rec.field, pattern: rec.pattern };
  }
  if (rec.op === "eq" && typeof rec.field === "string" && rec.literal !== undefined && rec.literal !== null) {
    return { op: "eq", field: rec.field, literal: String(rec.literal) };
  }
  return null;
}

function parseDslJson(dslJson: string): RuleDsl | null {
  let raw: unknown;
  try {
    raw = JSON.parse(dslJson);
  } catch {
    return null;
  }
  return parseDsl(raw);
}

function compareIso(left: string, operator: string, right: string): boolean {
  switch (operator) {
    case "≤":
    case "<=":
      return left <= right;
    case "<":
      return left < right;
    case ">":
      return left > right;
    case "≥":
    case ">=":
      return left >= right;
    case "=":
    case "==":
      return left === right;
    default:
      return false;
  }
}

function evalDsl(fields: ExtractionFields, dsl: RuleDsl): { ok: boolean; detail: string | null } {
  switch (dsl.op) {
    case "all": {
      for (const arg of dsl.args) {
        const child = evalDsl(fields, arg);
        if (!child.ok) return child;
      }
      return { ok: true, detail: null };
    }
    case "any": {
      if (dsl.args.length === 0) {
        return { ok: false, detail: "any() has no args" };
      }
      const details: string[] = [];
      for (const arg of dsl.args) {
        const child = evalDsl(fields, arg);
        if (child.ok) return { ok: true, detail: null };
        if (child.detail) details.push(child.detail);
      }
      return { ok: false, detail: details.join("; ") || "any() all failed" };
    }
    case "required": {
      const value = fieldValue(fields, dsl.field);
      if (value === null) {
        return { ok: false, detail: `required(${dsl.field}) missing` };
      }
      return { ok: true, detail: null };
    }
    case "exists": {
      if (!Object.prototype.hasOwnProperty.call(fields, dsl.field)) {
        return { ok: false, detail: `exists(${dsl.field}) missing` };
      }
      if (fields[dsl.field] === null || fields[dsl.field] === undefined) {
        return { ok: false, detail: `exists(${dsl.field}) missing` };
      }
      return { ok: true, detail: null };
    }
    case "compare": {
      const left = fieldValue(fields, dsl.left);
      const right = fieldValue(fields, dsl.right);
      if (left === null || right === null) {
        return {
          ok: false,
          detail: `compare(${dsl.left}, ${dsl.operator}, ${dsl.right}) missing field`,
        };
      }
      const ok = compareIso(left, dsl.operator, right);
      return {
        ok,
        detail: ok ? null : `${dsl.left} must be ${dsl.operator} ${dsl.right}`,
      };
    }
    case "regex": {
      const value = fieldValue(fields, dsl.field);
      if (value === null) {
        return { ok: false, detail: `regex(${dsl.field}) missing` };
      }
      try {
        const re = new RegExp(dsl.pattern);
        const ok = re.test(value);
        return { ok, detail: ok ? null : `${dsl.field} does not match /${dsl.pattern}/` };
      } catch {
        return { ok: false, detail: `regex(${dsl.field}) invalid pattern` };
      }
    }
    case "eq": {
      const value = fieldValue(fields, dsl.field);
      if (value === null) {
        return { ok: false, detail: `eq(${dsl.field}) missing` };
      }
      const ok = value === dsl.literal;
      return { ok, detail: ok ? null : `${dsl.field} != ${dsl.literal}` };
    }
    default:
      return { ok: false, detail: "unsupported or invalid dsl" };
  }
}

function evaluateOne(fields: ExtractionFields, rule: EvaluableRule): EvaluatedFinding {
  const blocking = rule.blocking;
  const dsl = parseDslJson(rule.dsl_json);
  if (!dsl) {
    return {
      rule_version_id: rule.version_id,
      result: "fail",
      blocking,
      detail: "unsupported or invalid dsl",
    };
  }
  const outcome = evalDsl(fields, dsl);
  return {
    rule_version_id: rule.version_id,
    result: outcome.ok ? "pass" : "fail",
    blocking,
    detail: outcome.detail,
  };
}

/**
 * Evaluate rule DSL against extraction fields.
 * Missing fields and invalid DSL become fail findings; never throws.
 */
export function evaluate(fields: ExtractionFields, rules: EvaluableRule[]): EvaluatedFinding[] {
  try {
    return rules.map((rule) => evaluateOne(fields, rule));
  } catch {
    return rules.map((rule) => ({
      rule_version_id: rule.version_id,
      result: "fail" as const,
      blocking: rule.blocking,
      detail: "unsupported or invalid dsl",
    }));
  }
}

export class RuleInterpreter {
  evaluate(fields: ExtractionFields, rules: EvaluableRule[]): EvaluatedFinding[] {
    return evaluate(fields, rules);
  }
}
