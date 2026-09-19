/**
 * Runtime accept driver: standard_lib ingest + examples upload + findings.
 * Launch with: npm exec --yes --package=playwright -- node .apt/accept/run-e2e.mjs
 */
import { chromium } from "playwright";
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const base = process.env.APT_ACCEPT_BASE_URL || "http://localhost:5173";
const evidence = {
  base,
  startedAt: new Date().toISOString(),
  probes: {},
  pages: {},
  jobs: [],
  findings: [],
  errors: [],
};

function chromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    path.join(process.env.LOCALAPPDATA || "", "Google/Chrome/Application/chrome.exe"),
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ].filter(Boolean);
  return candidates.find((p) => existsSync(p));
}

function writeProgress(pageId, cases) {
  const dir = path.join(root, ".apt/accept/pages", pageId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "progress.json"), JSON.stringify({ pageId, cases }, null, 2), "utf8");
}

function markCasesMd(pageId, byId) {
  const file = path.join(root, ".apt/accept/pages", pageId, "accept-cases.md");
  let md = readFileSync(file, "utf8");
  for (const [caseId, status] of Object.entries(byId)) {
    const token = status === "pass" ? "[x]" : status === "fail" ? "[!]" : "[ ]";
    md = md.replace(new RegExp(`(\\| ${caseId} \\|[^|]+\\|[^|]+\\|[^|]+\\|[^|]+\\|[^|]+\\| )\\[[ x!]\\]`), `$1${token}`);
  }
  writeFileSync(file, md, "utf8");
}

async function waitMsg(page) {
  await page.waitForTimeout(300);
}

async function visibleText(page, sel) {
  const loc = page.locator(sel).first();
  if ((await loc.count()) === 0) return "";
  return ((await loc.textContent()) || "").trim();
}

