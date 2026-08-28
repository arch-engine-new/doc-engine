import { defineConfig, loadEnv, type UserConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { coreEngineDevPlugin } from "./vite-plugin-core-engine";

/**
 * Copies apps/web/.env keys into Node `process.env` so core-engine plugins
 * (DemoHttpSession health, MinIO, OCR) can read unprefixed secrets. Skips
 * keys already set so CI/shell values win. Never use `envPrefix: ""` — that
 * would leak the same keys into client `import.meta.env`.
 */
function injectUnprefixedFileEnv(mode: string): void {
  const fileEnv = loadEnv(mode, process.cwd(), "");
  for (const [key, value] of Object.entries(fileEnv)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

/**
 * Vue workbench Vite config. Env injection stays Node-only so unprefixed
 * DATABASE_URL / MINIO_* / BAIDU_* reach plugins without a browser leak.
 */
export default defineConfig(({ mode }): UserConfig => {
  injectUnprefixedFileEnv(mode);
  return {
    plugins: [vue(), coreEngineDevPlugin()],
    optimizeDeps: {
      exclude: ["core-engine", "better-sqlite3"],
    },
  };
});
