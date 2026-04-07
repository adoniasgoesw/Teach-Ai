import { prisma } from "../lib/prisma.js"
import { getStripe } from "../lib/stripeServer.js"
import {
  planSlugFromStripePriceId,
  stripePriceIdForSlug,
} from "../lib/stripePlanEnv.js"
import { syncUserSubscriptionCredits } from "../lib/subscriptionCredits.js"

/**
 * POST /api/billing/create-subscription
 * Body: { userId, planId }
 * Retorna { clientSecret?: string | null, subscriptionId: string, status: string }
 * clientSecret ausente = pagamento já ok (ex.: valor zero) ou usar portal.
 */
export async function postCreateSubscription(req, res) {
  try {
    const userId =
      req.body?.userId != null ? String(req.body.userId).trim() : ""
    const planId =
      req.body?.planId != null ? String(req.body.planId).trim() : ""
    if (!userId || !planId) {
      return res
        .status(400)
        .json({ message: "userId e planId são obrigatórios." })
    }

    const plan = await prisma.plan.findFirst({
      where: { id: planId, active: true },
    })
    if (!plan || plan.slug === "free") {
      return res.status(400).json({ message: "Plano inválido ou gratuito." })
    }

    const priceId = stripePriceIdForSlug(plan.slug)
    if (!priceId) {
      return res.status(503).json({
        message: `Configure STRIPE_PRICE_${String(plan.slug).toUpperCase()} no servidor.`,
      })
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." })
    }

    await syncUserSubscriptionCredits(userId)

    const stripe = getStripe()

    let customerId = user.stripeCustomerId
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name || undefined,
        metadata: { appUserId: userId },
      })
      customerId = customer.id
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      })
    }

    const open = await stripe.subscriptions.list({
      customer: customerId,
      status: "incomplete",
      limit: 20,
    })
    for (const s of open.data) {
      try {
        await stripe.subscriptions.cancel(s.id)
      } catch {
        /* ignore */
      }
    }

    const subRow = await prisma.userSubscription.findUnique({
      where: { userId },
      include: { plan: true },
    })

    const meta = { appUserId: userId, appPlanId: plan.id }

    if (
      subRow?.externalSubscriptionId &&
      subRow.plan?.slug &&
      subRow.plan.slug !== "free"
    ) {
      const stripeSub = await stripe.subscriptions.retrieve(
        subRow.externalSubscriptionId
      )
      const itemId = stripeSub.items?.data?.[0]?.id
      if (!itemId) {
        return res.status(400).json({ message: "Assinatura Stripe inválida." })
      }

      const updated = await stripe.subscriptions.update(
        subRow.externalSubscriptionId,
        {
          items: [{ id: itemId, price: priceId }],
          metadata: meta,
          proration_behavior: "always_invoice",
          payment_behavior: "pending_if_incomplete",
          expand: ["latest_invoice.payment_intent"],
        }
      )

      await prisma.userSubscription.update({
        where: { userId },
        data: {
          externalCustomerId: customerId,
          externalSubscriptionId: updated.id,
          status: "INCOMPLETE",
        },
      })

      const pi = updated.latest_invoice?.payment_intent
      const clientSecret =
        pi && typeof pi === "object" && pi.client_secret
          ? pi.client_secret
          : null

      return res.status(200).json({
        clientSecret,
        subscriptionId: updated.id,
        status: updated.status,
      })
    }

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      metadata: meta,
      payment_behavior: "default_incomplete",
      payment_settings: {
        save_default_payment_method: "on_subscription",
      },
      expand: ["latest_invoice.payment_intent"],
    })

    await prisma.userSubscription.update({
      where: { userId },
      data: {
        externalCustomerId: customerId,
        externalSubscriptionId: subscription.id,
        status: "INCOMPLETE",
      },
    })

    const pi = subscription.latest_invoice?.payment_intent
    const clientSecret =
      pi && typeof pi === "object" && pi.client_secret
        ? pi.client_secret
        : null

    return res.status(200).json({
      clientSecret,
      subscriptionId: subscription.id,
      status: subscription.status,
    })
  } catch (err) {
    console.error("[billing] create-subscription:", err)
    const msg = err?.raw?.message || err?.message || "Erro ao criar assinatura."
    return res.status(500).json({ message: msg })
  }
}
