import { prisma } from "../lib/prisma.js"

/** GET /api/plans — catálogo de planos ativos (preços e créditos/mês). */
export async function listPlans(req, res) {
  try {
    const plans = await prisma.plan.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        slug: true,
        name: true,
        monthlyCredits: true,
        priceMonthlyCents: true,
        sortOrder: true,
      },
    })
    return res.status(200).json({ plans })
  } catch (err) {
    console.error("[plans] list:", err)
    return res.status(500).json({ message: "Erro ao listar planos." })
  }
}
