/**
 * F-10 Task 16: job_upload T1–T3 (M3 / M4 / M12).
 * Reads Vue source + skillConfirm gate; engine HTTP 409 is covered elsewhere.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const INDEX_PATH = join(REPO_ROOT, "apps/web/src/views/job_upload/index.vue");
const TOOLBAR_PATH = join(REPO_ROOT, "apps/web/src/views/job_upload/UploadToolbar.vue");
const HTTP_PATH = join(REPO_ROOT, "apps/web/src/services/http.ts");
const STEP_CHAT_PATH = join(REPO_ROOT, "apps/web/src/components/StepChat.vue");
const SKILL_CONFIRM_MODULE = "../../../apps/web/src/views/job_upload/skillConfirm.ts";

function readUtf8(path: string): string {
  return readFileSync(path, "utf8");
}

function findButton(source: string, label: string): string | undefined {
  const buttons = source.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) ?? [];
  return buttons.find((btn) => btn.includes(label));
}

describe("job_upload Vue T1–T3", () => {
  it("T1 / M3: 确认完成并处理 is disabled without summary; http has confirm-skill", async () => {
    const toolbar = readUtf8(TOOLBAR_PATH);
    expect(toolbar).toContain("确认完成并处理");
    const btn = findButton(toolbar, "确认完成并处理");
    expect(btn).toBeDefined();
    expect(btn).toMatch(/:disabled="!canConfirm"/);
    expect(btn).not.toMatch(/\bghost\b/);

    const httpSrc = readUtf8(HTTP_PATH);
    expect(httpSrc).toContain("confirm-skill");

    const { canConfirmSkillUi } = await import(SKILL_CONFIRM_MODULE);
    expect(canConfirmSkillUi(null)).toBe(false);
    expect(canConfirmSkillUi(undefined)).toBe(false);
    expect(canConfirmSkillUi({ names: [], check_labels: [], fix_plain: [] })).toBe(false);
  });

  it("T2 / M4: three engine labels; gate needs names+checks+fixes; speech is not summary", async () => {
    const toolbar = readUtf8(TOOLBAR_PATH);
    expect(toolbar).toContain("表名 / 别名");
    expect(toolbar).toContain("检查项");
    expect(toolbar).toContain("会怎么修");
    expect(toolbar).toContain("不是最后一句聊天");

    const indexSrc = readUtf8(INDEX_PATH);
    expect(indexSrc).not.toMatch(/assistant_reply/);
    expect(readUtf8(STEP_CHAT_PATH)).toContain("skill_summary");

    const { canConfirmSkillUi } = await import(SKILL_CONFIRM_MODULE);
    expect(canConfirmSkillUi("可以确认了")).toBe(false);
    expect(
      canConfirmSkillUi({
        names: ["可以确认了"],
        check_labels: [],
        fix_plain: [],
      }),
    ).toBe(false);
    expect(
      canConfirmSkillUi({
        names: ["混凝土检验批"],
        check_labels: ["日期顺序"],
        fix_plain: [],
      }),
    ).toBe(false);
    expect(
      canConfirmSkillUi({
        names: ["混凝土检验批"],
        check_labels: ["日期顺序"],
        fix_plain: ["按 Skill 映射 patch 单元格"],
      }),
    ).toBe(true);
  });

  it("T3 / M12: main upload ignores empty DocType; accept has xlsx; uploadJob omits docTypeId", async () => {
    const toolbar = readUtf8(TOOLBAR_PATH);
    const uploadBtn = findButton(toolbar, "上传资料");
    expect(uploadBtn).toBeDefined();
    expect(uploadBtn).toMatch(/:disabled="!canUploadSkill"/);
    expect(uploadBtn).not.toMatch(/selectedDocTypeId/);
    expect(toolbar).toMatch(/xlsx/);
    expect(toolbar).toContain("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    const indexSrc = readUtf8(INDEX_PATH);
    const uploadCall = indexSrc.match(/uploadJob\(file,\s*\{[^}]*\}\)/);
    expect(uploadCall?.[0]).toMatch(/projectId/);
    expect(uploadCall?.[0]).toMatch(/packId/);
    expect(uploadCall?.[0]).not.toMatch(/docTypeId/);
    expect(indexSrc).not.toMatch(/track=all/);

    const httpSrc = readUtf8(HTTP_PATH);
    expect(httpSrc).toMatch(/docTypeId\?:/);

    const { canUploadSkill } = await import(SKILL_CONFIRM_MODULE);
    expect(canUploadSkill({ busy: false, selectedDocTypeId: "" })).toBe(true);
    expect(canUploadSkill({ busy: true, selectedDocTypeId: "dt_demo" })).toBe(false);
  });
});
