import { prisma } from "./prisma.js"
import { parsePositiveInt } from "./parseId.js"

export const AI_JOB_KIND = {
  QUIZ: "QUIZ",
  FLASHCARDS: "FLASHCARDS",
  NOTES: "NOTES",
  AUDIO: "AUDIO",
}

/**
 * Retorna job (ou null).
 */
export async function getAiJob(sourceId, kind) {
  const sid = parsePositiveInt(sourceId)
  if (sid == null) return null
  return prisma.sourceAiJob.findUnique({
    where: { sourceId_kind: { sourceId: sid, kind } },
  })
}

/**
 * Tenta iniciar um job.
 * - Se não existir, cria IN_PROGRESS.
 * - Se existir IN_PROGRESS, retorna { started: false, status: 'IN_PROGRESS' }.
 * - Se existir FAILED, reabre como IN_PROGRESS.
 * - Se existir COMPLETED, retorna { started: false, status: 'COMPLETED' }.
 */
export async function startAiJob(sourceId, kind, userId) {
  const sid = parsePositiveInt(sourceId)
  if (sid == null) throw new Error("startAiJob: sourceId inválido.")
  const uid = userId == null ? null : parsePositiveInt(userId)
  try {
    const job = await prisma.sourceAiJob.create({
      data: {
        sourceId: sid,
        kind,
        status: "IN_PROGRESS",
        userId: uid,
      },
    })
    return { started: true, job }
  } catch (e) {
    if (e?.code !== "P2002") throw e
    const existing = await prisma.sourceAiJob.findUnique({
      where: { sourceId_kind: { sourceId: sid, kind } },
    })
    if (!existing) return { started: false, status: "IN_PROGRESS", job: null }
    if (existing.status === "FAILED") {
      const reopened = await prisma.sourceAiJob.update({
        where: { sourceId_kind: { sourceId: sid, kind } },
        data: { status: "IN_PROGRESS", error: null, userId: uid, finishedAt: null },
      })
      return { started: true, job: reopened }
    }
    return { started: false, status: existing.status, job: existing }
  }
}

export async function completeAiJob(sourceId, kind) {
  const sid = parsePositiveInt(sourceId)
  if (sid == null) return null
  try {
    return await prisma.sourceAiJob.update({
      where: { sourceId_kind: { sourceId: sid, kind } },
      data: { status: "COMPLETED", finishedAt: new Date(), error: null },
    })
  } catch (e) {
    if (e?.code === "P2025") return null
    throw e
  }
}

export async function failAiJob(sourceId, kind, error) {
  const sid = parsePositiveInt(sourceId)
  if (sid == null) return null
  const msg = String(error?.message || error || "").slice(0, 500) || "Erro"
  try {
    return await prisma.sourceAiJob.update({
      where: { sourceId_kind: { sourceId: sid, kind } },
      data: { status: "FAILED", finishedAt: new Date(), error: msg },
    })
  } catch (e) {
    if (e?.code === "P2025") return null
    throw e
  }
}

