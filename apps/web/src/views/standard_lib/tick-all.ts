/**
 * Serial per-page tick until the ingest run reports done.
 * ocr_error / index_error must not break the loop; remaining pending pages still tick.
 * Callers pass the existing one-page tick (no book-wide OCR API).
 */
export async function runTickAll(
  tickFn: () => Promise<{ done: boolean; status: string }>,
): Promise<void> {
  for (;;) {
    const result = await tickFn();
    if (result.done) return;
  }
}
