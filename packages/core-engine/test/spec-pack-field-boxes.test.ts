/**
 * SLICE-2 spec pack + FieldBox extraction: A1, A2.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { JobPipeline } from "../src/index.js";

const INDUSTRY_WORDS = ["公路", "水利", "房建"] as const;

describe("SLICE-2 spec pack and field boxes", () => {
  let pipeline: JobPipeline;

  beforeEach(() => {
    pipeline = JobPipeline.open(":memory:");
  });

  afterEach(async () => {
    await pipeline.close();
  });

  it("A1 createProject + createSpecPack; listed names have no industry presets", async () => {
    const project = await pipeline.createProject("SLICE-2 Demo");
    const pack = await pipeline.createSpecPack({
      projectId: project.project_id,
      name: "空规范包",
      version: "1",
    });
    expect(pack.project_id).toBe(project.project_id);
    expect(pack.group_keys_json).toBeNull();
    expect(pack.order_key).toBeNull();
    expect(pack.effective_standard_version_id).toBeNull();

    const listed = await pipeline.listSpecPacks(project.project_id);
    expect(listed.length).toBeGreaterThan(0);
    for (const row of listed) {
      const blob = `${row.name}\n${row.version}\n${row.group_keys_json ?? ""}\n${row.order_key ?? ""}`;
      for (const word of INDUSTRY_WORDS) {
        expect(blob).not.toContain(word);
      }
    }
  });

  it("A2 save 3 FieldBoxes then extract keys 编号/日期A/日期B", async () => {
    const project = await pipeline.createProject();
    const pack = await pipeline.createSpecPack({
      projectId: project.project_id,
      name: "空规范包",
      version: "1",
    });
    const template = await pipeline.createTemplate({ packId: pack.pack_id, name: "夹具模板" });
    await pipeline.saveFieldBoxes(template.template_id, [
      { field_key: "编号", value_type: "string", page: 1, x: "0", y: "0", w: "12", h: "8" },
      { field_key: "日期A", value_type: "date", page: 1, x: "0", y: "20", w: "12", h: "8" },
      { field_key: "日期B", value_type: "date", page: 1, x: "0", y: "40", w: "12", h: "8" },
    ]);

    const { extraction, job } = await pipeline.runFixtureJob({
      kind: "ok",
      template_id: template.template_id,
    });
    expect(job.template_id).toBe(template.template_id);
    const fields = JSON.parse(extraction.fields_json) as Record<string, unknown>;
    expect(fields).toHaveProperty("编号");
    expect(fields).toHaveProperty("日期A");
    expect(fields).toHaveProperty("日期B");
  });
});
