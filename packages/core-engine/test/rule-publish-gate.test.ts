/**
 * SLICE-3 rule publish gate: A3 + chat must not publish + DSL all/eq.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  evaluate,
  JobPipeline,
  PACK_ID,
  RULE_R1_VERSION_ID,
} from "../src/index.js";

const REQUIRED_DSL = { op: "required", field: "编号" } as const;

describe("SLICE-3 rule publish gate", () => {
  let pipeline: JobPipeline;

  beforeEach(() => {
    pipeline = JobPipeline.open(":memory:");
  });

  afterEach(async () => {
    await pipeline.close();
  });

  it("A3 draft with only pass fixture cannot publish; fail fixture then publish succeeds", async () => {
    const { version } = await pipeline.saveDraft({
      packId: PACK_ID,
      title: "A3 required 编号",
      dsl: REQUIRED_DSL,
    });
    expect(version.status).toBe("draft");
    expect((await pipeline.listPublishedRuleVersions()).some((v) => v.version_id === version.version_id)).toBe(
      false,
    );

    await pipeline.addFixture({
      versionId: version.version_id,
      kind: "pass",
      payload: { 编号: "SH-001" },
    });
    await pipeline.runFixtures(version.version_id);

    expect(await pipeline.canPublish(version.version_id)).toBe(false);
    const refused = await pipeline.publish(version.version_id);
    expect(refused.ok).toBe(false);
    expect((await pipeline.getRuleVersion(version.version_id))?.status).toBe("draft");

    const jobFindings = (await pipeline.runFixtureJob({ kind: "ok" })).findings;
    expect(jobFindings.every((f) => f.rule_version_id !== version.version_id)).toBe(true);
    expect(jobFindings.some((f) => f.rule_version_id === RULE_R1_VERSION_ID)).toBe(true);

    await pipeline.addFixture({
      versionId: version.version_id,
      kind: "fail",
      payload: {},
    });
    await pipeline.runFixtures(version.version_id);

    expect(await pipeline.canPublish(version.version_id)).toBe(true);
    const published = await pipeline.publish(version.version_id);
    expect(published.ok).toBe(true);
    expect((await pipeline.getRuleVersion(version.version_id))?.status).toBe("published");
  });

  it("appendChat step=rule_editor does not publish or change draft status", async () => {
    const { version } = await pipeline.saveDraft({
      packId: PACK_ID,
      title: "chat must not publish",
      dsl: REQUIRED_DSL,
    });
    const { job } = await pipeline.runFixtureJob({ kind: "ok" });

    await pipeline.appendChat({
      traceId: job.trace_id,
      step: "rule_editor",
      body: "请把这条规则发布上线",
    });

    expect((await pipeline.getRuleVersion(version.version_id))?.status).toBe("draft");
    expect((await pipeline.listPublishedRuleVersions()).some((v) => v.version_id === version.version_id)).toBe(
      false,
    );
    const messages = await pipeline.listMessages(job.trace_id, "rule_editor");
    expect(messages.some((m) => m.body === "请把这条规则发布上线")).toBe(true);
  });

  it("DSL all and eq evaluate without throwing on invalid op", () => {
    const allPass = evaluate(
      { 编号: "SH-001" },
      [{ version_id: "v_all", dsl_json: JSON.stringify({ op: "all", args: [REQUIRED_DSL] }), blocking: 1 }],
    );
    expect(allPass[0]?.result).toBe("pass");

    const eqPass = evaluate(
      { 编号: "SH-001" },
      [
        {
          version_id: "v_eq",
          dsl_json: JSON.stringify({ op: "eq", field: "编号", literal: "SH-001" }),
          blocking: 1,
        },
      ],
    );
    expect(eqPass[0]?.result).toBe("pass");

    const invalid = evaluate(
      { 编号: "SH-001" },
      [{ version_id: "v_bad", dsl_json: JSON.stringify({ op: "not-a-real-op" }), blocking: 1 }],
    );
    expect(invalid[0]?.result).toBe("fail");
  });
});
