/**
 * POST /api/tts/google — síntese sem persistir (texto no body).
 */
import {
  TTS_MAX_TEXT_CHARS,
  ttsCreditsForPlaybackSeconds,
  ttsCreditsForText,
} from "../lib/creditPricing.js"
import { getMp3DurationSeconds } from "../lib/mp3Duration.js"
import { prisma } from "../lib/prisma.js"
import {
  consumeCreditsTx,
  getCreditBalance,
  isInsufficientCreditsError,
  jsonInsufficientCredits,
} from "../lib/creditService.js"
import { interactiveTxOptions } from "../lib/prismaInteractiveTx.js"
import { synthesizeTextToMp3Buffer } from "../lib/googleTtsSynthesize.js"

export async function postGoogleTts(req, res) {
  try {
    const text = req.body?.text
    if (typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ message: "Campo text é obrigatório." })
    }
    if (text.length > TTS_MAX_TEXT_CHARS) {
      return res.status(400).json({
        message: `Texto excede o limite de ${TTS_MAX_TEXT_CHARS.toLocaleString("pt-BR")} caracteres para um único áudio.`,
      })
    }

    const userId =
      req.body?.userId != null ? String(req.body.userId).trim() : ""
    if (!userId) {
      return res.status(400).json({
        message: "userId é obrigatório para gerar áudio com créditos.",
      })
    }

    const bal = await getCreditBalance(userId)
    if (bal < 1) {
      return res.status(403).json({
        ...jsonInsufficientCredits({
          message:
            "Seus créditos acabaram ou são insuficientes para este áudio.",
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
            "Seus créditos acabaram ou são insuficientes (cobrança pela duração do MP3).",
          balance: bal,
          required: ttsCost,
        }),
      })
    }

    try {
      await prisma.$transaction(
        async (tx) => {
          await consumeCreditsTx(tx, {
            userId,
            amount: ttsCost,
            type: "TTS_AUDIO",
            label:
              durationSec != null
                ? `Áudio TTS (${ttsCost} créd. · ${Math.floor(durationSec / 60)} min)`
                : `Áudio TTS (${ttsCost} créd., estimativa)`,
            metadata: {
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
    res.setHeader("Cache-Control", "private, no-store")
    res.setHeader("X-Credits-Charged", String(ttsCost))
    return res.status(200).send(buf)
  } catch (err) {
    console.error("[Google TTS] erro:", err)
    const code = err?.code
    const hint =
      code === 7 || code === 16
        ? " Verifique GOOGLE_APPLICATION_CREDENTIALS ou GOOGLE_TTS_CREDENTIALS_JSON e se a API Text-to-Speech está ativa no projeto."
        : ""
    return res.status(500).json({
      message: `Erro ao gerar áudio (Google Cloud TTS).${hint}`,
      detail: String(err?.message || err).slice(0, 500),
    })
  }
}
