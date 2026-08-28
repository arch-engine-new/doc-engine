import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import {
  handleDemoRequest,
  type DemoHttpMultipart,
  type DemoHttpMultipartFields,
  type DemoHttpMultipartFile,
  type DemoHttpRequest,
} from "./handle-request.js";
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

function readContentType(req: IncomingMessage): string {
  const raw = req.headers["content-type"];
  if (Array.isArray(raw)) return raw[0] ?? "";
  return raw ?? "";
}

function isMultipartContentType(contentType: string): boolean {
  return contentType.toLowerCase().startsWith("multipart/form-data");
}

function extractBoundary(contentType: string): string | null {
  for (const segment of contentType.split(";")) {
    const trimmed = segment.trim();
    if (!trimmed.toLowerCase().startsWith("boundary=")) continue;
    const value = trimmed.slice("boundary=".length).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      return value.slice(1, -1);
    }
    return value;
  }
  return null;
}

function parseContentDisposition(header: string): { name?: string; fileName?: string } {
  const nameQuoted = /name="([^"]+)"/i.exec(header);
  const nameBare = /name=([^;\s]+)/i.exec(header);
  const fileQuoted = /filename="([^"]+)"/i.exec(header);
  const fileBare = /filename=([^;\s]+)/i.exec(header);
  const fileName = fileQuoted?.[1] ?? fileBare?.[1];
  return {
    name: nameQuoted?.[1] ?? nameBare?.[1],
    fileName: fileName ? decodeURIComponent(fileName.replace(/^"|"$/g, "")) : undefined,
  };
}

function guessMime(fileName: string, partContentType?: string): string {
  if (partContentType && partContentType.length > 0) {
    return partContentType.split(";")[0]!.trim();
  }
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".pdf")) return "application/pdf";
  return "application/octet-stream";
}

/**
 * Hand-rolled multipart parser so upload routes get binary file bytes without a
 * new dependency; only fields needed by POST /api/jobs/upload are surfaced.
 */
export function parseMultipartBody(raw: Buffer, boundary: string): DemoHttpMultipart {
  const delimiter = Buffer.from(`--${boundary}`);
  const result: DemoHttpMultipart = { fields: {} };
  let offset = 0;

  while (offset < raw.length) {
    const start = raw.indexOf(delimiter, offset);
    if (start < 0) break;
    let partStart = start + delimiter.length;
    if (raw[partStart] === 0x2d && raw[partStart + 1] === 0x2d) break;
    if (raw[partStart] === 0x0d && raw[partStart + 1] === 0x0a) {
      partStart += 2;
    }
    const next = raw.indexOf(delimiter, partStart);
    if (next < 0) break;
    let partEnd = next;
    if (partEnd >= 2 && raw[partEnd - 2] === 0x0d && raw[partEnd - 1] === 0x0a) {
      partEnd -= 2;
    }
    const part = raw.subarray(partStart, partEnd);
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd < 0) {
      offset = next;
      continue;
    }
    const headerText = part.subarray(0, headerEnd).toString("utf8");
    const body = part.subarray(headerEnd + 4);
    const disposition = parseContentDisposition(headerText);
    const typeMatch = /content-type:\s*([^\r\n]+)/i.exec(headerText);
    const partMime = typeMatch?.[1]?.trim();

    if (disposition.fileName != null) {
      const file: DemoHttpMultipartFile = {
        bytes: new Uint8Array(body),
        fileName: disposition.fileName,
        mime: guessMime(disposition.fileName, partMime),
      };
      result.file = file;
    } else if (disposition.name != null) {
      const text = body.toString("utf8");
      result.fields[disposition.name as keyof DemoHttpMultipartFields] = text;
    }
    offset = next;
  }

  return result;
}

export async function readRawBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return Buffer.alloc(0);
  return Buffer.concat(chunks);
}

export async function readNodeBody(req: IncomingMessage): Promise<unknown> {
  const contentType = readContentType(req);
  const raw = await readRawBody(req);
  if (raw.length === 0) return {};

  if (isMultipartContentType(contentType)) {
    const boundary = extractBoundary(contentType);
    if (!boundary) return {};
    return parseMultipartBody(raw, boundary).fields;
  }

  const text = raw.toString("utf8").trim();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

export async function nodeRequestToDemo(req: IncomingMessage): Promise<DemoHttpRequest> {
  const method = req.method ?? "GET";
  const url = req.url ?? "/";
  if (method === "GET" || method === "HEAD") {
    return { method, url, body: {} };
  }

  const contentType = readContentType(req);
  const raw = await readRawBody(req);
  if (isMultipartContentType(contentType)) {
    const boundary = extractBoundary(contentType);
    if (!boundary) {
      return { method, url, body: {} };
    }
    const multipart = parseMultipartBody(raw, boundary);
    return { method, url, body: multipart.fields, multipart };
  }

  let body: unknown = {};
  if (raw.length > 0) {
    const text = raw.toString("utf8").trim();
    if (text) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = { raw: text };
      }
    }
  }
  return { method, url, body };
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
