/**
 * F-6 Task 1 RED: live MinIO health must not skip; fail maps to HTTP 503.
 * probeMinioHealth is not exported yet — missing export / skip path is the red light.
 * Placeholder keys are only "test-key". Never print process.env MinIO secrets.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import * as minioApi from "../src/blob/minio.js";
import { handleDemoRequest } from "../src/http/handle-request.js";
import { DemoHttpSession } from "../src/http/session.js";
import * as sessionApi from "../src/http/session.js";
import { JobPipeline } from "../src/pipeline/job-pipeline.js";

const TEST_KEY = "test-key";
const UNREACHABLE_MINIO = "http://127.0.0.1:1";
const SESSION_SOURCE = join(
  dirname(fileURLToPath(import.meta.url)),
  "../src/http/session.ts",
);
const MINIO_ENV_KEYS = [
  "MINIO_ENDPOINT",
  "MINIO_ACCESS_KEY",
  "MINIO_SECRET_KEY",
  "MINIO_BUCKET",
] as const;

type DemoHealthProbe = "ok" | "fail" | "skip";
type ProbeMinioHealth = (env?: NodeJS.ProcessEnv) => Promise<DemoHealthProbe>;

function resolveProbeMinioHealth(): ProbeMinioHealth | undefined {
  const fromSession = (sessionApi as { probeMinioHealth?: unknown }).probeMinioHealth;
  if (typeof fromSession === "function") {
    return fromSession as ProbeMinioHealth;
  }
  const fromMinio = (minioApi as { probeMinioHealth?: unknown }).probeMinioHealth;
  if (typeof fromMinio === "function") {
    return fromMinio as ProbeMinioHealth;
  }
  return undefined;
}

function snapshotMinioEnv(): Record<string, string | undefined> {
  const snap: Record<string, string | undefined> = {};
  for (const key of MINIO_ENV_KEYS) {
    snap[key] = process.env[key];
  }
  return snap;
}

function restoreMinioEnv(snap: Record<string, string | undefined>): void {
  for (const key of MINIO_ENV_KEYS) {
    const value = snap[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function clearMinioEnv(): void {
  for (const key of MINIO_ENV_KEYS) {
    delete process.env[key];
  }
}

function extractNamedFunctionBody(source: string, marker: string): string {
  const start = source.indexOf(marker);
  if (start < 0) {
    throw new Error(`${marker} not found in session.ts`);
  }
  const brace = source.indexOf("{", start);
  if (brace < 0) {
    throw new Error(`${marker} body brace not found`);
  }
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(brace, i + 1);
      }
    }
  }
  throw new Error(`${marker} body is unclosed`);
}

describe("live MinIO health must not skip", () => {
  const minioEnvSnapshot = snapshotMinioEnv();

  afterEach(() => {
    restoreMinioEnv(minioEnvSnapshot);
  });

  it("probeMinioHealth without MINIO_ENDPOINT returns fail not skip", async () => {
    const probe = resolveProbeMinioHealth();
    expect(typeof probe).toBe("function");
    const result = await probe!({});
    expect(result).toBe("fail");
    expect(result).not.toBe("skip");
  });

  it("probeMinioHealth with unreachable endpoint and test-key returns fail", async () => {
    const probe = resolveProbeMinioHealth();
    expect(typeof probe).toBe("function");
    const result = await probe!({
      MINIO_ENDPOINT: UNREACHABLE_MINIO,
      MINIO_ACCESS_KEY: TEST_KEY,
      MINIO_SECRET_KEY: TEST_KEY,
    });
    expect(result).toBe("fail");
    expect(result).not.toBe("skip");
  }, 8_000);

  it("memory DemoHttpSession GET /api/health is 200 with minio skip", async () => {
    const session = new DemoHttpSession();
    try {
      const res = await handleDemoRequest(session, {
        method: "GET",
        url: "/api/health",
        body: {},
      });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ mode: "memory", minio: "skip" });
    } finally {
      await session.close();
    }
  });

  it("live session without MINIO_ENDPOINT maps health minio fail to HTTP 503", async () => {
    clearMinioEnv();
    const session = new DemoHttpSession({
      pipeline: JobPipeline.open(),
      mode: "live",
      live: {
        mode: "live",
        databaseUrl: "postgres://x",
        qdrantUrl: "http://127.0.0.1:1",
        neo4jUri: "bolt://127.0.0.1:1",
        neo4jUser: "neo4j",
        neo4jPassword: "x",
      },
    });
    try {
      const health = await session.health();
      expect(health.minio).toBe("fail");
      expect(health.minio).not.toBe("skip");
      const res = await handleDemoRequest(session, {
        method: "GET",
        url: "/api/health",
        body: {},
      });
      expect(res.status).toBe(503);
      expect(res.body).toMatchObject({ mode: "live", minio: "fail" });
    } finally {
      await session.close();
    }
  }, 20_000);

  it("live probeMinio source must not return skip", () => {
    const source = readFileSync(SESSION_SOURCE, "utf8");
    const body = extractNamedFunctionBody(source, "async function probeMinio(");
    expect(body).not.toMatch(/return\s+"skip"/);
  });
});
