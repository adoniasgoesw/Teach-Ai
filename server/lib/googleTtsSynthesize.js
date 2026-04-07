/**
 * Síntese Google Cloud TTS → Buffer MP3 (texto longo em fatias).
 * Usado por POST /tts/google e pelo cache em SourceAudio.
 */
import fs from "node:fs"
import { TextToSpeechClient } from "@google-cloud/text-to-speech"

const DEFAULT_CHUNK_UTF8 = 4500
const MAX_SSML_BYTES = 5000

/** Voz estável (Neural2). Chirp3-HD pode retornar gRPC 13 INTERNAL em alguns projetos/regiões. */
const DEFAULT_TTS_VOICE = "pt-BR-Neural2-A"
const DEFAULT_TTS_VOICE_FALLBACK = "pt-BR-Wavenet-A"

function isTransientTtsGrpcCode(code) {
  return code === 4 || code === 13 || code === 14
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function buildSsmlInput(raw) {
  let s = escapeXml(raw.trim())
  s = s.replace(/\r\n/g, "\n").replace(/\n+/g, " ")
  s = s.replace(/\.\s+/g, '.<break time="160ms"/> ')
  s = s.replace(/\?\s+/g, '?<break time="150ms"/> ')
  s = s.replace(/!\s+/g, '!<break time="150ms"/> ')
  s = s.replace(/;\s+/g, ';<break time="110ms"/> ')
  s = s.replace(/:\s+/g, ':<break time="90ms"/> ')
  return `<speak><prosody rate="108%" pitch="+2st">${s}</prosody></speak>`
}

function fitTextForSsml(raw) {
  const t = raw.trim()
  if (!t) return t
  let lo = 0
  let hi = t.length
  let best = 0
  const budget = MAX_SSML_BYTES - 120
  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2)
    const ssml = buildSsmlInput(t.slice(0, mid))
    if (Buffer.byteLength(ssml, "utf8") <= budget) {
      best = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return t.slice(0, best)
}

function splitTextIntoUtf8Chunks(str, maxBytes) {
  const enc = new TextEncoder()
  const full = String(str)
  if (enc.encode(full).length <= maxBytes) {
    return full.trim() ? [full] : []
  }
  const out = []
  let start = 0
  while (start < full.length) {
    let lo = start
    let hi = full.length
    let best = start
    while (lo <= hi) {
      const mid = lo + Math.floor((hi - lo) / 2)
      const bytes = enc.encode(full.slice(start, mid)).length
      if (bytes <= maxBytes) {
        best = mid
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
    if (best === start) {
      best = Math.min(start + 1, full.length)
    }
    const piece = full.slice(start, best)
    const lastNl = piece.lastIndexOf("\n")
    if (lastNl > 0 && lastNl >= Math.floor(piece.length * 0.35)) {
      out.push(full.slice(start, start + lastNl + 1))
      start = start + lastNl + 1
    } else {
      out.push(piece)
      start = best
    }
  }
  return out.filter((c) => c.trim().length > 0)
}

let clientSingleton = null

function assertServiceAccountShape(creds) {
  if (!creds || typeof creds !== "object") return
  if (!creds.client_email || !creds.private_key) {
    throw new Error(
      "Credenciais Google TTS: o JSON precisa ser de uma service account (client_email + private_key)."
    )
  }
}

/**
 * Em Render/Fly/Heroku não existe ADC; é obrigatório JSON ou arquivo acessível.
 * Preferir GOOGLE_TTS_CREDENTIALS_JSON (minificado) ou GOOGLE_TTS_CREDENTIALS_JSON_B64 no painel.
 */
export function getTtsClient() {
  if (clientSingleton) return clientSingleton
  const opts = {}
  const jsonB64 = process.env.GOOGLE_TTS_CREDENTIALS_JSON_B64?.trim()
  const json = process.env.GOOGLE_TTS_CREDENTIALS_JSON?.trim()
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()

  if (jsonB64) {
    let decoded
    try {
      decoded = Buffer.from(jsonB64, "base64").toString("utf8")
      opts.credentials = JSON.parse(decoded)
    } catch {
      throw new Error(
        "GOOGLE_TTS_CREDENTIALS_JSON_B64 inválido (use base64 do JSON da service account)."
      )
    }
    assertServiceAccountShape(opts.credentials)
  } else if (json) {
    try {
      opts.credentials = JSON.parse(json)
    } catch {
      throw new Error("GOOGLE_TTS_CREDENTIALS_JSON não é JSON válido.")
    }
    assertServiceAccountShape(opts.credentials)
  } else if (keyFile) {
    if (!fs.existsSync(keyFile)) {
      throw new Error(
        `GOOGLE_APPLICATION_CREDENTIALS: arquivo não encontrado (${keyFile}). ` +
          "No Render, defina GOOGLE_TTS_CREDENTIALS_JSON ou GOOGLE_TTS_CREDENTIALS_JSON_B64 com o JSON da service account (arquivo local não existe no deploy)."
      )
    }
    opts.keyFilename = keyFile
  } else {
    throw new Error(
      "Google Cloud TTS sem credenciais: defina GOOGLE_TTS_CREDENTIALS_JSON, " +
        "GOOGLE_TTS_CREDENTIALS_JSON_B64 ou GOOGLE_APPLICATION_CREDENTIALS. " +
        "No GCP, ative a API Cloud Text-to-Speech e use uma chave JSON de service account."
    )
  }

  clientSingleton = new TextToSpeechClient(opts)
  return clientSingleton
}

function getSpeakingRate() {
  const raw = process.env.GOOGLE_TTS_SPEAKING_RATE?.trim()
  if (raw === undefined || raw === "") return 1.12
  const n = Number.parseFloat(raw)
  if (!Number.isFinite(n)) return 1.12
  return Math.min(4, Math.max(0.25, n))
}

function getChunkBytes() {
  const raw = process.env.GOOGLE_TTS_CHUNK_BYTES?.trim()
  if (raw === undefined || raw === "") return DEFAULT_CHUNK_UTF8
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 500) return DEFAULT_CHUNK_UTF8
  return Math.min(n, 4800)
}

async function synthesizePlain(client, textChunk, languageCode, voiceName) {
  const speakingRate = getSpeakingRate()
  const [response] = await client.synthesizeSpeech({
    input: { text: textChunk },
    voice: {
      languageCode,
      name: voiceName,
    },
    audioConfig: {
      audioEncoding: "MP3",
      speakingRate,
    },
  })
  return response.audioContent
}

/**
 * Uma tentativa com voz primária; em erro transitório (ex. INTERNAL), repete com fallback.
 */
async function synthesizePlainWithVoiceFallback(
  client,
  textChunk,
  languageCode,
  primaryVoice,
  fallbackVoice
) {
  try {
    return await synthesizePlain(client, textChunk, languageCode, primaryVoice)
  } catch (e) {
    const canRetry =
      fallbackVoice &&
      fallbackVoice !== primaryVoice &&
      isTransientTtsGrpcCode(e?.code)
    if (!canRetry) throw e
    console.warn(
      "[Google TTS] voz primária falhou (gRPC",
      e?.code,
      "), tentando fallback:",
      fallbackVoice
    )
    return await synthesizePlain(client, textChunk, languageCode, fallbackVoice)
  }
}

export function getTtsVoiceConfig() {
  const languageCode = process.env.GOOGLE_TTS_LANGUAGE_CODE?.trim() || "pt-BR"
  const voiceName =
    process.env.GOOGLE_TTS_VOICE_NAME?.trim() || DEFAULT_TTS_VOICE
  const fallbackName =
    process.env.GOOGLE_TTS_VOICE_FALLBACK_NAME?.trim() ||
    DEFAULT_TTS_VOICE_FALLBACK
  return { languageCode, voiceName, fallbackName }
}

/**
 * @param {string} fullText
 * @returns {Promise<Buffer>}
 */
export async function synthesizeTextToMp3Buffer(fullText) {
  const trimmed = String(fullText ?? "").trim()
  if (!trimmed) return Buffer.alloc(0)

  const { languageCode, voiceName, fallbackName } = getTtsVoiceConfig()
  const client = getTtsClient()
  const chunkBytes = getChunkBytes()
  const plainUtf8Bytes = Buffer.byteLength(trimmed, "utf8")

  async function trySsmlWithVoice(vName, ssml) {
    const speakingRate = getSpeakingRate()
    const [response] = await client.synthesizeSpeech({
      input: { ssml },
      voice: { languageCode, name: vName },
      audioConfig: { audioEncoding: "MP3", speakingRate },
    })
    return Buffer.from(response.audioContent || [])
  }

  if (plainUtf8Bytes <= 4200) {
    const oneShotSsml = buildSsmlInput(fitTextForSsml(trimmed))
    const ssmlBytes = Buffer.byteLength(oneShotSsml, "utf8")
    if (ssmlBytes <= MAX_SSML_BYTES - 32) {
      try {
        return await trySsmlWithVoice(voiceName, oneShotSsml)
      } catch (e) {
        if (e?.code === 3) {
          console.warn("[Google TTS] SSML único rejeitado, usando texto em fatias.")
        } else if (
          fallbackName !== voiceName &&
          isTransientTtsGrpcCode(e?.code)
        ) {
          try {
            return await trySsmlWithVoice(fallbackName, oneShotSsml)
          } catch (e2) {
            if (e2?.code === 3) {
              console.warn(
                "[Google TTS] SSML com voz fallback rejeitado, usando texto em fatias."
              )
            } else {
              console.warn(
                "[Google TTS] SSML falhou (gRPC",
                e?.code,
                "/",
                e2?.code,
                "), usando texto em fatias."
              )
            }
          }
        } else {
          console.warn(
            "[Google TTS] SSML falhou (gRPC",
            e?.code,
            "), usando texto em fatias."
          )
        }
      }
    }
  }

  const chunks = splitTextIntoUtf8Chunks(trimmed, chunkBytes)
  const buffers = []
  for (let i = 0; i < chunks.length; i++) {
    const part = chunks[i].trim()
    if (!part) continue
    const audio = await synthesizePlainWithVoiceFallback(
      client,
      part,
      languageCode,
      voiceName,
      fallbackName
    )
    if (audio?.length) buffers.push(Buffer.from(audio))
  }

  if (buffers.length === 0) return Buffer.alloc(0)
  return Buffer.concat(buffers)
}
