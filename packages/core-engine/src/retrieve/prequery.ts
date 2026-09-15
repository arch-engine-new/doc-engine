/**
 * Prequery: rewrite + intent. Tests use FakePrequery (deterministic).
 * ZhipuPrequery is a thin production wrapper and must not be used as rerank.
 */

import type { ChatComplete, Prequery, PrequeryIntent, PrequeryResult } from "./ports.js";

const EXACT_RE = /(\d+(?:\.\d+)+|第.+条)/;
const GRAPH_RE = /引用|替代|废止|supersede|cites|requires|applies/i;
/** Table captions look like clause numbers; EXACT_RE would steal "8.5.1" from "表 8.5.1-1". */
const TABLE_RE = /附表|见表|表/;

function inferIntent(query: string): PrequeryResult {
  if (TABLE_RE.test(query)) {
    return { rewritten: query, intent: "semantic" };
  }
  const graph = GRAPH_RE.test(query);
  const exact = EXACT_RE.exec(query);
  if (graph) {
    return {
      rewritten: query,
      intent: "graph",
      clauseNo: exact?.[1],
    };
  }
  if (exact) {
    return { rewritten: query, intent: "exact", clauseNo: exact[1] };
  }
  return { rewritten: query, intent: "semantic" };
}

/** Deterministic prequery for tests. Map overrides take precedence; never used as rerank scores. */
export class FakePrequery implements Prequery {
  constructor(private readonly map: Record<string, PrequeryResult> = {}) {}

  /** Map wins so A12 can pin paraphrases; unmapped table captions stay semantic. */
  rewrite(query: string): PrequeryResult {
    const mapped = this.map[query];
    if (mapped) return { ...mapped };
    return inferIntent(query);
  }
}

function parseIntent(value: unknown): PrequeryIntent {
  if (value === "exact" || value === "semantic" || value === "graph") return value;
  return "semantic";
}

/** Thin glm-style wrapper for production prequery only — not a reranker. */
export class ZhipuPrequery implements Prequery {
  constructor(private readonly llm: ChatComplete) {}

  async rewrite(query: string): Promise<PrequeryResult> {
    const raw = await this.llm.complete({
      prompt: `Rewrite this operator query for standard-clause retrieval. Return JSON {"rewritten":string,"intent":"exact"|"semantic"|"graph","clauseNo"?:string}. Query: ${query}`,
    });
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const rec = parsed as Record<string, unknown>;
        const rewritten = typeof rec.rewritten === "string" ? rec.rewritten : query;
        const clauseNo = typeof rec.clauseNo === "string" ? rec.clauseNo : undefined;
        const toClauseNo = typeof rec.toClauseNo === "string" ? rec.toClauseNo : undefined;
        return { rewritten, intent: parseIntent(rec.intent), clauseNo, toClauseNo };
      }
    } catch {
      /* fall through to heuristic */
    }
    return inferIntent(query);
  }
}
