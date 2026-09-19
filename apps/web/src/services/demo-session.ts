/** Demo ids for nav links after `/api/demo/reset` or first list. Survives SPA navigation. */

import { reactive } from "vue";
import { http } from "./http";
import type { JobView, SpecPackView, TemplateView } from "./types";

const STORAGE_KEY = "apt-demo-nav";

export interface DemoNavIds {
  projectId: string;
  packId: string;
  templateId: string;
  jobId: string;
  traceId: string;
}

export interface DemoResetResult {
  ok: true;
  project: { project_id: string };
  pack: { pack_id: string };
  template: { template_id: string };
  jobs: { job: { job_id: string; trace_id: string } }[];
}

export const demoNav = reactive<DemoNavIds>({
  projectId: "",
  packId: "",
  templateId: "",
  jobId: "",
  traceId: "",
});

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...demoNav }));
  } catch {
    /* ignore quota / private mode */
  }
}

/** Restore last reset ids so nav links survive a full page reload. */
export function loadDemoNav(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<DemoNavIds>;
    if (parsed && typeof parsed === "object") {
      demoNav.projectId = parsed.projectId ?? demoNav.projectId;
      demoNav.packId = parsed.packId ?? demoNav.packId;
      demoNav.templateId = parsed.templateId ?? demoNav.templateId;
      demoNav.jobId = parsed.jobId ?? demoNav.jobId;
      demoNav.traceId = parsed.traceId ?? demoNav.traceId;
    }
  } catch {
    /* ignore */
  }
}

/** Merge partial nav ids into the reactive store and persist to localStorage. */
export function rememberDemoNav(partial: Partial<DemoNavIds>): void {
  // Persist whichever nav ids the caller supplied; undefined keys are left unchanged.
  if (partial.projectId !== undefined) demoNav.projectId = partial.projectId;
  if (partial.packId !== undefined) demoNav.packId = partial.packId;
  if (partial.templateId !== undefined) demoNav.templateId = partial.templateId;
  if (partial.jobId !== undefined) demoNav.jobId = partial.jobId;
  if (partial.traceId !== undefined) demoNav.traceId = partial.traceId;
  persist();
}

/** Map POST /api/demo/reset body onto nav so 模板/规则/组卷/审计 stop using demo placeholders. */
export function applyResetResult(body: DemoResetResult): void {
  const job = body.jobs[0]?.job;
  rememberDemoNav({
    projectId: body.project.project_id,
    packId: body.pack.pack_id,
    templateId: body.template.template_id,
    jobId: job?.job_id ?? "",
    traceId: job?.trace_id ?? "",
  });
}

/** Idempotent seed: empty pipeline gets fixture jobs plus 空规范包. */
export async function resetDemo(): Promise<DemoResetResult> {
  const data = await http<DemoResetResult>("/api/demo/reset", { method: "POST" });
  applyResetResult(data);
  return data;
}

/** First pack with a bound effective version, else any pack in the ledger. */
export async function resolveLivePackId(): Promise<string | null> {
  const projects = await http<{ projects: { project_id: string }[] }>("/api/projects");
  for (const project of projects.projects) {
    const packsRes = await http<{ packs: SpecPackView[] }>(`/api/projects/${project.project_id}/packs`);
    const bound = packsRes.packs.find((row) => row.effective_standard_version_id);
    if (bound) return bound.pack_id;
    if (packsRes.packs[0]) return packsRes.packs[0].pack_id;
  }
  return null;
}

/** Bootstrap demo nav from live jobs or seed reset when the ledger is empty. */
export async function ensureDemoSession(): Promise<DemoNavIds> {
  // Reuse live jobs when present; otherwise seed demo fixture and resolve pack/template ids.
  loadDemoNav();
  if (demoNav.packId) {
    try {
      await http(`/api/packs/${demoNav.packId}`);
    } catch {
      demoNav.packId = "";
    }
  }
  const jobsRes = await http<{ jobs: JobView[] }>("/api/jobs");
  if (jobsRes.jobs.length === 0) {
    await resetDemo();
    return { ...demoNav };
  }
  const job = jobsRes.jobs[0]!;
  const projects = await http<{ projects: { project_id: string }[] }>("/api/projects");
  const project = projects.projects[0];
  let packId = demoNav.packId;
  let templateId = demoNav.templateId;
  const projectId = project?.project_id ?? demoNav.projectId;
  if (project) {
    const packsRes = await http<{ packs: SpecPackView[] }>(`/api/projects/${project.project_id}/packs`);
    const pack = packsRes.packs.find((row) => row.name === "空规范包") ?? packsRes.packs[0];
    if (pack) {
      packId = pack.pack_id;
      const embedded = pack.templates?.[0]?.template_id;
      if (embedded) {
        templateId = embedded;
      } else {
        const tpls = await http<{ templates: TemplateView[] }>(`/api/packs/${pack.pack_id}/templates`);
        templateId = tpls.templates[0]?.template_id ?? templateId;
      }
    }
  }
  rememberDemoNav({
    projectId,
    packId,
    templateId,
    jobId: job.job_id,
    traceId: job.trace_id,
  });
  return { ...demoNav };
}
