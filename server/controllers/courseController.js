import { prisma } from "../lib/prisma.js"

export async function createCourse(req, res) {
  try {
    const { name, description, userId } = req.body

    if (!userId) {
      return res.status(400).json({ message: "O ID do usuário é obrigatório." })
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

    // Busca o maior id numérico atual da tabela de cursos e soma +1. Se não existir, começa em 1.
    const rows =
      (await prisma.$queryRaw`SELECT COALESCE(MAX(CAST(id AS INTEGER)), 0) AS "max" FROM "Course" WHERE id ~ '^[0-9]+$'`) ??
      []
    const currentMax = Number(rows[0]?.max ?? 0)
    const nextId = String(currentMax + 1)

    const course = await prisma.course.create({
      data: {
        id: nextId,
        name,
        description: description || null,
        userId: user.id,
      },
      select: {
        id: true,
        name: true,
        description: true,
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
    const { userId } = req.query

    if (!userId) {
      return res.status(400).json({ message: "O ID do usuário é obrigatório." })
    }

    const user = await prisma.user.findUnique({
      where: { id: String(userId) },
      select: { id: true },
    })

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado." })
    }

    const courses = await prisma.course.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    })

    return res.status(200).json({ courses })
  } catch (error) {
    console.error("Erro ao listar cursos:", error)
    return res.status(500).json({ message: "Erro interno ao listar cursos." })
  }
}

