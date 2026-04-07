import { prisma } from "../lib/prisma.js"

/** GET /api/users/profile?userId= */
export async function getUserProfile(req, res) {
  try {
    const userId =
      req.query?.userId != null ? String(req.query.userId).trim() : ""
    if (!userId) {
      return res.status(400).json({ message: "userId é obrigatório." })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." })
    }

    return res.status(200).json({ user })
  } catch (err) {
    console.error("[users] profile:", err)
    return res.status(500).json({ message: "Erro ao carregar perfil." })
  }
}
