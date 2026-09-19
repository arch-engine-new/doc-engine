import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin, ViteDevServer } from "vite";

type CoreEngineHttpModule = {
  nodeRequestToDemo: (req: IncomingMessage) => Promise<import("core-engine/http").DemoHttpRequest>;
  getSharedSession: () => Promise<import("core-engine/http").DemoHttpSession>;
  handleDemoRequest: (
    session: import("core-engine/http").DemoHttpSession,
    parsed: import("core-engine/http").DemoHttpRequest,
  ) => Promise<import("core-engine/http").DemoHttpResponse>;
  writeDemoJson: (res: ServerResponse, status: number, body: unknown) => void;
};

function isAdapterPath(pathname: string): boolean {
  return pathname.startsWith("/api/") || pathname.startsWith("/adapter/");
}

async function loadHttpModule(server: ViteDevServer): Promise<CoreEngineHttpModule> {
  return server.ssrLoadModule("core-engine/http") as Promise<CoreEngineHttpModule>;
}

/**
 * Vite dev middleware for in-process JobPipeline `/api/*`.
 * Reloads core-engine/http per request so route changes apply without restarting Vite.
 */
export function coreEngineDevPlugin(): Plugin {
  return {
    name: "core-engine-http",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "/";
        const pathname = url.split("?")[0] ?? "/";
        if (!isAdapterPath(pathname)) {
          next();
          return;
        }
        void (async () => {
          try {
            const mod = await loadHttpModule(server);
            const parsed = await mod.nodeRequestToDemo(req);
            const session = await mod.getSharedSession();
            const result = await mod.handleDemoRequest(session, parsed);
            mod.writeDemoJson(res, result.status, result.body);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ error: message }));
          }
        })();
      });
    },
  };
}
