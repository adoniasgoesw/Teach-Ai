import { assertSourceOwnedByUser, readUserIdFromBody } from "../lib/courseAccess.js"
import { CREDIT_AI_FLASHCARDS } from "../lib/creditPricing.js"
import {
  consumeCreditsTx,
  getCreditBalance,
  isInsufficientCreditsError,
  jsonInsufficientCredits,
} from "../lib/creditService.js"
import { interactiveTxOptions } from "../lib/prismaInteractiveTx.js"
import { prisma } from "../lib/prisma.js"
import { generateContent, parseJsonFromAi } from "../lib/studyGemini.js"
import { AI_JOB_KIND, completeAiJob, failAiJob, startAiJob } from "../lib/sourceAiJobs.js"

const MAX_CHARS = 22_000

function buildFlashcardPrompt(excerpt, sourceTitle) {
  return `Você é um especialista em métodos de estudo. Leia o texto abaixo e extraia os conceitos mais importantes.

CONTEXTO: ${sourceTitle}

INSTRUÇÕES:
- Crie entre 12 e 20 flashcards cobrindo ideias-chave, definições, relações e termos que um aluno precisa dominar para avaliação.
- Frente (term): pergunta curta, conceito ou termo.
- Verso (definition): resposta clara e objetiva, baseada no texto — sem inventar fatos externos.
- Português do Brasil.

FORMATO (obrigatório): responda APENAS com JSON válido, sem markdown:
{
  "flashcards": [
    { "term": "frente do card", "definition": "verso / explicação", "order": 0 }
  ]
}

TEXTO:
"""
${excerpt}
"""
`.trim()
}

function validateFlashcards(items) {
  if (!Array.isArray(items) || items.length === 0) return false
  return items.every((f) => {
    if (!f || typeof f !== "object") return false
    return (
      String(f.term ?? "").trim().length > 2 &&
      String(f.definition ?? "").trim().length > 2
    )
  })
}

async function ensureSource(sourceId) {
  const id = sourceId != null ? String(sourceId).trim() : ""
  if (!id) return { error: "sourceId inválido." }
  const source = await prisma.source.findUnique({
    where: { id },
    select: { id: true, text: true, filename: true },
  })
  if (!source) return { error: "Fonte não encontrada." }
  const text = String(source.text ?? "").trim()
  if (!text) return { error: "Esta fonte ainda não tem texto extraído (processe o PDF antes)." }
  return { source }
}

