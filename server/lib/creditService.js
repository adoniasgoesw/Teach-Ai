import { prisma } from "./prisma.js"
import { parsePositiveInt } from "./parseId.js"

export class InsufficientCreditsError extends Error {
  constructor(message, { balance = 0, required = 0 } = {}) {
    super(message)
    this.name = "InsufficientCreditsError"
    this.code = "INSUFFICIENT_CREDITS"
    this.balance = balance
    this.required = required
  }
}

export async function getCreditBalance(userId) {
  const id = parsePositiveInt(userId)
  if (id == null) return 0
  const w = await prisma.creditWallet.findUnique({
    where: { userId: id },
    select: { balance: true },
  })
  return w?.balance ?? 0
}

export async function getOrCreateWalletTx(tx, userId) {
  const id = parsePositiveInt(userId)
  if (id == null) {
    throw new InsufficientCreditsError(
      "Identificação de usuário ausente; não é possível usar créditos.",
      { balance: 0, required: 0 }
    )
  }
  return tx.creditWallet.upsert({
    where: { userId: id },
    create: { userId: id, balance: 0 },
    update: {},
  })
}

/**
 * Debita créditos dentro de uma transação Prisma já aberta.
 * `amount` > 0 = quantidade a consumir.
 */
export async function consumeCreditsTx(tx, { userId, amount, type, label, metadata }) {
  const id = parsePositiveInt(userId)
  const n = Math.floor(Number(amount))
  if (id == null) {
    throw new InsufficientCreditsError(
      "Identificação de usuário ausente; não é possível usar créditos.",
      { balance: 0, required: Math.max(0, n) }
    )
  }
  if (n <= 0) {
    const w = await getOrCreateWalletTx(tx, id)
    return { balanceAfter: w.balance, consumed: 0 }
  }

  await getOrCreateWalletTx(tx, id)
  const wallet = await tx.creditWallet.findUnique({ where: { userId: id } })
  const balance = wallet?.balance ?? 0
  if (balance < n) {
    throw new InsufficientCreditsError(
      "Seus créditos acabaram ou são insuficientes para esta ação.",
      { balance, required: n }
    )
  }

  const newBal = balance - n
  await tx.creditWallet.update({
    where: { userId: id },
    data: { balance: newBal },
  })
  await tx.creditTransaction.create({
    data: {
      userId: id,
      amount: -n,
      type,
      balanceAfter: newBal,
      label: label ?? undefined,
      metadata: metadata === undefined ? undefined : metadata,
    },
  })
  return { balanceAfter: newBal, consumed: n }
}

export function isInsufficientCreditsError(err) {
  return err instanceof InsufficientCreditsError || err?.code === "INSUFFICIENT_CREDITS"
}

export function jsonInsufficientCredits(err) {
  return {
    code: "INSUFFICIENT_CREDITS",
    message: err?.message || "Créditos insuficientes.",
    balance: err?.balance ?? 0,
    required: err?.required ?? 0,
  }
}
