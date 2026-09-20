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
        事假: { rewritten: CANON, intent: "semantic" },
        不存在: { rewritten: "不存在", intent: "semantic" },
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
    // 未自备 1.1 出边；expandOneHop 不得多出 graph 行。
    expect(hits).toHaveLength(1);
    expect(hits[0]?.retrieve_path).toBe("exact");
    expect(hits[0]?.clause_id).toBe(`${ingested.version.version_id}:1.1`);
    expect(hits[0]?.unit_id).toBe(hits[0]?.clause_id);
    expect(hits[0]?.chunk_kind).toBe("clause");
    expect(hits[0]?.file_name).toBe("leave");
    expect(hits[0]?.page_start).toBe(1);
    expect(hits[0]?.page_end).toBe(1);
    expect(hits[0]?.standard_version_id).toBe(ingested.version.version_id);
    expect(hits[0]?.span).toBeTruthy();
    expect(hits[0]?.heading).toContain("1.1 事假须提前申请");
    expect(hits[0]?.body).toContain("须在休假前");
    expect((await pipeline.getClause(hits[0]!.clause_id!))?.clause_id).toBe(hits[0]!.clause_id);

    const findings = await pipeline.attachStandardFitFinding({
      jobId: job.job_id,
      query: "1.1",
      ruleVersionId: RULE_R1_VERSION_ID,
    });
    expect(findings).toHaveLength(1);
    const finding = findings[0]!;
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
          unit_id: "invented-999",
          chunk_kind: "clause",
          file_name: "leave",
          page_start: 1,
          page_end: 1,
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
    // graph intent 不走 expandOneHop；共享 seed 1.1 无出边。须仍单行 SUPERSEDES。
    expect(hits).toHaveLength(1);
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

  /**
   * MemoryVectorStore returns every clause in the pack (topK=8). T10/T13 need
   * a single vector origin so the CITES neighbor is graph, not an already-seen
   * vector row. Do not put 1.1→1.2 on the shared seedPack (A11 length===1).
   */
  function topClauseRerank() {
    const inner = new IndependentReranker();
    return {
      async rerank(
        query: string,
        candidates: Array<{ clause_id: string; text: string; vector?: number[] }>,
      ): Promise<string[]> {
        const ordered = await inner.rerank(query, candidates);
        return ordered.slice(0, 1);
      },
    };
  }

  async function reopenWithTopClauseRerank(): Promise<void> {
    await pipeline.close();
    pipeline = JobPipeline.openStandardLibrary({
      vector: new MemoryVectorStore(),
      graph: new MemoryGraphStore(),
      prequery: new FakePrequery({
        [Q_PARAPHRASE_A]: { rewritten: CANON, intent: "semantic" },
        [Q_PARAPHRASE_B]: { rewritten: CANON, intent: "semantic" },
        事假: { rewritten: CANON, intent: "semantic" },
        不存在: { rewritten: "不存在", intent: "semantic" },
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
      rerank: topClauseRerank(),
      embed: new HashEmbeddings(),
    });
  }

  it("A19-hit 事假 semantic: 1.1 vector plus 1.2 graph CITES one hop", async () => {
    await reopenWithTopClauseRerank();
    const { pack, ingested, idOf } = await seedPack();
    await pipeline.addStandardEdge({
      from: idOf("1.1"),
      to: idOf("1.2"),
      kind: "CITES",
    });
    const hits = await pipeline.searchStandard({ packId: pack.pack_id, query: "事假" });
    const hit11 = hits.find((hit) => hit.clause_id === idOf("1.1"));
    const hit12 = hits.find((hit) => hit.clause_id === idOf("1.2"));
    expect(hit11?.retrieve_path).toBe("vector");
    expect(hit12?.retrieve_path).toBe("graph");
    expect(hit12?.path).toEqual([{ from: idOf("1.1"), to: idOf("1.2"), kind: "CITES" }]);
    expect(hit12?.path).toHaveLength(1);
    expect(hit12?.heading).toBe(
      ingested.clauses.find((clause) => clause.clause_id === idOf("1.2"))?.heading,
    );
    expect(hit12?.body).toContain("医疗机构证明");
  });

  it("A19-empty 不存在 semantic with zero clause hits adds no graph row", async () => {
    const project = await pipeline.createProject();
    const pack = await pipeline.createSpecPack({
      projectId: project.project_id,
      name: "空包",
      version: "1",
    });
    const hits = await pipeline.searchStandard({ packId: pack.pack_id, query: "不存在" });
    expect(hits).toHaveLength(0);
    expect(hits.some((hit) => hit.retrieve_path === "graph")).toBe(false);
  });

  it("A19-dedupe keeps 1.2 as the original vector row when it was already retrieved", async () => {
    const { pack, idOf } = await seedPack();
    await pipeline.addStandardEdge({
      from: idOf("1.1"),
      to: idOf("1.2"),
      kind: "CITES",
    });
    const hits = await pipeline.searchStandard({ packId: pack.pack_id, query: "事假" });
    const rows12 = hits.filter((hit) => hit.clause_id === idOf("1.2"));
    expect(rows12).toHaveLength(1);
    expect(rows12[0]?.retrieve_path).toBe("vector");
    expect(hits.find((hit) => hit.clause_id === idOf("1.1"))?.retrieve_path).toBe("vector");
  });

  it("A19-one-hop does not walk 1.2→2.1 when only 1.1 was a retrieve origin", async () => {
    const { pack, idOf } = await seedPack();
    await pipeline.addStandardEdge({
      from: idOf("1.1"),
      to: idOf("1.2"),
      kind: "CITES",
    });
    await pipeline.addStandardEdge({
      from: idOf("1.2"),
      to: idOf("2.1"),
      kind: "CITES",
    });
    const hits = await pipeline.searchStandard({ packId: pack.pack_id, query: "1.1" });
    expect(hits[0]?.retrieve_path).toBe("exact");
    expect(hits[0]?.clause_id).toBe(idOf("1.1"));
    expect(hits.some((hit) => hit.clause_id === idOf("1.2") && hit.retrieve_path === "graph")).toBe(
      true,
    );
    expect(hits.some((hit) => hit.clause_id === idOf("2.1"))).toBe(false);
  });

  it("A19-exact 1.1 with case-local CITES keeps exact first and appends graph neighbor", async () => {
    const { pack, idOf } = await seedPack();
    await pipeline.addStandardEdge({
      from: idOf("1.1"),
      to: idOf("1.2"),
      kind: "CITES",
    });
    const hits = await pipeline.searchStandard({ packId: pack.pack_id, query: "1.1" });
    expect(hits[0]?.retrieve_path).toBe("exact");
    expect(hits[0]?.clause_id).toBe(idOf("1.1"));
    const hit12 = hits.find((hit) => hit.clause_id === idOf("1.2"));
    expect(hit12?.retrieve_path).toBe("graph");
    expect(hit12?.path).toEqual([{ from: idOf("1.1"), to: idOf("1.2"), kind: "CITES" }]);
  });
});

