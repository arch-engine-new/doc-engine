import {
  BucketAlreadyExists,
  BucketAlreadyOwnedByYou,
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  NoSuchBucket,
  NoSuchKey,
  NotFound,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { BlobPutInput, BlobStore } from "./port.js";

const DEFAULT_BUCKET = "docengine";
const PLACEHOLDER_REGION = "us-east-1";

/**
 * Constructor inputs so callers can pass endpoint/keys without reading `.env`.
 * MinIO credentials stay local; this store is not the 资料云 / pending-mount adapter.
 */
export interface MinioBlobStoreOptions {
  endpoint?: string;
  accessKey?: string;
  secretKey?: string;
  bucket?: string;
  env?: NodeJS.ProcessEnv;
}

function readTrimmed(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const raw = env[key];
  if (raw == null) {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function errorName(err: unknown): string {
  if (typeof err !== "object" || err === null || !("name" in err)) {
    return "";
  }
  return String((err as { name: unknown }).name);
}

function httpStatus(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) {
    return undefined;
  }
  return (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
}

function isBucketMissing(err: unknown): boolean {
  return (
    err instanceof NotFound ||
    err instanceof NoSuchBucket ||
    errorName(err) === "NotFound" ||
    errorName(err) === "NoSuchBucket" ||
    httpStatus(err) === 404
  );
}

function isBucketAlreadyThere(err: unknown): boolean {
  return (
    err instanceof BucketAlreadyOwnedByYou ||
    err instanceof BucketAlreadyExists ||
    errorName(err) === "BucketAlreadyOwnedByYou" ||
    errorName(err) === "BucketAlreadyExists"
  );
}

function isObjectMissing(err: unknown): boolean {
  return err instanceof NoSuchKey || errorName(err) === "NoSuchKey" || httpStatus(err) === 404;
}

/**
 * Strip path separators, control characters, and `..` so a user filename cannot
 * become a nested S3 key or path-traversal prefix inside jobs/{job_id}/.
 */
export function safeName(fileName: string): string {
  const sanitized = fileName
    .replace(/[/\\]/g, "_")
    .replace(/\.\./g, "_")
    .replace(/[\u0000-\u001f\u007f]/g, "_")
    .trim();
  return sanitized.length > 0 ? sanitized : "unnamed";
}

/**
 * Build the object key Task 7 writes onto DocumentRow.file_uri after put.
 * Shape is jobs/{job_id}/{safeName} so OCR can re-read the original by job.
 */
export function uploadObjectKey(jobId: string, fileName: string): string {
  return `jobs/${jobId}/${safeName(fileName)}`;
}

/**
 * Assemble DocumentRow.file_uri as s3://{bucket}/{key}. The ledger already has
 * this column; MinIO is only the bytes, not a new table and not 资料云.
 */
export function blobObjectUri(bucket: string, key: string): string {
  return `s3://${bucket}/${key}`;
}

/**
 * S3-compatible BlobStore for original uploads so OCR can re-read bytes.
 * MinIO is NOT the pending-mount / 资料云 adapter (`/adapter/pending-mount`).
 * Uses path-style addressing because MinIO has no virtual-host DNS for buckets.
 */
export class MinioBlobStore implements BlobStore {
  readonly bucket: string;
  private readonly client: S3Client;

  constructor(options: MinioBlobStoreOptions = {}) {
    const env = options.env ?? process.env;
    const endpoint = options.endpoint ?? readTrimmed(env, "MINIO_ENDPOINT");
    if (!endpoint) {
      throw new Error("MINIO_ENDPOINT is required to construct MinioBlobStore");
    }
    const accessKey = options.accessKey ?? readTrimmed(env, "MINIO_ACCESS_KEY");
    const secretKey = options.secretKey ?? readTrimmed(env, "MINIO_SECRET_KEY");
    if (!accessKey || !secretKey) {
      throw new Error(
        "Incomplete MinIO configuration: missing MINIO_ACCESS_KEY or MINIO_SECRET_KEY",
      );
    }
    this.bucket = options.bucket ?? readTrimmed(env, "MINIO_BUCKET") ?? DEFAULT_BUCKET;
    this.client = new S3Client({
      endpoint,
      region: PLACEHOLDER_REGION,
      forcePathStyle: true,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }

  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return;
    } catch (err) {
      if (!isBucketMissing(err)) {
        throw err;
      }
    }
    try {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    } catch (err) {
      if (isBucketAlreadyThere(err)) {
        return;
      }
      throw err;
    }
  }

  async put(input: BlobPutInput): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.bytes,
        ContentType: input.mime,
      }),
    );
  }

  async get(key: string): Promise<Uint8Array> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!response.Body) {
        throw new Error(`Blob not found: ${key}`);
      }
      return await response.Body.transformToByteArray();
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("Blob not found:")) {
        throw err;
      }
      if (isObjectMissing(err)) {
        throw new Error(`Blob not found: ${key}`);
      }
      throw err;
    }
  }
}

/**
 * Skip constructing S3Client when MINIO_ENDPOINT is empty/unset so tests and
 * memory-mode assembly never talk to MinIO. Incomplete keys must throw instead
 * of silently pretending uploads succeeded.
 */
export function fromEnv(env: NodeJS.ProcessEnv = process.env): MinioBlobStore | null {
  const endpoint = readTrimmed(env, "MINIO_ENDPOINT");
  if (!endpoint) {
    return null;
  }
  const accessKey = readTrimmed(env, "MINIO_ACCESS_KEY");
  const secretKey = readTrimmed(env, "MINIO_SECRET_KEY");
  if (!accessKey || !secretKey) {
    throw new Error(
      "Incomplete MinIO configuration: MINIO_ENDPOINT is set but MINIO_ACCESS_KEY or MINIO_SECRET_KEY is missing",
    );
  }
  return new MinioBlobStore({
    endpoint,
    accessKey,
    secretKey,
    bucket: readTrimmed(env, "MINIO_BUCKET"),
    env,
  });
}
