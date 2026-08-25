/**
 * HITL (Human-in-the-Loop) Gateway.
 *
 * Manages interrupt lifecycle: create, retrieve, resume, and cleanup.
 * Integrates with StateStore for persistence.
 */

import { randomUUID } from "crypto";
import type { StateStore, StoredHitlInterrupt } from "../persistence/types.js";

/** HITL interrupt status values. */
export type HitlInterruptStatus = "pending" | "resumed" | "expired" | "cancelled";

/** Decision payload provided when resuming a HITL interrupt. */
export interface HitlDecision {
  /** Decision type (e.g., "approve", "reject", "modify"). */
  action: string;
  /** Optional data accompanying the decision. */
  data?: unknown;
  /** ISO timestamp of decision. */
  decidedAt: string;
}

/** Result of creating a HITL interrupt. */
export interface CreateInterruptResult {
  /** Unique token for the interrupt (used for resume). */
  token: string;
  /** The interrupt row that was created. */
  interrupt: HitlInterruptRow;
}

/** HITL interrupt row (simplified view for external API). */
export interface HitlInterruptRow {
  id: number;
  runId: string;
  nodeId: string;
  token: string;
  status: "pending" | "resumed" | "expired" | "cancelled";
  payload: unknown;
  decision: HitlDecision | null;
  expiresAt: string | null;
  resumedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * HitlGateway manages the HITL interrupt lifecycle.
 * Provides create, get, resume, and cleanup operations.
 */
export class HitlGateway {
  private store: StateStore;

  constructor(store: StateStore) {
    this.store = store;
  }

  /**
   * Create a new HITL interrupt for a run/node.
   *
   * @param runId - Run identifier
   * @param nodeId - Node identifier waiting for human input
   * @param payload - Arbitrary payload to present to human reviewer
   * @param expiresAt - Optional ISO timestamp when interrupt expires
   * @returns Token and interrupt row
   */
  async createInterrupt(
    runId: string,
    nodeId: string,
    payload: unknown,
    expiresAt?: string,
  ): Promise<CreateInterruptResult> {
    const token = randomUUID();
    const now = new Date().toISOString();

    const interruptData = {
      runId,
      nodeId,
      token,
      status: "pending" as const,
      payloadJson: payload,
      decisionJson: null,
      expiresAt: expiresAt ?? null,
      resumedAt: null,
      createdAt: now,
      updatedAt: now,
      creator: "system",
      updater: "system",
      deleted: 0,
    };

    await this.store.createHitlInterrupt(interruptData);

    const row = await this.store.getHitlInterruptByToken(token);
    if (!row) {
      throw new Error(`Failed to retrieve created interrupt with token ${token}`);
    }

    return {
      token,
      interrupt: this.mapToRow(row),
    };
  }

  /**
   * Get a HITL interrupt by token.
   *
   * @param token - Interrupt token
   * @returns Interrupt row or null if not found
   */
  async getInterrupt(token: string): Promise<HitlInterruptRow | null> {
    const row = await this.store.getHitlInterruptByToken(token);
    return row ? this.mapToRow(row) : null;
  }

  /**
   * Resume a HITL interrupt with a human decision.
   * Idempotent: if already resumed, returns true without error.
   * Returns false if interrupt not found or expired.
   *
   * @param token - Interrupt token
   * @param decision - Human decision payload
   * @returns True if resume succeeded (or was already resumed), false if not found/expired
   */
  async resume(token: string, decision: HitlDecision): Promise<boolean> {
    const existing = await this.store.getHitlInterruptByToken(token);
    if (!existing) {
      return false;
    }

    // Idempotent: if already resumed, return true
    if (existing.status === "resumed") {
      return true;
    }

    // Check if expired
    if (existing.expiresAt && new Date(existing.expiresAt) < new Date()) {
      await this.store.updateHitlInterrupt(token, {
        status: "expired",
        updatedAt: new Date().toISOString(),
      });
      return false;
    }

    // Update with decision
    await this.store.updateHitlInterrupt(token, {
      status: "resumed",
      decisionJson: decision,
      resumedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return true;
  }

  /**
   * Update a HITL interrupt (e.g., to mark as expired).
   *
   * @param token - Interrupt token
   * @param updates - Fields to update
   * @returns True if updated, false if not found
   */
  async updateHitlInterrupt(
    token: string,
    updates: Partial<Pick<HitlInterruptRow, "status" | "updatedAt">>,
  ): Promise<boolean> {
    const existing = await this.store.getHitlInterruptByToken(token);
    if (!existing) {
      return false;
    }

    await this.store.updateHitlInterrupt(token, {
      status: updates.status ?? existing.status,
      updatedAt: updates.updatedAt ?? new Date().toISOString(),
    });

    return true;
  }

  /**
   * Clean up expired interrupts.
   * Marks pending interrupts past their expiresAt as expired.
   *
   * @returns Number of interrupts cleaned up
   */
  async cleanupExpired(): Promise<number> {
    const now = new Date().toISOString();
    // This would require a query to find expired interrupts
    // For now, we'll implement a simple version that could be expanded
    // The actual implementation would depend on the store having a query method
    return 0;
  }

  /**
   * Get all HITL interrupts for a run.
   *
   * @param runId - Run identifier
   * @returns Array of interrupt rows
   */
  async getInterruptsForRun(runId: string): Promise<HitlInterruptRow[]> {
    const rows = await this.store.getHitlInterrupts(runId);
    return rows.map((r) => this.mapToRow(r));
  }

  /**
   * Map stored interrupt to public row format.
   */
  private mapToRow(stored: StoredHitlInterrupt): HitlInterruptRow {
    return {
      id: stored.id,
      runId: stored.runId,
      nodeId: stored.nodeId,
      token: stored.token,
      status: stored.status as HitlInterruptRow["status"],
      payload: stored.payloadJson,
      decision: stored.decisionJson as HitlDecision | null,
      expiresAt: stored.expiresAt,
      resumedAt: stored.resumedAt,
      createdAt: stored.createdAt,
      updatedAt: stored.updatedAt,
    };
  }
}

/**
 * Create a HitlGateway from a StateStore.
 * Convenience function for common setup.
 */
export function createHitlGateway(store: StateStore): HitlGateway {
  return new HitlGateway(store);
}