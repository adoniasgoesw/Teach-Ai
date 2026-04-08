import { prisma } from "../lib/prisma.js"
import { parsePositiveInt } from "../lib/parseId.js"

export async function createCourse(req, res) {
  try {
    const { name, userId: userIdRaw } = req.body

    const userId = parsePositiveInt(userIdRaw)
    if (userId == null) {
      return res.status(400).json({ message: "O ID do usuário é obrigatório (número)." })
    }

    if (!name) {
      return res.status(400).json({ message: "O nome do curso é obrigatório." })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    })

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." })
    }

    const course = await prisma.course.create({
      data: {
        name,
        userId: user.id,
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        userId: true,
      },
    })

    return res.status(201).json({
      course,
      message: "Curso criado com sucesso.",
    })
  } catch (error) {
    console.error("Erro ao criar curso:", error)
    return res.status(500).json({ message: "Erro interno ao criar curso." })
  }
}

export async function listCourses(req, res) {
  try {
    const userId = parsePositiveInt(req.query?.userId)
    if (userId == null) {
      return res.status(400).json({ message: "O ID do usuário é obrigatório (número)." })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    })

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." })
    }

    const courses = await prisma.course.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        userId: true,
        _count: { select: { sources: true } },
      },
    })

    return res.status(200).json({ courses })
  } catch (error) {
    console.error("Erro ao listar cursos:", error)
    return res.status(500).json({ message: "Erro interno ao listar cursos." })
  }
}

