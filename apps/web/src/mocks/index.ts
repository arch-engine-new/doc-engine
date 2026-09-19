/**
 * Prototype mock leftover. Wired Walking Skeleton pages use live `/api` via `http.ts`.
 * Remaining shell pages still do not read this module.
 */
export const LIVE_API = true;

/** Explain that a page should call live /api instead of prototype mocks. */
export function mockNote(pageId: string): string {
  return `${pageId}: 使用 /api（core-engine HTTP 适配层），不再读取 designs/v0/mock。`;
}
