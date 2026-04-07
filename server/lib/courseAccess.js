import { prisma } from "./prisma.js"

export async function assertCourseOwnedByUser(courseId, userId) {
  const cid = courseId != null ? String(courseId).trim() : ""
  const uid = userId != null ? String(userId).trim() : ""
  if (!cid) return { ok: false, status: 400, message: "courseId inválido." }
  if (!uid) return { ok: false, status: 400, message: "userId é obrigatório." }

  const course = await prisma.course.findUnique({
    where: { id: cid },
    select: { userId: true },
  })
  if (!course) return { ok: false, status: 404, message: "Curso não encontrado." }
  if (String(course.userId) !== uid) {
    return { ok: false, status: 403, message: "Acesso negado a este curso." }
  }
  return { ok: true }
}

export async function assertSourceOwnedByUser(sourceId, userId) {
  const sid = sourceId != null ? String(sourceId).trim() : ""
  const uid = userId != null ? String(userId).trim() : ""
  if (!sid) return { ok: false, status: 400, message: "sourceId inválido." }
  if (!uid) return { ok: false, status: 400, message: "userId é obrigatório." }

  const source = await prisma.source.findUnique({
    where: { id: sid },
    select: { id: true, course: { select: { userId: true } } },
  })
  if (!source) return { ok: false, status: 404, message: "Fonte não encontrada." }
  if (String(source.course.userId) !== uid) {
    return { ok: false, status: 403, message: "Acesso negado a esta fonte." }
  }
  return { ok: true, source }
}

export function readUserIdFromBody(req) {
  const raw = req.body?.userId
  if (raw == null || String(raw).trim() === "") return ""
  return String(raw).trim()
}
