/**
 * A failed page must not abort the rest of the book.
 * Breaking on `ocr_error` / `index_error` would leave remaining `pending`
 * pages stalled, forcing the operator back to 「处理一页」 for every leftover
 * page and violating ingest-run acceptance.
 *
 * Callers must inject the existing one-page tick (`tickStandardIngest`).
 * Opening a book-wide OCR / `tick-all` HTTP path would hide per-page failures
 * in a single request and break the ≤1 page per tick invariant.
 */
export async function runTickAll(
  tickFn: () => Promise<{ done: boolean; status: string }>,
): Promise<void> {
  for (;;) {
    const result = await tickFn();
    if (result.done) return;
  }
}
