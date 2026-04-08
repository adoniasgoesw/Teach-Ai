import { prisma } from "../lib/prisma.js"
import { parsePositiveInt } from "../lib/parseId.js"

/** GET /api/users/profile?userId= */
export async function getUserProfile(req, res) {
  try {
    const userId = parsePositiveInt(req.query?.userId)
    if (userId == null) {
      return res.status(400).json({ message: "userId é obrigatório (número)." })
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
