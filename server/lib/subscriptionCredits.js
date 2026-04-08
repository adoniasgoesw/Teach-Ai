import { Prisma } from "@prisma/client"
import { prisma } from "./prisma.js"
import { parsePositiveInt } from "./parseId.js"

/** Próximo mês civil; evita “pular” dias em meses curtos. */
export function addOneCalendarMonth(date) {
  const d = new Date(date)
  const day = d.getDate()
  d.setMonth(d.getMonth() + 1)
  if (d.getDate() < day) d.setDate(0)
  return d
}

async function ensureFreeSubscriptionIfMissing(tx, userId) {
  const sub = await tx.userSubscription.findUnique({ where: { userId } })
  if (sub) return
  const freePlan = await tx.plan.findUnique({ where: { slug: "free" } })
  if (!freePlan) return
  const now = new Date()
  const periodEnd = addOneCalendarMonth(now)
  await tx.userSubscription.create({
    data: {
      userId,
      planId: freePlan.id,
      status: "ACTIVE",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      creditsIncludedThisPeriod: freePlan.monthlyCredits,
    },
  })
}

/**
 * Enquanto o período vigente já tiver terminado, soma créditos do plano ao saldo
 * (não substitui) e avança o ciclo. Idempotente por ciclo dentro da transação.
 */
async function applyDuePeriodGrantsInTx(tx, userId) {
  const now = new Date()
  for (;;) {
    const sub = await tx.userSubscription.findUnique({
      where: { userId },
      include: { plan: true },
    })
    if (!sub || sub.status !== "ACTIVE") break
    /// Ciclo e créditos de planos pagos vêm dos webhooks Stripe (invoice.paid).
    if (sub.externalSubscriptionId) break
    if (now.getTime() <= sub.currentPeriodEnd.getTime()) break

    const grant =
      sub.plan?.monthlyCredits ?? sub.creditsIncludedThisPeriod ?? 0
    if (grant <= 0) break

    await tx.creditWallet.update({
      where: { userId },
      data: { balance: { increment: grant } },
    })
    const wallet = await tx.creditWallet.findUnique({
      where: { userId },
      select: { balance: true },
    })
    const newStart = sub.currentPeriodEnd
    const newEnd = addOneCalendarMonth(newStart)
    await tx.creditTransaction.create({
      data: {
        userId,
        amount: grant,
        type: "PLAN_PERIOD_GRANT",
        balanceAfter: wallet?.balance ?? grant,
        label: "Renovação mensal — créditos do plano",
        metadata: {
          periodStart: newStart.toISOString(),
          periodEnd: newEnd.toISOString(),
          planSlug: sub.plan?.slug ?? null,
        },
      },
    })
    await tx.userSubscription.update({
      where: { userId },
      data: {
        currentPeriodStart: newStart,
        currentPeriodEnd: newEnd,
        creditsIncludedThisPeriod: grant,
      },
    })
  }
}

const TX_OPTS = {
  maxWait: 5000,
  timeout: 15000,
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
}

async function runSyncTransaction(userId) {
  await prisma.$transaction(async (tx) => {
    await ensureFreeSubscriptionIfMissing(tx, userId)
    await applyDuePeriodGrantsInTx(tx, userId)
  }, TX_OPTS)
}

/**
 * Garante carteira, assinatura Free legada (se faltar) e concessões mensais em atraso (+saldo).
 */
export async function syncUserSubscriptionCredits(userId) {
  const uid = parsePositiveInt(userId)
  if (uid == null) {
    throw new Error("syncUserSubscriptionCredits: userId inválido.")
  }
  await prisma.creditWallet.upsert({
    where: { userId: uid },
    create: { userId: uid, balance: 0 },
    update: {},
  })

  const attempts = 3
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try {
      await runSyncTransaction(uid)
      return
    } catch (err) {
      lastErr = err
      if (err?.code === "P2034" && i < attempts - 1) continue
      throw err
    }
  }
  throw lastErr
}
