/**
 * Bytes to persist for a later OCR/extract step.
 * DocumentRow.file_uri already names the object; this input is only the payload.
 */
export interface BlobPutInput {
  key: string;
  bytes: Uint8Array;
  mime?: string;
}

/**
 * Object store for original uploads so OCR can re-read bytes without a new ledger table.
 * Production uses MinIO (Task 3); tests use MemoryBlobStore. DocumentRow.file_uri already holds the URI.
 */
export interface BlobStore {
  ensureBucket(): Promise<void>;
  put(input: BlobPutInput): Promise<void>;
  get(key: string): Promise<Uint8Array>;
}
