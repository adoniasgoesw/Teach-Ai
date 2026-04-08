import { assertSourceOwnedByUser, readUserIdFromBody } from "../lib/courseAccess.js"
import { parsePositiveInt } from "../lib/parseId.js"
import { CREDIT_AI_QUIZ } from "../lib/creditPricing.js"
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

function buildQuizPrompt(excerpt, sourceTitle) {
  return `Você é um professor experiente aplicando uma prova avaliativa sobre o material abaixo.

CONTEXTO DO MATERIAL (título/nome da fonte): ${sourceTitle}

INSTRUÇÕES:
- Com base APENAS no texto fornecido, crie entre 9 e 12 questões de múltipla escolha sobre conceitos importantes (definições, relações, ideias centrais).
- Evite perguntas triviais do tipo "qual é o título do capítulo X" ou que dependam só de memorizar números de página.
- Cada questão deve ter EXATAMENTE 4 alternativas, sendo apenas UMA correta.
- Distribua as questões em três níveis de dificuldade: algumas "easy", algumas "medium" e algumas "hard" (proporção aproximada 4 easy, 4 medium, 3 hard quando possível).
- Linguagem: português do Brasil, clara e objetiva.
- Não invente fatos que não estejam no texto.

FORMATO DE RESPOSTA (obrigatório):
Responda APENAS com um JSON válido, sem markdown, sem texto antes ou depois:
{
  "quizzes": [
    {
      "question": "enunciado da pergunta",
      "alternatives": ["alternativa A", "alternativa B", "alternativa C", "alternativa D"],
      "correctIndex": 0,
      "difficulty": "easy"
    }
  ]
}
O campo correctIndex é o índice 0-based da alternativa correta (0 a 3).

TEXTO DO MATERIAL:
"""
${excerpt}
"""
`.trim()
}

function validateQuizzes(items) {
  if (!Array.isArray(items) || items.length === 0) return false
  return items.every((q) => {
    if (!q || typeof q !== "object") return false
    if (String(q.question ?? "").trim().length < 5) return false
    const alts = q.alternatives
    if (!Array.isArray(alts) || alts.length !== 4) return false
    if (!alts.every((a) => String(a ?? "").trim().length > 0)) return false
    const ci = Number(q.correctIndex)
    if (!Number.isInteger(ci) || ci < 0 || ci > 3) return false
    const d = String(q.difficulty ?? "medium").toLowerCase()
    if (!["easy", "medium", "hard"].includes(d)) return false
    return true
  })
}

async function ensureSource(sourceId) {
  const id = parsePositiveInt(sourceId)
  if (id == null) return { error: "sourceId inválido." }
  const source = await prisma.source.findUnique({
    where: { id },
    select: { id: true, text: true, filename: true },
  })
  if (!source) return { error: "Fonte não encontrada." }
  const text = String(source.text ?? "").trim()
  if (!text) return { error: "Esta fonte ainda não tem texto extraído (processe o PDF antes)." }
  return { source }
}

