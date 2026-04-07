/** Rótulos amigáveis para CreditTransactionType (API). */
export const CREDIT_TYPE_LABELS = {
  PLAN_PERIOD_GRANT: "Créditos do plano",
  PLAN_CHANGE_ADJUST: "Ajuste de plano",
  PDF_UPLOAD: "Upload de PDF",
  TTS_AUDIO: "Áudio (TTS)",
  AI_SUMMARY: "IA — Resumo",
  AI_QUIZ: "IA — Quiz",
  AI_FLASHCARDS: "IA — Flashcards",
  AI_NOTES: "IA — Anotações",
  ADMIN_ADJUST: "Ajuste administrativo",
  REFUND: "Estorno",
}

export function labelForCreditType(type) {
  if (type == null) return "Movimentação"
  return CREDIT_TYPE_LABELS[type] || String(type).replace(/_/g, " ")
}

export function formatCreditDelta(amount) {
  const n = Number(amount)
  if (n > 0) return `+${n} crédito${n === 1 ? "" : "s"}`
  if (n < 0) {
    const a = Math.abs(n)
    return `−${a} crédito${a === 1 ? "" : "s"}`
  }
  return "0"
}

export function formatBrlFromCents(cents) {
  const c = Number(cents) || 0
  return (c / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
}

export function formatDatePt(iso) {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  } catch {
    return "—"
  }
}

export function formatDateTimePt(iso) {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return "—"
  }
}
