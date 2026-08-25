/**
 * Minimal HTTP adapter for ControlPlane.
 *
 * Why: Provides a REST API over the in-process ControlPlane for remote access.
 * Uses native fetch/Request/Response (works in Node 18+, Cloudflare Workers, etc.)
 * No external framework dependency - can be adapted to Express/Fastify if needed.
 */

import type { ControlPlane, CompileResult, RunView, StartRunControlOptions, ResumeHitlOptions, StartRunResult } from "./control.js";
import type { GraphDefinition } from "../graph/types.js";
import type { HitlDecision } from "../hitl/gateway.js";

/** HTTP server interface (minimal subset). */
export interface HttpServer {
  /** Start listening on port. */
  listen(port: number, hostname?: string): Promise<void>;
  /** Stop the server. */
  close(): Promise<void>;
  /** Server address info. */
  address(): { port: number; hostname: string } | null;
}

/** Request handler function type. */
type RequestHandler = (request: Request) => Promise<Response>;

/** Route definition. */
interface Route {
  method: string;
  path: string;
  handler: RequestHandler;
}

/**
 * Create a minimal HTTP server using native fetch API.
 * Works in Node.js 18+, Cloudflare Workers, Deno, Bun.
 */
function createNativeServer(handler: RequestHandler): HttpServer {
  // Check if we're in Node.js environment
  const isNode = typeof process !== "undefined" && process.versions?.node;

  if (isNode) {
    // Dynamic import for Node.js http module
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const http = require("http");

    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
      const request = new Request(url.toString(), {
        method: req.method,
        headers: req.headers as HeadersInit,
        body: req.method !== "GET" && req.method !== "HEAD" ? req : undefined,
      });

      try {
        const response = await handler(request);
        res.writeHead(response.status, Object.fromEntries(response.headers));
        if (response.body) {
          // For ReadableStream body (Node 18+)
          if (response.body instanceof ReadableStream) {
            for await (const chunk of response.body) {
              res.write(Buffer.from(chunk));
            }
          } else {
            res.write(await response.text());
          }
        }
        res.end();
      } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: (error as Error).message }));
      }
    });

    return {
      listen(port: number, hostname?: string): Promise<void> {
        return new Promise((resolve, reject) => {
          server.listen(port, hostname ?? "0.0.0.0", () => resolve());
          server.on("error", reject);
        });
      },
      close(): Promise<void> {
        return new Promise((resolve, reject) => {
          server.close((err) => (err ? reject(err) : resolve()));
        });
      },
      address() {
        const addr = server.address();
        return addr && typeof addr === "object" ? { port: addr.port, hostname: addr.address } : null;
      },
    };
  }

  // For non-Node environments (Workers, Deno, Bun), return a mock
  // The actual server is platform-specific (e.g., export default fetch in Workers)
  return {
    async listen() {
      throw new Error("Native server not supported in this environment. Use platform-specific handler.");
    },
    async close() {},
    address() { return null; },
  };
}

/**
 * Create REST routes for ControlPlane.
 */
