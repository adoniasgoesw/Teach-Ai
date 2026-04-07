import Stripe from "stripe"

let singleton = null

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY não configurada.")
  }
  if (!singleton) {
    singleton = new Stripe(key)
  }
  return singleton
}
