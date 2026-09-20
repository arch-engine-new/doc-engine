/**
 * In-process HTTP adapter around JobPipeline.
 *
 * Convention: JSON fields match ledger/row snake_case (job_id, trace_id, pack_id).
 * Request bodies also accept camelCase aliases. Chat never confirms, publishes, or submits.
 */

import { mockPendingMount, uploadDocument } from "../adapter/mock.js";
import type {
  CompletenessRuleWrite,
  ExcelCellMappingWrite,
  FieldBoxWrite,
  FieldFillRuleWrite,
} from "../persistence/store.js";
import { NoOpenHitlError } from "../agent/job-step-orchestrator.js";
import { isRetrieveChatStep, isSkillTeachStep } from "../agent/prompts.js";
import { packChatTraceId } from "../agent/context.js";
import {
  LedgerConflictError,
  SkillTrackConfirmNextError,
  UploadValidationError,
  type JobPipeline,
} from "../pipeline/job-pipeline.js";
import type { EdgeKind, RetrieveHit } from "../retrieve/ports.js";
import { createFetchHandler, getDefaultLlmProvider } from "agent-runtime";
import { DEMO_DICTS } from "./dicts.js";
import type { DemoHttpSession } from "./session.js";
import { UploadServiceUnavailableError } from "./session.js";
import { resolveJobsListTrack } from "../persistence/ledger.js";
import { runSkillJob, SkillConfirmGateError } from "../skill/load-index.js";

/**
 * Parsed multipart file for POST /api/jobs/upload — bytes stay binary so JPEG/PDF
 * are not corrupted by UTF-8 decoding in the Node adapter.
 */
export interface DemoHttpMultipartFile {
  bytes: Uint8Array;
  fileName: string;
  mime: string;
}

/**
 * Text fields from multipart/form-data. Snake_case matches ledger columns; HTTP
 * also accepts camelCase aliases when callers send projectId/packId/templateId.
 */
export interface DemoHttpMultipartFields {
  pack_id?: string;
  template_id?: string;
  doc_type_id?: string;
  project_id?: string;
  packId?: string;
  templateId?: string;
  docTypeId?: string;
  projectId?: string;
  excel_sheet_name?: string;
  excelSheetName?: string;
  trace_id?: string;
  traceId?: string;
  metadata?: string;
  metadata_json?: string;
  title?: string;
  /**
   * Omit for the default table Skill upload. Pass `legacy` only for leftover
   * fixture JPEG/PDF checks that still need DocType + DSL + confirm-next.
   */
  track?: string;
}

/**
 * Multipart payload when Content-Type is multipart/form-data. Populated by node.ts
 * so handleDemoRequest can route uploads without re-parsing the raw body.
 */
export interface DemoHttpMultipart {
  file?: DemoHttpMultipartFile;
  fields: DemoHttpMultipartFields;
}

export interface DemoHttpRequest {
  method: string;
  url: string;
  body: unknown;
  multipart?: DemoHttpMultipart;
}

export interface DemoHttpResponse {
  status: number;
  body: unknown;
}

type Params = Record<string, string>;

function json(status: number, body: unknown): DemoHttpResponse {
  return { status, body };
}

function isStoreOutage(lower: string): boolean {
  return (
    lower.includes("econnrefused") ||
    lower.includes("not configured") ||
    lower.includes("incomplete live engine") ||
    lower.includes("connect") ||
    lower.includes("neo4j") ||
    lower.includes("qdrant") ||
    lower.includes("timeout")
  );
}

function errorStatus(err: unknown): DemoHttpResponse {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  if (err instanceof UploadValidationError) return json(400, { error: message });
  if (err instanceof LedgerConflictError) return json(409, { error: message });
  if (err instanceof SkillTrackConfirmNextError) return json(409, { error: message });
  if (err instanceof SkillConfirmGateError) return json(409, { error: message });
  if (err instanceof UploadServiceUnavailableError) return json(503, { error: message });
  if (lower.includes("not found")) return json(404, { error: message });
  if (lower.includes("cannot confirm-next") || lower.includes("submit is not allowed")) {
    return json(409, { error: message });
  }
  if (lower.includes("no_open_hitl")) {
    return json(409, { error: "no_open_hitl" });
  }
  if (
    lower.includes("must be") ||
    lower.includes("required") ||
    lower.includes("is not effective") ||
    lower.includes("does not belong")
  ) {
    return json(400, { error: message });
  }
  if (isStoreOutage(lower)) return json(503, { error: message });
  return json(400, { error: message });
}

function parseUrl(url: string): { pathname: string; query: URLSearchParams } {
  const parsed = new URL(url, "http://demo.local");
  return { pathname: parsed.pathname.replace(/\/+$/, "") || "/", query: parsed.searchParams };
}

