import { prisma } from "../lib/prisma.js"
import { syncUserSubscriptionCredits } from "../lib/subscriptionCredits.js"

const DEFAULT_TX_TAKE = 80

/**
 * GET /api/credits/transactions?userId=&take=
 * Histórico de movimentações (ledger) — consumos e entradas.
 */
export async function getCreditTransactions(req, res) {
  try {
    const userId =
      req.query?.userId != null ? String(req.query.userId).trim() : ""
    if (!userId) {
      return res.status(400).json({ message: "userId é obrigatório." })
    }

    const takeRaw = Number(req.query?.take)
    const take = Number.isFinite(takeRaw)
      ? Math.min(200, Math.max(1, Math.floor(takeRaw)))
      : DEFAULT_TX_TAKE

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    })
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." })
    }

    const rows = await prisma.creditTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        amount: true,
        type: true,
        balanceAfter: true,
        label: true,
        metadata: true,
        createdAt: true,
      },
    })

    return res.status(200).json({ transactions: rows })
  } catch (err) {
    console.error("[credits] transactions:", err)
    return res.status(500).json({ message: "Erro ao listar transações." })
  }
}

/**
 * GET /api/account/summary?userId=
 * Perfil mínimo + carteira + assinatura/plano + uso no ciclo + config de cobrança.
 */
export async function getAccountSummary(req, res) {
  try {
    const userId =
      req.query?.userId != null ? String(req.query.userId).trim() : ""
    if (!userId) {
      return res.status(400).json({ message: "userId é obrigatório." })
    }

    // Aplica concessões mensais do plano Free/legado quando o ciclo vence.
    // Para planos Stripe, a concessão vem dos webhooks (invoice.paid) e o sync não mexe.
    await syncUserSubscriptionCredits(userId)

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    })
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." })
    }

    await prisma.creditWallet.upsert({
      where: { userId },
      create: { userId, balance: 0 },
      update: {},
    })

    const [wallet, subscription, billingConfig] = await Promise.all([
      prisma.creditWallet.findUnique({
        where: { userId },
        select: { balance: true, updatedAt: true },
      }),
      prisma.userSubscription.findUnique({
        where: { userId },
        include: {
          plan: {
            select: {
              id: true,
              slug: true,
              name: true,
              monthlyCredits: true,
              priceMonthlyCents: true,
            },
          },
        },
      }),
      prisma.billingConfig.findUnique({
        where: { id: "default" },
        select: { creditUnitCents: true },
      }),
    ])

    const balance = wallet?.balance ?? 0
    const periodStart =
      subscription?.currentPeriodStart ??
      (() => {
        const d = new Date()
        d.setDate(1)
        d.setHours(0, 0, 0, 0)
        return d
      })()

    const spentAgg = await prisma.creditTransaction.aggregate({
      where: {
        userId,
        createdAt: { gte: periodStart },
        amount: { lt: 0 },
      },
      _sum: { amount: true },
    })
    const usedThisPeriod = Math.abs(Number(spentAgg._sum.amount) || 0)

    const planMonthlyCredits =
      subscription?.creditsIncludedThisPeriod ??
      subscription?.plan?.monthlyCredits ??
      null

    return res.status(200).json({
      user,
      wallet: {
        balance,
        updatedAt: wallet?.updatedAt ?? null,
      },
      subscription: subscription
        ? {
            status: subscription.status,
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd,
            creditsIncludedThisPeriod: subscription.creditsIncludedThisPeriod,
            lastPaymentAt: subscription.lastPaymentAt,
            lastPaymentAmountCents: subscription.lastPaymentAmountCents,
            externalCustomerId: subscription.externalCustomerId,
            externalSubscriptionId: subscription.externalSubscriptionId,
            canceledAt: subscription.canceledAt,
            cardLast4: subscription.cardLast4,
            cardBrand: subscription.cardBrand,
            cardExpMonth: subscription.cardExpMonth,
            cardExpYear: subscription.cardExpYear,
            plan: subscription.plan,
          }
        : null,
      billingConfig: billingConfig
        ? { creditUnitCents: billingConfig.creditUnitCents }
        : { creditUnitCents: 10 },
      usage: {
        remaining: balance,
        usedThisPeriod,
        planMonthlyCredits,
      },
    })
  } catch (err) {
    console.error("[account] summary:", err)
    return res.status(500).json({ message: "Erro ao carregar resumo da conta." })
  }
}

/**
 * GET /api/credits/wallet?userId=
 * Saldo atual (carteira criada implicitamente com 0 se não existir).
 */
export async function getCreditsWallet(req, res) {
  try {
    const userId =
      req.query?.userId != null ? String(req.query.userId).trim() : ""
    if (!userId) {
      return res.status(400).json({ message: "userId é obrigatório." })
    }

    await prisma.creditWallet.upsert({
      where: { userId },
      create: { userId, balance: 0 },
      update: {},
    })

    const row = await prisma.creditWallet.findUnique({
      where: { userId },
      select: { balance: true, updatedAt: true },
    })

    return res.status(200).json({
      userId,
      balance: row?.balance ?? 0,
      updatedAt: row?.updatedAt ?? null,
    })
  } catch (err) {
    console.error("[credits] wallet:", err)
    return res.status(500).json({ message: "Erro ao consultar créditos." })
  }
}
