/**
 * B-3: 进页即挂载 StepChat。
 * 进页就要可见：未检索时用户仍需本步 HITL，不能等 hits。
 * 零命中不卸载：hits.length===0 仍要能问「未命中」，不得拆掉侧栏。
 * 不绑 Job：/api/jobs[0] 是 fixture-reversed.json，线程必须是 pack:${packId}。
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const VUE_PATH = join(REPO_ROOT, "apps/web/src/views/standard_lib/index.vue");

describe("standard_lib StepChat on load", () => {
  const source = readFileSync(VUE_PATH, "utf8");
  const template = source.includes("<template>")
    ? source.slice(source.indexOf("<template>"))
    : source;

  it("mounts StepChat without a chatReady / hits.length gate", () => {
    expect(template).toContain("<StepChat");
    expect(template).not.toContain('v-if="chatReady"');
    expect(source).not.toMatch(/chatReady(?:\.value)?\s*=\s*.*hits\.length\s*>\s*0/);
  });

  it("does not request /api/jobs and uses pack-scoped trace", () => {
    expect(source).not.toContain("/api/jobs");
    expect(source).toMatch(/pack:\$\{packId/);
  });
});
