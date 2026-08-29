/** Fetch wrapper for live `/api/*` (Vite middleware → JobPipeline). */

import type {
  ExcelCellMappingView,
  ExcelCellMappingWrite,
  JobView,
  ReceiptView,
  SignatureTaskView,
  TemplateView,
} from "./types";

/** Thrown when `/api/*` returns a non-2xx status so callers can branch on HTTP status. */
export class HttpError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(status: number, payload: unknown) {
    super(`HTTP ${status}`);
    this.status = status;
    this.payload = payload;
  }
}

export interface DictItem {
  value: string;
  label: string;
}

/** JSON fetch helper for same-origin `/api` and `/adapter` routes served by the Vite middleware. */
export async function http<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(path, { ...init, headers });
  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : null;
  if (!res.ok) throw new HttpError(res.status, data);
  return data as T;
}

/** Surface adapter `{ error }` bodies; fall back to Error.message. */
export function errorMessage(err: unknown): string {
  if (err instanceof HttpError) {
    const payload = err.payload;
    if (payload && typeof payload === "object" && "error" in payload) {
      return String((payload as { error: unknown }).error);
    }
    return err.message;
  }
  return err instanceof Error ? err.message : String(err);
}

const dictCache = new Map<string, DictItem[]>();

/** Dropdown options from `GET /api/dict/:dictType` (no hardcoded option arrays). */
export async function loadDict(dictType: string): Promise<DictItem[]> {
  const cached = dictCache.get(dictType);
  if (cached) return cached;
  const data = await http<{ dictType: string; items: DictItem[] }>(`/api/dict/${dictType}`);
  dictCache.set(dictType, data.items);
  return data.items;
}

/** Map a dict value to its label; unknown values stay as the raw code. */
export function dictLabel(items: DictItem[], value: string): string {
  return items.find((item) => item.value === value)?.label ?? value;
}

/** Multipart upload for POST /api/templates/:id/excel-template. */
export async function uploadExcelTemplate(
  templateId: string,
  file: File,
  excelSheetName?: string,
): Promise<{ template: TemplateView }> {
  const form = new FormData();
  form.append("file", file);
  if (excelSheetName) form.append("excel_sheet_name", excelSheetName);

  const res = await fetch(`/api/templates/${templateId}/excel-template`, { method: "POST", body: form });
  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : null;
  if (!res.ok) throw new HttpError(res.status, data);
  return data as { template: TemplateView };
}

export async function fetchExcelMappings(templateId: string): Promise<ExcelCellMappingView[]> {
  const data = await http<{ mappings: ExcelCellMappingView[] }>(
    `/api/templates/${templateId}/excel-mappings`,
  );
  return data.mappings;
}

export async function saveExcelMappings(
  templateId: string,
  mappings: ExcelCellMappingWrite[],
): Promise<ExcelCellMappingView[]> {
  const data = await http<{ mappings: ExcelCellMappingView[] }>(
    `/api/templates/${templateId}/excel-mappings`,
    { method: "PUT", body: JSON.stringify({ mappings }) },
  );
  return data.mappings;
}

/** Pending signature tasks for the 资料待签 tab. */
export async function fetchPendingSignatures(): Promise<SignatureTaskView[]> {
  const data = await http<{ tasks: SignatureTaskView[] }>("/api/pending/signatures");
  return data.tasks;
}

/** Confirm a signature task and receive a Receipt. */
export async function confirmSignatureTask(
  taskId: string,
  signerName: string,
): Promise<{ task: SignatureTaskView; receipt: ReceiptView }> {
  return http<{ task: SignatureTaskView; receipt: ReceiptView }>(
    `/api/signature-tasks/${taskId}/confirm`,
    { method: "POST", body: JSON.stringify({ signerName }) },
  );
}

/** Multipart upload for POST /api/jobs/upload — no JSON Content-Type (browser sets boundary). */
export async function uploadJob(
  file: File,
  fields?: { packId?: string; templateId?: string; projectId?: string; docTypeId?: string },
): Promise<{ job: JobView }> {
  const form = new FormData();
  form.append("file", file);
  if (fields?.projectId) form.append("project_id", fields.projectId);
  if (fields?.packId) form.append("pack_id", fields.packId);
  if (fields?.docTypeId) form.append("doc_type_id", fields.docTypeId);
  if (fields?.templateId) form.append("template_id", fields.templateId);

  const res = await fetch("/api/jobs/upload", { method: "POST", body: form });
  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : null;
  if (!res.ok) throw new HttpError(res.status, data);
  return data as { job: JobView };
}
