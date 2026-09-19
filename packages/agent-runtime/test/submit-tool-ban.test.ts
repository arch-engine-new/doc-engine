/**
 * SLICE-4 A8: tools whose names start with submit_ must not register or execute.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ToolRegistry } from "../src/tools/registry.js";
import { ToolRuntime, ToolExecutionError } from "../src/tools/runtime.js";

const dummySchema = {
  input: { type: "object", additionalProperties: true },
  output: { type: "object", additionalProperties: true },
};

describe("A8 submit_ tool ban", () => {
  let registry: ToolRegistry;
  let runtime: ToolRuntime;

  beforeEach(() => {
    registry = new ToolRegistry();
    runtime = new ToolRuntime(registry);
  });

  it("does not register submit_volume or other submit_ names", () => {
    const handler = vi.fn(async () => ({}));
    expect(() => registry.register("submit_volume", dummySchema, handler)).toThrow(/forbidden/);
    expect(() => registry.register("submit_foo", dummySchema, handler)).toThrow(/forbidden/);
    expect(registry.has("submit_volume")).toBe(false);
    expect(registry.has("submit_foo")).toBe(false);
    expect(registry.list()).toEqual([]);
  });

  it("execute submit_volume / submit_* is rejected with NOT_FOUND", async () => {
    await expect(runtime.execute("submit_volume", {})).rejects.toBeInstanceOf(ToolExecutionError);
    await expect(runtime.execute("submit_volume", {})).rejects.toMatchObject({
      code: "NOT_FOUND",
      toolName: "submit_volume",
    });
    await expect(runtime.execute("submit_pack", {})).rejects.toMatchObject({
      code: "NOT_FOUND",
      toolName: "submit_pack",
    });
  });

  it("still registers and executes tools that do not use the submit_ prefix", async () => {
    registry.register("check_wording", dummySchema, async () => ({ ok: true }));
    const result = await runtime.execute("check_wording", {});
    expect(result.output).toEqual({ ok: true });
  });
});
