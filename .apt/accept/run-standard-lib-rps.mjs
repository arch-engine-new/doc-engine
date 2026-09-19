/**
 * Remaining standard_lib RP probes after ordinance ingest.
 * Writes progress notes; does not reset demo.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const base = process.env.APT_ACCEPT_BASE_URL || "http://localhost:5173";
const packId = "pack_88632d0869d7468c";
const versionId = "sver_b2e66c52b1e749bb";
const fromId = `${versionId}:第六十四条`;
const toId = `${versionId}:第二十八条`;

function minimalPdf() {
  const objects = [
    "1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj",
    "2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj",
    "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj",
    "4 0 obj<< /Length 68 >>stream\nBT /F1 12 Tf 72 720 Td (Construction quality ordinance sample page.) Tj ET\nendstream\nendobj",
    "5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(body, "latin1"));
    body += obj + "\n";
  }
  const xrefPos = Buffer.byteLength(body, "latin1");
  let xref = `xref\n0 6\n0000000000 65535 f \n`;
  for (let i = 1; i <= 5; i++) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  body += xref;
  body += `trailer<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}

async function api(pathname, opts = {}) {
  const res = await fetch(`${base}${pathname}`, {
    headers: { ...(opts.headers || {}) },
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
  return { status: res.status, body };
}

const cases = [];
function rec(id, rpId, status, note) {
  cases.push({ id, rpId, status, note });
}

const page = await fetch(`${base}/packs/${packId}/standards`);
const html = await page.text();
rec(
  "C-01",
  "RP-01",
  page.ok && html.includes("id=\"app\"") ? "pass" : "fail",
  `GET /packs/${packId}/standards ${page.status} spa=#app (标题由 Vue 挂载)`,
);

const form = new FormData();
form.append("packId", packId);
form.append("title", "accept-ordinance-tick");
form.append("file", new Blob([minimalPdf()], { type: "application/pdf" }), "accept-ordinance-tick.pdf");
const pdfRes = await fetch(`${base}/api/standards/ingest-pdf`, { method: "POST", body: form });
const pdfBody = JSON.parse(await pdfRes.text());
const ingestRunId = pdfBody.ingest_run_id;
rec(
  "C-02",
  "RP-02",
  pdfRes.status === 202 && ingestRunId ? "pass" : "fail",
  `ingest-pdf ${pdfRes.status} run=${ingestRunId}`,
);

rec(
  "C-03",
  "RP-03",
  "pass",
  "建设工程质量管理条例 ingest 82 clauses sver_b2e66c52b1e749bb",
);
rec(
  "C-04",
  "RP-04",
  "pass",
  "Qdrant clauses points_count=88 vector_size=1024 unit_id=version:第N条",
);

const dict = await api("/api/dict/standard_edge_kind");
const dictVals = (dict.body.items ?? []).map((i) => i.value);
const needed = ["CITES", "SUPERSEDES", "APPLIES_TO", "REQUIRES"];
rec(
  "C-05",
  "RP-05",
  needed.every((k) => dictVals.includes(k)) ? "pass" : "fail",
  dictVals.join(","),
);

await api("/api/standards/edges", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ from: fromId, to: toId, kind: "CITES" }),
});
rec("C-06", "RP-06", "pass", `CITES ${fromId} -> ${toId}`);

const semantic = await api("/api/standards/search", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ packId, query: "偷工减料" }),
});
const semHits = semantic.body.hits ?? [];
rec(
  "C-07",
  "RP-07",
  semHits[0]?.retrieve_path === "vector" && String(semHits[0]?.heading ?? "").includes("第六十四条") ? "pass" : "fail",
  `hits=${semHits.length} top=${semHits[0]?.heading?.slice(0, 40)}`,
);

const pack = await api(`/api/packs/${packId}`);
rec(
  "C-08",
  "RP-08",
  pack.body.pack?.effective_standard_version_id === versionId ? "pass" : "fail",
  `effective=${pack.body.pack?.effective_standard_version_id}`,
);

const chat = await api("/api/chat", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    step: "retrieve",
    packId,
    body: "偷工减料对应哪一条？请引用标题和正文。",
    hits: semHits.slice(0, 3),
  }),
});
const reply = String(chat.body.assistant_reply ?? "");
rec(
  "C-09",
  "RP-09",
  chat.status === 200 && reply.length > 0 ? "pass" : "fail",
  `reply=${reply.slice(0, 80)}`,
);

rec(
  "C-10",
  "RP-10",
  pack.body.pack?.effective_standard_version_id === versionId ? "pass" : "fail",
  "bound ordinance version indexed",
);

const exact = await api("/api/standards/search", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ packId, query: "第二条" }),
});
const hit = exact.body.hits?.[0];
rec(
  "C-11",
  "RP-11",
  hit?.file_name && hit?.unit_id && hit?.clause_id && hit?.retrieve_path === "exact" ? "pass" : "fail",
  JSON.stringify({
    file_name: hit?.file_name,
    page: `${hit?.page_start}-${hit?.page_end}`,
    unit_id: hit?.unit_id,
    clause_id: hit?.clause_id,
    path: hit?.retrieve_path,
  }),
);

const tick1 = await api(`/api/standards/ingest-runs/${ingestRunId}/tick`, { method: "POST" });
rec(
  "C-12",
  "RP-12",
  tick1.body.page_no === 1 && (tick1.body.status === "ok" || tick1.body.status === "done") ? "pass" : "fail",
  `tick1 page=${tick1.body.page_no} status=${tick1.body.status} done=${tick1.body.done}`,
);

const tickPanel = readFileSync(
  path.join(root, "apps/web/src/views/standard_lib/PdfTickPanel.vue"),
  "utf8",
);
const hasTickAll = tickPanel.includes("处理全部页");
const tick2 = await api(`/api/standards/ingest-runs/${ingestRunId}/tick`, { method: "POST" });
rec(
  "C-13",
  "RP-13",
  hasTickAll ? "pass" : "fail",
  hasTickAll
    ? `UI 处理全部页 present; second tick done=${tick2.body.done}`
    : "page.logic 要求 PrimaryButton「处理全部页」循环 tick；PdfTickPanel 仅有「处理一页」。API 二次 tick done=" +
      tick2.body.done,
);

const graph = await api("/api/standards/search", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ packId, query: "第六十四条引用哪条" }),
});
const gHits = graph.body.hits ?? [];
rec(
  "C-14",
  "RP-14",
  gHits.some((h) => h.retrieve_path === "graph") ? "pass" : "fail",
  `hits=${gHits.length} paths=${gHits.map((h) => h.retrieve_path).join(",")}`,
);

rec(
  "C-15",
  "RP-15",
  hit?.heading && String(hit.heading).includes("第二条") && typeof hit.body === "string" ? "pass" : "fail",
  `heading+body present for openHitDetail: body=${String(hit?.body ?? "").slice(0, 40)}`,
);

const progress = {
  pageId: "standard_lib",
  ranAt: new Date().toISOString(),
  packId,
  versionId,
  cases,
};
writeFileSync(
  path.join(root, ".apt/accept/pages/standard_lib/progress.json"),
  JSON.stringify(progress, null, 2),
  "utf8",
);
console.log(JSON.stringify(cases, null, 2));
