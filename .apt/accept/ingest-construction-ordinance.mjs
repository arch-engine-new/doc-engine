/**
 * Ingest 《建设工程质量管理条例》 (gov.cn 2019) into live standard_lib / Qdrant.
 * Does not call /api/demo/reset.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const base = process.env.APT_ACCEPT_BASE_URL || "http://localhost:5173";
const sourceFile = path.join(root, ".apt/accept/sources/construction-quality-management-ordinance.txt");
const sourceUrl = "https://www.gov.cn/gongbao/content/2019/content_5468867.htm";

async function api(pathname, opts = {}) {
  const res = await fetch(`${base}${pathname}`, {
    headers: { "content-type": "application/json; charset=utf-8", ...(opts.headers || {}) },
    ...opts,
  });
  const text = await res.text();
  let body = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(`${pathname} ${res.status}: ${text.slice(0, 600)}`);
  }
  return body;
}

const health = await api("/api/health");
const projects = await api("/api/projects");
const projectId = projects.projects?.[0]?.project_id;
if (!projectId) throw new Error("no project");
const packs = await api(`/api/projects/${projectId}/packs`);
const pack = packs.packs.find((row) => row.name === "空规范包") ?? packs.packs[0];
if (!pack) throw new Error("no pack");

const raw = readFileSync(sourceFile, "utf8");
const text = raw.replace(/^来源：.*$/m, "").replace(/^国务院公报.*$/m, "").trim();

const ingest = await api("/api/standards/ingest", {
  method: "POST",
  body: JSON.stringify({
    packId: pack.pack_id,
    title: "建设工程质量管理条例",
    fileUri: sourceUrl,
    text,
  }),
});

const versionId = ingest.version?.version_id;
const clauseCount = Array.isArray(ingest.clauses) ? ingest.clauses.length : 0;
if (!versionId) throw new Error("ingest missing version_id");

const bind = await api(`/api/packs/${pack.pack_id}/effective-version`, {
  method: "POST",
  body: JSON.stringify({ versionId }),
});

async function search(query) {
  const result = await api("/api/standards/search", {
    method: "POST",
    body: JSON.stringify({ packId: pack.pack_id, query }),
  });
  const hits = Array.isArray(result.hits) ? result.hits : [];
  return {
    query,
    count: hits.length,
    top: hits.slice(0, 3).map((h) => ({
      clause_id: h.clause_id,
      heading: h.heading,
      retrieve_path: h.retrieve_path,
      file_name: h.file_name,
      unit_id: h.unit_id,
      page_start: h.page_start,
      page_end: h.page_end,
      chunk_kind: h.chunk_kind,
      body: typeof h.body === "string" ? h.body.slice(0, 80) : h.body,
      standard_version_id: h.standard_version_id ?? h.version_id,
    })),
  };
}

const searches = [
  await search("第二条"),
  await search("偷工减料"),
  await search("肢解发包是什么"),
];

const qdrantRes = await fetch("http://127.0.0.1:6333/collections/clauses");
const qdrant = await qdrantRes.json();
const scrollRes = await fetch("http://127.0.0.1:6333/collections/clauses/points/scroll", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    limit: 20,
    with_payload: true,
    with_vector: false,
    filter: {
      must: [{ key: "file_name", match: { value: "content_5468867.htm" } }],
    },
  }),
});
const scroll = await scrollRes.json();

const evidence = {
  ranAt: new Date().toISOString(),
  sourceUrl,
  health,
  packId: pack.pack_id,
  versionId,
  clauseCount,
  bound: bind.pack?.effective_standard_version_id,
  qdrant: {
    points_count: qdrant.result?.points_count,
    vector_size: qdrant.result?.config?.params?.vectors?.size,
  },
  searches,
  samplePayloads: (scroll.result?.points ?? []).slice(0, 5).map((p) => ({
    id: p.id,
    unit_id: p.payload?.unit_id,
    file_name: p.payload?.file_name,
    chunk_kind: p.payload?.chunk_kind,
  })),
};

writeFileSync(path.join(root, ".apt/accept/evidence.json"), JSON.stringify(evidence, null, 2), "utf8");
console.log(JSON.stringify({
  packId: pack.pack_id,
  versionId,
  clauseCount,
  bound: evidence.bound,
  points: evidence.qdrant.points_count,
  dim: evidence.qdrant.vector_size,
  searches: searches.map((s) => ({ query: s.query, count: s.count, top: s.top[0]?.heading, path: s.top[0]?.retrieve_path })),
}, null, 2));