export async function getSourceFlashcards(req, res) {
  try {
    const sourceId = req.params.sourceId != null ? String(req.params.sourceId).trim() : ""
    const check = await ensureSource(sourceId)
    if (check.error) {
      const code = check.error.includes("não encontrad") ? 404 : 400
      return res.status(code).json({ message: check.error })
    }

    const rows = await prisma.flashcard.findMany({
      where: { sourceId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    })

    if (rows.length === 0) {
      const job = await prisma.sourceAiJob.findUnique({
        where: { sourceId_kind: { sourceId, kind: AI_JOB_KIND.FLASHCARDS } },
      })
      if (job?.status === "IN_PROGRESS") {
        return res.status(202).json({ status: "IN_PROGRESS", flashcards: [] })
      }
    }

    const flashcards = rows.map((r) => ({
      id: r.id,
      sourceId: r.sourceId,
      term: r.term,
      definition: r.definition,
      order: r.order,
      createdAt: r.createdAt,
    }))

    return res.status(200).json({ flashcards })
  } catch (err) {
    console.error("[flashcard] get:", err)
    return res.status(500).json({ message: "Erro ao listar flashcards." })
  }
}

export async function postGenerateSourceFlashcards(req, res) {
  try {
    const sourceId = req.params.sourceId != null ? String(req.params.sourceId).trim() : ""
    const check = await ensureSource(sourceId)
    if (check.error) {
      const code = check.error.includes("não encontrad") ? 404 : 400
      return res.status(code).json({ message: check.error })
    }

    const userId = readUserIdFromBody(req)
    if (!userId) {
      return res.status(400).json({ message: "userId é obrigatório." })
    }
    const own = await assertSourceOwnedByUser(sourceId, userId)
    if (!own.ok) {
      return res.status(own.status).json({ message: own.message })
    }

    // Se já existe flashcards, não gera de novo (não cobra 2x).
    const existing = await prisma.flashcard.findMany({
      where: { sourceId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    })
    if (existing.length > 0) {
      await completeAiJob(sourceId, AI_JOB_KIND.FLASHCARDS)
      return res.status(200).json({
        ok: true,
        cached: true,
        creditsCharged: 0,
        flashcards: existing.map((r) => ({
          id: r.id,
          sourceId: r.sourceId,
          term: r.term,
          definition: r.definition,
          order: r.order,
          createdAt: r.createdAt,
        })),
      })
    }

    const started = await startAiJob(sourceId, AI_JOB_KIND.FLASHCARDS, userId)
    if (!started.started) {
      if (started.status === "IN_PROGRESS") {
        return res.status(202).json({ status: "IN_PROGRESS" })
      }
    }

    const bal = await getCreditBalance(userId)
    if (bal < CREDIT_AI_FLASHCARDS) {
      return res.status(403).json({
        ...jsonInsufficientCredits({
          message:
            "Seus créditos acabaram ou são insuficientes para gerar flashcards.",
          balance: bal,
          required: CREDIT_AI_FLASHCARDS,
        }),
      })
    }

    const { source } = check
    const excerpt = String(source.text).slice(0, MAX_CHARS)
    const title = source.filename?.trim() || "Material do curso"

    let items
    try {
      const raw = await generateContent(buildFlashcardPrompt(excerpt, title))
      const parsed = parseJsonFromAi(raw)
      items = parsed?.flashcards
    } catch (e) {
      await failAiJob(sourceId, AI_JOB_KIND.FLASHCARDS, e)
      throw e
    }

    if (!validateFlashcards(items)) {
      await failAiJob(sourceId, AI_JOB_KIND.FLASHCARDS, "Flashcards inválidos")
      return res.status(503).json({
        message:
          "A IA não retornou flashcards válidos (JSON). Tente novamente em instantes.",
      })
    }

    const rows = items.map((f, idx) => ({
      sourceId,
      term: String(f.term).trim(),
      definition: String(f.definition).trim(),
      order: Number.isFinite(f.order) ? Number(f.order) : idx,
    }))

    let balanceAfter = bal
    const flashcards = await prisma.$transaction(
      async (tx) => {
        const countNow = await tx.flashcard.count({ where: { sourceId } })
        if (countNow > 0) {
          await tx.sourceAiJob.update({
            where: { sourceId_kind: { sourceId, kind: AI_JOB_KIND.FLASHCARDS } },
            data: { status: "COMPLETED", finishedAt: new Date(), error: null },
          })
          return tx.flashcard.findMany({
            where: { sourceId },
            orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          })
        }
        await tx.flashcard.deleteMany({ where: { sourceId } })
        await tx.flashcard.createMany({ data: rows })
        const spent = await consumeCreditsTx(tx, {
          userId,
          amount: CREDIT_AI_FLASHCARDS,
          type: "AI_FLASHCARDS",
          label: "IA — Flashcards",
          metadata: { sourceId },
        })
        balanceAfter = spent.balanceAfter
        await tx.sourceAiJob.update({
          where: { sourceId_kind: { sourceId, kind: AI_JOB_KIND.FLASHCARDS } },
          data: { status: "COMPLETED", finishedAt: new Date(), error: null },
        })
        return tx.flashcard.findMany({
          where: { sourceId },
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        })
      },
      interactiveTxOptions
    )

    return res.status(200).json({
      ok: true,
      creditsCharged: CREDIT_AI_FLASHCARDS,
      balanceAfter,
      flashcards: flashcards.map((r) => ({
        id: r.id,
        sourceId: r.sourceId,
        term: r.term,
        definition: r.definition,
        order: r.order,
        createdAt: r.createdAt,
      })),
    })
  } catch (err) {
    if (isInsufficientCreditsError(err)) {
      return res.status(403).json(jsonInsufficientCredits(err))
    }
    console.error("[flashcard] generate:", err)
    return res.status(500).json({
      message: err?.message || "Erro ao gerar flashcards com a IA.",
    })
  }
}
