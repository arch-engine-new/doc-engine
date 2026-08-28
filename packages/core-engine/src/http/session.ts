/**
 * Process-local JobPipeline for the demo HTTP adapter.
 * JSON in/out uses ledger/row snake_case (job_id, trace_id, pack_id).
 * Request bodies also accept camelCase aliases (jobId, packId, …).
 */

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

export interface DemoResetResult {
  ok: true;
  project: ProjectRow;
  pack: SpecPackRow;
  template: TemplateRow;
  fixtureTemplate: TemplateRow;
  jobs: FixtureJobResult[];
  standard: IngestStandardResult | null;
}

export class DemoHttpSession {
  pipeline: JobPipeline;

  constructor() {
    this.pipeline = JobPipeline.openStandardLibrary();
  }

  /**
   * Idempotent: replace the in-memory pipeline and re-seed fixture demo data.
   * Does not seed 公路/水利/房建 packs.
   *
   * Demo project gets its own 「空规范包」 + template so project_home / annotate
   * are reachable. Fixture jobs still bind PACK_ID (pack_slice1) so existing
   * walking-skeleton tests keep working.
   */
  async reset(): Promise<DemoResetResult> {
    await this.pipeline.close();
    resetAdapterWrites();
    this.pipeline = JobPipeline.openStandardLibrary();

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

  close(): Promise<void> {
    return this.pipeline.close();
  }
}

let shared: DemoHttpSession | null = null;

export function getSharedSession(): DemoHttpSession {
  if (!shared) shared = new DemoHttpSession();
  return shared;
}

export function replaceSharedSession(session: DemoHttpSession): void {
  shared = session;
}
