import crypto from "crypto"
import { prisma } from "../lib/prisma.js"
import { parsePositiveInt } from "../lib/parseId.js"
import { assertSourceOwnedByUser, readUserIdFromBody } from "../lib/courseAccess.js"
import {
  TTS_MAX_TEXT_CHARS,
  ttsCreditsForPlaybackSeconds,
  ttsCreditsForText,
} from "../lib/creditPricing.js"
import { getMp3DurationSeconds } from "../lib/mp3Duration.js"
import {
  consumeCreditsTx,
  getCreditBalance,
  isInsufficientCreditsError,
  jsonInsufficientCredits,
} from "../lib/creditService.js"
import { synthesizeTextToMp3Buffer } from "../lib/googleTtsSynthesize.js"
import { interactiveTxOptions } from "../lib/prismaInteractiveTx.js"

function hashText(text) {
  return crypto.createHash("sha256").update(String(text), "utf8").digest("hex")
}

/**
 * GET /api/sources/:sourceId/audio
 * Retorna MP3 em cache ou 404.
 */
export async function getSourceAudio(req, res) {
  try {
    const sourceId = parsePositiveInt(req.params.sourceId)
    if (sourceId == null) {
      return res.status(400).json({ message: "sourceId inválido." })
    }

    const source = await prisma.source.findUnique({
      where: { id: sourceId },
      select: { id: true },
    })
    if (!source) {
      return res.status(404).json({ message: "Fonte não encontrada." })
    }

    const row = await prisma.sourceAudio.findUnique({
      where: { sourceId },
    })

    if (!row?.data?.length) {
      return res.status(404).json({ message: "Áudio ainda não gerado para esta fonte." })
    }

    res.setHeader("Content-Type", row.mimeType || "audio/mpeg")
    res.setHeader("Cache-Control", "private, max-age=3600")
    res.setHeader("X-Source-Audio-Hash", row.textHash || "")
    return res.status(200).send(Buffer.from(row.data))
  } catch (err) {
    console.error("[sourceAudio] get:", err)
    return res.status(500).json({ message: "Erro ao buscar áudio." })
  }
}

/**
 * POST /api/sources/:sourceId/audio
 * Body: { "text": "..." } — se o hash bater com o cache, devolve o MP3 do BD sem chamar o Google.
 * Caso contrário sintetiza, grava e devolve o áudio.
 */
export async function postSourceAudio(req, res) {
  try {
    const sourceId = parsePositiveInt(req.params.sourceId)
    const text = req.body?.text

    if (sourceId == null) {
      return res.status(400).json({ message: "sourceId inválido." })
    }
    if (typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ message: "Campo text é obrigatório." })
    }
    if (text.length > TTS_MAX_TEXT_CHARS) {
      return res.status(400).json({
        message: `Texto excede o limite de ${TTS_MAX_TEXT_CHARS.toLocaleString("pt-BR")} caracteres para um único áudio.`,
      })
    }

    const userId = readUserIdFromBody(req)
    if (userId == null) {
      return res.status(400).json({ message: "userId é obrigatório para usar créditos." })
    }

    const own = await assertSourceOwnedByUser(sourceId, userId)
    if (!own.ok) {
      return res.status(own.status).json({ message: own.message })
    }

    const textHash = hashText(text)

    const existing = await prisma.sourceAudio.findUnique({
      where: { sourceId },
    })

    if (existing && existing.textHash === textHash && existing.data?.length) {
      res.setHeader("Content-Type", existing.mimeType || "audio/mpeg")
      res.setHeader("Cache-Control", "private, max-age=3600")
      res.setHeader("X-Source-Audio-Cached", "1")
      res.setHeader("X-Source-Audio-Hash", textHash)
      return res.status(200).send(Buffer.from(existing.data))
    }

    const bal = await getCreditBalance(userId)
    if (bal < 1) {
      return res.status(403).json({
        ...jsonInsufficientCredits({
          message:
            "Seus créditos acabaram ou são insuficientes para gerar este áudio.",
          balance: bal,
          required: 1,
        }),
      })
    }

    const buf = await synthesizeTextToMp3Buffer(text)
    if (!buf.length) {
      return res.status(502).json({ message: "Google TTS retornou áudio vazio." })
    }

    const durationSec = await getMp3DurationSeconds(buf)
    const ttsCost =
      durationSec != null
        ? ttsCreditsForPlaybackSeconds(durationSec)
        : ttsCreditsForText(text)

    if (bal < ttsCost) {
      return res.status(403).json({
        ...jsonInsufficientCredits({
          message:
            "Seus créditos acabaram ou são insuficientes para este áudio (cobrança pela duração do MP3).",
          balance: bal,
          required: ttsCost,
        }),
      })
    }

    try {
      await prisma.$transaction(
        async (tx) => {
          await tx.sourceAudio.upsert({
            where: { sourceId },
            create: {
              sourceId,
              data: buf,
              mimeType: "audio/mpeg",
              textHash,
            },
            update: {
              data: buf,
              mimeType: "audio/mpeg",
              textHash,
            },
          })
          await consumeCreditsTx(tx, {
            userId,
            amount: ttsCost,
            type: "TTS_AUDIO",
            label:
              durationSec != null
                ? `Áudio TTS (${ttsCost} créd. · ${Math.floor(durationSec / 60)} min)`
                : `Áudio TTS (${ttsCost} créd., estimativa)`,
            metadata: {
              sourceId,
              chars: text.length,
              durationSec: durationSec ?? undefined,
              chargedBy: durationSec != null ? "playback" : "chars",
            },
          })
        },
        interactiveTxOptions
      )
    } catch (e) {
      if (isInsufficientCreditsError(e)) {
        return res.status(403).json(jsonInsufficientCredits(e))
      }
      throw e
    }

    res.setHeader("Content-Type", "audio/mpeg")
    res.setHeader("Cache-Control", "private, max-age=3600")
    res.setHeader("X-Source-Audio-Cached", "0")
    res.setHeader("X-Source-Audio-Hash", textHash)
    res.setHeader("X-Credits-Charged", String(ttsCost))
    return res.status(200).send(buf)
  } catch (err) {
    console.error("[sourceAudio] post:", err)
    const code = err?.code
    const hint =
      code === 7 || code === 16
        ? " Verifique credenciais Google TTS e API ativa."
        : code === 13
          ? " Erro interno do Google TTS: use voz Neural2/Wavenet (veja GOOGLE_TTS_VOICE_NAME no servidor)."
          : ""
    if (code === "P2028") {
      return res.status(503).json({
        message:
          "O servidor demorou ao salvar o áudio no banco. Tente gerar de novo em alguns segundos.",
        detail: String(err?.message || err).slice(0, 300),
      })
    }
    return res.status(500).json({
      message: `Erro ao gerar ou salvar áudio.${hint}`,
      detail: String(err?.message || err).slice(0, 500),
    })
  }
}