function match(pathname: string, pattern: string): Params | null {
  const pathParts = pathname.split("/").filter(Boolean);
  const patParts = pattern.split("/").filter(Boolean);
  if (pathParts.length !== patParts.length) return null;
  const params: Params = {};
  for (let i = 0; i < patParts.length; i++) {
    const part = patParts[i]!;
    const value = pathParts[i]!;
    if (part.startsWith(":")) params[part.slice(1)] = decodeURIComponent(value);
    else if (part !== value) return null;
  }
  return params;
}

function asRecord(body: unknown): Record<string, unknown> {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }
  return {};
}

function pick(body: unknown, ...keys: string[]): unknown {
  const rec = asRecord(body);
  for (const key of keys) {
    if (rec[key] !== undefined) return rec[key];
  }
  return undefined;
}

function str(body: unknown, ...keys: string[]): string | undefined {
  const value = pick(body, ...keys);
  if (value === undefined || value === null) return undefined;
  return String(value);
}

function requireStr(body: unknown, ...keys: string[]): string {
  const value = str(body, ...keys);
  if (!value) throw new Error(`missing ${keys[0]}`);
  return value;
}

/** Pass through Vue-posted ledger text; dropping string heading/body would leave chat with only ids. */
function optionalHitText(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function parseRetrieveHits(body: unknown): RetrieveHit[] | undefined {
  const raw = pick(body, "hits", "retrieve_hits");
  if (!Array.isArray(raw)) return undefined;
  const hits: RetrieveHit[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.unit_id !== "string" || typeof rec.file_name !== "string") continue;
    const path = rec.retrieve_path;
    hits.push({
      clause_id: typeof rec.clause_id === "string" ? rec.clause_id : null,
      unit_id: rec.unit_id,
      chunk_kind: rec.chunk_kind === "table" || rec.chunk_kind === "annex" ? rec.chunk_kind : "clause",
      file_name: rec.file_name,
      page_start: Number(rec.page_start) || 0,
      page_end: Number(rec.page_end) || 0,
      standard_version_id: String(rec.standard_version_id ?? ""),
      span: null,
      retrieve_path: path === "vector" || path === "graph" || path === "exact" ? path : "exact",
      heading: optionalHitText(rec.heading),
      body: optionalHitText(rec.body),
    });
  }
  return hits;
}

const STANDARD_EDGE_KINDS: readonly EdgeKind[] = [
  "CITES",
  "SUPERSEDES",
  "APPLIES_TO",
  "REQUIRES",
  "SUPPORTS",
  "PARENT_OF",
  "BELONGS_TO",
];

/** HTTP used to reject layout kinds; SUPPORTS/PARENT_OF/BELONGS_TO are first-class ingest edges. */
function parseStandardEdgeKind(kind: string): EdgeKind {
  if ((STANDARD_EDGE_KINDS as readonly string[]).includes(kind)) return kind as EdgeKind;
  throw new Error(`unsupported edge kind: ${kind}`);
}

/**
 * ingest-pdf is not Job upload: no 4MB gate. 202 returns before any page OCR.
 */
async function startPdfIngest(pipeline: JobPipeline, req: DemoHttpRequest): Promise<{ ingest_run_id: string }> {
  const mp = req.multipart;
  if (!mp?.file) throw new Error("multipart file field required");
  const packId = mp.fields.pack_id ?? mp.fields.packId;
  const title = mp.fields.title;
  if (!packId) throw new Error("pack_id is required");
  if (!title) throw new Error("title is required");
  const started = await pipeline.startStandardPdfIngest({
    packId,
    title,
    fileName: mp.file.fileName,
    bytes: mp.file.bytes,
  });
  return { ingest_run_id: started.ingest_run_id };
}

function parseTree(treeJson: string | null | undefined): { submitted: false } & Record<string, unknown> {
  let parsed: Record<string, unknown> = {};
  if (treeJson) {
    try {
      const value: unknown = JSON.parse(treeJson);
      if (value && typeof value === "object" && !Array.isArray(value)) {
        parsed = value as Record<string, unknown>;
      }
    } catch {
      parsed = {};
    }
  }
  return { ...parsed, submitted: false };
}

function boxesFromBody(body: unknown): FieldBoxWrite[] {
  const rec = asRecord(body);
  const raw = Array.isArray(body) ? body : rec.boxes;
  if (!Array.isArray(raw)) throw new Error("boxes array required");
  return raw.map((item) => {
    const row = asRecord(item);
    return {
      field_key: String(row.field_key ?? row.fieldKey ?? ""),
      value_type: String(row.value_type ?? row.valueType ?? "string"),
      page: Number(row.page ?? 1),
      x: String(row.x ?? "0"),
      y: String(row.y ?? "0"),
      w: String(row.w ?? "0"),
      h: String(row.h ?? "0"),
    };
  });
}

