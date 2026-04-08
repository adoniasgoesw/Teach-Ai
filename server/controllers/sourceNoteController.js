import { assertSourceOwnedByUser, readUserIdFromBody } from "../lib/courseAccess.js"
import { parsePositiveInt } from "../lib/parseId.js"
import { CREDIT_AI_NOTES } from "../lib/creditPricing.js"
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

function buildNotePrompt(excerpt, sourceTitle) {
  return `Você é um aluno dedicado fazendo anotações acadêmicas para revisar antes de uma prova.

MATERIAL: ${sourceTitle}

INSTRUÇÕES:
- Português do Brasil, tom objetivo, adequado a prova.
- Não copie o texto inteiro: sintetize o que cai em avaliação.
- Organize em SEÇÕES com títulos claros (um tema por bloco).
- Definições no padrão: **Termo:** explicação curta.
- Listas com "-" ou numeradas "1." para passos.
- Código, comandos ou tags entre crases, ex: \`document.write()\`, \`<script>\`.
- Linha em branco entre seções.
- Não invente fatos fora do texto.

O campo "content" deve usar Markdown leve (o app formata na tela — sem ## soltos sem sentido):
- Seções principais: ## Título da seção
- Subtópicos: ### se precisar
- **Conceito:** texto
- Listas com hífen ou números

RESPOSTA: APENAS JSON válido (sem texto fora do JSON):
{
  "content": "string com \\n entre parágrafos, Markdown como acima"
}

TEXTO:
"""
${excerpt}
"""
`.trim()
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

export async function getSourceNote(req, res) {
  try {
    const sourceId = parsePositiveInt(req.params.sourceId)
    const check = await ensureSource(sourceId)
    if (check.error) {
      const code = check.error.includes("não encontrad") ? 404 : 400
      return res.status(code).json({ message: check.error })
    }

    const row = await prisma.sourceNote.findUnique({
      where: { sourceId },
    })

    if (!row) {
      const job = await prisma.sourceAiJob.findUnique({
        where: { sourceId_kind: { sourceId, kind: AI_JOB_KIND.NOTES } },
      })
      if (job?.status === "IN_PROGRESS") {
        return res.status(202).json({ status: "IN_PROGRESS", note: null })
      }
    }

    return res.status(200).json({
      note: row
        ? {
            id: row.id,
            sourceId: row.sourceId,
            content: row.content,
            updatedAt: row.updatedAt,
            createdAt: row.createdAt,
          }
        : null,
    })
  } catch (err) {
    console.error("[note] get:", err)
    return res.status(500).json({ message: "Erro ao buscar anotação." })
  }
}

export async function postGenerateSourceNote(req, res) {
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

    // Se já existe anotação, não gera de novo (não cobra 2x).
    const existing = await prisma.sourceNote.findUnique({ where: { sourceId } })
    if (existing?.content?.trim()) {
      await completeAiJob(sourceId, AI_JOB_KIND.NOTES)
      return res.status(200).json({
        ok: true,
        cached: true,
        creditsCharged: 0,
        note: {
          id: existing.id,
          sourceId: existing.sourceId,
          content: existing.content,
          updatedAt: existing.updatedAt,
          createdAt: existing.createdAt,
        },
      })
    }

    const started = await startAiJob(sourceId, AI_JOB_KIND.NOTES, userId)
    if (!started.started) {
      if (started.status === "IN_PROGRESS") {
        return res.status(202).json({ status: "IN_PROGRESS" })
      }
    }

    const bal = await getCreditBalance(userId)
    if (bal < CREDIT_AI_NOTES) {
      return res.status(403).json({
        ...jsonInsufficientCredits({
          message:
            "Seus créditos acabaram ou são insuficientes para gerar anotações.",
          balance: bal,
          required: CREDIT_AI_NOTES,
        }),
      })
    }

    const { source } = check
    const excerpt = String(source.text).slice(0, MAX_CHARS)
    const title = source.filename?.trim() || "Material do curso"

    let content = ""
    try {
      const raw = await generateContent(buildNotePrompt(excerpt, title))
      const parsed = parseJsonFromAi(raw)
      content =
        parsed && typeof parsed.content === "string"
          ? String(parsed.content).trim()
          : ""
    } catch (e) {
      await failAiJob(sourceId, AI_JOB_KIND.NOTES, e)
      throw e
    }

    if (!content || content.length < 50) {
      await failAiJob(sourceId, AI_JOB_KIND.NOTES, "Anotações inválidas")
      return res.status(503).json({
        message:
          "A IA não retornou anotações válidas (JSON). Tente novamente em instantes.",
      })
    }

    let balanceAfter = bal
    const row = await prisma.$transaction(
      async (tx) => {
        const existingNow = await tx.sourceNote.findUnique({ where: { sourceId } })
        if (existingNow?.content?.trim()) {
          await tx.sourceAiJob.update({
            where: { sourceId_kind: { sourceId, kind: AI_JOB_KIND.NOTES } },
            data: { status: "COMPLETED", finishedAt: new Date(), error: null },
          })
          return existingNow
        }
        const n = await tx.sourceNote.upsert({
          where: { sourceId },
          create: { sourceId, content },
          update: { content },
        })
        const spent = await consumeCreditsTx(tx, {
          userId,
          amount: CREDIT_AI_NOTES,
          type: "AI_NOTES",
          label: "IA — Anotações",
          metadata: { sourceId },
        })
        balanceAfter = spent.balanceAfter
        await tx.sourceAiJob.update({
          where: { sourceId_kind: { sourceId, kind: AI_JOB_KIND.NOTES } },
          data: { status: "COMPLETED", finishedAt: new Date(), error: null },
        })
        return n
      },
      interactiveTxOptions
    )

    return res.status(200).json({
      ok: true,
      creditsCharged: CREDIT_AI_NOTES,
      balanceAfter,
      note: {
        id: row.id,
        sourceId: row.sourceId,
        content: row.content,
        updatedAt: row.updatedAt,
        createdAt: row.createdAt,
      },
    })
  } catch (err) {
    if (isInsufficientCreditsError(err)) {
      return res.status(403).json(jsonInsufficientCredits(err))
    }
    console.error("[note] generate:", err)
    return res.status(500).json({
      message: err?.message || "Erro ao gerar anotações com a IA.",
    })
  }
}
