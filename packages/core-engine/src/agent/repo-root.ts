import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Locate monorepo root so `.apt/agent-runtime.llm.json` resolves when Vite cwd is apps/web.
 */
export function resolveRepoRoot(startDir = process.cwd()): string {
  if (process.env.APT_PROJECT_ROOT && existsSync(join(process.env.APT_PROJECT_ROOT, ".apt"))) {
    return process.env.APT_PROJECT_ROOT;
  }

  let dir = startDir;
  for (let i = 0; i < 12; i++) {
    if (existsSync(join(dir, ".apt", "agent-runtime.llm.json")) || existsSync(join(dir, ".apt", "goal.md"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // Fallback: core-engine package is packages/core-engine → repo root two levels up
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "..", "..");
}
