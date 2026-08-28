/**
 * resolveEngineMode: all empty → memory; partial → throw; complete → live.
 * openLiveFromEnv: memory env → sqlite+memory ports (no live clients).
 */

import { describe, it, expect } from "vitest";
import { resolveEngineMode } from "../src/persistence/live-env.js";
import { JobPipeline } from "../src/pipeline/job-pipeline.js";

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

describe("JobPipeline.openLiveFromEnv", () => {
  it("returns sqlite+memory pipeline when live keys are unset", async () => {
    const saved = snapshotLiveEnv();
    clearLiveEnv();
    let pipeline: JobPipeline | undefined;
    try {
      pipeline = await JobPipeline.openLiveFromEnv();
      const project = await pipeline.createProject("openLiveFromEnv-memory");
      expect(project.project_id.length).toBeGreaterThan(0);
    } finally {
      await pipeline?.close();
      restoreLiveEnv(saved);
    }
  });

  it("throws Incomplete live engine on partial env without opening live clients", async () => {
    const saved = snapshotLiveEnv();
    clearLiveEnv();
    process.env.DATABASE_URL = LIVE.DATABASE_URL;
    try {
      let message = "";
      try {
        await JobPipeline.openLiveFromEnv();
      } catch (err) {
        message = err instanceof Error ? err.message : String(err);
      }
      expect(message).toMatch(/Incomplete live engine/);
      expect(message).toMatch(/QDRANT_URL/);
    } finally {
      restoreLiveEnv(saved);
    }
  });
});