const GFM_TABLE_TEXT = `1.1 事假须提前申请。
须在休假前一至三个工作日提交书面申请，并经主管确认。
1.2 病假须提供证明。
申请病假应附医疗机构证明，急诊可于返岗后补交。
2.1 审批时限为三个工作日。
主管须在三个工作日内完成审批并书面回复。

| 条款 | 说明 |
| --- | --- |
| 1.1 | 事假 |
| 2.1 | 审批 |
`;

const GHOST_CITE_TEXT = `1.1 事假须提前申请。
引用第99.9条办理。
`;

const PARENT_TEXT = `8.5 构造要求
本节给出构造规定。
8.5.1 钢筋锚固
锚固长度不得小于规定值。
`;

const UNLINKED_TABLE_TEXT = `1.1 事假须提前申请。
须提前书面申请。

| 列A | 列B |
| --- | --- |
| foo | bar |
`;

describe("layout ingest SUPPORTS / CITES", () => {
  let pipeline: JobPipeline;

  beforeEach(() => {
    pipeline = JobPipeline.openStandardLibrary({
      vector: new MemoryVectorStore(),
      graph: new MemoryGraphStore(),
      prequery: new FakePrequery(),
      rerank: new IndependentReranker(),
      embed: new HashEmbeddings(),
    });
  });

  afterEach(async () => {
    await pipeline.close();
  });

  async function ingestText(text: string, fileUri = "fixture://leave.md") {
    const project = await pipeline.createProject();
    const pack = await pipeline.createSpecPack({
      projectId: project.project_id,
      name: "请假制度包",
      version: "1",
    });
    const ingested = await pipeline.ingestStandard({
      packId: pack.pack_id,
      title: "员工请假说明",
      fileUri,
      text,
    });
    const idOf = (no: string) => `${ingested.version.version_id}:${no}`;
    return { pack, ingested, idOf };
  }

  it("GFM table cells 1.1 and 2.1 yield one table unit and two SUPPORTS", async () => {
    const { ingested, idOf } = await ingestText(GFM_TABLE_TEXT);
    const tables = ingested.layoutUnits.filter((unit) => unit.chunk_kind === "table");
    expect(tables).toHaveLength(1);
    expect(tables[0]?.body_markdown).toContain("|");
    expect(tables[0]?.clause_id).toBeNull();
    expect(ingested.tablesUnlinked).toBe(0);

    const graph = pipeline.library.getPorts().graph;
    const supports = await graph.queryPath(tables[0]!.unit_id, "SUPPORTS");
    expect(supports).toHaveLength(2);
    expect(supports.every((edge) => edge.kind === "SUPPORTS")).toBe(true);
    expect(supports.map((edge) => edge.to).sort()).toEqual([idOf("1.1"), idOf("2.1")].sort());
  });

  it("正文第99.9条 with no such clause creates 0 CITES", async () => {
    const { ingested, idOf } = await ingestText(GHOST_CITE_TEXT);
    expect(ingested.clauses).toHaveLength(1);
    const graph = pipeline.library.getPorts().graph;
    const cites = await graph.queryPath(idOf("1.1"), "CITES");
    expect(cites).toHaveLength(0);
    expect(ingested.clauses.some((c) => c.clause_id.endsWith(":99.9"))).toBe(false);
  });

  it("parent PARENT_OF child; unlinked table is not proximity SUPPORTS", async () => {
    const tree = await ingestText(PARENT_TEXT);
    const graph = pipeline.library.getPorts().graph;
    const parents = await graph.queryPath(tree.idOf("8.5"), "PARENT_OF");
    expect(parents).toEqual([
      { from: tree.idOf("8.5"), to: tree.idOf("8.5.1"), kind: "PARENT_OF" },
    ]);

    const unlinked = await ingestText(UNLINKED_TABLE_TEXT, "fixture://unlinked.md");
    expect(unlinked.ingested.tablesUnlinked).toBe(1);
    const tables = unlinked.ingested.layoutUnits.filter((unit) => unit.chunk_kind === "table");
    expect(tables).toHaveLength(1);
    const supports = await pipeline.library.getPorts().graph.queryPath(
      tables[0]!.unit_id,
      "SUPPORTS",
    );
    expect(supports).toHaveLength(0);
  });

  it("search 见表 keeps table hit with SUPPORTS clause ids (M3)", async () => {
    const { pack, ingested, idOf } = await ingestText(GFM_TABLE_TEXT);
    const hits = await pipeline.searchStandard({ packId: pack.pack_id, query: "见表" });
    const tableHit = hits.find((hit) => hit.chunk_kind === "table");
    expect(tableHit).toBeTruthy();
    expect(hits[0]?.chunk_kind).toBe("table");
    expect(tableHit?.clause_id).toBeNull();
    const tableUnit = ingested.layoutUnits.find((u) => u.chunk_kind === "table");
    expect(tableHit?.unit_id).toBe(tableUnit?.unit_id);
    expect(tableHit?.heading).toBe(tableUnit?.heading);
    expect(tableHit?.body).toContain(tableUnit?.body_markdown ?? "");
    expect(tableHit?.file_name).toBe("leave.md");
    expect(tableHit?.page_start).toBe(1);
    expect(tableHit?.page_end).toBe(1);
    expect(tableHit?.supported_clause_ids?.length).toBeGreaterThanOrEqual(2);
    expect([...(tableHit?.supported_clause_ids ?? [])].sort()).toEqual(
      [idOf("1.1"), idOf("2.1")].sort(),
    );
  });

  it("FakePrequery does not exact-match table captions (M12/R20)", () => {
    expect(new FakePrequery().rewrite("表 8.5.1-1").intent).not.toBe("exact");
    expect(new FakePrequery().rewrite("见表 8.5.1-1").intent).toBe("semantic");
    expect(new FakePrequery().rewrite("附表 8.5.1-1").intent).toBe("semantic");
  });

  it("packA graph retrieve hits packB clause in the same project (R29)", async () => {
    const project = await pipeline.createProject();
    const packA = await pipeline.createSpecPack({
      projectId: project.project_id,
      name: "包A",
      version: "1",
    });
    const packB = await pipeline.createSpecPack({
      projectId: project.project_id,
      name: "包B",
      version: "1",
    });
    const ingestedA = await pipeline.ingestStandard({
      packId: packA.pack_id,
      title: "标准A",
      fileUri: "fixture://pack-a.md",
      text: `1.1 事假须提前申请。\n须提前书面申请。\n`,
    });
    const ingestedB = await pipeline.ingestStandard({
      packId: packB.pack_id,
      title: "标准B",
      fileUri: "fixture://pack-b.md",
      text: `2.1 审批时限为三个工作日。\n主管须书面回复。\n`,
    });
    const fromId = `${ingestedA.version.version_id}:1.1`;
    const toId = `${ingestedB.version.version_id}:2.1`;
    await pipeline.addStandardEdge({ from: fromId, to: toId, kind: "CITES" });

    const hits = await pipeline.searchStandard({
      packId: packA.pack_id,
      query: "1.1引用哪条",
    });
    expect(hits[0]?.retrieve_path).toBe("graph");
    expect(hits[0]?.clause_id).toBe(toId);
    expect(hits[0]?.unit_id).toBe(toId);
    expect(hits[0]?.file_name).toBe("pack-b.md");
    expect(hits[0]?.page_start).toBe(1);
    expect(hits[0]?.page_end).toBe(1);
    expect(hits[0]?.path).toEqual([{ from: fromId, to: toId, kind: "CITES" }]);
  });

  it("attachHit rejects table unit_id as clause_id (M4)", async () => {
    const { pack, ingested } = await ingestText(GFM_TABLE_TEXT);
    const table = ingested.layoutUnits.find((unit) => unit.chunk_kind === "table");
    expect(table).toBeTruthy();
    const job = await pipeline.openJobForPack({
      projectId: pack.project_id,
      packId: pack.pack_id,
    });
    await expect(
      pipeline.library.attachHit(
        job.job_id,
        job.trace_id,
        {
          clause_id: table!.unit_id,
          unit_id: table!.unit_id,
          chunk_kind: "clause",
          file_name: table!.file_name,
          page_start: table!.page_start,
          page_end: table!.page_end,
          standard_version_id: ingested.version.version_id,
          span: null,
          retrieve_path: "vector",
        },
        RULE_R1_VERSION_ID,
      ),
    ).rejects.toThrow(/table|unit/i);
  });

  it("attach 见表 expands table SUPPORTS into distinct clause findings (M13)", async () => {
    const { pack, ingested } = await ingestText(GFM_TABLE_TEXT);
    const table = ingested.layoutUnits.find((unit) => unit.chunk_kind === "table");
    expect(table).toBeTruthy();
    const job = await pipeline.openJobForPack({
      projectId: pack.project_id,
      packId: pack.pack_id,
    });
    const findings = await pipeline.attachStandardFitFinding({
      jobId: job.job_id,
      query: "见表",
      ruleVersionId: RULE_R1_VERSION_ID,
    });
    expect(findings.length).toBeGreaterThanOrEqual(2);
    const clauseIds = findings.map((row) => row.clause_id);
    expect(new Set(clauseIds).size).toBe(clauseIds.length);
    for (const clauseId of clauseIds) {
      expect(clauseId).toBeTruthy();
      expect((await pipeline.getClause(clauseId!))?.clause_id).toBe(clauseId);
    }
    const sources = findings.map((row) => JSON.parse(row.detail ?? "{}").source);
    expect(sources.every((source) => source?.unit_id === table!.unit_id)).toBe(true);
    expect(sources.every((source) => source?.file_name === table!.file_name)).toBe(true);
    expect(sources.every((source) => source?.page_start === table!.page_start)).toBe(true);
    expect(sources.every((source) => source?.page_end === table!.page_end)).toBe(true);
  });
});
