/**
 * F-10 Task 2: SkillIndex lookup — M7 exact/partial, pack isolation, empty index (R1/R2/R19/R26).
 */

import { describe, expect, it } from "vitest";
import { SkillIndex, SkillIndexConflictError } from "../src/skill/index.js";
import type { SkillRecord } from "../src/skill/record.js";

function record(partial: Pick<SkillRecord, "skill_id" | "pack_id" | "canonical_name"> & Partial<SkillRecord>): SkillRecord {
  return {
    project_id: "prj_skill",
    names: [partial.canonical_name],
    aliases: [],
    check_items: [],
    fix_actions: [],
    version: 1,
    ...partial,
  };
}

describe("SkillIndex lookup", () => {
  it("starts empty with no seed table names (R1)", () => {
    const index = new SkillIndex();
    expect(index.list("pack_a")).toEqual([]);
    const miss = index.lookup("pack_a", "混凝土浇筑记录");
    expect(miss.hit).toBeNull();
    expect(miss.candidates).toEqual([]);
  });

  it("requires exact equality when the name is ≤5 characters (M7)", () => {
    const index = new SkillIndex();
    index.put(record({ skill_id: "sk_short", pack_id: "pack_a", canonical_name: "钢筋表" }));
    const hit = index.lookup("pack_a", "钢筋表");
    expect(hit.hit?.skill_id).toBe("sk_short");
    expect(hit.candidates).toHaveLength(1);
    expect(index.lookup("pack_a", "钢筋").hit).toBeNull();
    expect(index.lookup("pack_a", "钢筋表A").hit).toBeNull();
    expect(index.lookup("pack_a", "主体结构钢筋表检查记录").hit).toBeNull();
  });

  it("requires exact equality at the 5-character boundary (M7)", () => {
    const index = new SkillIndex();
    index.put(record({ skill_id: "sk_five", pack_id: "pack_a", canonical_name: "检验批质量" }));
    expect(index.lookup("pack_a", "检验批质量").hit?.skill_id).toBe("sk_five");
    expect(index.lookup("pack_a", "检验批质").hit).toBeNull();
    expect(index.lookup("pack_a", "检验批质量记").hit).toBeNull();
  });

  it("allows substring match when both names are >5 characters (M7)", () => {
    const index = new SkillIndex();
    index.put(
      record({ skill_id: "sk_long", pack_id: "pack_a", canonical_name: "混凝土浇筑施工记录" }),
    );
    expect(index.lookup("pack_a", "混凝土浇筑施工记录").hit?.skill_id).toBe("sk_long");
    expect(index.lookup("pack_a", "混凝土浇筑施工记录表").hit?.skill_id).toBe("sk_long");
    expect(index.lookup("pack_a", "混凝土浇筑施工").hit?.skill_id).toBe("sk_long");
    expect(index.lookup("pack_a", "混凝土").hit).toBeNull();
  });

  it("does not auto-hit when zero or many candidates match (R19)", () => {
    const index = new SkillIndex();
    expect(index.lookup("pack_a", "混凝土浇筑施工记录").hit).toBeNull();
    expect(index.lookup("pack_a", "混凝土浇筑施工记录").candidates).toEqual([]);
    index.put(
      record({ skill_id: "sk_a", pack_id: "pack_a", canonical_name: "混凝土浇筑施工记录表" }),
    );
    index.put(
      record({ skill_id: "sk_b", pack_id: "pack_a", canonical_name: "混凝土浇筑施工记录单" }),
    );
    const many = index.lookup("pack_a", "混凝土浇筑施工记录");
    expect(many.hit).toBeNull();
    expect(many.candidates.map((row) => row.skill_id).sort()).toEqual(["sk_a", "sk_b"]);
  });

  it("hits aliases the same way as table names", () => {
    const index = new SkillIndex();
    index.put(
      record({
        skill_id: "sk_alias",
        pack_id: "pack_a",
        canonical_name: "混凝土浇筑施工记录",
        names: ["混凝土浇筑施工记录"],
        aliases: ["浇筑记录表"],
      }),
    );
    expect(index.lookup("pack_a", "浇筑记录表").hit?.skill_id).toBe("sk_alias");
    expect(index.lookup("pack_a", "浇筑记录").hit).toBeNull();
  });

  it("does not let pack B hit a name written in pack A (R26)", () => {
    const index = new SkillIndex();
    index.put(record({ skill_id: "sk_a", pack_id: "pack_a", canonical_name: "混凝土浇筑记录" }));
    expect(index.lookup("pack_b", "混凝土浇筑记录").hit).toBeNull();
    expect(index.lookup("pack_b", "混凝土浇筑记录").candidates).toEqual([]);
    expect(index.lookup("pack_a", "混凝土浇筑记录").hit?.skill_id).toBe("sk_a");
  });

  it("keeps one skill per table and distinct skill_id values (R2)", () => {
    const index = new SkillIndex();
    index.put(record({ skill_id: "sk_1", pack_id: "pack_a", canonical_name: "混凝土浇筑施工记录" }));
    index.put(record({ skill_id: "sk_2", pack_id: "pack_a", canonical_name: "钢筋加工配料单" }));
    const a = index.lookup("pack_a", "混凝土浇筑施工记录");
    const b = index.lookup("pack_a", "钢筋加工配料单");
    expect(a.hit?.skill_id).toBe("sk_1");
    expect(b.hit?.skill_id).toBe("sk_2");
    expect(a.hit?.skill_id).not.toBe(b.hit?.skill_id);
  });

  it("rejects a second record with the same (pack_id, canonical_name)", () => {
    const index = new SkillIndex();
    index.put(record({ skill_id: "sk_1", pack_id: "pack_a", canonical_name: "混凝土浇筑记录" }));
    expect(() =>
      index.put(record({ skill_id: "sk_2", pack_id: "pack_a", canonical_name: "混凝土浇筑记录" })),
    ).toThrow(SkillIndexConflictError);
    index.put(record({ skill_id: "sk_2", pack_id: "pack_b", canonical_name: "混凝土浇筑记录" }));
    expect(index.lookup("pack_b", "混凝土浇筑记录").hit?.skill_id).toBe("sk_2");
  });
});
