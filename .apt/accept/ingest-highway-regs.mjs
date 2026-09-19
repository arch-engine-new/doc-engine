/**
 * Ingest highway construction regulations. Does not call /api/demo/reset.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const base = process.env.APT_ACCEPT_BASE_URL || "http://localhost:5173";

const docs = [
  {
    title: "中华人民共和国公路法（2017年第五次修正）",
    fileUri: "http://www.npc.gov.cn/c2/c30834/201905/t20190521_278501.html",
    file: path.join(root, ".apt/accept/sources/highway-law-npc.txt"),
  },
  {
    title: "公路建设市场管理办法（交通运输部令2015年第11号）",
    fileUri: "https://xxgk.mot.gov.cn/2020/gz/202112/t20211228_3633687.html",
    file: path.join(root, ".apt/accept/sources/highway-construction-market-mot.txt"),
    bind: true,
  },
  {
    title: "农村公路建设管理办法（交通运输部令2018年第4号）",
    fileUri: "https://xxgk.mot.gov.cn/jigou/fgs/202006/t20200623_3307957.html",
    file: path.join(root, ".apt/accept/sources/rural-highway-mot.txt"),
  },
];

function clauseText(raw) {
  const lines = String(raw).split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    const t = line.trim();
    if (/^第.+条(?:\s|$)/.test(t) || out.length > 0) out.push(t);
  }
  return out.join("\n");
}

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
  if (!res.ok) throw new Error(`${pathname} ${res.status}: ${text.slice(0, 500)}`);
  return body;
}

const health = await api("/api/health");
const projects = await api("/api/projects");
const projectId = projects.projects?.[0]?.project_id;
if (!projectId) throw new Error("no project");
const packs = await api(`/api/projects/${projectId}/packs`);
const pack = packs.packs.find((row) => row.name === "空规范包") ?? packs.packs[0];
if (!pack) throw new Error("no pack");

const ingested = [];
let bindVersionId = null;
for (const doc of docs) {
  const text = clauseText(readFileSync(doc.file, "utf8"));
  const result = await api("/api/standards/ingest", {
    method: "POST",
    body: JSON.stringify({
      packId: pack.pack_id,
      title: doc.title,
      fileUri: doc.fileUri,
      text,
    }),
  });
  ingested.push({
    title: doc.title,
    source: doc.fileUri,
    versionId: result.version?.version_id,
    clauseCount: result.clauses?.length ?? 0,
  });
  if (doc.bind) bindVersionId = result.version?.version_id;
}

if (bindVersionId) {
  await api(`/api/packs/${pack.pack_id}/effective-version`, {
    method: "POST",
    body: JSON.stringify({ versionId: bindVersionId }),
  });
}

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
      body: typeof h.body === "string" ? h.body.slice(0, 80) : h.body,
    })),
  };
}

const searches = [
  await search("第二十四条"),
  await search("转包或者违法分包"),
  await search("公路建设应当纳入国民经济"),
];

const qdrantRes = await fetch("http://127.0.0.1:6333/collections/clauses");
const qdrant = await qdrantRes.json();

const evidence = {
  ranAt: new Date().toISOString(),
  scenario: "highway-construction-regs",
  health,
  packId: pack.pack_id,
  bound: bindVersionId,
  ingested,
  qdrant: {
    points_count: qdrant.result?.points_count,
    vector_size: qdrant.result?.config?.params?.vectors?.size,
  },
  searches,
};

writeFileSync(path.join(root, ".apt/accept/evidence.json"), JSON.stringify(evidence, null, 2), "utf8");
console.log(JSON.stringify({
  packId: pack.pack_id,
  bound: bindVersionId,
  ingested,
  points: evidence.qdrant.points_count,
  dim: evidence.qdrant.vector_size,
  searches: searches.map((s) => ({
    query: s.query,
    count: s.count,
    top: s.top[0]?.heading,
    path: s.top[0]?.retrieve_path,
  })),
}, null, 2));
