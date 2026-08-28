/**
 * SLICE-5 volume grouping preview: A7 + chat must not submit or write Receipt.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  JobPipeline,
  buildPreviewTree,
  type VolumeGroupNode,
  type VolumeLeafNode,
  type VolumePreviewNode,
  type VolumePreviewTree,
} from "../src/index.js";

const INDUSTRY_NAMES = ["公路", "水利", "房建"];

function asLeaf(node: VolumePreviewNode | undefined): VolumeLeafNode {
  expect(node?.kind).toBe("leaf");
  return node as VolumeLeafNode;
}

function findGroup(nodes: VolumePreviewNode[], key: string, value: string): VolumeGroupNode {
  const found = nodes.find((n) => n.kind === "group" && n.key === key && n.value === value);
  expect(found, `missing group ${key}=${value}`).toBeTruthy();
  return found as VolumeGroupNode;
}

function treeHasIndustryName(tree: VolumePreviewTree): boolean {
  const blob = JSON.stringify(tree);
  return INDUSTRY_NAMES.some((name) => blob.includes(name));
}

describe("buildPreviewTree", () => {
  it("nests by groupKeys and sorts leaves by orderKey then extractionId", () => {
    const tree = buildPreviewTree(
      [
        { extractionId: "ext_b", fields: { zone: "东区", process: "浇筑", seq: "2" } },
        { extractionId: "ext_a", fields: { zone: "东区", process: "浇筑", seq: "1" } },
        { extractionId: "ext_c", fields: { zone: "西区", process: "回填", seq: "1" } },
      ],
      ["zone", "process"],
      "seq",
    );
    expect(tree.submitted).toBe(false);
    expect(tree.groupKeys).toEqual(["zone", "process"]);
    expect(tree.orderKey).toBe("seq");

    const east = findGroup(tree.nodes, "zone", "东区");
    const pour = findGroup(east.children, "process", "浇筑");
    const leaves = pour.children.map(asLeaf);
    expect(leaves.map((l) => l.fields.seq)).toEqual(["1", "2"]);
    expect(leaves.map((l) => l.extractionId)).toEqual(["ext_a", "ext_b"]);

    const west = findGroup(tree.nodes, "zone", "西区");
    const backfill = findGroup(west.children, "process", "回填");
    expect(asLeaf(backfill.children[0]).extractionId).toBe("ext_c");
    expect(treeHasIndustryName(tree)).toBe(false);
  });

  it("missing group/order values become empty string; empty order sorts first", () => {
    const tree = buildPreviewTree(
      [
        { extractionId: "ext_2", fields: { zone: "东区", seq: "2" } },
        { extractionId: "ext_empty", fields: { zone: "东区" } },
        { extractionId: "ext_nogroup", fields: { seq: "1" } },
      ],
      ["zone"],
      "seq",
    );
    const emptyZone = findGroup(tree.nodes, "zone", "");
    expect(asLeaf(emptyZone.children[0]).extractionId).toBe("ext_nogroup");
    const east = findGroup(tree.nodes, "zone", "东区");
    expect(east.children.map((n) => asLeaf(n).extractionId)).toEqual(["ext_empty", "ext_2"]);
  });

  it("empty groupKeys yields a flat leaf list with submitted false", () => {
    const tree = buildPreviewTree(
      [
        { extractionId: "ext_z", fields: { seq: "2" } },
        { extractionId: "ext_a", fields: { seq: "1" } },
      ],
      [],
      "seq",
    );
    expect(tree.submitted).toBe(false);
    expect(tree.groupKeys).toEqual([]);
    expect(tree.nodes.every((n) => n.kind === "leaf")).toBe(true);
    expect(tree.nodes.map((n) => asLeaf(n).extractionId)).toEqual(["ext_a", "ext_z"]);
    expect(treeHasIndustryName(tree)).toBe(false);
  });
});

describe("SLICE-5 volume preview", () => {
  let pipeline: JobPipeline;

  beforeEach(() => {
    pipeline = JobPipeline.open(":memory:");
  });

  afterEach(async () => {
    await pipeline.close();
  });

  it("A7 custom groupKeys nest leaves; submitted stays false; audit volume_preview", async () => {
    const project = await pipeline.createProject();
    const pack = await pipeline.createSpecPack({
      projectId: project.project_id,
      name: "自定义组卷",
      version: "1",
    });
    const updated = await pipeline.setGroupKeys(pack.pack_id, ["zone", "process"], "seq");
    expect(JSON.parse(updated.group_keys_json ?? "null")).toEqual(["zone", "process"]);
    expect(updated.order_key).toBe("seq");
    expect(INDUSTRY_NAMES.some((n) => (updated.group_keys_json ?? "").includes(n))).toBe(false);

    const job = await pipeline.openJobForPack({
      projectId: project.project_id,
      packId: pack.pack_id,
    });
    expect(job.status).toBe("checking");

    await pipeline.attachExtraction(job.job_id, { zone: "东区", process: "浇筑", seq: "2" });
    await pipeline.attachExtraction(job.job_id, { zone: "东区", process: "浇筑", seq: "1" });
    await pipeline.attachExtraction(job.job_id, { zone: "西区", process: "回填", seq: "1" });

    const result = await pipeline.previewVolume(job.job_id);
    expect(result.preview.preview_id).toBeTruthy();
    expect(result.preview.job_id).toBe(job.job_id);
    expect(result.tree.submitted).toBe(false);

    const stored = JSON.parse(result.preview.tree_json) as VolumePreviewTree;
    expect(stored.submitted).toBe(false);
    expect(stored.groupKeys).toEqual(["zone", "process"]);

    const east = findGroup(stored.nodes, "zone", "东区");
    const pour = findGroup(east.children, "process", "浇筑");
    expect(pour.children.map((n) => asLeaf(n).fields.seq)).toEqual(["1", "2"]);
    const west = findGroup(stored.nodes, "zone", "西区");
    expect(findGroup(west.children, "process", "回填").children).toHaveLength(1);

    expect(treeHasIndustryName(stored)).toBe(false);
    expect((await pipeline.getJob(job.job_id))?.status).toBe("checking");
    expect(await pipeline.listReceipts(job.job_id)).toHaveLength(0);

    const events = await pipeline.listAudit(job.trace_id);
    expect(
      events.some((e) => e.event_type === "volume_preview" && e.ref_id === result.preview.preview_id),
    ).toBe(true);

    const latest = await pipeline.getVolumePreview(job.job_id);
    expect(latest?.preview_id).toBe(result.preview.preview_id);
  });

  it("empty groupKeys persist a flat leaf list without industry volume names", async () => {
    const project = await pipeline.createProject();
    const pack = await pipeline.createSpecPack({
      projectId: project.project_id,
      name: "空分组",
      version: "1",
    });
    await pipeline.setGroupKeys(pack.pack_id, [], null);
    const job = await pipeline.openJobForPack({
      projectId: project.project_id,
      packId: pack.pack_id,
    });
    await pipeline.attachExtraction(job.job_id, { title: "叶甲" });
    await pipeline.attachExtraction(job.job_id, { title: "叶乙" });

    const result = await pipeline.previewVolume(job.job_id);
    const stored = JSON.parse(result.preview.tree_json) as VolumePreviewTree;
    expect(stored.submitted).toBe(false);
    expect(stored.groupKeys).toEqual([]);
    expect(stored.nodes).toHaveLength(2);
    expect(stored.nodes.every((n) => n.kind === "leaf")).toBe(true);
    expect(treeHasIndustryName(stored)).toBe(false);
  });

  it("appendChat step=volume_preview does not set submitted true and writes no Receipt", async () => {
    const project = await pipeline.createProject();
    const pack = await pipeline.createSpecPack({
      projectId: project.project_id,
      name: "对话不提交",
      version: "1",
    });
    await pipeline.setGroupKeys(pack.pack_id, ["zone"], "seq");
    const job = await pipeline.openJobForPack({
      projectId: project.project_id,
      packId: pack.pack_id,
    });
    await pipeline.attachExtraction(job.job_id, { zone: "东区", seq: "1" });
    const previewed = await pipeline.previewVolume(job.job_id);

    await pipeline.appendChat({
      traceId: job.trace_id,
      step: "volume_preview",
      body: "对话声称组卷已提交成功",
    });

    const after = await pipeline.getVolumePreview(job.job_id);
    expect(JSON.parse(after?.tree_json ?? "{}").submitted).toBe(false);
    expect(after?.preview_id).toBe(previewed.preview.preview_id);
    expect(await pipeline.listReceipts(job.job_id)).toHaveLength(0);
    expect((await pipeline.getJob(job.job_id))?.status).not.toBe("submitted");
    expect((await pipeline.getJob(job.job_id))?.status).not.toBe("success");

    const messages = await pipeline.listMessages(job.trace_id, "volume_preview");
    expect(messages.some((m) => m.body === "对话声称组卷已提交成功")).toBe(true);
  });

  it("runFixtureJob still produces a single extraction; extra leaves attach without changing that", async () => {
    const { job, extraction } = await pipeline.runFixtureJob({ kind: "ok" });
    await pipeline.setGroupKeys(job.pack_id!, ["zone", "process"], "seq");
    await pipeline.attachExtraction(job.job_id, { zone: "东区", process: "浇筑", seq: "1" });
    const result = await pipeline.previewVolume(job.job_id);
    const stored = JSON.parse(result.preview.tree_json) as VolumePreviewTree;
    const ids = collectLeafIds(stored.nodes);
    expect(ids).toContain(extraction.extraction_id);
    expect(ids.length).toBeGreaterThanOrEqual(2);
    expect(stored.submitted).toBe(false);
  });
});

function collectLeafIds(nodes: VolumePreviewNode[]): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    if (node.kind === "leaf") ids.push(node.extractionId);
    else ids.push(...collectLeafIds(node.children));
  }
  return ids;
}
