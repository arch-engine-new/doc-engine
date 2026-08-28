/**
 * Draft save + fixture publish gate. New drafts must pass ≥1 pass and ≥1 fail fixture.
 * Seeded R1/R2 stay published via seedPublishedRules; this module never backfills that path.
 */

import { evaluate } from "./interpreter.js";
import type { LedgerStore } from "../persistence/ledger.js";
import type { RuleFixtureRow, RuleRow, RuleVersionRow } from "../types.js";

export type RuleFixtureKind = "pass" | "fail";

export interface SaveDraftInput {
  packId: string;
  title: string | null;
  dsl: unknown;
  blocking?: number;
}

export interface SaveDraftResult {
  rule: RuleRow;
  version: RuleVersionRow;
}

export interface AddFixtureInput {
  versionId: string;
  kind: RuleFixtureKind;
  payload: Record<string, unknown>;
}

export type PublishResult =
  | { ok: true; version: RuleVersionRow }
  | { ok: false; reason: string };

function stringifyDsl(dsl: unknown): string {
  if (typeof dsl === "string") return dsl;
  return JSON.stringify(dsl ?? {});
}

function payloadFields(payloadJson: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(payloadJson);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

export class RulePublisher {
  constructor(private readonly store: LedgerStore) {}

  async saveDraft(input: SaveDraftInput): Promise<SaveDraftResult> {
    const rule = await this.store.insertRule({
      pack_id: input.packId,
      title: input.title,
    });
    const version = await this.store.insertDraftRuleVersion({
      rule_id: rule.rule_id,
      dsl_json: stringifyDsl(input.dsl),
      blocking: input.blocking ?? 1,
    });
    return { rule, version };
  }

  async addFixture(input: AddFixtureInput): Promise<RuleFixtureRow> {
    if (input.kind !== "pass" && input.kind !== "fail") {
      throw new Error(`fixture kind must be pass|fail, got ${String(input.kind)}`);
    }
    return this.store.insertRuleFixture({
      version_id: input.versionId,
      kind: input.kind,
      payload_json: JSON.stringify(input.payload ?? {}),
    });
  }

  async runFixtures(versionId: string): Promise<RuleFixtureRow[]> {
    const version = await this.store.getRuleVersion(versionId);
    if (!version) {
      throw new Error(`rule version not found: ${versionId}`);
    }
    const fixtures = await this.store.listRuleFixtures(versionId);
    for (const fixture of fixtures) {
      const fields = payloadFields(fixture.payload_json);
      const [finding] = evaluate(fields, [version]);
      const result = finding?.result === "pass" ? "pass" : "fail";
      await this.store.updateFixtureLastResult(fixture.id, result);
    }
    return this.store.listRuleFixtures(versionId);
  }

  async canPublish(versionId: string): Promise<boolean> {
    const fixtures = await this.store.listRuleFixtures(versionId);
    const hasPass = fixtures.some((f) => f.kind === "pass" && f.last_result === "pass");
    const hasFail = fixtures.some((f) => f.kind === "fail" && f.last_result === "fail");
    return hasPass && hasFail;
  }

  async publish(versionId: string): Promise<PublishResult> {
    const version = await this.store.getRuleVersion(versionId);
    if (!version) {
      return { ok: false, reason: `rule version not found: ${versionId}` };
    }
    if (version.status === "published") {
      return { ok: true, version };
    }
    if (!(await this.canPublish(versionId))) {
      return {
        ok: false,
        reason:
          "publish gate: need ≥1 pass fixture with last_result=pass and ≥1 fail fixture with last_result=fail",
      };
    }
    return { ok: true, version: await this.store.updateRuleVersionStatus(versionId, "published") };
  }
}
