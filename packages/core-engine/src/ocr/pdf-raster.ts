/**
 * Single-page PDF raster for standard ingest. Scanned pages must OCR a PNG,
 * never the original PDF bytes (R24 / D11).
 */

import { getDocumentProxy, renderPageAsImage } from "unpdf";

export type PdfPageRasterFn = (bytes: Uint8Array, pageNo: number) => Promise<Uint8Array>;

let injectedRaster: PdfPageRasterFn | undefined;

/**
 * Tests replace the live unpdf+canvas path so CI stays green without
 * `@napi-rs/canvas`. Production must not rely on this hook.
 */
export function setPdfPageRaster(fn: PdfPageRasterFn | undefined): void {
  injectedRaster = fn;
}

/**
 * Rasterize one 1-based PDF page to PNG. Failures throw; callers must not
 * fall back to handing the whole PDF to Paddle.
 */
export async function renderPdfPagePng(bytes: Uint8Array, pageNo: number): Promise<Uint8Array> {
  if (pageNo < 1 || !Number.isInteger(pageNo)) {
    throw new Error(`pdf page must be 1-based, got ${pageNo}`);
  }
  if (injectedRaster) {
    return injectedRaster(bytes, pageNo);
  }
  return renderLivePdfPagePng(bytes, pageNo);
}

async function renderLivePdfPagePng(bytes: Uint8Array, pageNo: number): Promise<Uint8Array> {
  const data = Uint8Array.from(bytes);
  const pdf = await getDocumentProxy(data);
  try {
    const image = await renderPageAsImage(pdf, pageNo, {
      canvasImport: () => import("@napi-rs/canvas"),
    });
    return new Uint8Array(image);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `pdf raster failed for page ${pageNo}; install @napi-rs/canvas to enable live unpdf render: ${message}`,
    );
  }
}
