/**
 * Split standard text on clause headings (第N条 / N.N). Not a fixed token window.
 */

import type { ClauseSpan } from "./ports.js";

const HEADING_RE = /^(第.+条|\d+(?:\.\d+)+)(?:\s+|$)(.*)$/;

export interface SplitClause {
  clauseNo: string;
  heading: string;
  body: string;
  span: ClauseSpan;
  parentClauseNo: string | null;
}

function parentNumber(clauseNo: string): string | null {
  if (clauseNo.startsWith("第")) return null;
  const dot = clauseNo.lastIndexOf(".");
  if (dot <= 0) return null;
  return clauseNo.slice(0, dot);
}

/**
 * Split on lines that start with `第…条` or dotted numbers like `1.1`.
 * Preserves parent heading on child clauses. Does not chunk by token length.
 */
export function splitClauses(text: string): SplitClause[] {
  const lines = text.split(/\r?\n/);
  const raw: Array<{
    clauseNo: string;
    headingLine: string;
    bodyLines: string[];
    start: number;
    end: number;
  }> = [];
  let offset = 0;
  let current: (typeof raw)[number] | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineStart = offset;
    const lineEnd = offset + line.length + (i < lines.length - 1 ? 1 : 0);
    const trimmed = line.trim();
    const match = HEADING_RE.exec(trimmed);
    if (match) {
      if (current) {
        current.end = lineStart;
        raw.push(current);
      }
      current = {
        clauseNo: match[1]!,
        headingLine: trimmed,
        bodyLines: [],
        start: lineStart,
        end: lineEnd,
      };
    } else if (current) {
      current.bodyLines.push(line);
      current.end = lineEnd;
    }
    offset = lineEnd;
  }
  if (current) raw.push(current);

  const byNo = new Map(raw.map((item) => [item.clauseNo, item]));
  return raw.map((item) => {
    const parentClauseNo = parentNumber(item.clauseNo);
    const parent = parentClauseNo ? byNo.get(parentClauseNo) : undefined;
    const heading = parent ? `${parent.headingLine} / ${item.headingLine}` : item.headingLine;
    const body = item.bodyLines.join("\n").trim();
    return {
      clauseNo: item.clauseNo,
      heading,
      body,
      span: { start: item.start, end: item.end },
      parentClauseNo: parent ? parentClauseNo : null,
    };
  });
}
