/**
 * Live Postgres + Qdrant + Neo4j after demo reset.
 * Unset env → skip (CI success). Does not open live clients when skipped.
 */

import { QdrantClient } from "@qdrant/js-client-rest";
import neo4j from "neo4j-driver";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DemoHttpSession } from "../src/http/session.js";
import { resolveEngineMode, type LiveEngineMode } from "../src/persistence/live-env.js";
import { EMPTY_PACK_NAME } from "../src/pipeline/seed.js";

function neo4jToNumber(value: unknown): number {
  if (value && typeof value === "object" && "toNumber" in value) {
    const toNumber = (value as { toNumber?: unknown }).toNumber;
    if (typeof toNumber === "function") return (toNumber as () => number).call(value);
  }
  return Number(value);
}

describe.skipIf(!process.env.DATABASE_URL || !process.env.QDRANT_URL || !process.env.NEO4J_URI)(
  "live triple-store after demo reset",
  () => {
    let session: DemoHttpSession;
    let live: LiveEngineMode;
    let packId: string;

    beforeAll(async () => {
      const resolved = resolveEngineMode();
      if (resolved.mode !== "live") {
        throw new Error("expected live engine when DATABASE_URL, QDRANT_URL, and NEO4J_URI are set");
      }
      live = resolved;
      session = await DemoHttpSession.openFromEnv();
      const seeded = await session.reset();
      expect(seeded.pack.name).toBe(EMPTY_PACK_NAME);
      packId = seeded.pack.pack_id;
    }, 60_000);

    afterAll(async () => {
      await session?.close();
    });

    it("Postgres t_clause count > 0", async () => {
      const client = new pg.Client({ connectionString: live.databaseUrl });
      await client.connect();
      try {
        const result = await client.query<{ n: string }>("SELECT count(*)::text AS n FROM t_clause");
        expect(Number(result.rows[0]?.n)).toBeGreaterThan(0);
      } finally {
        await client.end();
      }
    });

    it("Qdrant collections includes clauses", async () => {
      const client = new QdrantClient({
        url: live.qdrantUrl,
        apiKey: process.env.QDRANT_API_KEY,
      });
      const listed = await client.getCollections();
      expect(listed.collections.map((item) => item.name)).toContain("clauses");
    });

    it("Neo4j MATCH (c:Clause) count > 0", async () => {
      const driver = neo4j.driver(live.neo4jUri, neo4j.auth.basic(live.neo4jUser, live.neo4jPassword));
      const neoSession = driver.session();
      try {
        const result = await neoSession.run("MATCH (c:Clause) RETURN count(c) AS n");
        expect(neo4jToNumber(result.records[0]?.get("n"))).toBeGreaterThan(0);
      } finally {
        await neoSession.close();
        await driver.close();
      }
    });

    it('searchStandard on 空规范包 query "1.1" returns a clause_id', async () => {
      const hits = await session.pipeline.searchStandard({ packId, query: "1.1" });
      expect(hits[0]?.clause_id).toBeTruthy();
    });
  },
);