function fieldDefsFromBody(body: unknown): Array<{
  field_key: string;
  value_type: string;
  required?: number;
}> {
  const rec = asRecord(body);
  const raw = Array.isArray(body) ? body : rec.fieldDefs ?? rec.field_defs ?? rec.defs;
  if (!Array.isArray(raw)) throw new Error("field defs array required");
  return raw.map((item) => {
    const row = asRecord(item);
    return {
      field_key: String(row.field_key ?? row.fieldKey ?? ""),
      value_type: String(row.value_type ?? row.valueType ?? "string"),
      required: row.required === undefined ? 0 : Number(row.required),
    };
  });
}

function excelMappingsFromBody(body: unknown): ExcelCellMappingWrite[] {
  const rec = asRecord(body);
  const raw = Array.isArray(body) ? body : rec.mappings;
  if (!Array.isArray(raw)) throw new Error("mappings array required");
  return raw.map((item) => {
    const row = asRecord(item);
    const roleRaw = row.signature_role ?? row.signatureRole;
    return {
      sheet_name: String(row.sheet_name ?? row.sheetName ?? ""),
      cell: String(row.cell ?? ""),
      field_key: String(row.field_key ?? row.fieldKey ?? ""),
      value_type: String(row.value_type ?? row.valueType ?? "string"),
      signature_role:
        roleRaw === undefined || roleRaw === null || roleRaw === "" ? null : String(roleRaw),
    };
  });
}

function fillRulesFromBody(body: unknown): FieldFillRuleWrite[] {
  const rec = asRecord(body);
  const raw = Array.isArray(body) ? body : rec.rules;
  if (!Array.isArray(raw)) throw new Error("rules array required");
  return raw.map((item) => {
    const row = asRecord(item);
    return {
      field_key: String(row.field_key ?? row.fieldKey ?? ""),
      required: row.required === undefined ? 0 : Number(row.required),
      pattern: row.pattern == null || row.pattern === "" ? null : String(row.pattern),
      min_num: optionalBodyStr(row.min_num ?? row.minNum),
      max_num: optionalBodyStr(row.max_num ?? row.maxNum),
      default_generator:
        row.default_generator ?? row.defaultGenerator
          ? String(row.default_generator ?? row.defaultGenerator)
          : null,
      default_literal:
        row.default_literal ?? row.defaultLiteral
          ? String(row.default_literal ?? row.defaultLiteral)
          : null,
    };
  });
}

/** Empty / missing JSON fields become null so they match FieldFillRuleWrite string | null. */
function optionalBodyStr(value: unknown): string | null {
  return value == null || value === "" ? null : String(value);
}

function completenessRulesFromBody(body: unknown): CompletenessRuleWrite[] {
  const rec = asRecord(body);
  const raw = Array.isArray(body) ? body : rec.rules;
  if (!Array.isArray(raw)) throw new Error("rules array required");
  return raw.map((item) => {
    const row = asRecord(item);
    return {
      rule_id: row.rule_id ?? row.ruleId ? String(row.rule_id ?? row.ruleId) : undefined,
      doc_type_id: String(row.doc_type_id ?? row.docTypeId ?? ""),
      label: String(row.label ?? ""),
      required: row.required === undefined ? 1 : Number(row.required),
    };
  });
}

function fieldValuesFromBody(body: unknown): Record<string, string | number | boolean | null> {
  const rec = asRecord(body);
  const raw = pick(body, "fieldValues", "field_values");
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === null) {
      out[key] = null;
    } else if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      out[key] = value;
    } else {
      out[key] = String(value);
    }
  }
  return out;
}

/**
 * WHY: Demo HTTP is what check_findings / pending_review / volume_preview call.
 * GET /api/jobs therefore defaults to leftover `track=legacy` so Skill uploads
 * never mix into those lists (M16/R28/D12). GET /api/jobs/:id stays unfiltered
 * so the Skill workbench can still load a job by id.
 */
