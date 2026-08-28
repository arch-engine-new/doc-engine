/**
 * Process-local JobPipeline for the demo HTTP adapter.
 * JSON in/out uses ledger/row snake_case (job_id, trace_id, pack_id).
 * Request bodies also accept camelCase aliases (jobId, packId, …).
 */

import { QdrantClient } from "@qdrant/js-client-rest";
import neo4j from "neo4j-driver";
import pg from "pg";
import {
  CHECK_WORDING_FIXTURE,
  EMPTY_PACK_NAME,
  JobPipeline,
  PACK_ID,
  resetAdapterWrites,
  type FixtureJobResult,
  type IngestStandardResult,
  type ProjectRow,
  type SpecPackRow,
  type TemplateRow,
} from "../index.js";
import { resolveEngineMode, type LiveEngineMode } from "../persistence/live-env.js";

const DEMO_BOXES = [
  { field_key: "编号", value_type: "string", page: 1, x: "8", y: "8", w: "24", h: "8" },
  { field_key: "日期A", value_type: "date", page: 1, x: "8", y: "20", w: "24", h: "8" },
  { field_key: "日期B", value_type: "date", page: 1, x: "8", y: "32", w: "24", h: "8" },
] as const;

/** Leave-request style fixture — never 公路/水利/房建. */
const LEAVE_STANDARD_TEXT = `1.1 事假须提前申请。
须在休假前一至三个工作日提交书面申请，并经主管确认。
1.2 病假须提供证明。
申请病假应附医疗机构证明，急诊可于返岗后补交。
2.1 审批时限为三个工作日。
主管须在三个工作日内完成审批并书面回复。
`;

const QDRANT_COLLECTION = "clauses";

export interface DemoResetResult {
  ok: true;
  project: ProjectRow;
  pack: SpecPackRow;
  template: TemplateRow;
  fixtureTemplate: TemplateRow;
  jobs: FixtureJobResult[];
  standard: IngestStandardResult | null;
}

export type DemoHealthProbe = "ok" | "fail" | "skip";

export interface DemoHealth {
  mode: "live" | "memory";
  postgres: DemoHealthProbe;
  qdrant: DemoHealthProbe;
  neo4j: DemoHealthProbe;
}

export class DemoHttpSession {
  pipeline: JobPipeline;
  mode: "memory" | "live";
  private liveConfig: LiveEngineMode | null;

  /**
   * Tests construct this with no args so vitest stays sqlite+memory even if
   * the process has live env keys. Vite uses openFromEnv() via getSharedSession().
   */
  constructor(options?: {
    pipeline: JobPipeline;
    mode: "memory" | "live";
    live?: LiveEngineMode;
  }) {
    if (options) {
      this.pipeline = options.pipeline;
      this.mode = options.mode;
      this.liveConfig = options.live ?? null;
    } else {
      this.pipeline = JobPipeline.openStandardLibrary();
      this.mode = "memory";
      this.liveConfig = null;
    }
  }

  /** First shared session follows env so Vite .env actually hits the three stores. */
  static async openFromEnv(): Promise<DemoHttpSession> {
    const resolved = resolveEngineMode();
    const pipeline = await JobPipeline.openLiveFromEnv();
    return new DemoHttpSession({
      pipeline,
      mode: resolved.mode,
      live: resolved.mode === "live" ? resolved : undefined,
    });
  }

  /**
   * Idempotent: replace the pipeline and re-seed fixture demo data.
   * Does not seed 公路/水利/房建 packs.
   *
   * Demo project gets its own 「空规范包」 + template so project_home / annotate
   * are reachable. Fixture jobs still bind PACK_ID (pack_slice1) so existing
   * walking-skeleton tests keep working.
   */
  async reset(): Promise<DemoResetResult> {
    if (this.mode === "live") {
      await this.resetLiveStores();
    } else {
      await this.pipeline.close();
      resetAdapterWrites();
      this.pipeline = JobPipeline.openStandardLibrary();
    }
    return this.seedFixtures();
  }

  async health(): Promise<DemoHealth> {
    if (this.mode !== "live") {
      return { mode: "memory", postgres: "skip", qdrant: "skip", neo4j: "skip" };
    }
    const live = this.requireLiveConfig();
    const [postgres, qdrant, neo4jStatus] = await Promise.all([
      probePostgres(live.databaseUrl),
      probeQdrant(live.qdrantUrl),
      probeNeo4j(live.neo4jUri, live.neo4jUser, live.neo4jPassword),
    ]);
    return { mode: "live", postgres, qdrant, neo4j: neo4jStatus };
  }

  close(): Promise<void> {
    return this.pipeline.close();
  }

