/**
 * Payment Links por plano.
 *
 * Recomendado: setar via env (Netlify/Render) para evitar hardcode.
 * - VITE_STRIPE_LINK_PRO
 * - VITE_STRIPE_LINK_PLUS
 * - VITE_STRIPE_LINK_ULTRA
 *
 * OBS: links `.../test_...` são do modo teste.
 */
export const STRIPE_PAYMENT_LINKS = {
    pro:
        import.meta.env.VITE_STRIPE_LINK_PRO ||
        "https://buy.stripe.com/9B600je7cfgUeNL6XC2ZO02", // (provável PROD)
    plus:
        import.meta.env.VITE_STRIPE_LINK_PLUS ||
        "https://buy.stripe.com/8x2dR95AG2u8cFD6XC2ZO01", // (provável PROD)
    ultra:
        import.meta.env.VITE_STRIPE_LINK_ULTRA ||
        "https://buy.stripe.com/test_14AbJ12oud8M20Zeq42ZO00",
}

// Exemplo PROD (deixe configurado via env quando for virar live):
// ultra: "https://buy.stripe.com/14AbJ12oud8M20Zeq42ZO00",

export function paymentLinkForPlanSlug(slug) {
    const s = String(slug ?? "").trim().toLowerCase()
    return STRIPE_PAYMENT_LINKS[s] || null
}

/**
 * Payment Links aceitam `prefilled_email` para ajudar a identificar o cliente.
 * Isso facilita reconciliar o pagamento com o User no webhook.
 */
export function buildPaymentLink(slug, { email } = {}) {
    const base = paymentLinkForPlanSlug(slug)
    if (!base) return null
    const e = String(email ?? "").trim()
    if (!e) return base
    const sep = base.includes("?") ? "&" : "?"
    return `${base}${sep}prefilled_email=${encodeURIComponent(e)}`
}

