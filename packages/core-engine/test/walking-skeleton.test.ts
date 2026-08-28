/**
 * SLICE-1 walking skeleton acceptance: A4, A5, A9, A15.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  JobPipeline,
  RULE_R2_ID,
  RULE_R2_VERSION_ID,
} from "../src/index.js";

describe("SLICE-1 walking skeleton", () => {
  let pipeline: JobPipeline;

  beforeEach(() => {
    pipeline = JobPipeline.open(":memory:");
  });

  afterEach(async () => {
    await pipeline.close();
  });

  it("A4 reversed → finding with result fail, blocking 1 for R2", async () => {
    const { findings } = await pipeline.runFixtureJob({ kind: "reversed" });
    const r2Fail = findings.filter(
      (f) => f.rule_version_id === RULE_R2_VERSION_ID && f.result === "fail" && f.blocking === 1,
    );
    expect(r2Fail.length).toBeGreaterThan(0);
    const published = await pipeline.getPublishedRuleVersion(RULE_R2_ID);
    expect(published?.blocking).toBe(1);
    expect(published?.status).toBe("published");
  });

  it("A5 ok → no R2 fail finding", async () => {
    const { findings } = await pipeline.runFixtureJob({ kind: "ok" });
    const r2Fail = findings.filter(
      (f) => f.rule_version_id === RULE_R2_VERSION_ID && f.result === "fail",
    );
    expect(r2Fail).toHaveLength(0);
  });

  it("A9 listAudit(trace_id) includes extraction, rule_version, finding", async () => {
    const ok = await pipeline.runFixtureJob({ kind: "ok" });
    const reversed = await pipeline.runFixtureJob({ kind: "reversed" });
    expect(ok.job.trace_id).not.toBe(reversed.job.trace_id);

    for (const result of [ok, reversed]) {
      const events = await pipeline.listAudit(result.job.trace_id);
      const types = events.map((e) => e.event_type);
      expect(types).toContain("extraction");
      expect(types).toContain("rule_version");
      expect(types).toContain("finding");
    }
  });

  it("A15 chat persists; job.status unchanged", async () => {
    const { job } = await pipeline.runFixtureJob({ kind: "reversed" });
    const statusBefore = job.status;
    expect(statusBefore).toBe("checking");

    await pipeline.appendChat({
      traceId: job.trace_id,
      step: "checking",
      body: "请确认日期是否颠倒",
    });

    const messages = await pipeline.listMessages(job.trace_id, "checking");
    expect(messages.some((m) => m.body === "请确认日期是否颠倒")).toBe(true);

    const after = await pipeline.getJob(job.job_id);
    expect(after?.status).toBe(statusBefore);
  });
});
