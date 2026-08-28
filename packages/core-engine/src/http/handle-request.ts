/**
 * In-process HTTP adapter around JobPipeline.
 *
 * Convention: JSON fields match ledger/row snake_case (job_id, trace_id, pack_id).
 * Request bodies also accept camelCase aliases. Chat never confirms, publishes, or submits.
 */

import { mockPendingMount, type FieldBoxWrite } from "../index.js";
import { DEMO_DICTS } from "./dicts.js";
import type { DemoHttpSession } from "./session.js";

export interface DemoHttpRequest {
  method: string;
  url: string;
  body: unknown;
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
  if (lower.includes("not found")) return json(404, { error: message });
  if (lower.includes("cannot confirm-next") || lower.includes("submit is not allowed")) {
    return json(409, { error: message });
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

export async function handleDemoRequest(
  session: DemoHttpSession,
  req: DemoHttpRequest,
): Promise<DemoHttpResponse> {
  const method = req.method.toUpperCase();
  const { pathname, query } = parseUrl(req.url);
  const p = session.pipeline;

  try {
    if (method === "GET" && pathname === "/api/health") {
      return json(200, await session.health());
    }

    if (method === "POST" && pathname === "/api/demo/reset") {
      return json(200, await session.reset());
    }

    if (method === "GET" && pathname === "/api/projects") {
      return json(200, { projects: await p.listProjects() });
    }
    if (method === "POST" && pathname === "/api/projects") {
      const name = str(req.body, "name") ?? "演示项目-夹具";
      return json(200, { project: await p.createProject(name) });
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
    const packOne = match(pathname, "/api/packs/:id");
    if (method === "GET" && packOne) {
      const pack = await p.getSpecPack(packOne.id);
      if (!pack) return json(404, { error: `spec pack not found: ${packOne.id}` });
      return json(200, { pack, templates: await p.listTemplates(packOne.id) });
    }
    if (method === "POST" && pathname === "/api/templates") {
      const packId = requireStr(req.body, "packId", "pack_id");
      if (!(await p.getSpecPack(packId))) return json(404, { error: `spec pack not found: ${packId}` });
      const template = await p.createTemplate({
        packId,
        name: str(req.body, "name") ?? "空包模板",
        pageImageUri: str(req.body, "pageImageUri", "page_image_uri"),
      });
      return json(200, { template });
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
    if (method === "POST" && pathname === "/api/standards/search") {
      const hits = await p.searchStandard({
        packId: requireStr(req.body, "packId", "pack_id"),
        query: requireStr(req.body, "query"),
        jobId: str(req.body, "jobId", "job_id"),
      });
      return json(200, { hits });
    }
    if (method === "POST" && pathname === "/api/standards/edges") {
      const kind = requireStr(req.body, "kind");
      await p.addStandardEdge({
        from: requireStr(req.body, "from"),
        to: requireStr(req.body, "to"),
        kind: kind as "CITES" | "SUPERSEDES" | "APPLIES_TO" | "REQUIRES",
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
      const jobRows = await p.listJobs();
      const jobs = [];
      for (const job of jobRows) {
        const document = await p.getDocumentForJob(job.job_id);
        jobs.push({ ...job, file_name: document?.file_name ?? null });
      }
      return json(200, { jobs });
    }

    if (method === "POST" && pathname === "/api/chat") {
      const result = await p.appendChat({
        traceId: requireStr(req.body, "traceId", "trace_id"),
        step: requireStr(req.body, "step"),
        body: requireStr(req.body, "body"),
        role: str(req.body, "role"),
      });
      return json(200, result);
    }

    const confirm = match(pathname, "/api/jobs/:id/confirm-next");
    if (method === "POST" && confirm) {
      return json(200, { job: await p.confirmNext(confirm.id) });
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
