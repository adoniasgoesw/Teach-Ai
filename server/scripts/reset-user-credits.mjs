/**
 * Zera o histórico de CreditTransaction do usuário e define saldo fixo na carteira.
 * Útil para dev/teste (“resetar” para 20 créditos).
 *
 * Uso (PowerShell):
 *   cd server
 *   npm run seed:reset-credits
 *
 * Outro usuário / saldo:
 *   $env:USER_ID="seu-id"; $env:BALANCE="20"; node scripts/reset-user-credits.mjs
 */
import "dotenv/config"
import { prisma } from "../lib/prisma.js"
import { parsePositiveInt } from "../lib/parseId.js"

const userId = parsePositiveInt(process.env.USER_ID ?? "1")
const balance = Math.max(0, Math.floor(Number(process.env.BALANCE ?? 20)))

async function main() {
  if (userId == null) {
    console.error("[reset-credits] USER_ID inválido (número inteiro > 0).")
    process.exit(1)
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  })
  if (!user) {
    console.error("[reset-credits] Usuário não encontrado:", userId)
    process.exit(1)
  }

  await prisma.$transaction(async (tx) => {
    await tx.creditTransaction.deleteMany({ where: { userId } })
    await tx.creditWallet.upsert({
      where: { userId },
      create: { userId, balance },
      update: { balance },
    })
    await tx.creditTransaction.create({
      data: {
        userId,
        amount: balance,
        type: "ADMIN_ADJUST",
        balanceAfter: balance,
        label: `Reset de saldo → ${balance} créditos`,
        metadata: { script: "reset-user-credits.mjs" },
      },
    })
  })

  console.log(
    "[reset-credits] OK — user:",
    userId,
    "(" + user.email + ") | saldo:",
    balance,
    "| histórico anterior apagado; 1 linha ADMIN_ADJUST."
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
