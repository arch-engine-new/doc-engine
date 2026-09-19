import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const base = process.env.APT_ACCEPT_BASE_URL || "http://127.0.0.1:5173";
const packId = process.env.APT_ACCEPT_PACK_ID || "pack_202641ec47ed420e";
const url = `${base}/packs/${packId}/standards`;

const result = {
  url,
  title: "",
  ingestVisible: false,
  searchVisible: false,
  edgeKindOptions: [],
  stepChatVisible: false,
  hitsAfterSearch: 0,
  error: "",
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("h1", { timeout: 15000 });
  result.title = (await page.locator("h1").first().textContent())?.trim() || "";
  result.ingestVisible = await page.getByRole("button", { name: "入库条款" }).isVisible();
  result.searchVisible = await page.getByRole("button", { name: "检索" }).isVisible();
  result.edgeKindOptions = await page.locator("select").first().locator("option").evaluateAll((opts) =>
    opts.map((o) => o.value),
  );
  const packJson = await page.evaluate(async (id) => {
    const res = await fetch(`/api/packs/${id}`);
    return res.json();
  }, packId);
  result.packEffective = packJson?.pack?.effective_standard_version_id ?? null;
  const input = page.locator('input.grow, input[placeholder*="条款号"]').first();
  await input.fill("1.1");
  const searchWait = page.waitForResponse(
    (r) => r.url().includes("/api/standards/search") && r.request().method() === "POST",
    { timeout: 30000 },
  );
  await page.getByRole("button", { name: "检索" }).click();
  const searchRes = await searchWait;
  result.searchStatus = searchRes.status();
  result.searchBody = await searchRes.json();
  await page.waitForSelector("table tbody tr td", { timeout: 10000 });
  result.hitsAfterSearch = await page.locator("table tbody tr").filter({ hasNotText: "尚无命中" }).count();
  result.stepChatVisible = (await page.locator("text=可就命中条款").count()) > 0
    || (await page.locator("aside, .step-chat, [class*='step-chat']").count()) > 0
    || (await page.locator("textarea").count()) > 1;
  const shot = join(dirname(fileURLToPath(import.meta.url)), "screenshot-standards-live.png");
  await page.screenshot({ path: shot, fullPage: true });
  result.screenshot = shot;
} catch (e) {
  result.error = String(e?.message || e);
} finally {
  await browser.close();
}

writeFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "ui-probe.json"),
  JSON.stringify(result, null, 2),
  "utf8",
);
console.log(JSON.stringify(result, null, 2));
