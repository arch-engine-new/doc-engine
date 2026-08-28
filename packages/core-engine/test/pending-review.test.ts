/**
 * SLICE-4 pending review: A6 + chat must not write Receipt.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  CHECK_WORDING_FIXTURE,
  JobPipeline,
  createCheckWordingToolHandler,
} from "../src/index.js";

describe("SLICE-4 pending review", () => {
  let pipeline: JobPipeline;

  beforeEach(() => {
    pipeline = JobPipeline.open(":memory:");
  });

  afterEach(async () => {
    await pipeline.close();
  });

  it("A6 checkWording pending; editWording; confirm has receipt_id; without confirm no receipt", async () => {
    const { job } = await pipeline.runFixtureJob({ kind: "ok" });

    const proposal = await pipeline.checkWording({
      jobId: job.job_id,
      wording: CHECK_WORDING_FIXTURE,
    });
    expect(proposal.status).toBe("pending");
    expect(proposal.wording).toBe(CHECK_WORDING_FIXTURE);
    expect(proposal.job_id).toBe(job.job_id);
    expect((await pipeline.getJob(job.job_id))?.status).toBe("pending");
    expect(await pipeline.listReceipts(job.job_id)).toHaveLength(0);
    expect((await pipeline.listPending(job.job_id)).map((p) => p.proposal_id)).toContain(proposal.proposal_id);

    const edited = await pipeline.editWording(proposal.proposal_id, "审核人改后的措辞");
    expect(edited.status).toBe("pending");
    expect(edited.wording).toBe("审核人改后的措辞");
    expect(await pipeline.listReceipts(job.job_id)).toHaveLength(0);

    const unconfirmed = await pipeline.checkWording({
      jobId: job.job_id,
      wording: "另一条未确认提案",
      agentRunId: "run_fixture",
    });
    expect(unconfirmed.status).toBe("pending");
    expect(unconfirmed.agent_run_id).toBe("run_fixture");
    expect(await pipeline.listReceipts(job.job_id)).toHaveLength(0);

    const confirmed = await pipeline.confirmProposal(proposal.proposal_id);
    expect(confirmed.proposal.status).toBe("confirmed");
    expect(confirmed.receipt.receipt_id).toBeTruthy();
    expect(confirmed.receipt.status).toBe("accepted");
    expect(confirmed.receipt.proposal_id).toBe(proposal.proposal_id);
    expect(await pipeline.listReceipts(job.job_id)).toHaveLength(1);

    const stillPending = await pipeline.listPending(job.job_id);
    expect(stillPending.some((p) => p.proposal_id === unconfirmed.proposal_id)).toBe(true);
    expect(stillPending.some((p) => p.proposal_id === proposal.proposal_id)).toBe(false);

    const events = await pipeline.listAudit(job.trace_id);
    expect(events.some((e) => e.event_type === "receipt" && e.ref_id === confirmed.receipt.receipt_id)).toBe(
      true,
    );
  });

  it("appendChat step=pending_review does not confirm or write Receipt", async () => {
    const { job } = await pipeline.runFixtureJob({ kind: "ok" });
    const proposal = await pipeline.checkWording({
      jobId: job.job_id,
      wording: CHECK_WORDING_FIXTURE,
    });

    await pipeline.appendChat({
      traceId: job.trace_id,
      step: "pending_review",
      body: "对话声称已确认并落库",
    });

    expect((await pipeline.getJob(job.job_id))?.status).toBe("pending");
    const after = (await pipeline.listPending(job.job_id)).find((p) => p.proposal_id === proposal.proposal_id);
    expect(after?.status).toBe("pending");
    expect(await pipeline.listReceipts(job.job_id)).toHaveLength(0);

    const messages = await pipeline.listMessages(job.trace_id, "pending_review");
    expect(messages.some((m) => m.body === "对话声称已确认并落库")).toBe(true);
  });

  it("check_wording tool handler only writes Proposal, never Receipt", async () => {
    const { job } = await pipeline.runFixtureJob({ kind: "ok" });
    const handler = createCheckWordingToolHandler(pipeline.review);
    const proposal = await handler({ jobId: job.job_id, wording: CHECK_WORDING_FIXTURE });
    expect(proposal.status).toBe("pending");
    expect(await pipeline.listReceipts(job.job_id)).toHaveLength(0);
  });
});