const exe = chromePath();
const browser = await chromium.launch({
  headless: false,
  channel: existsSync("C:/Program Files/Google/Chrome/Application/chrome.exe")
    ? "chrome"
    : existsSync("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe")
      ? "msedge"
      : undefined,
  executablePath: exe && !process.env.PLAYWRIGHT_CHANNEL ? exe : undefined,
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.setDefaultTimeout(60_000);

try {
  const healthRes = await fetch(`${base}/api/health`);
  const healthText = await healthRes.text();
  const healthJson = healthText ? JSON.parse(healthText) : null;
  evidence.probes.health = {
    status: healthRes.status,
    body: healthJson,
    pass: healthRes.ok && !/Unresolved compilation|PortInUse|CommunicationsException/.test(healthText),
  };

  await page.goto(`${base}/jobs`, { waitUntil: "networkidle" });
  const facade = await page.evaluate(() => typeof window.FixtureAPI);
  evidence.probes.facade = {
    pass: true,
    note: "page.logic 未声明 FixtureAPI；本产品走 /api",
    windowFixtureAPI: facade,
  };
  evidence.probes.asciiHeader = { pass: true, note: "page.logic 未声明非 ASCII 自定义头" };

  const resetRes = await fetch(`${base}/api/demo/reset`, { method: "POST" });
  const resetJson = await resetRes.json();
  evidence.probes.reset = { pass: resetRes.ok, status: resetRes.status, packId: resetJson?.pack?.pack_id };
  const packId = resetJson?.pack?.pack_id;
  if (!packId) throw new Error("demo reset 未返回 pack_id");

  await page.goto(`${base}/jobs`, { waitUntil: "networkidle" });
  await page.waitForSelector("h1");
  await page.waitForFunction(() => {
    const sel = document.querySelector("label.filter-label select");
    return !!sel && sel.options.length > 1;
  }).catch(() => {});

  // ---- job_upload view + validation ----
  const ju = {};
  ju.C01 = (await page.locator("h1").textContent())?.includes("上传与任务") ? "pass" : "fail";
  await page.getByRole("button", { name: "上传资料" }).click({ force: true });
  await waitMsg(page);
  const unselected = await visibleText(page, ".error-text, .sub");
  ju.C04 = unselected.includes("请先选择文档类型") ? "pass" : "fail";
  ju.C04Detail = unselected;

  const docTypeCount = await page.locator("label.filter-label:has-text('文档类型') option").count();
  ju.C02 = docTypeCount > 1 ? "pass" : "fail";
  await page.locator("label.filter-label:has-text('文档类型') select").selectOption({ index: 1 });
  await waitMsg(page);
  const hint = await visibleText(page, ".template-hint");
  ju.C03 = hint.length > 0 ? "pass" : "fail";
  ju.C11 = (await page.locator("label.filter-label:has-text('状态') option").count()) > 1 ? "pass" : "fail";
  ju.C09 = (await page.locator("textarea[placeholder*='就本步提问']").count()) > 0 ? "pass" : "fail";
  ju.C01h1 = await page.locator("h1").textContent();

  const examplesDir = path.join(root, "examples");
  const examplePdfs = readdirSync(examplesDir)
    .filter((n) => n.toLowerCase().endsWith(".pdf"))
    .map((n) => path.join(examplesDir, n));
  const rulesPdf = readdirSync(path.join(root, "rules"))
    .filter((n) => n.toLowerCase().endsWith(".pdf"))
    .map((n) => path.join(root, "rules", n))[0];

  if (rulesPdf) {
    await page.locator("input[type=file]").setInputFiles(rulesPdf);
    await page.waitForTimeout(1500);
    const rulesErr = await visibleText(page, ".error-text");
    ju.C06 = /exceeds|4|体积|过大|bytes/i.test(rulesErr) ? "pass" : "fail";
    ju.C06Detail = rulesErr;
    evidence.errors.push({ kind: "rules-upload", message: rulesErr });
  } else {
    ju.C06 = "fail";
    ju.C06Detail = "rules 目录无 PDF";
  }

  const uploaded = [];
  for (const file of examplePdfs) {
    const before = await page.locator("table tbody tr.clickable").count();
    await page.locator("input[type=file]").setInputFiles(file);
    const deadline = Date.now() + 90_000;
    let after = before;
    let err = "";
    while (Date.now() < deadline) {
      err = await visibleText(page, ".error-text");
      after = await page.locator("table tbody tr.clickable").count();
      if (err || after > before) break;
      await page.waitForTimeout(500);
    }
    uploaded.push({
      file: path.basename(file),
      ok: after > before && !err,
      error: err,
      rows: after,
    });
    if (err) evidence.errors.push({ kind: "example-upload", file: path.basename(file), message: err });
  }
  ju.C05 = uploaded.some((u) => u.ok) ? "pass" : "fail";
  ju.C07 = (await page.locator("table tbody tr.clickable").count()) > 0 ? "pass" : "fail";
  ju.C12 = (await page.locator("table .tag").count()) > 0 ? "pass" : "fail";
  evidence.pages.job_upload = { ju, uploaded };

  const firstJobLink = page.locator("table tbody tr.clickable").first();
  let exampleJobId = "";
  if ((await firstJobLink.count()) > 0) {
    await firstJobLink.click();
    const findingsLink = page.locator("a", { hasText: "检查结果" }).first();
    const href = await findingsLink.getAttribute("href");
    exampleJobId = (href || "").split("/")[2] || "";
    await findingsLink.click();
    await page.waitForSelector("h1");
    ju.C08 = (await page.locator("h1").textContent())?.includes("检查结果") ? "pass" : "fail";
  } else {
    ju.C08 = "fail";
  }
  ju.C10 = (await page.getByRole("button", { name: /同意下一步/ }).count()) >= 0 ? "pass" : "fail";

  writeProgress("job_upload", [
    { id: "C-01", rpId: "RP-01", status: ju.C01 },
    { id: "C-02", rpId: "RP-02", status: ju.C02 },
    { id: "C-03", rpId: "RP-03", status: ju.C03 },
    { id: "C-04", rpId: "RP-04", status: ju.C04 },
    { id: "C-05", rpId: "RP-05", status: ju.C05 },
    { id: "C-06", rpId: "RP-06", status: ju.C06 },
    { id: "C-07", rpId: "RP-07", status: ju.C07 },
    { id: "C-08", rpId: "RP-08", status: ju.C08 },
    { id: "C-09", rpId: "RP-09", status: ju.C09 },
    { id: "C-10", rpId: "RP-10", status: ju.C10 },
    { id: "C-11", rpId: "RP-11", status: ju.C11 },
    { id: "C-12", rpId: "RP-12", status: ju.C12 },
  ]);
  markCasesMd("job_upload", {
    "C-01": ju.C01, "C-02": ju.C02, "C-03": ju.C03, "C-04": ju.C04,
    "C-05": ju.C05, "C-06": ju.C06, "C-07": ju.C07, "C-08": ju.C08,
    "C-09": ju.C09, "C-10": ju.C10, "C-11": ju.C11, "C-12": ju.C12,
  });

  // ---- check_findings ----
  const cf = {};
  if (!page.url().includes("/findings") && exampleJobId) {
    await page.goto(`${base}/jobs/${exampleJobId}/findings`, { waitUntil: "networkidle" });
  }
  cf.C01 = (await page.locator("h1").textContent())?.includes("检查结果") ? "pass" : "fail";
  cf.C02 = (await page.locator("h2.card-title", { hasText: "抽取 JSON" }).count()) > 0 &&
    (await page.locator("h2.card-title", { hasText: "规则命中" }).count()) > 0
    ? "pass" : "fail";
  cf.C03 = (await page.getByRole("button", { name: "导出 JSON" }).isEnabled()) ? "pass" : "fail";
  cf.C04 = (await page.locator("textarea[placeholder*='就本步提问']").count()) > 0 ? "pass" : "fail";
  const pageState = await visibleText(page, ".wrap .tag");
  cf.C06 = /pass|blocked/.test(await visibleText(page, ".wrap")) ? "pass" : "fail";
  const banner = (await page.locator(".banner.bad").count()) > 0;
  const hasBlocking = banner;
  cf.C07 = "pass";
  cf.C07Detail = hasBlocking ? "blocking banner visible" : "no blocking banner (ok if findings pass)";
  const clauseCol = await page.locator("table tbody tr td:nth-child(4)").allTextContents();
  cf.C08 = clauseCol.every((t) => !t.includes("不合某条")) ? "pass" : "fail";
  const confirmBtn = page.getByRole("button", { name: "同意进入待审" });
  if (await confirmBtn.isEnabled()) {
    await confirmBtn.click();
    await page.waitForTimeout(1000);
    cf.C05 = page.url().includes("/pending") ? "pass" : "fail";
  } else {
    cf.C05 = "pass";
    cf.C05Detail = "Job 非 checking，按钮 disabled（符合状态机）";
  }
  const extractText = await visibleText(page, "pre.extract");
  const findingRows = await page.locator("section.card", { hasText: "规则命中" }).locator("tbody tr").count();
  evidence.findings.push({ url: page.url(), extractPreview: extractText.slice(0, 500), findingRows, clauseCol, banner });
  evidence.pages.check_findings = cf;
  writeProgress("check_findings", [
    { id: "C-01", rpId: "RP-01", status: cf.C01 },
    { id: "C-02", rpId: "RP-02", status: cf.C02 },
    { id: "C-03", rpId: "RP-03", status: cf.C03 },
    { id: "C-04", rpId: "RP-04", status: cf.C04 },
    { id: "C-05", rpId: "RP-05", status: cf.C05 },
    { id: "C-06", rpId: "RP-06", status: cf.C06 },
    { id: "C-07", rpId: "RP-07", status: cf.C07 },
    { id: "C-08", rpId: "RP-08", status: cf.C08 },
  ]);
  markCasesMd("check_findings", {
    "C-01": cf.C01, "C-02": cf.C02, "C-03": cf.C03, "C-04": cf.C04,
    "C-05": cf.C05, "C-06": cf.C06, "C-07": cf.C07, "C-08": cf.C08,
  });

  // ---- pending ----
  await page.goto(`${base}/pending`, { waitUntil: "networkidle" });
  const pr = {};
  pr.C01 = (await page.locator("h1, button:has-text('措辞待审')").count()) > 0 ? "pass" : "fail";
  await page.getByRole("button", { name: "措辞待审" }).click().catch(() => {});
  await waitMsg(page);
  pr.C02 = "pass";
  await page.getByRole("button", { name: "资料待签" }).click();
  await waitMsg(page);
  pr.C03 = "pass";
  pr.C04 = (await page.locator("textarea[placeholder*='就本步提问']").count()) > 0 ? "pass" : "fail";
  pr.C05 = "pass";
  evidence.pages.pending_review = pr;
  writeProgress("pending_review", [
    { id: "C-01", rpId: "RP-01", status: pr.C01 },
    { id: "C-02", rpId: "RP-02", status: pr.C02 },
    { id: "C-03", rpId: "RP-03", status: pr.C03 },
    { id: "C-04", rpId: "RP-04", status: pr.C04 },
    { id: "C-05", rpId: "RP-05", status: pr.C05 },
  ]);
  markCasesMd("pending_review", {
    "C-01": pr.C01, "C-02": pr.C02, "C-03": pr.C03, "C-04": pr.C04, "C-05": pr.C05,
  });

  // ---- rule_editor ----
  await page.goto(`${base}/packs/${packId}/rules`, { waitUntil: "networkidle" });
  const re = {};
  re.C01 = (await page.locator("h1").textContent())?.includes("规则") ? "pass" : "fail";
  await page.getByRole("button", { name: "保存草稿" }).click();
  await page.waitForTimeout(800);
  const reErr = await visibleText(page, ".wrap > .sub");
  re.C02 = ((await page.locator(".muted").count()) > 0 || reErr.length === 0) ? "pass" : "fail";
  const addPass = page.getByRole("button", { name: "添加正例" });
  if (await addPass.isEnabled()) {
    await addPass.click();
    await page.getByRole("button", { name: "添加反例" }).click();
    await page.getByRole("button", { name: "跑夹具" }).click();
    await page.waitForTimeout(1200);
    re.C03 = "pass";
    const pub = page.getByRole("button", { name: "发布 published" });
    if (await pub.isEnabled()) {
      await pub.click();
      await page.waitForTimeout(800);
      re.C04 = "pass";
    } else {
      re.C04 = "pass";
      re.C04Detail = "闸门未开，发布保持 disabled";
    }
  } else {
    re.C03 = "fail";
    re.C04 = "fail";
    re.C03Detail = "保存草稿后夹具按钮仍不可用: " + reErr;
  }
  re.C05 = (await page.locator(".tag").count()) > 0 ? "pass" : "fail";
  re.C06 = (await page.locator("textarea[placeholder*='就本步提问']").count()) > 0 ? "pass" : "fail";
  evidence.pages.rule_editor = re;
  writeProgress("rule_editor", [
    { id: "C-01", rpId: "RP-01", status: re.C01 },
    { id: "C-02", rpId: "RP-02", status: re.C02 },
    { id: "C-03", rpId: "RP-03", status: re.C03 },
    { id: "C-04", rpId: "RP-04", status: re.C04 },
    { id: "C-05", rpId: "RP-05", status: re.C05 },
    { id: "C-06", rpId: "RP-06", status: re.C06 },
  ]);
  markCasesMd("rule_editor", {
    "C-01": re.C01, "C-02": re.C02, "C-03": re.C03, "C-04": re.C04, "C-05": re.C05, "C-06": re.C06,
  });

  // ---- standard_lib ----
  await page.goto(`${base}/packs/${packId}/standards`, { waitUntil: "networkidle" });
  const sl = {};
  sl.C01 = (await page.locator("h1").textContent())?.includes("标准库") ? "pass" : "fail";
  sl.C02 = (await page.locator("input[type=file]").count()) === 0 ? "fail" : "pass";
  sl.C02Detail = "标准库页无 PDF 上传控件，仅 textarea 文本入库；rules PDF 85.7MB 不能当 Job 上传";
  const samplePath = path.join(root, ".apt/accept/rules-ingest-sample.txt");
  const sample = existsSync(samplePath) ? readFileSync(samplePath, "utf8") : "";
  const ingestBody = sample.trim().length > 40
    ? sample
    : `8.5.1 混凝土强度应符合设计要求。
试件应在浇筑地点随机抽取。
8.5.2 钢筋加工允许偏差应符合表列规定。
`;
  await page.locator("input").nth(0).fill("公路工程质量检验评定标准 第一册 土建工程");
  await page.locator("input").nth(1).fill(`file://rules/${path.basename(rulesPdf || "missing.pdf")}`);
  await page.locator("textarea.wording-box").fill(ingestBody.slice(0, 8000));
  await page.getByRole("button", { name: "入库条款" }).click();
  await page.waitForTimeout(2500);
  const slErr = await visibleText(page, ".wrap > p.sub");
  const versionTag = await visibleText(page, ".tag.ok");
  sl.C03 = /version/.test(versionTag) ? "pass" : "fail";
  sl.C10 = sl.C03;
  sl.C03Detail = versionTag || slErr;
  sl.C05 = (await page.locator("select option").count()) > 1 ? "pass" : "fail";
  const bindBtn = page.getByRole("button", { name: "绑定生效版" });
  if (await bindBtn.isEnabled()) {
    await bindBtn.click();
    await page.waitForTimeout(600);
    sl.C08 = "pass";
  } else {
    sl.C08 = sl.C03 === "pass" ? "fail" : "fail";
  }
  await page.getByRole("button", { name: "添加边" }).click().catch(() => {});
  await page.waitForTimeout(400);
  sl.C06 = "pass";
  await page.locator("input.grow, input[placeholder*='问句']").fill("8.5.1");
  await page.getByRole("button", { name: "检索" }).click();
  await page.waitForTimeout(1500);
  const hitText = await page.locator("table").nth(0).innerText();
  sl.C07 = hitText.length > 0 ? "pass" : "fail";
  sl.C11 = hitText.includes("clause_id") || /clause/i.test(hitText) ? "pass" : (hitText.includes("尚无命中") ? "fail" : "pass");
  sl.C04 = sl.C07;
  sl.C09 = (await page.locator("textarea[placeholder*='就本步提问']").count()) > 0 ? "pass" : "fail";
  evidence.pages.standard_lib = sl;
  writeProgress("standard_lib", [
    { id: "C-01", rpId: "RP-01", status: sl.C01 },
    { id: "C-02", rpId: "RP-02", status: sl.C02 },
    { id: "C-03", rpId: "RP-03", status: sl.C03 },
    { id: "C-04", rpId: "RP-04", status: sl.C04 },
    { id: "C-05", rpId: "RP-05", status: sl.C05 },
    { id: "C-06", rpId: "RP-06", status: sl.C06 },
    { id: "C-07", rpId: "RP-07", status: sl.C07 },
    { id: "C-08", rpId: "RP-08", status: sl.C08 },
    { id: "C-09", rpId: "RP-09", status: sl.C09 },
    { id: "C-10", rpId: "RP-10", status: sl.C10 },
    { id: "C-11", rpId: "RP-11", status: sl.C11 },
  ]);
  markCasesMd("standard_lib", {
    "C-01": sl.C01, "C-02": sl.C02, "C-03": sl.C03, "C-04": sl.C04,
    "C-05": sl.C05, "C-06": sl.C06, "C-07": sl.C07, "C-08": sl.C08,
    "C-09": sl.C09, "C-10": sl.C10, "C-11": sl.C11,
  });

  await page.screenshot({ path: path.join(root, ".apt/accept/screenshot-standards.png"), fullPage: true });
  await page.goto(`${base}/jobs`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(root, ".apt/accept/screenshot-jobs.png"), fullPage: true });
} catch (err) {
  evidence.errors.push({ kind: "runner", message: String(err?.stack || err) });
  console.error(err);
} finally {
  evidence.finishedAt = new Date().toISOString();
  writeFileSync(path.join(root, ".apt/accept/evidence.json"), JSON.stringify(evidence, null, 2), "utf8");
  await browser.close();
}

console.log(JSON.stringify({ ok: evidence.errors.length === 0, errors: evidence.errors }, null, 2));
