import { parseBuffer } from "music-metadata"

/**
 * Duração em segundos do buffer MP3 (ou null se não conseguir ler).
 */
export async function getMp3DurationSeconds(buffer) {
  try {
    const u8 = buffer instanceof Uint8Array ? buffer : Uint8Array.from(buffer)
    const meta = await parseBuffer(u8, { mimeType: "audio/mpeg" })
    const d = meta.format?.duration
    if (typeof d === "number" && Number.isFinite(d) && d > 0) return d
  } catch (e) {
    console.warn("[mp3Duration] parse falhou:", e?.message || e)
  }
  return null
}
