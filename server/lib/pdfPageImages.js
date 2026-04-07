import { pdf as pdfToImages } from "pdf-to-img"

/**
 * Renderiza as primeiras páginas do PDF em PNG (Buffer) para envio ao Gemini (visão).
 * @param {Buffer|Uint8Array} pdfBuffer
 * @param {{ maxPages?: number, scale?: number }} [opts]
 * @returns {Promise<Buffer[]>}
 */
export async function renderPdfPagesToPngBuffers(pdfBuffer, opts = {}) {
  const maxPages = Math.max(1, Math.min(200, Number(opts.maxPages) || 24))
  const scale = Number(opts.scale) > 0 ? Number(opts.scale) : 2

  const doc = await pdfToImages(pdfBuffer, { scale })
  const total = doc.length
  const n = Math.min(total, maxPages)
  const out = []
  for (let i = 1; i <= n; i++) {
    const buf = await doc.getPage(i)
    out.push(Buffer.isBuffer(buf) ? buf : Buffer.from(buf))
  }
  return out
}
