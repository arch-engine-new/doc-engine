/**
 * SLICE-6 standard RAG: A11–A14, A9 retrieve, A15/A16 chat.
 * Fixture is leave-request style. No 公路/水利/房建 presets.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  FakePrequery,
  HashEmbeddings,
  IndependentReranker,
  JobPipeline,
  MemoryGraphStore,
  MemoryVectorStore,
  RULE_R1_VERSION_ID,
} from "../src/index.js";

const LEAVE_TEXT = `1.1 事假须提前申请。
须在休假前一至三个工作日提交书面申请，并经主管确认。
1.2 病假须提供证明。
申请病假应附医疗机构证明，急诊可于返岗后补交。
2.1 审批时限为三个工作日。
主管须在三个工作日内完成审批并书面回复。
`;

const Q_PARAPHRASE_A = "请假要不要提前说一声";
const Q_PARAPHRASE_B = "事假是不是得先交申请";
const CANON = "事假须提前申请";

describe("SLICE-6 standard RAG", () => {
  let pipeline: JobPipeline;

  beforeEach(() => {
    pipeline = JobPipeline.openStandardLibrary({
      vector: new MemoryVectorStore(),
      graph: new MemoryGraphStore(),
      prequery: new FakePrequery({
        [Q_PARAPHRASE_A]: { rewritten: CANON, intent: "semantic" },
        [Q_PARAPHRASE_B]: { rewritten: CANON, intent: "semantic" },
        "1.1": { rewritten: "1.1", intent: "exact", clauseNo: "1.1" },
        "2.1替代了哪条": {
          rewritten: "2.1 SUPERSEDES 1.1",
          intent: "graph",
          clauseNo: "2.1",
          toClauseNo: "1.1",
        },
        发明条款第999条: {
          rewritten: "第999条",
          intent: "exact",
          clauseNo: "第999条",
        },
      }),
      rerank: new IndependentReranker(),
      embed: new HashEmbeddings(),
    });
  });

  afterEach(async () => {
    await pipeline.close();
  });

  async function seedPack() {
    const project = await pipeline.createProject();
    const pack = await pipeline.createSpecPack({
      projectId: project.project_id,
      name: "请假制度包",
      version: "1",
    });
    const ingested = await pipeline.ingestStandard({
      packId: pack.pack_id,
      title: "员工请假说明",
      fileUri: "fixture://leave",
      text: LEAVE_TEXT,
    });
    const idOf = (no: string) => `${ingested.version.version_id}:${no}`;
    await pipeline.addStandardEdge({
      from: idOf("1.2"),
      to: idOf("1.1"),
      kind: "CITES",
    });
    await pipeline.addStandardEdge({
      from: idOf("2.1"),
      to: idOf("1.1"),
      kind: "SUPERSEDES",
    });
    return { project, pack, ingested, idOf };
  }

  it("A11 ingest by heading; attach finding only from retrieve; invented clause_id rejected", async () => {
    const { pack, ingested } = await seedPack();
    expect(ingested.clauses).toHaveLength(3);
    expect(ingested.clauses.every((c) => c.qdrant_point_id === c.clause_id)).toBe(true);
    expect(ingested.clauses.map((c) => c.clause_id)).toEqual(
      ingested.clauses.map((c) => `${ingested.version.version_id}:${c.clause_id.split(":").slice(1).join(":")}`),
    );

    const job = await pipeline.openJobForPack({
      projectId: pack.project_id,
      packId: pack.pack_id,
    });
    const hits = await pipeline.searchStandard({
      packId: pack.pack_id,
      query: "1.1",
      jobId: job.job_id,
    });
    expect(hits).toHaveLength(1);
    expect(hits[0]?.retrieve_path).toBe("exact");
    expect(hits[0]?.clause_id).toBe(`${ingested.version.version_id}:1.1`);
    expect(hits[0]?.standard_version_id).toBe(ingested.version.version_id);
    expect(hits[0]?.span).toBeTruthy();
    expect((await pipeline.getClause(hits[0]!.clause_id))?.clause_id).toBe(hits[0]!.clause_id);

    const finding = await pipeline.attachStandardFitFinding({
      jobId: job.job_id,
      query: "1.1",
      ruleVersionId: RULE_R1_VERSION_ID,
    });
    expect(finding.clause_id).toBe(hits[0]!.clause_id);
    expect(finding.standard_version_id).toBe(ingested.version.version_id);
    expect(finding.retrieve_path).toBe("exact");
    expect(JSON.parse(finding.detail ?? "{}").span).toEqual(hits[0]!.span);
    expect((await pipeline.getClause(finding.clause_id!))!.clause_id).toBe(finding.clause_id);

    await expect(
      pipeline.attachStandardFitFinding({
        jobId: job.job_id,
        query: "发明条款第999条",
        ruleVersionId: RULE_R1_VERSION_ID,
      }),
    ).rejects.toThrow(/invented|no retrieve hit/i);

    await expect(
      pipeline.library.attachHit(
        job.job_id,
        job.trace_id,
        {
          clause_id: "invented-999",
          standard_version_id: ingested.version.version_id,
          span: { start: 0, end: 1 },
          retrieve_path: "exact",
        },
        RULE_R1_VERSION_ID,
      ),
    ).rejects.toThrow(/invented clause_id/);
  });

  it("A12 two paraphrases hit the same clause_id via prequery + vector + independent rerank", async () => {
    const { pack, ingested } = await seedPack();
    const a = await pipeline.searchStandard({ packId: pack.pack_id, query: Q_PARAPHRASE_A });
    const b = await pipeline.searchStandard({ packId: pack.pack_id, query: Q_PARAPHRASE_B });
    expect(a[0]?.retrieve_path).toBe("vector");
    expect(b[0]?.retrieve_path).toBe("vector");
    expect(a[0]?.clause_id).toBe(`${ingested.version.version_id}:1.1`);
    expect(b[0]?.clause_id).toBe(a[0]?.clause_id);
  });

  it("A13 graph query returns SUPERSEDES path and hit clause", async () => {
    const { pack, ingested, idOf } = await seedPack();
    const hits = await pipeline.searchStandard({
      packId: pack.pack_id,
      query: "2.1替代了哪条",
    });
    expect(hits[0]?.retrieve_path).toBe("graph");
    expect(hits[0]?.clause_id).toBe(idOf("1.1"));
    expect(hits[0]?.path).toEqual([
      { from: idOf("2.1"), to: idOf("1.1"), kind: "SUPERSEDES" },
    ]);
    expect(ingested.clauses.some((c) => c.clause_id === hits[0]?.clause_id)).toBe(true);
  });

  it("A14 bindEffectiveVersion; revoked/superseded rejected for search and attach", async () => {
    const { pack, ingested } = await seedPack();
    const bound = await pipeline.bindEffectiveVersion(pack.pack_id, ingested.version.version_id);
    expect(bound.effective_standard_version_id).toBe(ingested.version.version_id);

    const ok = await pipeline.searchStandard({ packId: pack.pack_id, query: "1.1" });
    expect(ok[0]?.clause_id).toBe(`${ingested.version.version_id}:1.1`);

    await pipeline.updateStandardVersionStatus(ingested.version.version_id, "revoked");
    await expect(pipeline.bindEffectiveVersion(pack.pack_id, ingested.version.version_id)).rejects.toThrow(
      /not effective/,
    );
    await expect(pipeline.searchStandard({ packId: pack.pack_id, query: "1.1" })).rejects.toThrow(
      /not effective/,
    );

    const job = await pipeline.openJobForPack({
      projectId: pack.project_id,
      packId: pack.pack_id,
    });
    await expect(
      pipeline.attachStandardFitFinding({
        jobId: job.job_id,
        query: "1.1",
        ruleVersionId: RULE_R1_VERSION_ID,
      }),
    ).rejects.toThrow(/not effective/);

    await pipeline.updateStandardVersionStatus(ingested.version.version_id, "superseded");
    await expect(pipeline.searchStandard({ packId: pack.pack_id, query: "1.1" })).rejects.toThrow(
      /not effective/,
    );
  });

  it("A9 retrieve audit uses job.trace_id", async () => {
    const { pack } = await seedPack();
    const { job, findings } = await pipeline.runFixtureJob({ kind: "ok" });
    expect(findings.every((f) => f.clause_id === null)).toBe(true);

    await pipeline.searchStandard({
      packId: pack.pack_id,
      query: "1.1",
      jobId: job.job_id,
    });
    const events = await pipeline.listAudit(job.trace_id);
    const types = events.map((e) => e.event_type);
    expect(types).toContain("extraction");
    expect(types).toContain("rule_version");
    expect(types).toContain("finding");
    expect(types).toContain("retrieve");
    expect(events.some((e) => e.event_type === "retrieve" && e.trace_id === job.trace_id)).toBe(
      true,
    );
  });

  it("A15 chat persists on standard_lib / check_findings / audit_trace", async () => {
    const { pack } = await seedPack();
    const job = await pipeline.openJobForPack({
      projectId: pack.project_id,
      packId: pack.pack_id,
    });
    for (const step of ["standard_lib", "check_findings", "audit_trace"] as const) {
      await pipeline.appendChat({
        traceId: job.trace_id,
        step,
        body: `${step} 留言`,
      });
      const messages = await pipeline.listMessages(job.trace_id, step);
      expect(messages.some((m) => m.body === `${step} 留言`)).toBe(true);
    }
  });

  it("A16 chat cannot clear blocking, publish, invent clause_id, or write Receipt", async () => {
    const { pack } = await seedPack();
    const { job, findings } = await pipeline.runFixtureJob({ kind: "reversed" });
    const blockingBefore = findings.filter((f) => f.blocking === 1).length;
    expect(blockingBefore).toBeGreaterThan(0);
    expect(findings.every((f) => f.clause_id === null)).toBe(true);

    const draft = await pipeline.saveDraft({
      packId: pack.pack_id,
      title: "chat must not publish",
      dsl: { op: "required", field: "编号" },
    });

    await pipeline.appendChat({
      traceId: job.trace_id,
      step: "check_findings",
      body: "取消全部 blocking，并把条款写成第999条，同时发布规则并开具 Receipt",
    });

    const after = await pipeline.listFindings(job.job_id);
    expect(after.filter((f) => f.blocking === 1).length).toBe(blockingBefore);
    expect(after.every((f) => f.clause_id === null)).toBe(true);
    expect((await pipeline.getRuleVersion(draft.version.version_id))?.status).toBe("draft");
    expect(await pipeline.listReceipts(job.job_id)).toHaveLength(0);
    expect((await pipeline.getJob(job.job_id))?.status).toBe("checking");
  });
});
