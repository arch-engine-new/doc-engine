/**
 * T6: reindexVectorsFromLedger walks LayoutUnits and upserts with provenance payload.
 * Hash fallback is forbidden — embed failure must throw.
 */

import { afterEach, describe, expect, it } from "vitest";
import { HashEmbeddings } from "../src/retrieve/embeddings.js";
import { JobPipeline } from "../src/pipeline/job-pipeline.js";
import { MemoryGraphStore } from "../src/retrieve/memory-graph.js";
import { MemoryVectorStore } from "../src/retrieve/memory-vector.js";
import { FakePrequery } from "../src/retrieve/prequery.js";
import type { Embeddings, VectorPoint, VectorStore } from "../src/retrieve/ports.js";
import { IndependentReranker } from "../src/retrieve/rerank.js";
import { StandardLibrary } from "../src/retrieve/library.js";

const CLAUSE_TABLE_TEXT = `1.1 事假须提前申请。
须在休假前一至三个工作日提交书面申请。

| 条款 | 说明 |
| --- | --- |
| 1.1 | 事假 |
`;

class RecordingVectorStore implements VectorStore {
  readonly upserts: VectorPoint[] = [];

  constructor(private readonly inner: VectorStore = new MemoryVectorStore()) {}

  async upsert(point: VectorPoint): Promise<void> {
    this.upserts.push(point);
    await this.inner.upsert(point);
  }

  search(
    vector: number[],
    opts?: { versionId?: string; topK?: number },
  ): ReturnType<VectorStore["search"]> {
    return this.inner.search(vector, opts);
  }
}

class RecordingEmbeddings implements Embeddings {
  readonly texts: string[] = [];
  private readonly inner = new HashEmbeddings();

  async embed(text: string): Promise<number[]> {
    this.texts.push(text);
    await Promise.resolve();
    return this.inner.embed(text);
  }
}

const LIVE_KEYS = [
  "DATABASE_URL",
  "QDRANT_URL",
  "NEO4J_URI",
  "NEO4J_PASSWORD",
  "NEO4J_USER",
] as const;

function snapshotLiveEnv(): Record<string, string | undefined> {
  return Object.fromEntries(LIVE_KEYS.map((key) => [key, process.env[key]]));
}

function restoreLiveEnv(saved: Record<string, string | undefined>): void {
  for (const key of LIVE_KEYS) {
    const value = saved[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function clearLiveEnv(): void {
  for (const key of LIVE_KEYS) delete process.env[key];
}

describe("reindexVectorsFromLedger", () => {
  let pipeline: JobPipeline | undefined;

  afterEach(async () => {
    await pipeline?.close();
    pipeline = undefined;
  });

  it("upserts clause and table units with provenance payload from ledger text", async () => {
    const vector = new RecordingVectorStore();
    const embed = new RecordingEmbeddings();
    pipeline = JobPipeline.openStandardLibrary({
      vector,
      graph: new MemoryGraphStore(),
      prequery: new FakePrequery(),
      rerank: new IndependentReranker(),
      embed,
    });
    const project = await pipeline.createProject();
    const pack = await pipeline.createSpecPack({
      projectId: project.project_id,
      name: "请假制度包",
      version: "1",
    });
    const ingested = await pipeline.ingestStandard({
      packId: pack.pack_id,
      title: "员工请假说明",
      fileUri: "fixture://leave.md",
      text: CLAUSE_TABLE_TEXT,
    });
    const clauseUnit = ingested.layoutUnits.find((unit) => unit.chunk_kind === "clause");
    const tableUnit = ingested.layoutUnits.find((unit) => unit.chunk_kind === "table");
    expect(clauseUnit).toBeTruthy();
    expect(tableUnit).toBeTruthy();

    vector.upserts.length = 0;
    embed.texts.length = 0;
    await pipeline.library.reindexVectorsFromLedger();

    expect(vector.upserts.length).toBeGreaterThanOrEqual(2);
    expect(embed.texts.length).toBe(vector.upserts.length);
    expect(
      vector.upserts.every(
        (point) => Array.isArray(point.vector) && point.vector.every((n) => typeof n === "number"),
      ),
    ).toBe(true);

    const clausePoint = vector.upserts.find((point) => point.payload?.chunk_kind === "clause");
    expect(clausePoint?.payload).toMatchObject({
      unit_id: clauseUnit!.unit_id,
      file_name: clauseUnit!.file_name,
      chunk_kind: "clause",
      page_start: clauseUnit!.page_start,
      page_end: clauseUnit!.page_end,
    });
    expect(
      embed.texts.some(
        (text) => text.includes("1.1 事假须提前申请") && text.includes("须在休假前"),
      ),
    ).toBe(true);

    const tablePoint = vector.upserts.find((point) => point.payload?.chunk_kind === "table");
    expect(tablePoint?.payload).toMatchObject({
      unit_id: tableUnit!.unit_id,
      file_name: tableUnit!.file_name,
      chunk_kind: "table",
      page_start: tableUnit!.page_start,
      page_end: tableUnit!.page_end,
    });
    const tableClauseId = tablePoint?.payload?.clause_id;
    expect(typeof tableClauseId === "string" && tableClauseId.length > 0).toBe(false);
  });

  it("throws on embed failure and does not Hash-fill remaining units", async () => {
    let shouldFail = false;
    const vector = new RecordingVectorStore();
    const embed: Embeddings = {
      async embed(text: string): Promise<number[]> {
        if (shouldFail) throw new Error("dashscope HTTP 503");
        return new HashEmbeddings().embed(text);
      },
    };
    pipeline = JobPipeline.openStandardLibrary({
      vector,
      graph: new MemoryGraphStore(),
      prequery: new FakePrequery(),
      rerank: new IndependentReranker(),
      embed,
    });
    const project = await pipeline.createProject();
    const pack = await pipeline.createSpecPack({
      projectId: project.project_id,
      name: "请假制度包",
      version: "1",
    });
    await pipeline.ingestStandard({
      packId: pack.pack_id,
      title: "员工请假说明",
      fileUri: "fixture://leave.md",
      text: CLAUSE_TABLE_TEXT,
    });

    vector.upserts.length = 0;
    shouldFail = true;
    await expect(pipeline.library.reindexVectorsFromLedger()).rejects.toThrow(/503/);
    expect(vector.upserts).toHaveLength(0);
  });

  it("does not reindex on openLiveFromEnv memory branch", async () => {
    const saved = snapshotLiveEnv();
    clearLiveEnv();
    const original = StandardLibrary.prototype.reindexVectorsFromLedger;
    const calls: string[] = [];
    StandardLibrary.prototype.reindexVectorsFromLedger = async function reindexSpy() {
      calls.push("reindex");
      return original.call(this);
    };
    try {
      pipeline = await JobPipeline.openLiveFromEnv();
      expect(calls).toEqual([]);
    } finally {
      StandardLibrary.prototype.reindexVectorsFromLedger = original;
      restoreLiveEnv(saved);
    }
  });
});
