import type { BlobPutInput, BlobStore } from "./port.js";

/**
 * In-memory BlobStore so unit tests never need MinIO or process.env.
 * Copies buffers on put/get so callers cannot mutate stored objects.
 */
export class MemoryBlobStore implements BlobStore {
  private readonly objects = new Map<string, Uint8Array>();

  async ensureBucket(): Promise<void> {
    return;
  }

  async put(input: BlobPutInput): Promise<void> {
    this.objects.set(input.key, new Uint8Array(input.bytes));
  }

  async get(key: string): Promise<Uint8Array> {
    const stored = this.objects.get(key);
    if (stored === undefined) {
      throw new Error(`Blob not found: ${key}`);
    }
    return new Uint8Array(stored);
  }
}