export async function getSourceQuizzes(req, res) {
  try {
    const sourceId = parsePositiveInt(req.params.sourceId)
    const check = await ensureSource(sourceId)
    if (check.error) {
      const code = check.error.includes("não encontrad") ? 404 : 400
      return res.status(code).json({ message: check.error })
    }

    const rows = await prisma.quiz.findMany({
      where: { sourceId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    })

    if (rows.length === 0) {
      const job = await prisma.sourceAiJob.findUnique({
        where: { sourceId_kind: { sourceId, kind: AI_JOB_KIND.QUIZ } },
      })
      if (job?.status === "IN_PROGRESS") {
        return res.status(202).json({ status: "IN_PROGRESS", quizzes: [] })
      }
    }

    const quizzes = rows.map((r) => ({
      id: r.id,
      sourceId: r.sourceId,
      question: r.question,
      alternatives: Array.isArray(r.alternatives) ? r.alternatives : [],
      correctIndex: r.correctIndex,
      difficulty: r.difficulty,
      order: r.order,
      createdAt: r.createdAt,
    }))

    return res.status(200).json({ quizzes })
  } catch (err) {
    console.error("[quiz] get:", err)
    return res.status(500).json({ message: "Erro ao listar quizzes." })
  }
}

export async function postGenerateSourceQuizzes(req, res) {
  try {
    const sourceId = parsePositiveInt(req.params.sourceId)
    const check = await ensureSource(sourceId)
    if (check.error) {
      const code = check.error.includes("não encontrad") ? 404 : 400
      return res.status(code).json({ message: check.error })
    }

    const userId = readUserIdFromBody(req)
    if (userId == null) {
      return res.status(400).json({ message: "userId é obrigatório." })
    }
    const own = await assertSourceOwnedByUser(sourceId, userId)
    if (!own.ok) {
      return res.status(own.status).json({ message: own.message })
    }

    // Se já existe quiz, não gera de novo (não cobra 2x).
    const existing = await prisma.quiz.findMany({
      where: { sourceId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    })
    if (existing.length > 0) {
      await completeAiJob(sourceId, AI_JOB_KIND.QUIZ)
      return res.status(200).json({
        ok: true,
        cached: true,
        creditsCharged: 0,
        quizzes: existing.map((r) => ({
          id: r.id,
          sourceId: r.sourceId,
          question: r.question,
          alternatives: Array.isArray(r.alternatives) ? r.alternatives : [],
          correctIndex: r.correctIndex,
          difficulty: r.difficulty,
          order: r.order,
          createdAt: r.createdAt,
        })),
      })
    }

    const started = await startAiJob(sourceId, AI_JOB_KIND.QUIZ, userId)
    if (!started.started) {
      if (started.status === "IN_PROGRESS") {
        return res.status(202).json({ status: "IN_PROGRESS" })
      }
      // COMPLETED: sem rows? deixa cair para tentar gerar.
    }

    const bal = await getCreditBalance(userId)
    if (bal < CREDIT_AI_QUIZ) {
      return res.status(403).json({
        ...jsonInsufficientCredits({
          message:
            "Seus créditos acabaram ou são insuficientes para gerar o quiz.",
          balance: bal,
          required: CREDIT_AI_QUIZ,
        }),
      })
    }

    const { source } = check
    const excerpt = String(source.text).slice(0, MAX_CHARS)
    const title = source.filename?.trim() || "Material do curso"

    let items
    try {
      const raw = await generateContent(buildQuizPrompt(excerpt, title))
      const parsed = parseJsonFromAi(raw)
      items = parsed?.quizzes
    } catch (e) {
      await failAiJob(sourceId, AI_JOB_KIND.QUIZ, e)
      throw e
    }

    if (!validateQuizzes(items)) {
      await failAiJob(sourceId, AI_JOB_KIND.QUIZ, "Quizzes inválidos")
      return res.status(503).json({
        message:
          "A IA não retornou quizzes válidos (JSON). Tente novamente em instantes.",
      })
    }

    const rows = items.map((q, idx) => ({
      sourceId,
      question: String(q.question).trim(),
      alternatives: q.alternatives.map((a) => String(a).trim()),
      correctIndex: Number(q.correctIndex),
      difficulty: String(q.difficulty ?? "medium").toLowerCase(),
      order: idx,
    }))

    let balanceAfter = bal
    const quizzes = await prisma.$transaction(
      async (tx) => {
        const countNow = await tx.quiz.count({ where: { sourceId } })
        if (countNow > 0) {
          await tx.sourceAiJob.update({
            where: { sourceId_kind: { sourceId, kind: AI_JOB_KIND.QUIZ } },
            data: { status: "COMPLETED", finishedAt: new Date(), error: null },
          })
          return tx.quiz.findMany({
            where: { sourceId },
            orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          })
        }
        await tx.quiz.deleteMany({ where: { sourceId } })
        await tx.quiz.createMany({ data: rows })
        const spent = await consumeCreditsTx(tx, {
          userId,
          amount: CREDIT_AI_QUIZ,
          type: "AI_QUIZ",
          label: "IA — Quiz",
          metadata: { sourceId },
        })
        balanceAfter = spent.balanceAfter
        await tx.sourceAiJob.update({
          where: { sourceId_kind: { sourceId, kind: AI_JOB_KIND.QUIZ } },
          data: { status: "COMPLETED", finishedAt: new Date(), error: null },
        })
        return tx.quiz.findMany({
          where: { sourceId },
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        })
      },
      interactiveTxOptions
    )

    return res.status(200).json({
      ok: true,
      creditsCharged: CREDIT_AI_QUIZ,
      balanceAfter,
      quizzes: quizzes.map((r) => ({
        id: r.id,
        sourceId: r.sourceId,
        question: r.question,
        alternatives: Array.isArray(r.alternatives) ? r.alternatives : [],
        correctIndex: r.correctIndex,
        difficulty: r.difficulty,
        order: r.order,
        createdAt: r.createdAt,
      })),
    })
  } catch (err) {
    if (isInsufficientCreditsError(err)) {
      return res.status(403).json(jsonInsufficientCredits(err))
    }
    console.error("[quiz] generate:", err)
    return res.status(500).json({
      message: err?.message || "Erro ao gerar quizzes com a IA.",
    })
  }
}
