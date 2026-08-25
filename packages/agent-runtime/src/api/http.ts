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
import type { IncomingMessage, ServerResponse } from "node:http";

/** HTTP server options. */
export interface HttpServerOptions {
  /** Port to listen on. */
  port: number;
  /** Hostname to bind to (default: "0.0.0.0"). */
  hostname?: string;
  /** Base path prefix for all routes (e.g., "/api/v1"). */
  basePath?: string;
  /** Optional logger function. */
  logger?: (message: string) => void;
}

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

    const server = http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
      const headers: Record<string, string> = {};
      for (const key of Object.keys(req.headers)) {
        const value = req.headers[key];
        if (value) headers[key] = Array.isArray(value) ? value[0] : value;
      }
      const hasBody = req.method !== "GET" && req.method !== "HEAD";
      const request = new Request(url.toString(), {
        method: req.method,
        headers,
        body: hasBody ? await collectBody(req) : undefined,
      });

      try {
        const response = await handler(request);
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });
        res.writeHead(response.status, responseHeaders);
        if (response.body) {
          // For ReadableStream body (Node 18+)
          const reader = response.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(Buffer.from(value));
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
          server.close((err: Error | null | undefined) => (err ? reject(err) : resolve()));
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
function createRoutes(controlPlane: ControlPlane, basePath: string = ""): Route[] {
  const prefix = basePath.replace(/\/$/, "");
  return [
    // POST /graphs - Compile a graph
    {
      method: "POST",
      path: `${prefix}/graphs`,
      handler: async (req) => {
        try {
          const def = (await req.json()) as { definition: GraphDefinition };
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
      path: `${prefix}/graphs/:graphId`,
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
      path: `${prefix}/runs`,
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
      path: `${prefix}/runs`,
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
      path: `${prefix}/runs/:runId`,
      handler: async (req) => {
        const runId = getPathParam(req, "runId");
        const run = await controlPlane.getRun(runId);
        if (!run) {
          return jsonResponse(404, { error: "Run not found" });
        }
        return jsonResponse(200, run);
      },
    },

    // POST /runs/:runId/wait - Wait for run completion
    {
      method: "POST",
      path: `${prefix}/runs/:runId/wait`,
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
      path: `${prefix}/runs/:runId/cancel`,
      handler: async (req) => {
        const runId = getPathParam(req, "runId");
        const cancelled = await controlPlane.cancelRun(runId);
        if (!cancelled) {
          return jsonResponse(404, { error: "Run not found or not running" });
        }
        return jsonResponse(200, { cancelled: true });
      },
    },

    // POST /runs/:runId/resume - Resume HITL
    {
      method: "POST",
      path: `${prefix}/runs/:runId/resume`,
      handler: async (req) => {
        try {
          const runId = getPathParam(req, "runId");
          const { token, decision } = (await req.json()) as { token: string; decision: HitlDecision };
          const result = await controlPlane.resumeHitl({ runId, token, decision });
          return jsonResponse(200, result);
        } catch (error) {
          return errorResponse(error);
        }
      },
    },

    // GET /runs/:runId/trace - Get event trace
    {
      method: "GET",
      path: `${prefix}/runs/:runId/trace`,
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
      path: `${prefix}/runs/:runId`,
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
      path: `${prefix}/health`,
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
 * @param options - Server options (port, hostname, basePath, logger)
 * @returns HttpServer instance (already listening if port provided)
 *
 * @example
 * ```ts
 * const controlPlane = createControlPlane(store);
 * const server = createHttpServer(controlPlane, { port: 3000 });
 * console.log("Server running on http://localhost:3000");
 * ```
 */
export async function createHttpServer(controlPlane: ControlPlane, options?: HttpServerOptions): Promise<HttpServer> {
  const routes = createRoutes(controlPlane, options?.basePath);
  const handler = createRouter(routes);
  const server = createNativeServer(handler);

  if (options?.port !== undefined) {
    const hostname = options.hostname ?? "0.0.0.0";
    await server.listen(options.port, hostname);
    options.logger?.(`HTTP server listening on http://${hostname}:${options.port}${options.basePath ?? ""}`);
  }

  return server;
}

/**
 * Create a fetch handler for serverless/platform deployments (Cloudflare Workers, Vercel, etc.).
 * Export this as default in Workers entry point.
 *
 * @param controlPlane - ControlPlane instance
 * @param options - Optional base path
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
export function createFetchHandler(controlPlane: ControlPlane, options?: { basePath?: string }): (request: Request) => Promise<Response> {
  const routes = createRoutes(controlPlane, options?.basePath);
  return createRouter(routes);
}

/** Extract path parameter from request. */
function getPathParam(req: Request, name: string): string {
  return (req as any).params?.[name] ?? "";
}

/** Collect the full request body as text (Node http IncomingMessage is a stream). */
function collectBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
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