/**
 * Live ingest + search + Docker Qdrant/Neo4j proof for $apt-accept.
 * Writes .apt/accept/evidence.json (utf-8).
 */
const base = process.env.APT_ACCEPT_BASE_URL || "http://127.0.0.1:5173";
const marker = "APT-ACCEPT-LIVE-20260919";
const leaveText = `1.1 事假须提前申请。${marker} 向量探针。
须在休假前一至三个工作日提交书面申请，并经主管确认。
1.2 病假须提供证明。
申请病假应附医疗机构证明，急诊可于返岗后补交。
2.1 审批时限为三个工作日。
主管须在三个工作日内完成审批并书面回复。
`;

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
    const err = new Error(`${pathname} ${res.status}: ${typeof body === "string" ? body.slice(0, 400) : JSON.stringify(body).slice(0, 400)}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

async function dockerJson(cmd) {
  const { execSync } = await import("node:child_process");
  return execSync(cmd, { encoding: "utf8" }).trim();
}

async function qdrantCollection() {
  const res = await fetch("http://127.0.0.1:6333/collections/clauses");
  if (res.status === 404) return { exists: false, points_count: 0 };
  const json = await res.json();
  return {
    exists: true,
    points_count: json.result?.points_count ?? 0,
    status: json.result?.status,
  };
}

async function qdrantScrollByUnitIds(_unitIds) {
  const res = await fetch("http://127.0.0.1:6333/collections/clauses/points/scroll", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      limit: 50,
      with_payload: true,
      with_vector: false,
    }),
  });
  const json = await res.json();
  return (json.result?.points ?? []).map((p) => ({
    id: p.id,
    unit_id: p.payload?.unit_id,
    file_name: p.payload?.file_name,
    page_start: p.payload?.page_start,
    page_end: p.payload?.page_end,
    chunk_kind: p.payload?.chunk_kind,
    versionId: p.payload?.versionId,
  }));
}

async function neo4j(cypher) {
  const { execSync } = await import("node:child_process");
  return execSync(`docker exec neo4j cypher-shell -u neo4j -p 12345678 --format plain "${cypher.replaceAll('"', '\\"')}"`, {
    encoding: "utf8",
  });
}

async function pg(sql) {
  const { execSync } = await import("node:child_process");
  return execSync(`docker exec docengine-postgres psql -U postgres -d docengine -t -A -c "${sql.replaceAll('"', '\\"')}"`, {
    encoding: "utf8",
  }).trim();
}

const evidence = {
  ranAt: new Date().toISOString(),
  baseUrl: base,
  marker,
  health: null,
  reset: null,
  before: {},
  ingest: {},
  bind: {},
  edge: {},
  search: {},
  after: {},
  dockerProof: {},
  pdf: {},
  dict: {},
  pageHtml: {},
  errors: [],
};

try {
  evidence.health = await api("/api/health");
} catch (e) {
  evidence.errors.push(`health: ${e.message}`);
}

evidence.reset = {
  ok: false,
  skipped: true,
  note: "live POST /api/demo/reset returns 503 (MinIO) and wipes Postgres/Qdrant/Neo4j; skipped so ingest proof is not deleted",
};

evidence.before = {
  pgClauses: await pg("SELECT count(*) FROM t_clause;"),
  qdrant: await qdrantCollection(),
  neo4jClauses: (await neo4j("MATCH (c:Clause) RETURN count(c) AS n;")).trim(),
};

const projects = await api("/api/projects");
let projectId = projects.projects?.[0]?.project_id;
if (!projectId) {
  const created = await api("/api/projects", {
    method: "POST",
    body: JSON.stringify({ name: "apt-accept-live" }),
  });
  projectId = created.project.project_id;
}

const packs = await api(`/api/projects/${projectId}/packs`);
let packId = packs.packs.find((p) => p.name !== "pack_slice1")?.pack_id ?? packs.packs?.[0]?.pack_id;
if (!packId) {
  const created = await api("/api/packs", {
    method: "POST",
    body: JSON.stringify({ projectId, name: "apt-accept-live-pack", version: "0" }),
  });
  packId = created.pack.pack_id;
}

let templateId = packs.packs.find((p) => p.pack_id === packId)?.templates?.[0]?.template_id;
if (!templateId) {
  try {
    const tpls = await api(`/api/packs/${packId}/templates`);
    templateId = tpls.templates?.[0]?.template_id;
  } catch {
    templateId = undefined;
  }
}
try {
  const jobsBefore = await api("/api/jobs");
  if ((jobsBefore.jobs ?? []).length === 0) {
    const fixture = await api("/api/jobs/fixture", {
      method: "POST",
      body: JSON.stringify({ kind: "ok", template_id: templateId }),
    });
    evidence.fixtureJob = { jobId: fixture.job?.job_id ?? fixture.job_id, ok: true };
  } else {
    evidence.fixtureJob = { jobId: jobsBefore.jobs[0].job_id, reused: true };
  }
} catch (e) {
  evidence.fixtureJob = { ok: false, message: e.message };
}
evidence.ingest.projectId = projectId;
evidence.ingest.packId = packId;

const ingested = await api("/api/standards/ingest", {
  method: "POST",
  body: JSON.stringify({
    packId,
    title: `员工请假说明 ${marker}`,
    fileUri: "fixture://leave-accept-live",
    text: leaveText,
  }),
});
const versionId = ingested.version?.version_id;
const clauses = ingested.clauses ?? [];
evidence.ingest = {
  ...evidence.ingest,
  versionId,
  clauseCount: clauses.length,
  clauseIds: clauses.map((c) => c.clause_id),
  tablesUnlinked: ingested.tablesUnlinked ?? 0,
};

const bound = await api(`/api/packs/${packId}/effective-version`, {
  method: "POST",
  body: JSON.stringify({ versionId }),
});
evidence.bind = {
  effective: bound.pack?.effective_standard_version_id,
};

const from = clauses[1]?.clause_id;
const to = clauses[0]?.clause_id;
if (from && to) {
  await api("/api/standards/edges", {
    method: "POST",
    body: JSON.stringify({ from, to, kind: "CITES" }),
  });
  evidence.edge = { from, to, kind: "CITES" };
}

const queries = ["1.1", "事假", marker, "1.2引用哪条"];
evidence.search = {};
for (const query of queries) {
  const result = await api("/api/standards/search", {
    method: "POST",
    body: JSON.stringify({ packId, query }),
  });
  evidence.search[query] = {
    hitCount: (result.hits ?? []).length,
    hits: (result.hits ?? []).slice(0, 5).map((h) => ({
      clause_id: h.clause_id,
      unit_id: h.unit_id,
      file_name: h.file_name,
      page_start: h.page_start,
      page_end: h.page_end,
      chunk_kind: h.chunk_kind,
      retrieve_path: h.retrieve_path,
      standard_version_id: h.standard_version_id,
      span: h.span,
    })),
  };
}

evidence.dict.edgeKind = await api("/api/dict/standard_edge_kind");
evidence.dict.retrievePath = await api("/api/dict/retrieve_path");

const pageRes = await fetch(`${base}/packs/${packId}/standards`);
evidence.pageHtml = {
  status: pageRes.status,
  hasApp: (await pageRes.text()).includes("id=\"app\""),
};

try {
  const pdfBody = `%PDF-1.1
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj
4 0 obj<< /Length 68 >>stream
BT /F1 12 Tf 72 720 Td (1.1 accept pdf clause ${marker}) Tj ET
endstream
endobj
5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj
trailer<< /Root 1 0 R >>
%%EOF
`;
  const form = new FormData();
  form.append("packId", packId);
  form.append("title", `accept-pdf ${marker}`);
  form.append("file", new Blob([pdfBody], { type: "application/pdf" }), "accept-live.pdf");
  const pdfRes = await fetch(`${base}/api/standards/ingest-pdf`, { method: "POST", body: form });
  const pdfText = await pdfRes.text();
  let pdfJson = pdfText;
  try {
    pdfJson = JSON.parse(pdfText);
  } catch {
    /* keep */
  }
  evidence.pdf.ingest = { status: pdfRes.status, body: pdfJson };
  if (pdfRes.ok && pdfJson?.ingest_run_id) {
    const tick = await api(`/api/standards/ingest-runs/${pdfJson.ingest_run_id}/tick`, { method: "POST" });
    evidence.pdf.tick = tick;
  }
} catch (e) {
  evidence.pdf.error = e.message;
}

evidence.after = {
  pgClauses: await pg("SELECT count(*) FROM t_clause;"),
  pgClauseIds: await pg("SELECT clause_id FROM t_clause ORDER BY clause_id;"),
  qdrant: await qdrantCollection(),
  neo4jClauses: (await neo4j("MATCH (c:Clause) RETURN count(c) AS n;")).trim(),
  neo4jIds: (await neo4j("MATCH (c:Clause) RETURN c.id AS id ORDER BY c.id;")).trim(),
  neo4jEdges: (await neo4j("MATCH (a)-[r]->(b) RETURN type(r) AS kind, a.id AS frm, b.id AS too ORDER BY kind, frm;")).trim(),
};

const unitIds = clauses.map((c) => c.clause_id);
let qdrantPoints = [];
try {
  qdrantPoints = await qdrantScrollByUnitIds(unitIds);
} catch (e) {
  evidence.errors.push(`qdrantScroll: ${e.message}`);
}
evidence.dockerProof = {
  qdrantAllPoints: qdrantPoints,
  qdrantPointsForThisIngest: qdrantPoints.filter((p) => unitIds.includes(p.unit_id)),
  pgHasMarkerClauses: String(evidence.after.pgClauseIds).includes(versionId),
  qdrantHasThisIngest: false,
  neo4jHasThisIngest: false,
  neo4jHasCites: false,
};
evidence.dockerProof.qdrantHasThisIngest = evidence.dockerProof.qdrantPointsForThisIngest.some(
  (p) => p.unit_id && unitIds.includes(p.unit_id),
);
evidence.dockerProof.neo4jHasThisIngest = String(evidence.after.neo4jIds).includes(versionId);
evidence.dockerProof.neo4jHasCites = /CITES/i.test(String(evidence.after.neo4jEdges));

const { writeFileSync } = await import("node:fs");
const { dirname, join } = await import("node:path");
const { fileURLToPath } = await import("node:url");
const out = join(dirname(fileURLToPath(import.meta.url)), "evidence.json");
writeFileSync(out, JSON.stringify(evidence, null, 2), "utf8");
console.log(JSON.stringify({
  packId,
  versionId,
  clauseCount: clauses.length,
  search11: evidence.search["1.1"]?.hitCount,
  searchLeave: evidence.search["事假"]?.hitCount,
  searchMarker: evidence.search[marker]?.hitCount,
  qdrantPoints: evidence.after.qdrant.points_count,
  qdrantHasThisIngest: evidence.dockerProof.qdrantHasThisIngest,
  neo4jHasThisIngest: evidence.dockerProof.neo4jHasThisIngest,
  neo4jHasCites: evidence.dockerProof.neo4jHasCites,
  pgClauses: evidence.after.pgClauses,
  pdfStatus: evidence.pdf.ingest?.status,
  resetOk: evidence.reset?.ok,
  out,
}, null, 2));
