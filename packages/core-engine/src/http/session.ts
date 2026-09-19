/**
 * Process-local JobPipeline for the demo HTTP adapter.
 * JSON in/out uses ledger/row snake_case (job_id, trace_id, pack_id).
 * Request bodies also accept camelCase aliases (jobId, packId, …).
 */

import { QdrantClient } from "@qdrant/js-client-rest";
import neo4j from "neo4j-driver";
import pg from "pg";
import { resetAdapterWrites } from "../adapter/mock.js";
import { MemoryBlobStore } from "../blob/memory.js";
import {
  blobObjectUri,
  fromEnv as minioFromEnv,
  probeMinioHealth,
  safeName,
} from "../blob/minio.js";
import { readPaddleOcrEnv } from "../ocr/env.js";
import { FakeOcr } from "../ocr/fake.js";
import { PaddleOcr } from "../ocr/paddleocr.js";
import type { LedgerStore } from "../persistence/ledger.js";
import { DocumentPipeline } from "../pipeline/document-pipeline.js";
import {
  JobPipeline,
  type FixtureJobResult,
  type OpenUploadJobInput,
  type OpenUploadJobResult,
} from "../pipeline/job-pipeline.js";
import { CHECK_WORDING_FIXTURE } from "../pipeline/review.js";
import {
  EMPTY_PACK_NAME,
  PACK_ID,
  seedConcreteInspectionBatchExcelDemo,
} from "../pipeline/seed.js";
import { resolveEngineMode, type LiveEngineMode } from "../persistence/live-env.js";
import type { IngestStandardResult } from "../retrieve/library.js";
import type { ProjectRow, SpecPackRow, TemplateRow } from "../types.js";
import { StepChatBridge } from "../agent/step-chat-bridge.js";
import { AgentRuntimeFactory } from "../agent/agent-runtime-factory.js";
import type { JobStepOrchestrator } from "../agent/job-step-orchestrator.js";

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
  ocr: DemoHealthProbe;
  minio: DemoHealthProbe;
  llm: DemoHealthProbe;
}

/**
 * Thrown when live mode lacks MinIO or a PaddleOCR token so HTTP returns 503
 * instead of silently falling back to FakeOcr / MemoryBlobStore on real uploads.
 */
export class UploadServiceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadServiceUnavailableError";
  }
}

export class DemoHttpSession {
  pipeline: JobPipeline;
  mode: "memory" | "live";
  private liveConfig: LiveEngineMode | null;
  private memoryBlob: MemoryBlobStore | null = null;
  private memoryOcr: FakeOcr | null = null;
  private stepChatBridge: StepChatBridge | null = null;
  private agentFactory: AgentRuntimeFactory | null = null;
  private documentPipeline: DocumentPipeline | null = null;
  /** Tests point this at an empty temp root so a checkout llm.json cannot leak. */
  private readonly projectRoot?: string;

