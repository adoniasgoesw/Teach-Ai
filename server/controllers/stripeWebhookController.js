import { prisma } from "../lib/prisma.js"
import { getStripe } from "../lib/stripeServer.js"
import { planSlugFromStripePriceId } from "../lib/stripePlanEnv.js"
import { addOneCalendarMonth } from "../lib/subscriptionCredits.js"

function prismaSubStatus(stripeStatus) {
  switch (stripeStatus) {
    case "active":
      return "ACTIVE"
    case "past_due":
      return "PAST_DUE"
    case "canceled":
      return "CANCELED"
    case "incomplete":
      return "INCOMPLETE"
    case "incomplete_expired":
      return "CANCELED"
    case "trialing":
      return "TRIALING"
    case "unpaid":
      return "PAST_DUE"
    default:
      return "INCOMPLETE"
  }
}

async function extractPmCardFromSub(subscription, stripe) {
  let pm = subscription.default_payment_method
  if (typeof pm === "string") {
    try {
      pm = await stripe.paymentMethods.retrieve(pm)
    } catch {
      return null
    }
  }
  if (pm && typeof pm === "object" && pm.card) {
    return {
      last4: pm.card.last4,
      brand: pm.card.brand,
      exp_month: pm.card.exp_month,
      exp_year: pm.card.exp_year,
    }
  }
  return null
}

async function resolvePlanFromStripeSubscription(sub) {
  if (sub.metadata?.appPlanId) {
    const p = await prisma.plan.findUnique({
      where: { id: sub.metadata.appPlanId },
    })
    if (p) return p
  }
  const priceId = sub.items?.data?.[0]?.price?.id
  const slug = planSlugFromStripePriceId(priceId)
  if (!slug) return null
  return prisma.plan.findUnique({ where: { slug } })
}

async function resolveUserIdFromStripeSubscription(sub, stripe) {
  const metaUserId = sub.metadata?.appUserId
  if (metaUserId) {
    const u = await prisma.user.findUnique({ where: { id: String(metaUserId) } })
    if (u) return String(u.id)
  }

  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer?.id
  if (!customerId) return null

  const byCustomer = await prisma.user.findUnique({
    where: { stripeCustomerId: customerId },
    select: { id: true, stripeCustomerId: true, email: true },
  })
  if (byCustomer) return String(byCustomer.id)

  // Fallback: reconciliar por e-mail do customer
  try {
    const customer = await stripe.customers.retrieve(customerId)
    const email =
      customer && typeof customer === "object" ? customer.email?.trim() : ""
    if (!email) return null
    const byEmail = await prisma.user.findUnique({
      where: { email },
      select: { id: true, stripeCustomerId: true },
    })
    if (!byEmail) return null
    if (!byEmail.stripeCustomerId) {
      await prisma.user.update({
        where: { id: byEmail.id },
        data: { stripeCustomerId: customerId },
      })
    }
    return String(byEmail.id)
  } catch {
    return null
  }
}

