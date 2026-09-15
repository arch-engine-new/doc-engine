/**
 * Split standard markdown into clause/table layout units.
 * Tables stay as GFM/VL pipe blocks; Job flattenOcrMarkdown would destroy SUPPORTS.
 */

import type { ClauseSpan } from "./ports.js";
import { splitClauses } from "./split.js";

const TABLE_CAPTION_RE = /表\s*(\d+(?:\.\d+)*)(?:-\d+)?/;
const ARTICLE_RE = /第\s*([\d.]+)\s*条/g;
const DOTTED_RE = /\d+(?:\.\d+)+/g;

export interface SplitLayoutUnit {
  chunkKind: "clause" | "table" | "annex";
  clauseNo: string | null;
  parentClauseNo: string | null;
  heading: string;
  body: string;
  span: ClauseSpan;
  caption: string | null;
  /** Containing clause when the table sits inside that clause's span; never nearest-neighbor. */
  containerClauseNo: string | null;
}

interface TableBlock {
  start: number;
  end: number;
  markdown: string;
  caption: string | null;
}

function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) return false;
  return (trimmed.match(/\|/g) ?? []).length >= 2;
}

function findTableBlocks(text: string): TableBlock[] {
  const lines = text.split(/\r?\n/);
  const blocks: TableBlock[] = [];
  let offset = 0;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const lineStart = offset;
    const lineEnd = offset + line.length + (i < lines.length - 1 ? 1 : 0);
    if (!isTableRow(line)) {
      offset = lineEnd;
      i += 1;
      continue;
    }
    const run = collectTableRun(lines, i, offset);
    if (run.rowCount >= 2) {
      blocks.push({
        start: lineStart,
        end: run.end,
        markdown: text.slice(lineStart, run.end).replace(/\s+$/, ""),
        caption: captionBefore(text, lineStart),
      });
    }
    offset = run.scanOffset;
    i = run.nextIndex;
  }
  return blocks;
}

function collectTableRun(
  lines: string[],
  startIndex: number,
  startOffset: number,
): { end: number; scanOffset: number; nextIndex: number; rowCount: number } {
  let offset = startOffset;
  let rowCount = 0;
  let end = startOffset;
  let i = startIndex;
  while (i < lines.length && isTableRow(lines[i]!)) {
    const line = lines[i]!;
    const lineEnd = offset + line.length + (i < lines.length - 1 ? 1 : 0);
    rowCount += 1;
    end = lineEnd;
    offset = lineEnd;
    i += 1;
  }
  return { end, scanOffset: offset, nextIndex: i, rowCount };
}

function captionBefore(text: string, tableStart: number): string | null {
  const before = text.slice(0, tableStart);
  const lines = before.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const trimmed = lines[i]!.trim();
    if (!trimmed) continue;
    if (isTableRow(trimmed)) return null;
    return TABLE_CAPTION_RE.test(trimmed) ? trimmed : null;
  }
  return null;
}

function maskTableBlocks(text: string, tables: TableBlock[]): string {
  let masked = text;
  for (let i = tables.length - 1; i >= 0; i -= 1) {
    const table = tables[i]!;
    const chunk = masked.slice(table.start, table.end);
    masked = masked.slice(0, table.start) + chunk.replace(/[^\r\n]/g, " ") + masked.slice(table.end);
  }
  return masked;
}

/**
 * Clause numbers cited in prose or table cells. Used for SUPPORTS/CITES;
 * callers must drop refs that are not already ingested (no ghost nodes).
 */
export function extractClauseRefs(text: string): string[] {
  const refs = new Set<string>();
  for (const match of text.matchAll(ARTICLE_RE)) {
    const num = match[1]!;
    refs.add(num);
    refs.add(`第${num}条`);
  }
  for (const match of text.matchAll(DOTTED_RE)) {
    refs.add(match[0]!);
  }
  return [...refs];
}

/**
 * `表 8.5.1-1` names clause 8.5.1. The `-N` suffix is the table serial, not a clause.
 */
export function clauseNoFromTableCaption(caption: string): string | null {
  const match = TABLE_CAPTION_RE.exec(caption);
  return match?.[1] ?? null;
}

function containingClauseNo(
  table: TableBlock,
  clauses: Array<{ clauseNo: string; span: ClauseSpan }>,
): string | null {
  for (const clause of clauses) {
    if (clause.span.start <= table.start && table.end <= clause.span.end) {
      return clause.clauseNo;
    }
  }
  return null;
}

/**
 * Clause units reuse splitClauses headings; GFM/VL pipe runs become table units.
 * Must not flatten pipes — cell_ref SUPPORTS needs the `|` grid intact.
 */
export function splitLayoutUnits(text: string): SplitLayoutUnit[] {
  const tables = findTableBlocks(text);
  const clauses = splitClauses(maskTableBlocks(text, tables));
  const units: SplitLayoutUnit[] = clauses.map((part) => ({
    chunkKind: "clause" as const,
    clauseNo: part.clauseNo,
    parentClauseNo: part.parentClauseNo,
    heading: part.heading,
    body: part.body,
    span: part.span,
    caption: null,
    containerClauseNo: null,
  }));
  for (const table of tables) {
    units.push({
      chunkKind: "table",
      clauseNo: null,
      parentClauseNo: null,
      heading: table.caption ?? "table",
      body: table.markdown,
      span: { start: table.start, end: table.end },
      caption: table.caption,
      containerClauseNo: containingClauseNo(table, clauses),
    });
  }
  units.sort((a, b) => a.span.start - b.span.start);
  return units;
}
