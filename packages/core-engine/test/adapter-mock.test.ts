/**
 * C4 mock adapter: pending-mount receipt; write without receipt_id fails and does not persist.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  commitAdapterWrite,
  listCommittedAdapterWrites,
  mockPendingMount,
  resetAdapterWrites,
  uploadDocument,
} from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OPENAPI = join(
  __dirname,
  "../../../docs/schema/generated/adapter-openapi.yaml",
);

describe("C4 mock adapter", () => {
  beforeEach(() => {
    resetAdapterWrites();
  });

  it("OpenAPI drafts POST /adapter/pending-mount with receipt_id and status", () => {
    const yaml = readFileSync(OPENAPI, "utf-8");
    expect(yaml).toContain("/adapter/pending-mount");
    expect(yaml).toContain("receipt_id");
    expect(yaml).toContain("status");
  });

  it("OpenAPI drafts POST /adapter/documents/upload with receipt_id and document_id", () => {
    const yaml = readFileSync(OPENAPI, "utf-8");
    expect(yaml).toContain("/adapter/documents/upload");
    expect(yaml).toContain("document_id");
  });

  it("mockPendingMount returns non-empty receipt_id", () => {
    const receipt = mockPendingMount();
    expect(receipt.receipt_id.length).toBeGreaterThan(0);
    expect(receipt.status).toBe("pending");
  });

  it("commitAdapterWrite without receipt_id throws and does not persist", () => {
    expect(() => commitAdapterWrite({ mount: "x" }, null)).toThrow(/receipt_id/);
    expect(() => commitAdapterWrite({ mount: "x" }, { receipt_id: "", status: "pending" })).toThrow(
      /receipt_id/,
    );
    expect(listCommittedAdapterWrites()).toHaveLength(0);

    const receipt = mockPendingMount();
    commitAdapterWrite({ mount: "ok" }, receipt);
    expect(listCommittedAdapterWrites()).toHaveLength(1);
    expect(listCommittedAdapterWrites()[0]?.receipt.receipt_id).toBe(receipt.receipt_id);
  });

  it("uploadDocument commits write with receipt_id and document_id", () => {
    const result = uploadDocument({
      projectId: "proj_test",
      docTypeId: "dt_test",
      buffer: new Uint8Array([0x50, 0x4b]),
      traceId: "trc_test",
      metadata: { artifact_id: "art_test" },
    });
    expect(result.receipt_id.length).toBeGreaterThan(0);
    expect(result.document_id.length).toBeGreaterThan(0);
    expect(result.status).toBe("uploaded");
    expect(listCommittedAdapterWrites()).toHaveLength(1);
  });
});