async function handleInvoicePaid(invoice) {
  const stripe = getStripe()
  const subId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription?.id
  if (!subId || invoice.status !== "paid") return

  const invId = invoice.id
  const existing = await prisma.invoice.findUnique({
    where: { externalId: invId },
  })
  if (existing?.status === "PAID") return

  const sub = await stripe.subscriptions.retrieve(subId, {
    expand: ["default_payment_method"],
  })
  const userId = await resolveUserIdFromStripeSubscription(sub, stripe)
  if (!userId) {
    console.warn("[stripe] invoice.paid: não foi possível identificar user", subId)
    return
  }

  const plan = await resolvePlanFromStripeSubscription(sub)
  if (!plan) {
    console.warn("[stripe] invoice.paid: plano não resolvido", subId)
    return
  }

  const billingReason = invoice.billing_reason
  const amountPaid = invoice.amount_paid ?? 0
  const grantPeriod =
    (billingReason === "subscription_create" ||
      billingReason === "subscription_cycle") &&
    amountPaid > 0

  const card = await extractPmCardFromSub(sub, stripe)
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer?.id

  await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.upsert({
      where: { externalId: invId },
      create: {
        userId,
        planId: plan.id,
        amountCents: amountPaid,
        currency: String(invoice.currency || "brl").toUpperCase(),
        status: "PAID",
        description:
          invoice.description?.trim() || `Assinatura TeachAI — ${plan.name}`,
        paidAt: new Date(),
        dueAt: invoice.due_date
          ? new Date(invoice.due_date * 1000)
          : null,
        externalId: invId,
        hostedInvoiceUrl: invoice.hosted_invoice_url || null,
        metadata: { stripe: true, billingReason },
      },
      update: {
        planId: plan.id,
        amountCents: amountPaid,
        status: "PAID",
        paidAt: new Date(),
        hostedInvoiceUrl: invoice.hosted_invoice_url || null,
        metadata: { stripe: true, billingReason },
      },
    })

    await tx.creditWallet.upsert({
      where: { userId },
      create: { userId, balance: 0 },
      update: {},
    })

    if (grantPeriod) {
      const grant = plan.monthlyCredits
      await tx.creditWallet.update({
        where: { userId },
        data: { balance: { increment: grant } },
      })
      const wallet = await tx.creditWallet.findUnique({
        where: { userId },
        select: { balance: true },
      })
      await tx.creditTransaction.create({
        data: {
          userId,
          amount: grant,
          type: "PLAN_PERIOD_GRANT",
          balanceAfter: wallet?.balance ?? grant,
          label:
            billingReason === "subscription_create"
              ? `Assinatura ${plan.name} — créditos`
              : `Renovação ${plan.name} — créditos`,
          metadata: { stripeInvoiceId: invId, subscriptionId: subId },
          invoiceId: inv.id,
        },
      })
    }

    const periodStart = new Date(sub.current_period_start * 1000)
    const periodEnd = new Date(sub.current_period_end * 1000)
    await tx.userSubscription.upsert({
      where: { userId },
      create: {
        userId,
        planId: plan.id,
        status: "ACTIVE",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        creditsIncludedThisPeriod: plan.monthlyCredits,
        externalSubscriptionId: sub.id,
        externalCustomerId: customerId ?? undefined,
        lastPaymentAmountCents: amountPaid,
        lastPaymentAt: new Date(),
        cardLast4: card?.last4 ?? null,
        cardBrand: card?.brand ?? null,
        cardExpMonth: card?.exp_month ?? null,
        cardExpYear: card?.exp_year ?? null,
      },
      update: {
        planId: plan.id,
        status: "ACTIVE",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        creditsIncludedThisPeriod: plan.monthlyCredits,
        externalSubscriptionId: sub.id,
        externalCustomerId: customerId ?? undefined,
        lastPaymentAmountCents: amountPaid,
        lastPaymentAt: new Date(),
        cardLast4: card?.last4 ?? null,
        cardBrand: card?.brand ?? null,
        cardExpMonth: card?.exp_month ?? null,
        cardExpYear: card?.exp_year ?? null,
      },
    })
  })
}

async function handleInvoicePaymentFailed(invoice) {
  const subId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription?.id
  if (!subId) return
  const stripe = getStripe()
  const sub = await stripe.subscriptions.retrieve(subId, {
    expand: ["default_payment_method"],
  })
  const userId = await resolveUserIdFromStripeSubscription(sub, stripe)
  if (!userId) return
  const plan = await resolvePlanFromStripeSubscription(sub)
  if (!plan) return
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer?.id
  const card = await extractPmCardFromSub(sub, stripe)
  const periodStart = new Date(sub.current_period_start * 1000)
  const periodEnd = new Date(sub.current_period_end * 1000)
  await prisma.userSubscription.upsert({
    where: { userId },
    create: {
      userId,
      planId: plan.id,
      status: "PAST_DUE",
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      creditsIncludedThisPeriod: plan.monthlyCredits,
      externalSubscriptionId: sub.id,
      externalCustomerId: customerId ?? undefined,
      cardLast4: card?.last4 ?? null,
      cardBrand: card?.brand ?? null,
      cardExpMonth: card?.exp_month ?? null,
      cardExpYear: card?.exp_year ?? null,
    },
    update: {
      status: "PAST_DUE",
      planId: plan.id,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      creditsIncludedThisPeriod: plan.monthlyCredits,
      externalSubscriptionId: sub.id,
      externalCustomerId: customerId ?? undefined,
      cardLast4: card?.last4 ?? null,
      cardBrand: card?.brand ?? null,
      cardExpMonth: card?.exp_month ?? null,
      cardExpYear: card?.exp_year ?? null,
    },
  })
}

