/**
 * Ingest public highway laws via POST /api/standards/ingest (not seed packs).
 * Sources: NPC / MOT HTML already fetched to local files.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const base = process.env.APT_ACCEPT_BASE_URL || "http://127.0.0.1:5173";

const docs = [
  {
    title: "中华人民共和国公路法（2017年第五次修正）",
    fileUri: "https://www.npc.gov.cn/c2/c30834/201905/t20190521_278501.html",
    file: path.join(
      process.env.USERPROFILE || "",
      ".cursor/projects/d-software-doc-engine/agent-tools/c2b5a7fa-7fae-4118-b6e7-07a0948ae5a6.txt",
    ),
  },
  {
    title: "公路安全保护条例（国务院令第593号）",
    fileUri: "https://xxgk.mot.gov.cn/jigou/fgs/202006/t20200623_3307992.html",
    file: path.join(
      process.env.USERPROFILE || "",
      ".cursor/projects/d-software-doc-engine/agent-tools/3e745226-804f-42f1-afa9-1607680740b1.txt",
    ),
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
    headers: { "content-type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  const text = await res.text();
  let body = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) throw new Error(`${pathname} ${res.status}: ${text.slice(0, 400)}`);
  return body;
}

const health = await api("/api/health");
const reset = await api("/api/demo/reset", { method: "POST", body: "{}" });
const packId = reset.pack?.pack_id;
if (!packId) throw new Error("reset missing pack_id");

const ingested = [];
for (const doc of docs) {
  const raw = readFileSync(doc.file, "utf8");
  const text = clauseText(raw);
  const result = await api("/api/standards/ingest", {
    method: "POST",
    body: JSON.stringify({
      packId,
      title: doc.title,
      fileUri: doc.fileUri,
      text,
    }),
  });
  ingested.push({
    title: doc.title,
    source: doc.fileUri,
    docId: result.doc?.doc_id,
    versionId: result.version?.version_id,
    versionStatus: result.version?.status,
    clauseCount: result.clauses?.length ?? 0,
    layoutUnitCount: result.layoutUnits?.length ?? 0,
    tablesUnlinked: result.tablesUnlinked ?? 0,
    clauses: (result.clauses || []).map((c) => ({
      clause_id: c.clause_id,
      heading: c.heading,
    })),
  });
}

const queries = ["公路建设应当纳入国民经济", "农民负担", "建筑控制区", "交工验收"];
const searches = [];
for (const query of queries) {
  const res = await api("/api/standards/search", {
    method: "POST",
    body: JSON.stringify({ packId, query }),
  });
  searches.push({
    query,
    hitCount: res.hits?.length ?? 0,
    hits: (res.hits || []).slice(0, 5).map((h) => ({
      clause_id: h.clause_id,
      unit_id: h.unit_id,
      chunk_kind: h.chunk_kind,
      file_name: h.file_name,
      page_start: h.page_start,
      page_end: h.page_end,
      retrieve_path: h.retrieve_path,
    })),
  });
}

const inventory = {
  ingestedAt: new Date().toISOString(),
  baseUrl: base,
  engineMode: health.mode,
  packId,
  demoLeaveFixture: reset.standard
    ? {
        title: "员工请假说明（演示夹具，非公路包）",
        versionId: reset.standard.version?.version_id,
        clauseCount: reset.standard.clauses?.length ?? 0,
      }
    : null,
  note: "未入库 JTG/GB 等收费行业标准。本轮只写入人大网/交通运输部公开的法律法规，走 POST /api/standards/ingest，不改种子代码。memory 模式重启后清空。",
  documents: ingested,
  searches,
};

const outDir = path.join(root, ".apt/accept");
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, "rag-ingest-inventory.json"), JSON.stringify(inventory, null, 2), "utf8");

const md = [
  "# RAG 本轮录入清单",
  "",
  `- 时间：${inventory.ingestedAt}`,
  `- 引擎：${inventory.engineMode}（${base}） pack \`${packId}\``,
  `- ${inventory.note}`,
  "",
  "## 文档",
  "",
  "| 标题 | 来源 | 条款数 | version_id |",
  "|------|------|--------|------------|",
];
if (inventory.demoLeaveFixture) {
  md.push(
    `| ${inventory.demoLeaveFixture.title} | 演示重置夹具 | ${inventory.demoLeaveFixture.clauseCount} | \`${inventory.demoLeaveFixture.versionId}\` |`,
  );
}
for (const d of ingested) {
  md.push(`| ${d.title} | ${d.source} | ${d.clauseCount} | \`${d.versionId}\` |`);
}
md.push("", "## 检索抽查", "");
for (const s of searches) {
  md.push(`- **${s.query}** → ${s.hitCount} 条`);
  for (const h of s.hits) {
    md.push(`  - \`${h.clause_id ?? "—"}\` ${h.file_name} p${h.page_start} ${h.retrieve_path}`);
  }
}
writeFileSync(path.join(outDir, "RAG-INGEST-LIST.md"), md.join("\n"), "utf8");
console.log(JSON.stringify({ packId, mode: health.mode, docs: ingested.map((d) => ({ title: d.title, n: d.clauseCount })) }, null, 2));
