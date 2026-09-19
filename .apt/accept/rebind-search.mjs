import { readFileSync, writeFileSync } from "node:fs";

const inv = JSON.parse(readFileSync(".apt/accept/rag-ingest-inventory.json", "utf8"));
const base = inv.baseUrl;
const packId = inv.packId;
const highway = inv.documents.find((d) => d.title.includes("公路法"));
const bind = await fetch(`${base}/api/packs/${packId}/effective-version`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ versionId: highway.versionId }),
});
if (!bind.ok) throw new Error(await bind.text());

const queries = ["公路建设应当纳入国民经济", "农民负担", "建筑控制区", "交工验收", "国道规划"];
const searches = [];
for (const query of queries) {
  const res = await fetch(`${base}/api/standards/search`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ packId, query }),
  });
  const body = await res.json();
  searches.push({
    query,
    hitCount: body.hits?.length ?? 0,
    hits: (body.hits || []).slice(0, 5).map((h) => ({
      clause_id: h.clause_id,
      unit_id: h.unit_id,
      file_name: h.file_name,
      page_start: h.page_start,
      retrieve_path: h.retrieve_path,
    })),
  });
}
inv.boundEffectiveVersionId = highway.versionId;
inv.boundTitle = highway.title;
inv.searches = searches;
inv.searchedAt = new Date().toISOString();
writeFileSync(".apt/accept/rag-ingest-inventory.json", JSON.stringify(inv, null, 2));
console.log(
  JSON.stringify(
    {
      bound: highway.versionId,
      searches: searches.map((s) => ({ q: s.query, n: s.hitCount, first: s.hits[0]?.clause_id })),
    },
    null,
    2,
  ),
);
