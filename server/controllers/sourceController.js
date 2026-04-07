import { prisma } from "../lib/prisma.js"

/**
 * Cria um Source ligado a um curso.
 * @param {object} opts
 * @param {import("@prisma/client").Prisma.TransactionClient} [opts.tx]
 */
export async function createSource({ tx = prisma, courseId, filename, text, titlesJson }) {
  return tx.source.create({
    data: {
      courseId,
      filename: filename ?? null,
      text: text ?? null,
      titlesJson: titlesJson ?? undefined,
    },
  })
}

/**
 * GET — lista sources do curso com lessons ordenadas (nome do PDF + aulas).
 */
export async function listSourcesByCourse(req, res) {
  try {
    const courseId = req.params.courseId != null ? String(req.params.courseId).trim() : ""
    if (!courseId) {
      return res.status(400).json({ message: "courseId inválido." })
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    })

    if (!course) {
      return res.status(404).json({ message: "Curso não encontrado." })
    }

    const rows = await prisma.source.findMany({
      where: { courseId },
      orderBy: { createdAt: "desc" },
      include: {
        lessons: {
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        },
      },
    })

    const sources = rows.map((s) => ({
      id: s.id,
      courseId: s.courseId,
      filename: s.filename,
      title: s.filename?.trim() || "Fonte sem nome",
      createdAt: s.createdAt,
      lessons: s.lessons.map((l) => ({
        id: l.id,
        sourceId: l.sourceId,
        title: l.title,
        content: l.content,
        isSubtitle: l.isSubtitle,
        parentTitle: l.parentTitle,
        order: l.order,
      })),
    }))

    return res.status(200).json({ sources })
  } catch (error) {
    console.error("[sources] listSourcesByCourse:", error)
    return res.status(500).json({ message: "Erro ao listar fontes do curso." })
  }
}
