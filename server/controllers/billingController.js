import { prisma } from "../lib/prisma.js"
import { parsePositiveInt } from "../lib/parseId.js"
import { getStripe } from "../lib/stripeServer.js"
import {
  planSlugFromStripePriceId,
  stripePriceIdForSlug,
} from "../lib/stripePlanEnv.js"
import { syncUserSubscriptionCredits } from "../lib/subscriptionCredits.js"
import { addOneCalendarMonth } from "../lib/subscriptionCredits.js"

/**
 * POST /api/billing/create-subscription
 * Body: { userId, planId }
 * Retorna { clientSecret?: string | null, subscriptionId: string, status: string }
 * clientSecret ausente = pagamento já ok (ex.: valor zero) ou usar portal.
 */
export async function postCreateSubscription(req, res) {
  try {
    const userId = parsePositiveInt(req.body?.userId)
    const planId = parsePositiveInt(req.body?.planId)
    if (userId == null || planId == null) {
      return res
        .status(400)
        .json({ message: "userId e planId são obrigatórios (números)." })
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
        metadata: { appUserId: String(user.id) },
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

    const meta = { appUserId: String(user.id), appPlanId: String(plan.id) }

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

/**
 * POST /api/billing/cancel-subscription
 * Body: { userId }
 *
 * Agenda cancelamento ao fim do período de cobrança (Stripe `cancel_at_period_end`).
 * O usuário mantém o plano até `currentPeriodEnd`; depois o webhook `customer.subscription.deleted` define Free.
 */
export async function postCancelSubscription(req, res) {
  try {
    const userId = parsePositiveInt(req.body?.userId)
    if (userId == null) {
      return res.status(400).json({ message: "userId é obrigatório (número)." })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, stripeCustomerId: true },
    })
    if (!user) return res.status(404).json({ message: "Usuário não encontrado." })

    const subRow = await prisma.userSubscription.findUnique({
      where: { userId },
      include: { plan: { select: { slug: true } } },
    })

    if (!subRow) {
      return res.status(200).json({ ok: true, scheduled: false })
    }

    if (!subRow.externalSubscriptionId) {
      return res.status(200).json({ ok: true, scheduled: false })
    }

    const stripe = getStripe()
    let stripeSub
    try {
      stripeSub = await stripe.subscriptions.retrieve(subRow.externalSubscriptionId)
    } catch (e) {
      console.warn(
        "[billing] cancel-subscription: retrieve failed",
        e?.message || e
      )
      return res.status(502).json({
        message: "Não foi possível ler a assinatura na Stripe.",
      })
    }

    if (
      stripeSub.status === "canceled" ||
      stripeSub.status === "incomplete_expired"
    ) {
      return res.status(400).json({
        message: "Esta assinatura já está encerrada na Stripe.",
      })
    }

    if (stripeSub.cancel_at_period_end) {
      await prisma.userSubscription.update({
        where: { userId },
        data: { cancelAtPeriodEnd: true },
      })
      return res.status(200).json({ ok: true, scheduled: true })
    }

    try {
      await stripe.subscriptions.update(subRow.externalSubscriptionId, {
        cancel_at_period_end: true,
      })
    } catch (e) {
      console.warn(
        "[billing] cancel-subscription: stripe update failed",
        e?.message || e
      )
      return res.status(502).json({
        message:
          "Não foi possível agendar o cancelamento na Stripe. Tente novamente.",
      })
    }

    await prisma.userSubscription.update({
      where: { userId },
      data: { cancelAtPeriodEnd: true },
    })

    return res.status(200).json({ ok: true, scheduled: true })
  } catch (err) {
    console.error("[billing] cancel-subscription:", err)
    return res.status(500).json({ message: "Erro ao cancelar assinatura." })
  }
}

/**
 * POST /api/billing/resume-subscription
 * Body: { userId }
 *
 * Remove o cancelamento agendado (`cancel_at_period_end: false`).
 */
export async function postResumeSubscription(req, res) {
  try {
    const userId = parsePositiveInt(req.body?.userId)
    if (userId == null) {
      return res.status(400).json({ message: "userId é obrigatório (número)." })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    })
    if (!user) return res.status(404).json({ message: "Usuário não encontrado." })

    const subRow = await prisma.userSubscription.findUnique({
      where: { userId },
      select: { externalSubscriptionId: true, cancelAtPeriodEnd: true },
    })

    if (!subRow?.externalSubscriptionId) {
      return res.status(200).json({ ok: true, resumed: false })
    }

    const stripe = getStripe()
    let stripeSub
    try {
      stripeSub = await stripe.subscriptions.retrieve(subRow.externalSubscriptionId)
    } catch (e) {
      console.warn(
        "[billing] resume-subscription: retrieve failed",
        e?.message || e
      )
      return res.status(502).json({
        message: "Não foi possível ler a assinatura na Stripe.",
      })
    }

    if (stripeSub.status === "canceled" || stripeSub.status === "incomplete_expired") {
      return res.status(400).json({
        message: "Assinatura já encerrada; faça uma nova assinatura pelo checkout.",
      })
    }

    if (!stripeSub.cancel_at_period_end) {
      await prisma.userSubscription.update({
        where: { userId },
        data: { cancelAtPeriodEnd: false },
      })
      return res.status(200).json({ ok: true, resumed: false })
    }

    try {
      await stripe.subscriptions.update(subRow.externalSubscriptionId, {
        cancel_at_period_end: false,
      })
    } catch (e) {
      console.warn(
        "[billing] resume-subscription: stripe update failed",
        e?.message || e
      )
      return res.status(502).json({
        message: "Não foi possível reativar a assinatura na Stripe.",
      })
    }

    await prisma.userSubscription.update({
      where: { userId },
      data: { cancelAtPeriodEnd: false },
    })

    return res.status(200).json({ ok: true, resumed: true })
  } catch (err) {
    console.error("[billing] resume-subscription:", err)
    return res.status(500).json({ message: "Erro ao reativar assinatura." })
  }
}

/**
 * GET /api/billing/invoices?userId=&take=
 * Lista faturas registradas no banco (Stripe + local).
 */
export async function getBillingInvoices(req, res) {
  try {
    const userId = parsePositiveInt(req.query?.userId)
    if (userId == null) {
      return res.status(400).json({ message: "userId é obrigatório (número)." })
    }

    const takeRaw = Number(req.query?.take)
    const take = Number.isFinite(takeRaw)
      ? Math.min(200, Math.max(1, Math.floor(takeRaw)))
      : 50

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    })
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." })
    }

    const invoices = await prisma.invoice.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }],
      take,
      select: {
        id: true,
        amountCents: true,
        currency: true,
        status: true,
        description: true,
        paidAt: true,
        dueAt: true,
        externalId: true,
        hostedInvoiceUrl: true,
        createdAt: true,
      },
    })

    return res.status(200).json({ invoices })
  } catch (err) {
    console.error("[billing] invoices:", err)
    return res.status(500).json({ message: "Erro ao listar faturas." })
  }
}
