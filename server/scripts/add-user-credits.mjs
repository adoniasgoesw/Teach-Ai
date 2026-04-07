/**
 * Soma créditos ao saldo atual (mantém histórico). Registra ADMIN_ADJUST.
 *
 * Uso:
 *   cd server
 *   npm run seed:add-credits
 *
 * PowerShell (outro usuário / quantidade):
 *   $env:USER_ID="seu-id"; $env:DELTA="20"; node scripts/add-user-credits.mjs
 */
import "dotenv/config"
import { prisma } from "../lib/prisma.js"

const userId = String(process.env.USER_ID ?? "1").trim()
const delta = Math.max(0, Math.floor(Number(process.env.DELTA ?? 20)))

async function main() {
  if (!delta) {
    console.error("[add-credits] DELTA deve ser > 0.")
    process.exit(1)
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  })
  if (!user) {
    console.error("[add-credits] Usuário não encontrado:", userId)
    process.exit(1)
  }

  const result = await prisma.$transaction(async (tx) => {
    const wallet = await tx.creditWallet.upsert({
      where: { userId },
      create: { userId, balance: 0 },
      update: {},
    })
    const prev = wallet.balance ?? 0
    const next = prev + delta
    await tx.creditWallet.update({
      where: { userId },
      data: { balance: next },
    })
    await tx.creditTransaction.create({
      data: {
        userId,
        amount: delta,
        type: "ADMIN_ADJUST",
        balanceAfter: next,
        label: `Ajuste manual +${delta} créditos`,
        metadata: { script: "add-user-credits.mjs", previousBalance: prev },
      },
    })
    return { prev, next }
  })

  console.log(
    "[add-credits] OK — user:",
    userId,
    "(" + user.email + ") |",
    result.prev,
    "→",
    result.next,
    "(+" + delta + ")"
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