  /**
   * Tests construct this with no args so vitest stays sqlite+memory even if
   * the process has live env keys. Vite uses openFromEnv() via getSharedSession().
   * Optional projectRoot isolates LLM config from the repo checkout.
   */
  constructor(options?: {
    pipeline?: JobPipeline;
    mode?: "memory" | "live";
    live?: LiveEngineMode;
    projectRoot?: string;
  }) {
    if (options?.pipeline) {
      this.pipeline = options.pipeline;
      this.mode = options.mode ?? "memory";
      this.liveConfig = options.live ?? null;
    } else {
      this.pipeline = JobPipeline.openStandardLibrary();
      this.mode = "memory";
      this.liveConfig = null;
    }
    this.projectRoot = options?.projectRoot;
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
   * Shared ControlPlane for StepChat and job-step HITL.
   * Memory/demo user sessions must not force FakeLlmProvider — missing llm.json
   * should surface UnconfiguredLlmProvider instead of echoing HITL prompts.
   */
  async getAgentRuntimeFactory(): Promise<AgentRuntimeFactory> {
    if (!this.agentFactory) {
      this.agentFactory = await AgentRuntimeFactory.getOrCreate({
        pipeline: this.pipeline,
        projectRoot: this.projectRoot,
        storePath: this.mode === "memory" ? ":memory:" : undefined,
      });
      this.pipeline.stepOrchestrator = this.agentFactory.getJobStepOrchestrator();
    }
    return this.agentFactory;
  }

  async getJobStepOrchestrator(): Promise<JobStepOrchestrator> {
    const factory = await this.getAgentRuntimeFactory();
    return factory.getJobStepOrchestrator();
  }

  async getStepChatBridge(): Promise<StepChatBridge> {
    if (!this.stepChatBridge) {
      const factory = await this.getAgentRuntimeFactory();
      this.stepChatBridge = factory.getStepChatBridge();
    }
    return this.stepChatBridge;
  }

  /** Ledger store shared with JobPipeline (sibling DocumentPipeline). */
  ledger(): LedgerStore {
    return (this.pipeline as unknown as { store: LedgerStore }).store;
  }

  getDocumentPipeline(): DocumentPipeline {
    if (!this.documentPipeline) {
      this.documentPipeline = new DocumentPipeline(this.ledger(), this.resolveUploadDeps().blob);
    }
    return this.documentPipeline;
  }

  async uploadExcelTemplate(
    templateId: string,
    file: { bytes: Uint8Array; fileName: string; mime: string },
    excelSheetName?: string | null,
  ): Promise<TemplateRow> {
    const template = await this.pipeline.getTemplate(templateId);
    if (!template) {
      throw new Error(`template not found: ${templateId}`);
    }
    const { blob } = this.resolveUploadDeps();
    const key = `templates/${templateId}/${safeName(file.fileName)}`;
    const bucket =
      typeof (blob as { bucket?: string }).bucket === "string"
        ? (blob as { bucket: string }).bucket
        : "docengine";
    await blob.ensureBucket();
    await blob.put({ key, bytes: file.bytes, mime: file.mime });
    return this.ledger().updateTemplateExcel(templateId, {
      layout_kind: "excel",
      excel_template_uri: blobObjectUri(bucket, key),
      excel_sheet_name: excelSheetName ?? template.excel_sheet_name,
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
    this.stepChatBridge = null;
    this.agentFactory = null;
    this.documentPipeline = null;
    return this.seedFixtures();
  }

  async health(): Promise<DemoHealth> {
    const llm = StepChatBridge.probeLlmHealth();
    if (this.mode !== "live") {
      return {
        mode: "memory",
        postgres: "skip",
        qdrant: "skip",
        neo4j: "skip",
        ocr: "skip",
        minio: "skip",
        llm,
      };
    }
    const live = this.requireLiveConfig();
    const [postgres, qdrant, neo4jStatus, minio, ocr] = await Promise.all([
      probePostgres(live.databaseUrl),
      probeQdrant(live.qdrantUrl),
      probeNeo4j(live.neo4jUri, live.neo4jUser, live.neo4jPassword),
      probeMinio(),
      probePaddleOcr(),
    ]);
    return { mode: "live", postgres, qdrant, neo4j: neo4jStatus, minio, ocr, llm };
  }

  /**
   * HTTP upload wrapper: memory tests use MemoryBlobStore + FakeOcr; live mode
   * requires both MinIO and PaddleOCR.fromEnv — missing either throws 503, not Fake.
   */
  async openUploadJob(
    input: Omit<OpenUploadJobInput, "projectId"> & { projectId?: string },
  ): Promise<OpenUploadJobResult> {
    const projectId = input.projectId ?? (await this.resolveDefaultUploadProjectId());
    const deps = this.resolveUploadDeps();
    return this.pipeline.openUploadJob({ ...input, projectId }, deps);
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

  private async resolveDefaultUploadProjectId(): Promise<string> {
    const projects = await this.pipeline.listProjects();
    if (projects.length > 0) return projects[0]!.project_id;
    const created = await this.pipeline.createProject("演示上传");
    return created.project_id;
  }

  private resolveUploadDeps(): { blob: MemoryBlobStore; ocr: FakeOcr } | {
    blob: NonNullable<ReturnType<typeof minioFromEnv>>;
    ocr: NonNullable<ReturnType<typeof PaddleOcr.fromEnv>>;
  } {
    if (this.mode === "memory") {
      if (!this.memoryBlob) this.memoryBlob = new MemoryBlobStore();
      if (!this.memoryOcr) this.memoryOcr = new FakeOcr();
      return { blob: this.memoryBlob, ocr: this.memoryOcr };
    }
    const blob = minioFromEnv();
    const ocr = PaddleOcr.fromEnv();
    if (!blob || !ocr) {
      throw new UploadServiceUnavailableError(
        "Real upload not configured: MinIO and PaddleOCR token must both be available in live mode",
      );
    }
    return { blob, ocr };
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
    await this.getAgentRuntimeFactory();
    const project = await this.pipeline.createProject("演示项目-夹具");
    await this.pipeline.setGroupKeys(PACK_ID, ["zone", "process"], "seq");
    const sliceTypes = await this.pipeline.ensureDemoDocTypes(PACK_ID);

    const fixtureTemplate = await this.pipeline.createTemplate({
      packId: PACK_ID,
      name: "收货单夹具模板",
      docTypeId: sliceTypes.childId,
    });
    await this.pipeline.saveFieldBoxes(fixtureTemplate.template_id, [...DEMO_BOXES]);

    const pack = await this.pipeline.createSpecPack({
      projectId: project.project_id,
      name: EMPTY_PACK_NAME,
      version: "0",
    });
    await this.pipeline.setGroupKeys(pack.pack_id, ["zone", "process"], "seq");
    const packTypes = await this.pipeline.ensureDemoDocTypes(pack.pack_id);
    const template = await this.pipeline.createTemplate({
      packId: pack.pack_id,
      name: "空包模板",
      docTypeId: packTypes.childId,
    });
    await this.pipeline.saveFieldBoxes(template.template_id, [...DEMO_BOXES]);

    const { blob } = this.resolveUploadDeps();
    await seedConcreteInspectionBatchExcelDemo(this.ledger(), {
      packId: pack.pack_id,
      blob,
    });

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

async function probeMinio(): Promise<DemoHealthProbe> {
  return probeMinioHealth();
}

/**
 * Auth-only health: GET a path that must not exist as a job. 404 means the
 * token was accepted; 401/403 means it was not. Never POST /ocr/jobs here.
 */
async function probePaddleOcr(): Promise<DemoHealthProbe> {
  const config = readPaddleOcrEnv();
  if (!config) return "skip";
  try {
    const url = `${config.jobUrl.replace(/\/+$/, "")}/__health_probe`;
    const response = await fetch(url, {
      method: "GET",
      headers: { Authorization: `bearer ${config.token}` },
    });
    if (response.status === 401 || response.status === 403) return "fail";
    if (response.status === 404) return "ok";
    return response.ok ? "ok" : "fail";
  } catch {
    return "fail";
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

/**
 * Demo reset must drop LayoutUnit as well as Clause. Clause-only DETACH
 * left SUPPORTS sources behind so the next ingest reused dirty table nodes.
 */
async function deleteNeo4jClauses(uri: string, user: string, password: string): Promise<void> {
  const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  const session = driver.session();
  try {
    await session.run("MATCH (c:Clause) DETACH DELETE c");
    await session.run("MATCH (n:LayoutUnit) DETACH DELETE n");
  } finally {
    await session.close();
    await driver.close();
  }
}
