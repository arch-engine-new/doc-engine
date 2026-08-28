/**
 * Task 6: parseOcrFields + extractByTemplate projection (missing keys stay null).
 */

import { describe, it, expect } from "vitest";
import { extractOcrByTemplate, parseOcrFields } from "../src/extract/ocr-fields.js";

const TEMPLATE_BOXES = [
  { field_key: "编号" },
  { field_key: "日期A" },
  { field_key: "日期B" },
] as const;

describe("parseOcrFields", () => {
  it("omits unread keys instead of inventing values", () => {
    const fields = parseOcrFields("编号：SH-001");
    expect(fields).toEqual({ 编号: "SH-001" });
    expect(fields).not.toHaveProperty("日期A");
    expect(fields).not.toHaveProperty("日期B");
  });

  it("keeps inverted dates as comparable ISO strings", () => {
    const fields = parseOcrFields("编号：SH-002\n日期A：2026-08-20\n日期B：2026-08-01");
    expect(fields["日期A"]).toBe("2026-08-20");
    expect(fields["日期B"]).toBe("2026-08-01");
    expect(fields["日期A"] > fields["日期B"]).toBe(true);
  });

  it("maps aliases and date regex variants onto canonical ISO keys", () => {
    const fields = parseOcrFields(
      "文号：A-9\n开始日期：2026年8月1日\n截止日期：2026/08/20",
    );
    expect(fields["编号"]).toBe("A-9");
    expect(fields["日期A"]).toBe("2026-08-01");
    expect(fields["日期B"]).toBe("2026-08-20");
  });
});

describe("extractOcrByTemplate", () => {
  it("projects missing FieldBox keys to null without throwing", () => {
    const fields = extractOcrByTemplate("无编号无日期", [...TEMPLATE_BOXES]);
    expect(fields).toEqual({ 编号: null, 日期A: null, 日期B: null });
  });

  it("fills parsed keys and leaves the rest null", () => {
    const fields = extractOcrByTemplate("编号：SH-001", [...TEMPLATE_BOXES]);
    expect(fields["编号"]).toBe("SH-001");
    expect(fields["日期A"]).toBeNull();
    expect(fields["日期B"]).toBeNull();
  });

  it("does not invent clause_id when a box asks for it", () => {
    const fields = extractOcrByTemplate("编号：SH-001\n日期A：2026-08-20\n日期B：2026-08-01", [
      ...TEMPLATE_BOXES,
      { field_key: "clause_id" },
    ]);
    expect(fields["编号"]).toBe("SH-001");
    expect(fields["日期A"]).toBe("2026-08-20");
    expect(fields["日期B"]).toBe("2026-08-01");
    expect(fields["clause_id"]).toBeNull();
  });
});