  private requireLiveConfig(): LiveEngineMode {
    if (this.liveConfig) return this.liveConfig;
    const resolved = resolveEngineMode();
    if (resolved.mode !== "live") {
      throw new Error("live demo session is missing live engine configuration");
    }
    this.liveConfig = resolved;
    return resolved;
  }

  private async resetLiveStores(): Promise<void> {
    const live = this.requireLiveConfig();
    await this.pipeline.wipeLedger();
    await deleteQdrantCollection(live.qdrantUrl);
    await deleteNeo4jClauses(live.neo4jUri, live.neo4jUser, live.neo4jPassword);
    await this.pipeline.close();
    resetAdapterWrites();
    this.pipeline = await JobPipeline.openLiveFromEnv();
    const resolved = resolveEngineMode();
    this.mode = resolved.mode;
    this.liveConfig = resolved.mode === "live" ? resolved : null;
  }

  private async seedFixtures(): Promise<DemoResetResult> {
    const project = await this.pipeline.createProject("演示项目-夹具");
    await this.pipeline.setGroupKeys(PACK_ID, ["zone", "process"], "seq");

    const fixtureTemplate = await this.pipeline.createTemplate({
      packId: PACK_ID,
      name: "收货单夹具模板",
    });
    await this.pipeline.saveFieldBoxes(fixtureTemplate.template_id, [...DEMO_BOXES]);

    const pack = await this.pipeline.createSpecPack({
      projectId: project.project_id,
      name: EMPTY_PACK_NAME,
      version: "0",
    });
    await this.pipeline.setGroupKeys(pack.pack_id, ["zone", "process"], "seq");
    const template = await this.pipeline.createTemplate({
      packId: pack.pack_id,
      name: "空包模板",
    });
    await this.pipeline.saveFieldBoxes(template.template_id, [...DEMO_BOXES]);

    let standard: IngestStandardResult | null = null;
    try {
      standard = await this.pipeline.ingestStandard({
        packId: pack.pack_id,
        title: "员工请假说明",
        fileUri: "fixture://leave",
        text: LEAVE_STANDARD_TEXT,
      });
      await this.pipeline.bindEffectiveVersion(pack.pack_id, standard.version.version_id);
    } catch {
      standard = null;
    }

    const ok = await this.pipeline.runFixtureJob({ kind: "ok", template_id: fixtureTemplate.template_id });
    const reversed = await this.pipeline.runFixtureJob({
      kind: "reversed",
      template_id: fixtureTemplate.template_id,
    });
    await this.pipeline.checkWording({
      jobId: reversed.job.job_id,
      wording: CHECK_WORDING_FIXTURE,
    });

    return {
      ok: true,
      project,
      pack,
      template,
      fixtureTemplate,
      jobs: [ok, reversed],
      standard,
    };
  }
}

let shared: DemoHttpSession | null = null;
let opening: Promise<DemoHttpSession> | null = null;

/** Shared adapter session: first call opens via env (Postgres/Qdrant/Neo4j when .env is set). */
export async function getSharedSession(): Promise<DemoHttpSession> {
  if (shared) return shared;
  if (!opening) {
    opening = DemoHttpSession.openFromEnv()
      .then((session) => {
        shared = session;
        return session;
      })
      .finally(() => {
        opening = null;
      });
  }
  return opening;
}

export function replaceSharedSession(session: DemoHttpSession): void {
  shared = session;
  opening = null;
}

async function probePostgres(databaseUrl: string): Promise<DemoHealthProbe> {
  const client = new pg.Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    await client.query("SELECT 1");
    return "ok";
  } catch {
    return "fail";
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function probeQdrant(qdrantUrl: string): Promise<DemoHealthProbe> {
  try {
    const url = `${qdrantUrl.replace(/\/+$/, "")}/readyz`;
    const res = await fetch(url);
    return res.ok ? "ok" : "fail";
  } catch {
    return "fail";
  }
}

async function probeNeo4j(uri: string, user: string, password: string): Promise<DemoHealthProbe> {
  const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  try {
    await driver.verifyConnectivity();
    return "ok";
  } catch {
    return "fail";
  } finally {
    await driver.close().catch(() => undefined);
  }
}

async function deleteQdrantCollection(qdrantUrl: string): Promise<void> {
  try {
    const client = new QdrantClient({
      url: qdrantUrl,
      apiKey: process.env.QDRANT_API_KEY,
    });
    await client.deleteCollection(QDRANT_COLLECTION);
  } catch {
    // ignore missing collection
  }
}

async function deleteNeo4jClauses(uri: string, user: string, password: string): Promise<void> {
  const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  const session = driver.session();
  try {
    await session.run("MATCH (c:Clause) DETACH DELETE c");
  } finally {
    await session.close();
    await driver.close();
  }
}
