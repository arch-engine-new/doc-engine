/**
 * Live RAG ingest smoke. Missing DATABASE_URL / QDRANT_URL / NEO4J_URI /
 * DASHSCOPE_API_KEY → skip so CI stays green without Docker. JSON leave fixture
 * is the live path; full-book OCR of rules/ is not a gate. Does not write 公路
 * into demo/reset seed. Skip is not a Hash fallback.
 */

import { QdrantClient } from "@qdrant/js-client-rest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HASH_EMBED_DIM } from "../src/retrieve/embeddings.js";
import { JobPipeline, liveRetrievePorts } from "../src/index.js";

const LEAVE_TEXT = `1.1 事假须提前申请。
须在休假前一至三个工作日提交书面申请，并经主管确认。
1.2 病假须提供证明。
申请病假应附医疗机构证明，急诊可于返岗后补交。
2.1 审批时限为三个工作日。
主管须在三个工作日内完成审批并书面回复。
`;

const hasLiveEnv = Boolean(
  process.env.DATABASE_URL &&
    process.env.QDRANT_URL &&
    process.env.NEO4J_URI &&
    process.env.DASHSCOPE_API_KEY,
);

function numericVector(raw: unknown): number[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  if (!raw.every((n) => typeof n === "number")) return undefined;
  return raw as number[];
}

async function scrollLivePoint(
  url: string,
): Promise<{ fileName: string; vector: number[] } | undefined> {
  const client = new QdrantClient({
    url,
    apiKey: process.env.QDRANT_API_KEY,
  });
  const scrolled = await client.scroll("clauses", {
    limit: 32,
    with_payload: true,
    with_vector: true,
  });
  for (const point of scrolled.points) {
    const fileName = point.payload?.file_name;
    const vector = numericVector(point.vector);
    if (typeof fileName === "string" && fileName.length > 0 && vector) {
      return { fileName, vector };
    }
  }
  return undefined;
}

describe.skipIf(!hasLiveEnv)("live RAG ingest smoke", () => {
  let pipeline: JobPipeline;

  beforeAll(async () => {
    // Fail fast with the liveRetrievePorts contract instead of a silent memory store.
    liveRetrievePorts();
    pipeline = await JobPipeline.openLiveFromEnv();
  }, 60_000);

  afterAll(async () => {
    await pipeline?.close();
  });

  it("JSON ingest leave fixture writes Qdrant file_name and vector length !== Hash 48", async () => {
    const project = await pipeline.createProject("live-rag-ingest-smoke");
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
    expect(ingested.clauses.length).toBeGreaterThan(0);

    const point = await scrollLivePoint(process.env.QDRANT_URL ?? "");
    expect(point?.fileName).toBeTruthy();
    expect(point?.vector).toBeTruthy();
    expect(point!.vector.length).not.toBe(HASH_EMBED_DIM);
  });
});
