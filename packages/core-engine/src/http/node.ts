import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { handleDemoRequest, type DemoHttpRequest } from "./handle-request.js";
import { getSharedSession } from "./session.js";

/** Structural Vite plugin shape — avoids depending on the vite package from core-engine. */
interface ViteMiddlewarePlugin {
  name: string;
  configureServer(server: {
    middlewares: {
      use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void;
    };
  }): void;
}

function isAdapterPath(pathname: string): boolean {
  return pathname.startsWith("/api/") || pathname.startsWith("/adapter/");
}

export async function readNodeBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return { raw };
  }
}

export async function nodeRequestToDemo(req: IncomingMessage): Promise<DemoHttpRequest> {
  return {
    method: req.method ?? "GET",
    url: req.url ?? "/",
    body: req.method === "GET" || req.method === "HEAD" ? {} : await readNodeBody(req),
  };
}

export function writeDemoJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(payload);
}

export function createDemoHttpServer(port = 8787): Server {
  const server = createServer((req, res) => {
    void (async () => {
      try {
        const parsed = await nodeRequestToDemo(req);
        const url = new URL(parsed.url, "http://demo.local");
        if (!isAdapterPath(url.pathname)) {
          writeDemoJson(res, 404, { error: "not found" });
          return;
        }
        const session = await getSharedSession();
        const result = await handleDemoRequest(session, parsed);
        writeDemoJson(res, result.status, result.body);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        writeDemoJson(res, 500, { error: message });
      }
    })();
  });
  server.listen(port);
  return server;
}

/** Vite middleware: same-process JobPipeline for /api/* and /adapter/*. */
export function coreEngineHttpPlugin(): ViteMiddlewarePlugin {
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
            const parsed = await nodeRequestToDemo(req);
            const session = await getSharedSession();
            const result = await handleDemoRequest(session, parsed);
            writeDemoJson(res, result.status, result.body);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            writeDemoJson(res, 500, { error: message });
          }
        })();
      });
    },
  };
}
