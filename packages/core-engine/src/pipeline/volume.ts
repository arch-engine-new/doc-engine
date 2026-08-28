/**
 * Volume preview desk: nested grouping snapshot only.
 * tree.submitted is always false; never writes Receipt; never marks job submitted.
 * groupKeys come from the spec pack, not industry presets (公路/水利/房建).
 */

import type { LedgerStore } from "../persistence/ledger.js";
import type { ExtractionRow, VolumePreviewRow } from "../types.js";

export interface VolumeLeaf {
  extractionId: string;
  fields: Record<string, unknown>;
}

export interface VolumeLeafNode {
  kind: "leaf";
  extractionId: string;
  fields: Record<string, unknown>;
}

export interface VolumeGroupNode {
  kind: "group";
  key: string;
  value: string;
  children: VolumePreviewNode[];
}

export type VolumePreviewNode = VolumeGroupNode | VolumeLeafNode;

export interface VolumePreviewTree {
  submitted: false;
  groupKeys: string[];
  orderKey: string | null;
  nodes: VolumePreviewNode[];
}

export interface PreviewVolumeResult {
  preview: VolumePreviewRow;
  tree: VolumePreviewTree;
}

function fieldAsString(fields: Record<string, unknown>, key: string | null | undefined): string {
  if (!key) return "";
  const value = fields[key];
  if (value === undefined || value === null) return "";
  return String(value);
}

function compareLeaves(a: VolumeLeaf, b: VolumeLeaf, orderKey: string | null): number {
  const av = fieldAsString(a.fields, orderKey);
  const bv = fieldAsString(b.fields, orderKey);
  if (av !== bv) return av < bv ? -1 : 1;
  if (a.extractionId !== b.extractionId) return a.extractionId < b.extractionId ? -1 : 1;
  return 0;
}

function nest(
  leaves: VolumeLeaf[],
  groupKeys: string[],
  orderKey: string | null,
  depth: number,
): VolumePreviewNode[] {
  if (depth >= groupKeys.length) {
    return [...leaves]
      .sort((a, b) => compareLeaves(a, b, orderKey))
      .map((leaf) => ({
        kind: "leaf" as const,
        extractionId: leaf.extractionId,
        fields: leaf.fields,
      }));
  }
  const key = groupKeys[depth]!;
  const buckets = new Map<string, VolumeLeaf[]>();
  for (const leaf of leaves) {
    const value = fieldAsString(leaf.fields, key);
    const bucket = buckets.get(value);
    if (bucket) bucket.push(leaf);
    else buckets.set(value, [leaf]);
  }
  const values = [...buckets.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return values.map((value) => ({
    kind: "group" as const,
    key,
    value,
    children: nest(buckets.get(value)!, groupKeys, orderKey, depth + 1),
  }));
}

/** Pure grouping; always returns submitted: false. Empty groupKeys → flat leaf nodes. */
export function buildPreviewTree(
  leaves: VolumeLeaf[],
  groupKeys: string[] | null | undefined,
  orderKey: string | null,
): VolumePreviewTree {
  const keys = groupKeys && groupKeys.length > 0 ? [...groupKeys] : [];
  if (keys.length === 0) {
    const nodes: VolumeLeafNode[] = [...leaves]
      .sort((a, b) => compareLeaves(a, b, orderKey))
      .map((leaf) => ({
        kind: "leaf" as const,
        extractionId: leaf.extractionId,
        fields: leaf.fields,
      }));
    return { submitted: false, groupKeys: keys, orderKey, nodes };
  }
  return {
    submitted: false,
    groupKeys: keys,
    orderKey,
    nodes: nest(leaves, keys, orderKey, 0),
  };
}

function parseGroupKeys(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => String(item));
  } catch {
    return [];
  }
}

function parseFields(row: ExtractionRow): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(row.fields_json);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* fall through */
  }
  return {};
}

export class VolumeDesk {
  constructor(private readonly store: LedgerStore) {}

  async attachExtraction(jobId: string, fields: Record<string, unknown>): Promise<ExtractionRow> {
    const job = await this.store.getJob(jobId);
    if (!job) {
      throw new Error(`job not found: ${jobId}`);
    }
    return this.store.insertExtraction({
      job_id: jobId,
      ocr_text: null,
      fields,
    });
  }

  /**
   * Snapshot grouping tree for all extractions on the job.
   * Does not write Receipt and does not change job status.
   */
  async previewVolume(jobId: string): Promise<PreviewVolumeResult> {
    const job = await this.store.getJob(jobId);
    if (!job) {
      throw new Error(`job not found: ${jobId}`);
    }
    let groupKeys: string[] = [];
    let orderKey: string | null = null;
    if (job.pack_id) {
      const pack = await this.store.getSpecPack(job.pack_id);
      if (pack) {
        groupKeys = parseGroupKeys(pack.group_keys_json);
        orderKey = pack.order_key;
      }
    }
    const leaves: VolumeLeaf[] = (await this.store.listExtractions(jobId)).map((row) => ({
      extractionId: row.extraction_id,
      fields: parseFields(row),
    }));
    const tree: VolumePreviewTree = {
      ...buildPreviewTree(leaves, groupKeys, orderKey),
      submitted: false,
    };
    const preview = await this.store.insertVolumePreview({ job_id: jobId, tree });
    await this.store.appendAudit({
      trace_id: job.trace_id,
      event_type: "volume_preview",
      ref_id: preview.preview_id,
      payload: {
        preview_id: preview.preview_id,
        job_id: job.job_id,
        submitted: false,
      },
    });
    return { preview, tree };
  }

  async getVolumePreview(jobId: string): Promise<VolumePreviewRow | null> {
    return this.store.getVolumePreview(jobId);
  }

  async getVolumePreviewById(previewId: string): Promise<VolumePreviewRow | null> {
    return this.store.getVolumePreviewById(previewId);
  }
}
