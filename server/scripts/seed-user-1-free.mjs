/**
 * Garante usuário id "1" com plano Free, assinatura ativa e 20 créditos na carteira.
 * Pré-requisito: `npm run seed:credits` (planos no banco).
 *
 * Uso:
 *   node scripts/seed-user-1-free.mjs
 *
 * Recriar do zero (apaga transações e zera saldo antes de aplicar):
 *   FORCE_USER1_RESET=1 node scripts/seed-user-1-free.mjs
 */
import "dotenv/config"
import bcrypt from "bcrypt"
import { prisma } from "../lib/prisma.js"

const USER_ID = "1"
const SEED_EMAIL = "user1@teachai.seed"

async function main() {
  const freePlan = await prisma.plan.findUnique({
    where: { slug: "free" },
  })
  if (!freePlan) {
    console.error(
      '[seed:user1] Plano "free" não encontrado. Rode: npm run seed:credits'
    )
    process.exit(1)
  }

  const now = new Date()
  const periodEnd = new Date(now)
  periodEnd.setMonth(periodEnd.getMonth() + 1)

  const passwordHash = await bcrypt.hash("TeachAi2026!Test", 10)

  await prisma.user.upsert({
    where: { id: USER_ID },
    create: {
      id: USER_ID,
      email: SEED_EMAIL,
      name: "Usuário Teste 1",
      password: passwordHash,
      createdAt: now,
      updatedAt: now,
    },
    update: {
      name: "Usuário Teste 1",
      updatedAt: now,
    },
  })

  if (process.env.FORCE_USER1_RESET === "1") {
    await prisma.creditTransaction.deleteMany({ where: { userId: USER_ID } })
    await prisma.creditWallet.upsert({
      where: { userId: USER_ID },
      create: { userId: USER_ID, balance: 0 },
      update: { balance: 0 },
    })
    console.log("[seed:user1] FORCE_USER1_RESET: transações removidas, saldo zerado.")
  }

  await prisma.userSubscription.upsert({
    where: { userId: USER_ID },
    create: {
      userId: USER_ID,
      planId: freePlan.id,
      status: "ACTIVE",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      creditsIncludedThisPeriod: freePlan.monthlyCredits,
    },
    update: {
      planId: freePlan.id,
      status: "ACTIVE",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      creditsIncludedThisPeriod: freePlan.monthlyCredits,
    },
  })

  const targetBalance = 20
  await prisma.$transaction(async (tx) => {
    await tx.creditWallet.upsert({
      where: { userId: USER_ID },
      create: { userId: USER_ID, balance: targetBalance },
      update: { balance: targetBalance },
    })

    const existingGrant = await tx.creditTransaction.findFirst({
      where: {
        userId: USER_ID,
        type: "PLAN_PERIOD_GRANT",
        label: "Seed user1 — créditos iniciais",
      },
    })
    if (!existingGrant) {
      await tx.creditTransaction.create({
        data: {
          userId: USER_ID,
          amount: targetBalance,
          type: "PLAN_PERIOD_GRANT",
          balanceAfter: targetBalance,
          label: "Seed user1 — créditos iniciais",
          metadata: { source: "seed-user-1-free.mjs" },
        },
      })
    }
  })

  const w = await prisma.creditWallet.findUnique({
    where: { userId: USER_ID },
  })
  console.log(
    "[seed:user1] OK — user id:",
    USER_ID,
    "| email:",
    SEED_EMAIL,
    "| saldo:",
    w?.balance,
    "| senha de teste: TeachAi2026!Test"
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
