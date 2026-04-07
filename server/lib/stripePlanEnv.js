/**
 * Lista de ids em env (um id ou vários separados por vírgula).
 */
function envIdList(raw) {
  if (!raw || typeof raw !== "string") return []
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

function envMatchesId(envVal, id) {
  const want = String(id || "").trim()
  if (!want) return false
  return envIdList(envVal).includes(want)
}

/**
 * Mapeia slug do plano → Price id na Stripe (price_…).
 * Configure no .env: STRIPE_PRICE_PRO, STRIPE_PRICE_PLUS, STRIPE_PRICE_ULTRA
 * (pode usar vários price_… separados por vírgula se recriar preços no Stripe).
 */
export function stripePriceIdForSlug(slug) {
  const s = String(slug || "")
    .trim()
    .toLowerCase()
  const map = {
    pro: process.env.STRIPE_PRICE_PRO,
    plus: process.env.STRIPE_PRICE_PLUS,
    ultra: process.env.STRIPE_PRICE_ULTRA,
  }
  const raw = map[s]
  const list = envIdList(raw)
  return list[0] || null
}

export function planSlugFromStripePriceId(priceId) {
  const id = String(priceId || "").trim()
  if (!id) return null
  if (envMatchesId(process.env.STRIPE_PRICE_PRO, id)) return "pro"
  if (envMatchesId(process.env.STRIPE_PRICE_PLUS, id)) return "plus"
  if (envMatchesId(process.env.STRIPE_PRICE_ULTRA, id)) return "ultra"
  return null
}

/**
 * Fallback: mapear por Product id (prod_…) do Stripe.
 * Útil quando Payment Link cria price novo mas o produto é o mesmo.
 * Env: STRIPE_PRODUCT_PRO, STRIPE_PRODUCT_PLUS, STRIPE_PRODUCT_ULTRA
 */
export function planSlugFromStripeProductId(productId) {
  const pid = String(productId || "").trim()
  if (!pid) return null
  if (envMatchesId(process.env.STRIPE_PRODUCT_PRO, pid)) return "pro"
  if (envMatchesId(process.env.STRIPE_PRODUCT_PLUS, pid)) return "plus"
  if (envMatchesId(process.env.STRIPE_PRODUCT_ULTRA, pid)) return "ultra"
  return null
}
