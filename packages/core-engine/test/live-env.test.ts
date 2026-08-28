/**
 * resolveEngineMode: all empty → memory; partial → throw; complete → live.
 */

import { describe, it, expect } from "vitest";
import { resolveEngineMode } from "../src/persistence/live-env.js";

const LIVE = {
  DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:5434/docengine",
  QDRANT_URL: "http://127.0.0.1:6333",
  NEO4J_URI: "bolt://127.0.0.1:7687",
  NEO4J_PASSWORD: "12345678",
};

describe("resolveEngineMode", () => {
  it("returns memory when all required keys are unset", () => {
    expect(resolveEngineMode({})).toEqual({ mode: "memory" });
  });

  it("returns memory when all required keys are empty or whitespace", () => {
    expect(
      resolveEngineMode({
        DATABASE_URL: "",
        QDRANT_URL: "   ",
        NEO4J_URI: "\t",
        NEO4J_PASSWORD: "\n",
      }),
    ).toEqual({ mode: "memory" });
  });

  it("throws listing missing keys when the set is partial", () => {
    let message = "";
    try {
      resolveEngineMode({
        DATABASE_URL: LIVE.DATABASE_URL,
        QDRANT_URL: "  ",
        NEO4J_URI: LIVE.NEO4J_URI,
      });
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    expect(message).toMatch(/QDRANT_URL/);
    expect(message).toMatch(/NEO4J_PASSWORD/);
    expect(message).not.toMatch(/DATABASE_URL/);
    expect(message).not.toMatch(/NEO4J_URI/);
  });

  it("returns live connection fields when all required keys are set", () => {
    expect(resolveEngineMode(LIVE)).toEqual({
      mode: "live",
      databaseUrl: LIVE.DATABASE_URL,
      qdrantUrl: LIVE.QDRANT_URL,
      neo4jUri: LIVE.NEO4J_URI,
      neo4jUser: "neo4j",
      neo4jPassword: LIVE.NEO4J_PASSWORD,
    });
  });

  it("uses NEO4J_USER when set and trims live values", () => {
    expect(
      resolveEngineMode({
        ...LIVE,
        DATABASE_URL: `  ${LIVE.DATABASE_URL}  `,
        NEO4J_USER: "  graph  ",
      }),
    ).toEqual({
      mode: "live",
      databaseUrl: LIVE.DATABASE_URL,
      qdrantUrl: LIVE.QDRANT_URL,
      neo4jUri: LIVE.NEO4J_URI,
      neo4jUser: "graph",
      neo4jPassword: LIVE.NEO4J_PASSWORD,
    });
  });
});
