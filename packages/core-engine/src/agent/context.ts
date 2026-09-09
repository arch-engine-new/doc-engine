import type { JobPipeline } from "../pipeline/job-pipeline.js";

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
}

/**
 * Read-only snapshot for LLM prompts — no writes, no MinIO/OCR clients.
 */
export async function buildJobContext(
  pipeline: JobPipeline,
  traceId: string,
  step: string,
): Promise<JobContextSnapshot> {
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