async function handleSubscriptionUpdated(sub) {
  const stripe = getStripe()
  const userId = await resolveUserIdFromStripeSubscription(sub, stripe)
  if (!userId) return
  if (sub.status !== "active" && sub.status !== "past_due") return

  const plan = await resolvePlanFromStripeSubscription(sub)
  if (!plan) return

  const card = await extractPmCardFromSub(sub, stripe)
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer?.id

  const periodStart = new Date(sub.current_period_start * 1000)
  const periodEnd = new Date(sub.current_period_end * 1000)
  await prisma.userSubscription.upsert({
    where: { userId },
    create: {
      userId,
      planId: plan.id,
      status: prismaSubStatus(sub.status),
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      creditsIncludedThisPeriod: plan.monthlyCredits,
      externalSubscriptionId: sub.id,
      externalCustomerId: customerId ?? undefined,
      cardLast4: card?.last4 ?? null,
      cardBrand: card?.brand ?? null,
      cardExpMonth: card?.exp_month ?? null,
      cardExpYear: card?.exp_year ?? null,
    },
    update: {
      planId: plan.id,
      status: prismaSubStatus(sub.status),
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      creditsIncludedThisPeriod: plan.monthlyCredits,
      externalSubscriptionId: sub.id,
      externalCustomerId: customerId ?? undefined,
      cardLast4: card?.last4 ?? null,
      cardBrand: card?.brand ?? null,
      cardExpMonth: card?.exp_month ?? null,
      cardExpYear: card?.exp_year ?? null,
    },
  })
}

async function handleSubscriptionDeleted(sub) {
  const stripe = getStripe()
  const userId = await resolveUserIdFromStripeSubscription(sub, stripe)
  if (!userId) return
  const free = await prisma.plan.findUnique({ where: { slug: "free" } })
  if (!free) return
  const now = new Date()
  await prisma.userSubscription.upsert({
    where: { userId },
    create: {
      userId,
      planId: free.id,
      status: "ACTIVE",
      externalSubscriptionId: null,
      externalCustomerId: null,
      creditsIncludedThisPeriod: free.monthlyCredits,
      currentPeriodStart: now,
      currentPeriodEnd: addOneCalendarMonth(now),
    },
    update: {
      planId: free.id,
      status: "ACTIVE",
      externalSubscriptionId: null,
      externalCustomerId: null,
      creditsIncludedThisPeriod: free.monthlyCredits,
      currentPeriodStart: now,
      currentPeriodEnd: addOneCalendarMonth(now),
      cardLast4: null,
      cardBrand: null,
      cardExpMonth: null,
      cardExpYear: null,
      lastPaymentAmountCents: null,
      lastPaymentAt: null,
    },
  })
}

async function handleCheckoutSessionCompleted(session) {
  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id
  const email = session.customer_details?.email?.trim() || ""
  if (!customerId || !email) return

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, stripeCustomerId: true },
  })
  if (!user) return
  if (!user.stripeCustomerId) {
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeCustomerId: customerId },
    })
  }
}

/**
 * POST /api/billing/webhook — body RAW (Buffer), não JSON.
 */
export async function postStripeWebhook(req, res) {
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  if (!whSecret) {
    console.error("[stripe] STRIPE_WEBHOOK_SECRET ausente")
    return res.status(503).json({ message: "Webhook não configurado." })
  }

  const sig = req.headers["stripe-signature"]
  let stripe
  try {
    stripe = getStripe()
  } catch {
    return res.status(503).json({ message: "Stripe não configurado." })
  }

  let event
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, whSecret)
  } catch (err) {
    console.error("[stripe] webhook assinatura:", err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object)
        break
      case "invoice.paid":
        await handleInvoicePaid(event.data.object)
        break
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object)
        break
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object)
        break
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object)
        break
      default:
        break
    }
  } catch (e) {
    console.error("[stripe] webhook handler:", e)
    return res.status(500).json({ ok: false })
  }

  return res.status(200).json({ received: true })
}
