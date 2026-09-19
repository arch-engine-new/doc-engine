/**
 * F-7 Task 1 RED: PdfTickPanel PrimaryButton「处理全部页」+ runTickAll loop.
 * tick-all.ts is not on disk yet — missing module / missing CTA is the red light.
 * http.ts must keep per-page tick; no ingest-all / tick-all API path.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const PANEL_PATH = join(REPO_ROOT, "apps/web/src/views/standard_lib/PdfTickPanel.vue");
const HTTP_PATH = join(REPO_ROOT, "apps/web/src/services/http.ts");
/** Relative to this test file. Brief wrote four `../`; Node resolves from the test dir so three is correct. */
const TICK_ALL_MODULE = "../../../apps/web/src/views/standard_lib/tick-all.ts";

type TickResult = { done: boolean; status: string };

function readUtf8(path: string): string {
  return readFileSync(path, "utf8");
}

/** Isolate the 处理全部页 control so we can require PrimaryButton (`button.btn`), not GhostButton. */
function findTickAllButton(source: string): string | undefined {
  const buttons = source.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) ?? [];
  return buttons.find((btn) => btn.includes("处理全部页"));
}

describe("standard_lib tickAll", () => {
  it("PdfTickPanel shows PrimaryButton 处理全部页 (class=btn, not only ghost)", () => {
    const panel = readUtf8(PANEL_PATH);
    expect(panel).toContain("处理全部页");
    const btn = findTickAllButton(panel);
    expect(btn).toBeDefined();
    expect(btn).toMatch(/\bclass="[^"]*\bbtn\b[^"]*"/);
    // GhostButton is `btn ghost`; PrimaryButton is `button.btn` without ghost.
    expect(btn).not.toMatch(/\bghost\b/);
  });

  it("runTickAll calls tickFn three times until done", async () => {
    const { runTickAll } = await import(TICK_ALL_MODULE);
    const replies: TickResult[] = [
      { done: false, status: "ok" },
      { done: false, status: "ok" },
      { done: true, status: "ok" },
    ];
    let calls = 0;
    // Each mock tick advances one page; the helper must not collapse the loop into one ingest-all call.
    await runTickAll(async (): Promise<TickResult> => {
      const reply = replies[calls];
      calls += 1;
      if (!reply) {
        throw new Error("tickFn called more times than mock pages");
      }
      return reply;
    });
    expect(calls).toBe(3);
  });

  it("runTickAll keeps looping after ocr_error until done", async () => {
    const { runTickAll } = await import(TICK_ALL_MODULE);
    const replies: TickResult[] = [
      { done: false, status: "ocr_error" },
      { done: true, status: "ok" },
    ];
    let calls = 0;
    await runTickAll(async (): Promise<TickResult> => {
      const reply = replies[calls];
      calls += 1;
      if (!reply) {
        throw new Error("tickFn called more times than mock pages");
      }
      return reply;
    });
    expect(calls).toBe(2);
  });

  it("http.ts source has no ingest-all / tick-all / tickAll API path", () => {
    const httpSrc = readUtf8(HTTP_PATH);
    expect(httpSrc).not.toMatch(/ingest-all/);
    expect(httpSrc).not.toMatch(/tick-all/);
    expect(httpSrc).not.toMatch(/tickAll/);
  });
});
