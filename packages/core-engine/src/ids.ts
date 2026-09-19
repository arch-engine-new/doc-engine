import { randomUUID } from "node:crypto";

/** Short prefixed id for ledger business keys. */
export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