function createRoutes(controlPlane: ControlPlane): Route[] {
  return [
    // POST /graphs - Compile a graph
    {
      method: "POST",
      path: "/graphs",
      handler: async (req) => {
        try {
          const def = (await req.json()) as GraphDefinition;
          const result: CompileResult = controlPlane.compileGraph(def);
          return jsonResponse(201, result);
        } catch (error) {
          return errorResponse(error);
        }
      },
    },

    // GET /graphs/:graphId - Get compiled graph
    {
      method: "GET",
      path: "/graphs/:graphId",
      handler: async (req) => {
        const graphId = getPathParam(req, "graphId");
        const graph = controlPlane.getCompiledGraph(graphId);
        if (!graph) {
          return jsonResponse(404, { error: "Graph not found" });
        }
        return jsonResponse(200, { graphId, compiledGraph: graph });
      },
    },

    // POST /runs - Start a new run
    {
      method: "POST",
      path: "/runs",
      handler: async (req) => {
        try {
          const options = (await req.json()) as StartRunControlOptions;
          const result: StartRunResult = await controlPlane.startRun(options);
          return jsonResponse(201, result);
        } catch (error) {
          return errorResponse(error);
        }
      },
    },

    // GET /runs - List runs
    {
      method: "GET",
      path: "/runs",
      handler: async (req) => {
        const url = new URL(req.url);
        const status = url.searchParams.get("status") as any;
        const runs: RunView[] = controlPlane.listRuns(status);
        return jsonResponse(200, { runs });
      },
    },

    // GET /runs/:runId - Get run view
    {
      method: "GET",
      path: "/runs/:runId",
      handler: async (req) => {
        const runId = getPathParam(req, "runId");
        const run = controlPlane.getRun(runId);
        if (!run) {
          return jsonResponse(404, { error: "Run not found" });
        }
        return jsonResponse(200, run);
      },
    },

    // POST /runs/:runId/wait - Wait for run completion
    {
      method: "POST",
      path: "/runs/:runId/wait",
      handler: async (req) => {
        const runId = getPathParam(req, "runId");
        const result = await controlPlane.waitForRun(runId);
        if (!result) {
          return jsonResponse(404, { error: "Run not found" });
        }
        return jsonResponse(200, result);
      },
    },

    // POST /runs/:runId/cancel - Cancel a run
    {
      method: "POST",
      path: "/runs/:runId/cancel",
      handler: async (req) => {
        const runId = getPathParam(req, "runId");
        const cancelled = controlPlane.cancelRun(runId);
        if (!cancelled) {
          return jsonResponse(404, { error: "Run not found or not running" });
        }
        return jsonResponse(200, { cancelled: true });
      },
    },

    // POST /runs/:runId/resume - Resume HITL
    {
      method: "POST",
      path: "/runs/:runId/resume",
      handler: async (req) => {
        try {
          const runId = getPathParam(req, "runId");
          const { token, decision } = (await req.json()) as { token: string; decision: HitlDecision };
          const status = await controlPlane.resumeHitl({ runId, token, decision });
          return jsonResponse(200, { status });
        } catch (error) {
          return errorResponse(error);
        }
      },
    },

    // GET /runs/:runId/trace - Get event trace
    {
      method: "GET",
      path: "/runs/:runId/trace",
      handler: async (req) => {
        const runId = getPathParam(req, "runId");
        const url = new URL(req.url);
        const fromSeq = url.searchParams.get("fromSeq");
        const trace = await controlPlane.getTrace(runId, fromSeq ? parseInt(fromSeq, 10) : undefined);
        return jsonResponse(200, { trace });
      },
    },

    // DELETE /runs/:runId - Delete run
    {
      method: "DELETE",
      path: "/runs/:runId",
      handler: async (req) => {
        const runId = getPathParam(req, "runId");
        const deleted = controlPlane.deleteRun(runId);
        if (!deleted) {
          return jsonResponse(404, { error: "Run not found" });
        }
        return jsonResponse(200, { deleted: true });
      },
    },

    // Health check
    {
      method: "GET",
      path: "/health",
      handler: async () => jsonResponse(200, { status: "ok" }),
    },
  ];
}

/**
 * Create HTTP request handler from routes.
 */
function createRouter(routes: Route[]): RequestHandler {
  return async (request: Request) => {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Find matching route
    for (const route of routes) {
      if (route.method !== method) continue;

      // Convert route path to regex
      const routeRegex = route.path
        .replace(/:([^/]+)/g, "(?<$1>[^/]+)")
        .replace(/\*/g, ".*");

      const match = path.match(new RegExp(`^${routeRegex}$`));
      if (match) {
        // Attach path params to request for handler
        (request as any).params = match.groups ?? {};
        return route.handler(request);
      }
    }

    return jsonResponse(404, { error: "Not found" });
  };
}

/**
 * Create HTTP server for ControlPlane.
 *
 * @param controlPlane - ControlPlane instance
 * @param port - Port to listen on (optional, for native server)
 * @returns HttpServer instance
 *
 * @example
 * ```ts
 * const controlPlane = createControlPlane(store);
 * const server = createHttpServer(controlPlane, 3000);
 * await server.listen(3000);
 * console.log("Server running on http://localhost:3000");
 * ```
 */
export function createHttpServer(controlPlane: ControlPlane, port?: number): HttpServer {
  const routes = createRoutes(controlPlane);
  const handler = createRouter(routes);
  const server = createNativeServer(handler);

  // If port provided, auto-start (for convenience in tests/scripts)
  if (port !== undefined) {
    // Note: caller should await server.listen(port) explicitly
    // We don't auto-start to allow configuration
  }

  return server;
}

/**
 * Create a fetch handler for serverless/platform deployments (Cloudflare Workers, Vercel, etc.).
 * Export this as default in Workers entry point.
 *
 * @param controlPlane - ControlPlane instance
 * @returns Fetch handler function
 *
 * @example
 * ```ts
 * // Cloudflare Workers entry point
 * import { createControlPlane } from "agent-runtime/api/control";
 * import { createFetchHandler } from "agent-runtime/api/http";
 *
 * const controlPlane = createControlPlane(env.DB);
 * export default createFetchHandler(controlPlane);
 * ```
 */
export function createFetchHandler(controlPlane: ControlPlane): (request: Request) => Promise<Response> {
  const routes = createRoutes(controlPlane);
  return createRouter(routes);
}

/** Extract path parameter from request. */
function getPathParam(req: Request, name: string): string {
  return (req as any).params?.[name] ?? "";
}

/** Create JSON response. */
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Create error response. */
function errorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : String(error);
  const code = error instanceof Error && "code" in error ? (error as any).code : "INTERNAL_ERROR";
  const status = code === "NOT_FOUND" ? 404 : code === "VALIDATION_ERROR" ? 400 : 500;
  return jsonResponse(status, { error: message, code });
}