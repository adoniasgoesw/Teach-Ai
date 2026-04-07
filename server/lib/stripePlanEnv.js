/**
 * Mapeia slug do plano → Price id na Stripe (price_…).
 * Configure no .env: STRIPE_PRICE_PRO, STRIPE_PRICE_PLUS, STRIPE_PRICE_ULTRA
 */
export function stripePriceIdForSlug(slug) {
  const s = String(slug || "")
    .trim()
    .toLowerCase()
  const map = {
    pro: process.env.STRIPE_PRICE_PRO?.trim(),
    plus: process.env.STRIPE_PRICE_PLUS?.trim(),
    ultra: process.env.STRIPE_PRICE_ULTRA?.trim(),
  }
  return map[s] || null
}

export function planSlugFromStripePriceId(priceId) {
  const id = String(priceId || "").trim()
  if (!id) return null
  if (id === process.env.STRIPE_PRICE_PRO?.trim()) return "pro"
  if (id === process.env.STRIPE_PRICE_PLUS?.trim()) return "plus"
  if (id === process.env.STRIPE_PRICE_ULTRA?.trim()) return "ultra"
  return null
}
