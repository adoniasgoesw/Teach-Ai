import { loadStripe } from "@stripe/stripe-js"

let stripePromise

/**
 * Instância lazy do Stripe (só a chave publishable no front).
 * A chave secreta fica no servidor — nunca no Vite.
 */
export function getStripe() {
    const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
    if (!key || typeof key !== "string" || !key.trim()) return null
    if (!stripePromise) stripePromise = loadStripe(key.trim())
    return stripePromise
}

export function hasStripePublishableKey() {
    const k = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
    return typeof k === "string" && k.trim().length > 0
}
