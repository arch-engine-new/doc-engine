/**
 * C4 mock adapter: pending-mount returns receipt_id; writes without receipt fail and do not persist.
 */

import { newId } from "../ids.js";

export interface AdapterReceipt {
  receipt_id: string;
  status: string;
}

export interface CommittedAdapterWrite {
  payload: unknown;
  receipt: AdapterReceipt;
}

export interface UploadDocumentInput {
  projectId: string;
  docTypeId: string;
  buffer: Uint8Array | Buffer;
  metadata?: unknown;
  traceId: string;
}

export interface UploadDocumentResult {
  receipt_id: string;
  document_id: string;
  status: string;
}

const committed: CommittedAdapterWrite[] = [];

export function mockPendingMount(): AdapterReceipt {
  return { receipt_id: newId("adp"), status: "pending" };
}

export function commitAdapterWrite(
  payload: unknown,
  receipt: AdapterReceipt | null | undefined,
): CommittedAdapterWrite {
  if (!receipt?.receipt_id) {
    throw new Error("adapter write requires receipt_id");
  }
  const entry = { payload, receipt };
  committed.push(entry);
  return entry;
}

/**
 * Mock 资料云 upload: always issues receipt_id + document_id; persists via commitAdapterWrite.
 */
export function uploadDocument(input: UploadDocumentInput): UploadDocumentResult {
  const pending = mockPendingMount();
  const document_id = newId("adpdoc");
  const result: UploadDocumentResult = {
    receipt_id: pending.receipt_id,
    document_id,
    status: "uploaded",
  };
  commitAdapterWrite(
    {
      op: "documents/upload",
      projectId: input.projectId,
      docTypeId: input.docTypeId,
      traceId: input.traceId,
      metadata: input.metadata ?? null,
      document_id,
      size: input.buffer.byteLength,
    },
    { receipt_id: result.receipt_id, status: result.status },
  );
  return result;
}

export function listCommittedAdapterWrites(): CommittedAdapterWrite[] {
  return [...committed];
}

export function resetAdapterWrites(): void {
  committed.length = 0;
}
