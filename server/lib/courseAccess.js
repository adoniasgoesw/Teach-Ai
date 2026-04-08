import { prisma } from "./prisma.js"
import { parsePositiveInt } from "./parseId.js"

export async function assertCourseOwnedByUser(courseId, userId) {
  const cid = parsePositiveInt(courseId)
  const uid = parsePositiveInt(userId)
  if (cid == null) return { ok: false, status: 400, message: "courseId inválido." }
  if (uid == null) return { ok: false, status: 400, message: "userId é obrigatório." }

  const course = await prisma.course.findUnique({
    where: { id: cid },
    select: { userId: true },
  })
  if (!course) return { ok: false, status: 404, message: "Curso não encontrado." }
  if (course.userId !== uid) {
    return { ok: false, status: 403, message: "Acesso negado a este curso." }
  }
  return { ok: true }
}

export async function assertSourceOwnedByUser(sourceId, userId) {
  const sid = parsePositiveInt(sourceId)
  const uid = parsePositiveInt(userId)
  if (sid == null) return { ok: false, status: 400, message: "sourceId inválido." }
  if (uid == null) return { ok: false, status: 400, message: "userId é obrigatório." }

  const source = await prisma.source.findUnique({
    where: { id: sid },
    select: { id: true, course: { select: { userId: true } } },
  })
  if (!source) return { ok: false, status: 404, message: "Fonte não encontrada." }
  if (source.course.userId !== uid) {
    return { ok: false, status: 403, message: "Acesso negado a esta fonte." }
  }
  return { ok: true, source }
}

/** @returns {number | null} */
export function readUserIdFromBody(req) {
  return parsePositiveInt(req.body?.userId)
}
