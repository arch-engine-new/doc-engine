/**
 * AC-8: document-gaps scan vs CompletenessRule + artifact fill.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DemoHttpSession } from "../src/http/session.js";
import { handleDemoRequest } from "../src/http/handle-request.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "../../..");
const FIXTURE_XLSX = join(
  REPO_ROOT,
  "docs/fixtures/excel/concrete-inspection-batch-gb50204-template.xlsx",
);
const FIXTURE_MAPPING_JSON = join(
  REPO_ROOT,
  "docs/fixtures/excel/concrete-inspection-batch-cell-mapping.json",
);

async function call(
  session: DemoHttpSession,
  method: string,
  url: string,
  body?: unknown,
) {
  return handleDemoRequest(session, { method, url, body: body ?? {} });
}

describe("document-gaps (AC-8)", () => {
  let session: DemoHttpSession;

  beforeEach(() => {
    session = new DemoHttpSession();
  });

  afterEach(async () => {
    await session.close();
  });

  it("reports concrete inspection batch gap then clears after generate", async () => {
    const reset = await call(session, "POST", "/api/demo/reset");
    expect(reset.status).toBe(200);
    const resetBody = reset.body as {
      project: { project_id: string };
      pack: { pack_id: string };
    };
    const projectId = resetBody.project.project_id;
    const packId = resetBody.pack.pack_id;

    const rulesRes = await call(session, "GET", `/api/packs/${packId}/completeness-rules`);
    expect(rulesRes.status).toBe(200);
    const rules = (rulesRes.body as { rules: { doc_type_id: string; label: string; required: number }[] })
      .rules;
    expect(rules.length).toBeGreaterThan(0);
    const concreteRule = rules.find((rule) => rule.label.includes("混凝土"));
    expect(concreteRule).toBeTruthy();
    expect(concreteRule!.required).toBe(1);

    const gapsBefore = await call(session, "GET", `/api/projects/${projectId}/document-gaps`);
    expect(gapsBefore.status).toBe(200);
    const missingBefore = (gapsBefore.body as { missing: { doc_type_id: string; label: string }[] })
      .missing;
    expect(missingBefore.some((gap) => gap.doc_type_id === concreteRule!.doc_type_id)).toBe(true);

    const docTypes = await call(session, "GET", `/api/packs/${packId}/doc-types`);
    const concreteDocType = (
      docTypes.body as { docTypes: { doc_type_id: string; name: string }[] }
    ).docTypes.find((dt) => dt.doc_type_id === concreteRule!.doc_type_id);
    expect(concreteDocType).toBeTruthy();

    const templates = await call(session, "GET", `/api/packs/${packId}/templates`);
    const template = (
      templates.body as { templates: { template_id: string; doc_type_id: string }[] }
    ).templates.find((tpl) => tpl.doc_type_id === concreteRule!.doc_type_id);
    expect(template).toBeTruthy();

    const fixtureJson = JSON.parse(readFileSync(FIXTURE_MAPPING_JSON, "utf8")) as {
      sheet: string;
      fields: Array<{ fieldKey: string; cell: string; valueType: string }>;
    };
    const xlsxBytes = readFileSync(FIXTURE_XLSX);

    const uploadTpl = await handleDemoRequest(session, {
      method: "POST",
      url: `/api/templates/${template!.template_id}/excel-template`,
      body: {},
      multipart: {
        file: {
          bytes: new Uint8Array(xlsxBytes),
          fileName: "concrete-template.xlsx",
          mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
        fields: { excel_sheet_name: fixtureJson.sheet },
      },
    });
    expect(uploadTpl.status).toBe(200);

    const mappings = fixtureJson.fields
      .filter((field) => ["project_name", "strength_sampling_record"].includes(field.fieldKey))
      .map((field) => ({
        sheet_name: fixtureJson.sheet,
        cell: field.cell,
        field_key: field.fieldKey,
        value_type: field.valueType,
        signature_role: null,
      }));
    await call(session, "PUT", `/api/templates/${template!.template_id}/excel-mappings`, { mappings });

    const generate = await call(session, "POST", `/api/projects/${projectId}/documents/generate`, {
      docTypeId: concreteRule!.doc_type_id,
      templateId: template!.template_id,
      fieldValues: {
        project_name: "滨江综合体一期工程",
        strength_sampling_record: "C30混凝土试块留置1组。",
      },
    });
    expect(generate.status).toBe(200);

    const gapsAfter = await call(session, "GET", `/api/projects/${projectId}/document-gaps`);
    expect(gapsAfter.status).toBe(200);
    const missingAfter = (gapsAfter.body as { missing: { doc_type_id: string }[] }).missing;
    expect(missingAfter.some((gap) => gap.doc_type_id === concreteRule!.doc_type_id)).toBe(false);
  });

  it("PUT completeness-rules replaces pack rules", async () => {
    const reset = await call(session, "POST", "/api/demo/reset");
    const packId = (reset.body as { pack: { pack_id: string } }).pack.pack_id;
    const docTypes = await call(session, "GET", `/api/packs/${packId}/doc-types`);
    const docTypeId = (docTypes.body as { docTypes: { doc_type_id: string }[] }).docTypes[0]!
      .doc_type_id;

    const put = await call(session, "PUT", `/api/packs/${packId}/completeness-rules`, {
      rules: [{ doc_type_id: docTypeId, label: "自定义缺表", required: 1 }],
    });
    expect(put.status).toBe(200);
    expect((put.body as { rules: { label: string }[] }).rules[0]?.label).toBe("自定义缺表");
  });
});
