/**
 * F-10 Task 4: matchCheckItems fail-closed (R6 R20 / D2).
 * Engine substring match only — unmatched never goes to a model.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canConfirmSkill, matchCheckItems, renderSkillSummary } from "../src/skill/index.js";
import type { SkillCheckItem } from "../src/skill/record.js";

const BODY =
  "混凝土浇筑施工记录 强度等级 C30 坍落度实测 180mm 浇筑部位 基础底板";

function item(label: string, keywords: string[]): SkillCheckItem {
  return { label, keywords };
}

describe("matchCheckItems fail-closed (R6/R20/D2)", () => {
  it("fails closed when a check_item can never match the body (R20/D2)", () => {
    const impossible = item("必须填写钢筋保护层厚度", ["永不可能出现在正文里的保护层夹具_XYZ"]);
    const result = matchCheckItems(BODY, [impossible]);
    expect(result.matched).toEqual([]);
    expect(result.unmatched).toEqual([impossible]);
    expect(result.verdict).toBe("fail");
    expect(result.item_results).toHaveLength(1);
    expect(result.item_results[0]?.matched).toBe(false);
    expect(result.item_results[0]?.verdict).toBe("fail");
    expect(result.item_results[0]?.reason).toBe("unmatched");
  });

  it("puts only keyword-subset hits on the model list and never returns pass from matching (R6)", () => {
    const hit = item("混凝土强度等级须写 C30", ["C30"]);
    const result = matchCheckItems(BODY, [hit]);
    expect(result.matched).toEqual([hit]);
    expect(result.unmatched).toEqual([]);
    expect(result.verdict).not.toBe("pass");
    expect(result.verdict).toBeNull();
    expect(result.item_results[0]?.matched).toBe(true);
    expect(result.item_results[0]?.reason).toBeNull();
  });

  it("keeps unmatched rows fail and out of the model list when some items hit (D2)", () => {
    const hit = item("坍落度须填实测值", ["坍落度"]);
    const miss = item("必须有监理签字栏", ["监理签字栏_ABSENT"]);
    const result = matchCheckItems(BODY, [hit, miss]);
    expect(result.matched).toEqual([hit]);
    expect(result.unmatched).toEqual([miss]);
    expect(result.verdict).toBe("fail");
    expect(result.item_results[1]?.reason).toBe("unmatched");
    expect(result.item_results[1]?.verdict).toBe("fail");
  });

  it("requires every keyword to be a substring of the body (AND, 关键词 ⊆ 正文)", () => {
    const both = item("强度与坍落度都要有", ["C30", "坍落度"]);
    const missingOne = item("强度与钢筋都要有", ["C30", "钢筋保护层"]);
    expect(matchCheckItems(BODY, [both]).matched).toEqual([both]);
    const miss = matchCheckItems(BODY, [missingOne]);
    expect(miss.matched).toEqual([]);
    expect(miss.unmatched).toEqual([missingOne]);
    expect(miss.verdict).toBe("fail");
  });

  it("treats empty keywords as unmatched so a blank item cannot wash to a hit", () => {
    const blank = item("空关键词不得当命中", []);
    const result = matchCheckItems(BODY, [blank]);
    expect(result.matched).toEqual([]);
    expect(result.verdict).toBe("fail");
    expect(result.item_results[0]?.reason).toBe("unmatched");
  });

  it("still allows confirm when matching is empty, but the verdict cannot be pass (R20)", () => {
    const items = [item("必须填写钢筋保护层厚度", ["永不可能出现在正文里的保护层夹具_XYZ"])];
    const result = matchCheckItems(BODY, items);
    expect(result.verdict).toBe("fail");
    expect(result.verdict).not.toBe("pass");
    const summary = renderSkillSummary({
      names: ["混凝土浇筑施工记录"],
      check_items: items,
      fix_actions: [{ kind: "annotate_fail", on: "on_fail" }],
    });
    expect(canConfirmSkill({ summary, check_items: items })).toBe(true);
  });

  it("does not import an LLM module (R6)", () => {
    const src = readFileSync(new URL("../src/skill/match-check-items.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/from ["'][^"']*llm/i);
    expect(src).not.toMatch(/LlmProvider/);
  });
});
