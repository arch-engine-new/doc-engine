/**
 * F-1 Task 3: clicking a retrieve hit opens heading+body detail.
 * Provenance columns stay five; the table must not grow a full-text <th>.
 * Source assertions — detail is Vue-only; Task 1/2 already cover search/prompt.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const VIEW_DIR = join(REPO_ROOT, "apps/web/src/views/standard_lib");

function readView(name: string): string {
  return readFileSync(join(VIEW_DIR, name), "utf8");
}

describe("standard_lib hit detail", () => {
  const table = readView("RetrieveHitsTable.vue");
  const index = readView("index.vue");

  it("keeps five provenance headers and no full-text column", () => {
    expect(table).toContain("<th>file_name</th>");
    expect(table).toContain("<th>页</th>");
    expect(table).toContain("<th>unit_id</th>");
    expect(table).toContain("<th>clause_id</th>");
    expect(table).toContain("<th>路径</th>");
    // Full text belongs in HitDetailPanel, never a table header.
    expect(table).not.toMatch(/<th>[^<]*(正文|heading|body|全文)[^<]*<\/th>/i);
  });

  it("clauseLabel still returns — for table, annex, and null clause_id", () => {
    expect(table).toContain("function clauseLabel");
    expect(table).toMatch(/chunk_kind === ["']table["']/);
    expect(table).toMatch(/chunk_kind === ["']annex["']/);
    expect(table).toMatch(/clause_id == null/);
    expect(table).toContain('return "—"');
  });

  it("row click emits select", () => {
    expect(table).toMatch(/@click/);
    expect(table).toMatch(/emit\(['"]select['"]/);
  });

  it("HitDetailPanel exists and shows heading and body with empty fallbacks", () => {
    const panelPath = join(VIEW_DIR, "HitDetailPanel.vue");
    expect(existsSync(panelPath)).toBe(true);
    const panel = readFileSync(panelPath, "utf8");
    expect(panel).toMatch(/<section[^>]*class="card"/);
    expect(panel).toMatch(/\bheading\b/);
    expect(panel).toMatch(/\bbody\b/);
    expect(panel).toContain("无标题");
    expect(panel).toContain("无正文");
  });

  it("index wires HitDetailPanel closed until a row is selected", () => {
    expect(index).toContain("HitDetailPanel");
    expect(index).toMatch(/v-if=["']selectedHit["']/);
    expect(index).toMatch(/<StepChat/);
    expect(index).toMatch(/v-if=["']packId["']/);
  });

  it("index.vue stays at or under 300 lines", () => {
    const lines = index.split(/\r?\n/).length;
    expect(lines).toBeLessThanOrEqual(300);
  });
});
