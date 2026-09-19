import type { JobPipeline } from "../pipeline/job-pipeline.js";
import type { RetrieveHit } from "../retrieve/ports.js";
import { isRetrieveChatStep } from "./prompts.js";

/** Read-only prompt snapshot. retrieve/standard_lib omits Job file/findings. */
export interface JobContextSnapshot {
  trace_id: string;
  job_id: string;
  pack_id: string | null;
  status: string;
  step: string;
  file_name: string | null;
  findings_summary: string;
  extraction_fields: Record<string, unknown> | null;
  pending_proposals: number;
  /** This retrieve's hits or 未命中; unused on Job steps. */
  retrieve_hits_summary?: string;
}

/** Optional pack/hits so retrieve chat can skip Job lookup. */
export interface BuildJobContextOptions {
  packId?: string;
  hits?: RetrieveHit[];
}

/** Stable pack thread id so standard_lib chat never borrows listJobs()[0]. */
export function packChatTraceId(packId: string): string {
  return `pack:${packId}`;
}

const PROMPT_BODY_MAX = 800;

function promptHeading(heading: string | null | undefined): string {
  return heading && heading.length > 0 ? heading : "无标题";
}

/** Truncation is prompt-only; the detail panel still shows the full ledger body (Task 3). */
function promptBody(body: string | null | undefined): string {
  if (!body || body.length === 0) {
    return "无正文";
  }
  if (body.length <= PROMPT_BODY_MAX) {
    return body;
  }
  return `${body.slice(0, PROMPT_BODY_MAX)}…`;
}

/**
 * Format this-turn RetrieveHit rows for the LLM. Empty list is an explicit miss.
 * Each row includes heading + a truncated body so chat can cite ledger text.
 */
export function formatRetrieveHitsForPrompt(hits: RetrieveHit[]): string {
  if (hits.length === 0) {
    return "未命中";
  }
  return hits
    .map((hit) => {
      const clauseId = hit.clause_id && hit.clause_id.length > 0 ? hit.clause_id : "—";
      return `- clause_id=${clauseId} unit_id=${hit.unit_id} file_name=${hit.file_name} heading=${promptHeading(hit.heading)} body=${promptBody(hit.body)}`;
    })
    .join("\n");
}

function packIdFromTrace(traceId: string): string | null {
  return traceId.startsWith("pack:") ? traceId.slice("pack:".length) : null;
}

function retrieveSnapshot(
  traceId: string,
  step: string,
  packId: string | null,
  hits: RetrieveHit[],
): JobContextSnapshot {
  return {
    trace_id: traceId,
    job_id: "",
    pack_id: packId,
    status: "standard_lib",
    step,
    file_name: null,
    findings_summary: "未命中",
    extraction_fields: null,
    pending_proposals: 0,
    retrieve_hits_summary: formatRetrieveHitsForPrompt(hits),
  };
}

/**
 * Read-only snapshot for LLM prompts — no writes, no MinIO/OCR clients.
 * retrieve/standard_lib never throw for a missing Job and never copy Job findings.
 */
export async function buildJobContext(
  pipeline: JobPipeline,
  traceId: string,
  step: string,
  options?: BuildJobContextOptions,
): Promise<JobContextSnapshot> {
  if (isRetrieveChatStep(step)) {
    const job = await pipeline.getJobByTrace(traceId);
    const packId = options?.packId ?? job?.pack_id ?? packIdFromTrace(traceId);
    return retrieveSnapshot(traceId, step, packId, options?.hits ?? []);
  }

  const job = await pipeline.getJobByTrace(traceId);
  if (!job) {
    throw new Error(`job not found for trace_id=${traceId}`);
  }

  const document = await pipeline.getDocumentForJob(job.job_id);
  const findings = await pipeline.listFindings(job.job_id);
  const extraction = await pipeline.getExtraction(job.job_id);
  const proposals = await pipeline.listPending(job.job_id);

  const blocking = findings.filter((f) => f.blocking);
  const findings_summary =
    findings.length === 0
      ? "无 finding"
      : `${findings.length} 条 finding（${blocking.length} 条 blocking）: ` +
        findings
          .slice(0, 5)
          .map((f) => `${f.result}${f.blocking ? "[blocking]" : ""}`)
          .join("; ");

  return {
    trace_id: traceId,
    job_id: job.job_id,
    pack_id: job.pack_id,
    status: job.status,
    step,
    file_name: document?.file_name ?? null,
    findings_summary,
    extraction_fields:
      extraction?.fields_json != null && typeof extraction.fields_json === "object"
        ? (extraction.fields_json as Record<string, unknown>)
        : null,
    pending_proposals: proposals.length,
  };
}

export function formatJobContextForPrompt(ctx: JobContextSnapshot): string {
  if (isRetrieveChatStep(ctx.step)) {
    return [
      ctx.pack_id ? `pack_id=${ctx.pack_id}` : "pack=(none)",
      `step=${ctx.step}`,
      `retrieve_hits:\n${ctx.retrieve_hits_summary ?? "未命中"}`,
    ].join("\n");
  }
  return [
    `trace_id=${ctx.trace_id}`,
    `job_id=${ctx.job_id}`,
    ctx.pack_id ? `pack_id=${ctx.pack_id}` : "pack=(none)",
    `job.status=${ctx.status}`,
    `step=${ctx.step}`,
    ctx.file_name ? `file=${ctx.file_name}` : "file=(none)",
    `findings: ${ctx.findings_summary}`,
    ctx.extraction_fields ? `fields=${JSON.stringify(ctx.extraction_fields)}` : "fields=(none)",
    `pending_proposals=${ctx.pending_proposals}`,
  ].join("\n");
}
