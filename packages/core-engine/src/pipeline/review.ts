/**
 * Review desk: cognition writes pending Proposal only; human confirm writes Receipt.
 * checkWording is the cognition port (deterministic wording fixture; no live LLM).
 */

import type { LedgerStore } from "../persistence/ledger.js";
import type { ProposalRow, ReceiptRow } from "../types.js";

/** Deterministic wording fixture used when callers omit custom copy. */
export const CHECK_WORDING_FIXTURE = "建议核对日期先后并修正措辞后提交审核。";

export interface CheckWordingInput {
  jobId: string;
  wording: string;
  agentRunId?: string;
  /** When false, only insert Proposal; job.status unchanged (orchestrator auto-draft at checking). */
  advanceJobStatus?: boolean;
}

export interface ConfirmProposalResult {
  proposal: ProposalRow;
  receipt: ReceiptRow;
}

export class ReviewDesk {
  constructor(private readonly store: LedgerStore) {}

  /**
   * Cognition port: insert Proposal status=pending. Must not insert Receipt.
   * May mark job.status=pending.
   */
  async checkWording(input: CheckWordingInput): Promise<ProposalRow> {
    const job = await this.store.getJob(input.jobId);
    if (!job) {
      throw new Error(`job not found: ${input.jobId}`);
    }
    const proposal = await this.store.insertProposal({
      job_id: input.jobId,
      wording: input.wording,
      status: "pending",
      agent_run_id: input.agentRunId ?? null,
    });
    if (input.advanceJobStatus !== false) {
      await this.store.updateJobStatus(input.jobId, "pending");
    }
    return proposal;
  }

  /** Edit wording only; status stays pending. */
  async editWording(proposalId: string, wording: string): Promise<ProposalRow> {
    const proposal = await this.store.getProposal(proposalId);
    if (!proposal) {
      throw new Error(`proposal not found: ${proposalId}`);
    }
    if (proposal.status !== "pending") {
      throw new Error(`proposal ${proposalId} is ${proposal.status}, not pending`);
    }
    return this.store.updateProposalWording(proposalId, wording);
  }

  /**
   * Human confirm: insert Receipt with non-empty receipt_id (status=accepted),
   * mark proposal confirmed, write audit event_type=receipt with job.trace_id.
   */
  async confirmProposal(proposalId: string): Promise<ConfirmProposalResult> {
    const proposal = await this.store.getProposal(proposalId);
    if (!proposal) {
      throw new Error(`proposal not found: ${proposalId}`);
    }
    if (proposal.status !== "pending") {
      throw new Error(`proposal ${proposalId} is ${proposal.status}, not pending`);
    }
    const job = await this.store.getJob(proposal.job_id);
    if (!job) {
      throw new Error(`job not found: ${proposal.job_id}`);
    }
    const receipt = await this.store.insertReceipt({
      proposal_id: proposal.proposal_id,
      job_id: proposal.job_id,
      status: "accepted",
      payload: { proposal_id: proposal.proposal_id, wording: proposal.wording },
    });
    if (!receipt.receipt_id) {
      throw new Error("receipt_id must be non-empty to persist");
    }
    const confirmed = await this.store.updateProposalStatus(proposalId, "confirmed");
    await this.store.appendAudit({
      trace_id: job.trace_id,
      event_type: "receipt",
      ref_id: receipt.receipt_id,
      payload: {
        receipt_id: receipt.receipt_id,
        proposal_id: confirmed.proposal_id,
        job_id: job.job_id,
      },
    });
    return { proposal: confirmed, receipt };
  }

  async listPending(jobId?: string): Promise<ProposalRow[]> {
    return this.store.listPendingProposals(jobId);
  }

  async listReceipts(jobId?: string): Promise<ReceiptRow[]> {
    return this.store.listReceipts(jobId);
  }
}

/**
 * Optional tool handler: calls the cognition port only (Proposal, never Receipt).
 */
export function createCheckWordingToolHandler(desk: ReviewDesk) {
  return async (input: CheckWordingInput): Promise<ProposalRow> => desk.checkWording(input);
}