export async function handleDemoRequest(
  session: DemoHttpSession,
  req: DemoHttpRequest,
): Promise<DemoHttpResponse> {
  const method = req.method.toUpperCase();
  const { pathname, query } = parseUrl(req.url);
  const p = session.pipeline;

  try {
    if (method === "GET" && pathname === "/api/health") {
      const health = await session.health();
      // Live MinIO is required object storage; fail is BLOCKED, not skip-as-green 200.
      if (health.mode === "live" && health.minio === "fail") {
        return json(503, health);
      }
      return json(200, health);
    }

    if (method === "POST" && pathname === "/api/demo/reset") {
      return json(200, await session.reset());
    }

    if (pathname.startsWith("/api/agent")) {
      const factory = await session.getAgentRuntimeFactory();
      const handler = createFetchHandler(factory.plane, { basePath: "/api/agent" });
      const url = new URL(req.url, "http://demo.local");
      const headers = new Headers({ "content-type": "application/json" });
      const init: RequestInit = { method, headers };
      if (method !== "GET" && method !== "HEAD" && req.body !== undefined) {
        init.body = JSON.stringify(req.body ?? {});
      }
      const response = await handler(new Request(url.toString(), init));
      const text = await response.text();
      let body: unknown = text;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = text;
      }
      return json(response.status, body);
    }

    if (method === "GET" && pathname === "/api/projects") {
      return json(200, { projects: await p.listProjects() });
    }
    if (method === "POST" && pathname === "/api/projects") {
      const name = str(req.body, "name") ?? "演示项目-夹具";
      return json(200, { project: await p.createProject(name) });
    }

    const projectOne = match(pathname, "/api/projects/:projectId");
    if (projectOne) {
      if (method === "PATCH") {
        const name = requireStr(req.body, "name");
        return json(200, { project: await p.updateProject(projectOne.projectId, name) });
      }
      if (method === "DELETE") {
        return json(200, { project: await p.deleteProject(projectOne.projectId) });
      }
    }

    const packs = match(pathname, "/api/projects/:projectId/packs");
    if (method === "GET" && packs) {
      const packRows = await p.listSpecPacks(packs.projectId);
      const listed = [];
      for (const pack of packRows) {
        listed.push({
          ...pack,
          templates: await p.listTemplates(pack.pack_id),
        });
      }
      return json(200, { packs: listed });
    }
    if (method === "POST" && pathname === "/api/packs") {
      const pack = await p.createSpecPack({
        projectId: requireStr(req.body, "projectId", "project_id"),
        name: requireStr(req.body, "name"),
        version: str(req.body, "version") ?? "0",
      });
      return json(200, { pack });
    }

    const packTemplates = match(pathname, "/api/packs/:id/templates");
    if (method === "GET" && packTemplates) {
      const pack = await p.getSpecPack(packTemplates.id);
      if (!pack) return json(404, { error: `spec pack not found: ${packTemplates.id}` });
      return json(200, { templates: await p.listTemplates(packTemplates.id) });
    }

    const packDocTypes = match(pathname, "/api/packs/:packId/doc-types");
    if (method === "GET" && packDocTypes) {
      const pack = await p.getSpecPack(packDocTypes.packId);
      if (!pack) return json(404, { error: `spec pack not found: ${packDocTypes.packId}` });
      const docTypes = await p.listDocTypes(packDocTypes.packId);
      const byId = new Map(docTypes.map((dt) => [dt.doc_type_id, dt]));
      const enriched = [];
      for (const dt of docTypes) {
        const templates = await p.listTemplatesByDocType(dt.doc_type_id);
        enriched.push({
          ...dt,
          parent_name: dt.parent_doc_type_id
            ? (byId.get(dt.parent_doc_type_id)?.name ?? null)
            : null,
          template_count: templates.length,
        });
      }
      return json(200, { docTypes: enriched });
    }

    const packCompletenessRules = match(pathname, "/api/packs/:packId/completeness-rules");
    if (packCompletenessRules) {
      const pack = await p.getSpecPack(packCompletenessRules.packId);
      if (!pack) return json(404, { error: `spec pack not found: ${packCompletenessRules.packId}` });
      if (method === "GET") {
        return json(200, {
          rules: await session.ledger().listCompletenessRules(packCompletenessRules.packId),
        });
      }
      if (method === "PUT") {
        return json(200, {
          rules: await session.ledger().saveCompletenessRules(
            packCompletenessRules.packId,
            completenessRulesFromBody(req.body),
          ),
        });
      }
    }

    if (method === "POST" && pathname === "/api/doc-types") {
      const packId = requireStr(req.body, "packId", "pack_id");
      if (!(await p.getSpecPack(packId))) return json(404, { error: `spec pack not found: ${packId}` });
      const parentRaw = pick(req.body, "parentDocTypeId", "parent_doc_type_id");
      const docType = await p.createDocType({
        packId,
        name: requireStr(req.body, "name"),
        parentDocTypeId:
          parentRaw === undefined || parentRaw === null || parentRaw === ""
            ? null
            : String(parentRaw),
      });
      return json(200, { docType });
    }

    const docTypeFieldDefs = match(pathname, "/api/doc-types/:id/field-defs");
    if (docTypeFieldDefs) {
      const docType = await p.getDocType(docTypeFieldDefs.id);
      if (!docType) return json(404, { error: `doc type not found: ${docTypeFieldDefs.id}` });
      if (method === "GET") {
        return json(200, { fieldDefs: await p.listFieldDefs(docTypeFieldDefs.id) });
      }
      if (method === "PUT") {
        return json(200, {
          fieldDefs: await p.saveFieldDefs(docTypeFieldDefs.id, fieldDefsFromBody(req.body)),
        });
      }
    }

    const docTypeFillRules = match(pathname, "/api/doc-types/:id/fill-rules");
    if (docTypeFillRules) {
      const docType = await p.getDocType(docTypeFillRules.id);
      if (!docType) return json(404, { error: `doc type not found: ${docTypeFillRules.id}` });
      if (method === "GET") {
        return json(200, { rules: await session.ledger().listFieldFillRules(docTypeFillRules.id) });
      }
      if (method === "PUT") {
        return json(200, {
          rules: await session.ledger().saveFieldFillRules(
            docTypeFillRules.id,
            fillRulesFromBody(req.body),
          ),
        });
      }
    }

    const docTypeOne = match(pathname, "/api/doc-types/:id");
    if (docTypeOne) {
      if (method === "PATCH") {
        const name = requireStr(req.body, "name");
        return json(200, { docType: await p.updateDocType(docTypeOne.id, name) });
      }
      if (method === "DELETE") {
        return json(200, { docType: await p.deleteDocType(docTypeOne.id) });
      }
    }

    const groupKeys = match(pathname, "/api/packs/:id/group-keys");
    if (method === "POST" && groupKeys) {
      const raw = pick(req.body, "groupKeys", "group_keys") ?? [];
      const keys = Array.isArray(raw)
        ? raw.map((item) => String(item))
        : String(raw)
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
      const orderRaw = pick(req.body, "orderKey", "order_key");
      const orderKey =
        orderRaw === undefined || orderRaw === null || orderRaw === "" ? null : String(orderRaw);
      return json(200, { pack: await p.setGroupKeys(groupKeys.id, keys, orderKey) });
    }
    const packSkills = match(pathname, "/api/packs/:id/skills");
    if (method === "GET" && packSkills) {
      return json(200, { skills: await p.listSkillRecords(packSkills.id) });
    }

    const packOne = match(pathname, "/api/packs/:id");
    if (packOne) {
      if (method === "GET") {
        const pack = await p.getSpecPack(packOne.id);
        if (!pack) return json(404, { error: `spec pack not found: ${packOne.id}` });
        return json(200, { pack, templates: await p.listTemplates(packOne.id) });
      }
      if (method === "PATCH") {
        const name = requireStr(req.body, "name");
        return json(200, { pack: await p.updateSpecPack(packOne.id, name) });
      }
      if (method === "DELETE") {
        return json(200, { pack: await p.deleteSpecPack(packOne.id) });
      }
    }
    if (method === "POST" && pathname === "/api/templates") {
      const packId = requireStr(req.body, "packId", "pack_id");
      if (!(await p.getSpecPack(packId))) return json(404, { error: `spec pack not found: ${packId}` });
      const template = await p.createTemplate({
        packId,
        name: str(req.body, "name") ?? "空包模板",
        pageImageUri: str(req.body, "pageImageUri", "page_image_uri"),
        docTypeId: str(req.body, "docTypeId", "doc_type_id"),
      });
      return json(200, { template });
    }

    const effectiveBoxes = match(pathname, "/api/templates/:id/effective-boxes");
    if (method === "GET" && effectiveBoxes) {
      const template = await p.getTemplate(effectiveBoxes.id);
      if (!template) return json(404, { error: `template not found: ${effectiveBoxes.id}` });
      return json(200, { boxes: await p.listEffectiveBoxes(effectiveBoxes.id) });
    }

    const boxes = match(pathname, "/api/templates/:id/boxes");
    if (boxes) {
      const template = await p.getTemplate(boxes.id);
      if (!template) return json(404, { error: `template not found: ${boxes.id}` });
      if (method === "GET") return json(200, { boxes: await p.listFieldBoxes(boxes.id) });
      if (method === "PUT") {
        return json(200, { boxes: await p.saveFieldBoxes(boxes.id, boxesFromBody(req.body)) });
      }
    }

    const excelTemplate = match(pathname, "/api/templates/:id/excel-template");
    if (method === "POST" && excelTemplate) {
      const mp = req.multipart;
      if (!mp?.file) throw new Error("multipart file field required");
      const sheetRaw = mp.fields.excel_sheet_name ?? mp.fields.excelSheetName;
      const template = await session.uploadExcelTemplate(
        excelTemplate.id,
        mp.file,
        sheetRaw ? String(sheetRaw) : undefined,
      );
      return json(200, { template });
    }

    const excelMappings = match(pathname, "/api/templates/:id/excel-mappings");
    if (excelMappings) {
      const template = await p.getTemplate(excelMappings.id);
      if (!template) return json(404, { error: `template not found: ${excelMappings.id}` });
      if (template.layout_kind !== "excel") {
        return json(400, { error: `template ${excelMappings.id} layout_kind must be excel` });
      }
      if (method === "GET") {
        return json(200, {
          mappings: await session.ledger().listExcelCellMappings(excelMappings.id),
        });
      }
      if (method === "PUT") {
        return json(200, {
          mappings: await session.ledger().saveExcelCellMappings(
            excelMappings.id,
            excelMappingsFromBody(req.body),
          ),
        });
      }
    }

    const template = match(pathname, "/api/templates/:id");
    if (method === "GET" && template) {
      const row = await p.getTemplate(template.id);
      if (!row) return json(404, { error: `template not found: ${template.id}` });
      return json(200, { template: row });
    }

    if (method === "POST" && pathname === "/api/rules/draft") {
      const result = await p.saveDraft({
        packId: requireStr(req.body, "packId", "pack_id"),
        title: str(req.body, "title") ?? null,
        dsl: pick(req.body, "dsl") ?? {},
        blocking: pick(req.body, "blocking") === undefined ? 1 : Number(pick(req.body, "blocking")),
      });
      return json(200, result);
    }

    const runFx = match(pathname, "/api/rules/:versionId/run-fixtures");
    if (method === "POST" && runFx) {
      return json(200, { fixtures: await p.runFixtures(runFx.versionId) });
    }
    const addFx = match(pathname, "/api/rules/:versionId/fixtures");
    if (method === "POST" && addFx) {
      const kind = requireStr(req.body, "kind");
      if (kind !== "pass" && kind !== "fail") throw new Error("fixture kind must be pass|fail");
      const payloadRaw = pick(req.body, "payload") ?? {};
      const payload =
        payloadRaw && typeof payloadRaw === "object" && !Array.isArray(payloadRaw)
          ? (payloadRaw as Record<string, unknown>)
          : {};
      const fixture = await p.addFixture({
        versionId: addFx.versionId,
        kind,
        payload,
      });
      return json(200, { fixture });
    }
    const publish = match(pathname, "/api/rules/:versionId/publish");
    if (method === "POST" && publish) {
      return json(200, await p.publish(publish.versionId));
    }

    if (method === "POST" && pathname === "/api/standards/ingest") {
      const result = await p.ingestStandard({
        packId: requireStr(req.body, "packId", "pack_id"),
        title: requireStr(req.body, "title"),
        fileUri: requireStr(req.body, "fileUri", "file_uri"),
        text: requireStr(req.body, "text"),
        versionId: str(req.body, "versionId", "version_id"),
        status: str(req.body, "status"),
      });
      return json(200, result);
    }
    if (method === "POST" && pathname === "/api/standards/ingest-pdf") {
      return json(202, await startPdfIngest(p, req));
    }
    const ingestTick = match(pathname, "/api/standards/ingest-runs/:id/tick");
    if (method === "POST" && ingestTick) {
      return json(200, await p.tickStandardIngest(ingestTick.id));
    }
    // WHY: standard_lib retrieval stays (D4/M11). Skill upload/teach/confirm
    // must not call searchStandard; this route is the library page, not processing.
    if (method === "POST" && pathname === "/api/standards/search") {
      const hits = await p.searchStandard({
        packId: requireStr(req.body, "packId", "pack_id"),
        query: requireStr(req.body, "query"),
        jobId: str(req.body, "jobId", "job_id"),
      });
      return json(200, { hits });
    }
    if (method === "POST" && pathname === "/api/standards/edges") {
      const kind = parseStandardEdgeKind(requireStr(req.body, "kind"));
      await p.addStandardEdge({
        from: requireStr(req.body, "from"),
        to: requireStr(req.body, "to"),
        kind,
      });
      return json(200, { ok: true });
    }
    const effective = match(pathname, "/api/packs/:id/effective-version");
    if (method === "POST" && effective) {
      const pack = await p.bindEffectiveVersion(
        effective.id,
        requireStr(req.body, "versionId", "version_id"),
      );
      return json(200, { pack });
    }

    if (method === "POST" && pathname === "/api/jobs/upload") {
      const mp = req.multipart;
      if (!mp?.file) throw new Error("multipart file field required");
      const fields = mp.fields;
      const result = await session.openUploadJob({
        projectId: fields.project_id ?? fields.projectId,
        packId: fields.pack_id ?? fields.packId,
        template_id: fields.template_id ?? fields.templateId,
        doc_type_id: fields.doc_type_id ?? fields.docTypeId,
        fileName: mp.file.fileName,
        mime: mp.file.mime,
        bytes: mp.file.bytes,
        track: fields.track === "legacy" ? "legacy" : undefined,
      });
      return json(200, result);
    }

    if (method === "POST" && pathname === "/api/jobs/fixture") {
      const kind = requireStr(req.body, "kind");
      if (kind !== "ok" && kind !== "reversed") throw new Error("kind must be ok|reversed");
      const result = await p.runFixtureJob({
        kind,
        template_id: str(req.body, "template_id", "templateId"),
      });
      return json(200, result);
    }
    if (method === "GET" && pathname === "/api/jobs") {
      const track = resolveJobsListTrack(query.get("track"));
      const jobRows = await session.ledger().listJobs({ track });
      const jobs = [];
      for (const job of jobRows) {
        const document = await p.getDocumentForJob(job.job_id);
        jobs.push({ ...job, file_name: document?.file_name ?? null });
      }
      return json(200, { jobs });
    }
    const jobOne = match(pathname, "/api/jobs/:id");
    if (method === "GET" && jobOne) {
      const job = await p.getJob(jobOne.id);
      if (!job) return json(404, { error: `job not found: ${jobOne.id}` });
      const document = await p.getDocumentForJob(job.job_id);
      return json(200, { job: { ...job, file_name: document?.file_name ?? null } });
    }

    if (method === "POST" && pathname === "/api/chat") {
      const step = requireStr(req.body, "step");
      const body = requireStr(req.body, "body");
      const packId = str(req.body, "packId", "pack_id");
      let traceId = str(req.body, "traceId", "trace_id");
      if (!traceId) {
        if (isRetrieveChatStep(step) && packId) {
          traceId = packChatTraceId(packId);
        } else {
          throw new Error("missing trace_id");
        }
      }
      const hits = parseRetrieveHits(req.body);
      const userResult = await p.appendChat({
        traceId,
        step,
        body,
        role: str(req.body, "role") ?? "operator",
      });
      const bridge = await session.getStepChatBridge();
      const agent = await bridge.reply({
        traceId,
        step,
        userMessage: body,
        packId,
        hits,
      });
      const assistantStored = await p.appendChat({
        traceId,
        step,
        body: agent.reply,
        role: "assistant",
      });
      return json(200, {
        ...userResult,
        assistant_reply: agent.reply,
        agent_run_id: agent.agentRunId,
        proposal_id: agent.proposalId ?? null,
        assistant_message: assistantStored.message,
        ...(isSkillTeachStep(step) && agent.skill_summary
          ? { skill_summary: agent.skill_summary }
          : {}),
      });
    }

    const skillDryRun = match(pathname, "/api/jobs/:id/skill-dry-run");
    if (method === "POST" && skillDryRun) {
      const result = await runSkillJob({
        persist: false,
        jobId: skillDryRun.id,
        ledger: session.ledger(),
        blob: session.blobStore(),
        llm: getDefaultLlmProvider(),
        selectedSkillId: str(req.body, "selected_skill_id", "selectedSkillId") ?? null,
        fieldValues: fieldValuesFromBody(req.body),
      });
      return json(200, result.preview);
    }
    const confirmSkill = match(pathname, "/api/jobs/:id/confirm-skill");
    if (method === "POST" && confirmSkill) {
      const result = await runSkillJob({
        persist: true,
        jobId: confirmSkill.id,
        ledger: session.ledger(),
        blob: session.blobStore(),
        llm: getDefaultLlmProvider(),
        selectedSkillId: str(req.body, "selected_skill_id", "selectedSkillId") ?? null,
        fieldValues: fieldValuesFromBody(req.body),
      });
      return json(200, {
        job: result.job,
        skill: result.skill,
        ledger: result.ledger,
        ...result.preview,
      });
    }

    const confirm = match(pathname, "/api/jobs/:id/confirm-next");
    if (method === "POST" && confirm) {
      const existing = await p.getJob(confirm.id);
      if (existing?.track === "skill") {
        return json(409, { error: "cannot confirm-next from track=skill" });
      }
      try {
        const orchestrator = await session.getJobStepOrchestrator();
        const job = await orchestrator.resumeConfirm(confirm.id);
        return json(200, { job });
      } catch (err) {
        if (err instanceof SkillTrackConfirmNextError) {
          return json(409, { error: err.message });
        }
        if (err instanceof NoOpenHitlError) {
          return json(409, { error: "no_open_hitl" });
        }
        throw err;
      }
    }

    const findings = match(pathname, "/api/jobs/:id/findings");
    if (method === "GET" && findings) {
      if (!(await p.getJob(findings.id))) return json(404, { error: `job not found: ${findings.id}` });
      return json(200, { findings: await p.listFindings(findings.id) });
    }
    const extraction = match(pathname, "/api/jobs/:id/extraction");
    if (method === "GET" && extraction) {
      if (!(await p.getJob(extraction.id))) return json(404, { error: `job not found: ${extraction.id}` });
      const row = await p.getExtraction(extraction.id);
      return json(200, { extraction: row });
    }
    const volume = match(pathname, "/api/jobs/:id/volume");
    if (volume) {
      if (!(await p.getJob(volume.id))) return json(404, { error: `job not found: ${volume.id}` });
      if (method === "POST") {
        const result = await p.previewVolume(volume.id);
        return json(200, { preview: result.preview, tree: { ...result.tree, submitted: false } });
      }
      if (method === "GET") {
        const preview = await p.getVolumePreview(volume.id);
        if (!preview) return json(404, { error: `volume preview not found: ${volume.id}` });
        return json(200, { preview, tree: parseTree(preview.tree_json) });
      }
    }

    if (method === "GET" && pathname === "/api/proposals") {
      const jobId = query.get("jobId") ?? query.get("job_id") ?? undefined;
      return json(200, { proposals: await p.listPending(jobId ?? undefined) });
    }

    const generateDoc = match(pathname, "/api/projects/:projectId/documents/generate");
    if (method === "POST" && generateDoc) {
      const docPipeline = session.getDocumentPipeline();
      const artifact = await docPipeline.generateArtifact({
        projectId: generateDoc.projectId,
        docTypeId: requireStr(req.body, "docTypeId", "doc_type_id"),
        templateId: str(req.body, "templateId", "template_id"),
        fieldValues: fieldValuesFromBody(req.body),
        traceId: str(req.body, "traceId", "trace_id"),
      });
      return json(200, { artifact });
    }

    const documentGaps = match(pathname, "/api/projects/:projectId/document-gaps");
    if (method === "GET" && documentGaps) {
      if (!(await session.ledger().getProject(documentGaps.projectId))) {
        return json(404, { error: `project not found: ${documentGaps.projectId}` });
      }
      const gaps = await session.getDocumentPipeline().listDocumentGaps(documentGaps.projectId);
      return json(200, gaps);
    }

    const uploadDoc = match(pathname, "/api/projects/:projectId/documents/:artifactId/upload");
    if (method === "POST" && uploadDoc) {
      const artifact = await session.ledger().getDocumentArtifact(uploadDoc.artifactId);
      if (!artifact || artifact.project_id !== uploadDoc.projectId) {
        return json(404, { error: `artifact not found: ${uploadDoc.artifactId}` });
      }
      const result = await session.getDocumentPipeline().uploadArtifact(uploadDoc.artifactId);
      return json(200, result);
    }

    if (method === "GET" && pathname === "/api/pending/signatures") {
      const tasks = await session.getDocumentPipeline().listPendingSignatures();
      return json(200, { tasks });
    }

    const confirmSignature = match(pathname, "/api/signature-tasks/:id/confirm");
    if (method === "POST" && confirmSignature) {
      const signerName = requireStr(req.body, "signerName", "signer_name");
      const result = await session
        .getDocumentPipeline()
        .confirmSignatureTask(confirmSignature.id, signerName);
      return json(200, result);
    }
    const confirmProposal = match(pathname, "/api/proposals/:id/confirm");
    if (method === "POST" && confirmProposal) {
      return json(200, await p.confirmProposal(confirmProposal.id));
    }
    const proposal = match(pathname, "/api/proposals/:id");
    if (method === "PATCH" && proposal) {
      return json(200, { proposal: await p.editWording(proposal.id, requireStr(req.body, "wording")) });
    }

    const chats = match(pathname, "/api/audit/:traceId/chats");
    if (method === "GET" && chats) {
      return json(200, {
        threads: await p.listThreads(chats.traceId),
        messages: await p.listMessagesByTrace(chats.traceId),
      });
    }
    const audit = match(pathname, "/api/audit/:traceId");
    if (method === "GET" && audit) {
      return json(200, { events: await p.listAudit(audit.traceId) });
    }

    if (method === "POST" && pathname === "/adapter/pending-mount") {
      return json(200, mockPendingMount());
    }

    if (method === "POST" && pathname === "/adapter/documents/upload") {
      const mp = req.multipart;
      if (!mp?.file) throw new Error("multipart file field required");
      const fields = mp.fields;
      const projectId = fields.project_id ?? fields.projectId;
      const docTypeId = fields.doc_type_id ?? fields.docTypeId;
      const traceId = fields.trace_id ?? fields.traceId;
      if (!projectId || !docTypeId || !traceId) {
        throw new Error("project_id, doc_type_id, and trace_id are required");
      }
      let metadata: unknown = undefined;
      const metadataRaw = fields.metadata ?? fields.metadata_json;
      if (metadataRaw) {
        try {
          metadata = JSON.parse(String(metadataRaw));
        } catch {
          metadata = metadataRaw;
        }
      }
      const result = uploadDocument({
        projectId: String(projectId),
        docTypeId: String(docTypeId),
        buffer: mp.file.bytes,
        metadata,
        traceId: String(traceId),
      });
      return json(200, result);
    }

    const dict = match(pathname, "/api/dict/:dictType");
    if (method === "GET" && dict) {
      const items = DEMO_DICTS[dict.dictType];
      if (!items) return json(404, { error: `unknown dictType: ${dict.dictType}` });
      return json(200, { dictType: dict.dictType, items });
    }

    return json(404, { error: `no route ${method} ${pathname}` });
  } catch (err) {
    return errorStatus(err);
  }
}
