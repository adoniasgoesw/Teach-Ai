/** PDF: até 30 pág. = 2; 31–80 = 4; 81–150 = 6. Acima disso não aceitamos upload. */
export const PDF_MAX_PAGES = 150

export function pdfCreditsForPageCount(pages) {
  const p = Math.floor(Number(pages) || 0)
  if (p < 1) return 2
  if (p <= 30) return 2
  if (p <= 80) return 4
  if (p <= PDF_MAX_PAGES) return 6
  return null
}

/** Cobrança TTS: 1 crédito por bloco de 10 min de áudio (arredonda para cima). */
export const TTS_MINUTES_PER_CREDIT = 10
const TTS_SECONDS_PER_CREDIT = TTS_MINUTES_PER_CREDIT * 60

/**
 * Créditos a partir da duração real do MP3 (segundos).
 * Ex.: ≤10 min → 1; ≤20 min → 2; ≤30 min → 3.
 */
export function ttsCreditsForPlaybackSeconds(seconds) {
  const s = Number(seconds)
  if (!Number.isFinite(s) || s <= 0) return 1
  return Math.max(1, Math.ceil(s / TTS_SECONDS_PER_CREDIT))
}

/**
 * Fallback (ex.: falha ao ler duração do MP3): ~700 caracteres ≈ 1 min.
 * Mesma regra de blocos de 10 min.
 */
export const TTS_CHARS_PER_MINUTE_ESTIMATE = 700

export function ttsCreditsForText(text) {
  const len = String(text ?? "").length
  if (len <= 0) return 1
  const estimatedMinutes = len / TTS_CHARS_PER_MINUTE_ESTIMATE
  return Math.max(1, Math.ceil(estimatedMinutes / TTS_MINUTES_PER_CREDIT))
}

/** Limite de caracteres por pedido TTS (evita abuso). */
export const TTS_MAX_TEXT_CHARS = 400_000

export const CREDIT_AI_QUIZ = 1
export const CREDIT_AI_FLASHCARDS = 1
export const CREDIT_AI_NOTES = 1
export const CREDIT_AI_SUMMARY = 1
