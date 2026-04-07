import axios from "axios"

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV
    ? "http://localhost:3000/api"
    : "https://teach-ai-86fo.onrender.com/api")

export const api = axios.create({
  baseURL: API_BASE_URL,
})

/** Servidor opcional `server.js` (porta 3002): só parse/ping. */
const TEST_API_BASE_URL =
  import.meta.env.VITE_TEST_API_URL || "http://localhost:3002/api/teste"

export const testApi = axios.create({
  baseURL: TEST_API_BASE_URL,
  timeout: 900_000,
})

export async function testePing() {
  const res = await testApi.get("/ping")
  return res.data
}

export async function testeParsePdf(file) {
  const formData = new FormData()
  formData.append("file", file)
  const res = await testApi.post("/parse-pdf", formData)
  return res.data
}

/**
 * PDF → Gemini → Prisma (API principal `index.js`, POST /ai/pdf).
 * Exige courseId existente; só grava no BD se a IA responder JSON válido.
 */
export async function uploadCoursePdf(file, courseId, userId) {
  try {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("courseId", String(courseId))
    formData.append("userId", String(userId))
    const res = await api.post("/ai/pdf", formData, { timeout: 900_000 })
    return res.data
  } catch (err) {
    await throwParsedClientError(err, "PDF")
  }
}

/** Saldo de créditos (GET /credits/wallet). */
export async function getCreditsWallet(userId) {
  const res = await api.get("/credits/wallet", {
    params: { userId: String(userId) },
  })
  return res.data
}

/** Resumo da conta: perfil, carteira, assinatura, uso no ciclo. */
export async function getAccountSummary(userId) {
  const res = await api.get("/account/summary", {
    params: { userId: String(userId) },
  })
  return res.data
}

/** Histórico de CreditTransaction (ledger). */
export async function getCreditTransactions(userId, take = 80) {
  const res = await api.get("/credits/transactions", {
    params: { userId: String(userId), take },
  })
  return res.data
}

/** Catálogo de planos. */
export async function getPlans() {
  const res = await api.get("/plans")
  return res.data
}

/**
 * Cria assinatura Stripe (PaymentIntent na primeira fatura).
 * Retorno: { clientSecret?: string | null, subscriptionId, status }
 */
export async function createStripeSubscription(userId, planId) {
  try {
    const res = await api.post("/billing/create-subscription", {
      userId: String(userId),
      planId: String(planId),
    })
    return res.data
  } catch (err) {
    await throwParsedClientError(err, "Assinatura")
  }
}

/** Perfil (nome, email) a partir do banco. */
export async function getUserProfile(userId) {
  const res = await api.get("/users/profile", {
    params: { userId: String(userId) },
  })
  return res.data
}

export async function getHealth() {
  const res = await api.get("/health")
  return res.data
}

export async function registerUser(payload) {
  const res = await api.post("/auth/register", payload)
  return res.data
}

export async function loginUser(payload) {
  const res = await api.post("/auth/login", payload)
  return res.data
}

export async function createCourse(payload) {
  const res = await api.post("/courses", payload)
  return res.data
}

export async function getCourses(userId) {
  const res = await api.get("/courses", {
    params: { userId },
  })
  return res.data
}

/** Sources + lessons de um curso (GET /courses/:courseId/sources). */
export async function getCourseSources(courseId) {
  const res = await api.get(`/courses/${encodeURIComponent(courseId)}/sources`)
  return res.data
}

const LONG_AI_TIMEOUT_MS = 900_000

export async function getSourceQuizzes(sourceId) {
  const res = await api.get(
    `/sources/${encodeURIComponent(sourceId)}/quizzes`
  )
  return res.data
}

export async function postGenerateSourceQuizzes(sourceId, userId) {
  const res = await api.post(
    `/sources/${encodeURIComponent(sourceId)}/quizzes/generate`,
    { userId: String(userId) },
    { timeout: LONG_AI_TIMEOUT_MS }
  )
  return res.data
}

export async function getSourceFlashcards(sourceId) {
  const res = await api.get(
    `/sources/${encodeURIComponent(sourceId)}/flashcards`
  )
  return res.data
}

export async function postGenerateSourceFlashcards(sourceId, userId) {
  const res = await api.post(
    `/sources/${encodeURIComponent(sourceId)}/flashcards/generate`,
    { userId: String(userId) },
    { timeout: LONG_AI_TIMEOUT_MS }
  )
  return res.data
}

export async function getSourceNote(sourceId) {
  const res = await api.get(
    `/sources/${encodeURIComponent(sourceId)}/notes`
  )
  return res.data
}

export async function postGenerateSourceNote(sourceId, userId) {
  const res = await api.post(
    `/sources/${encodeURIComponent(sourceId)}/notes/generate`,
    { userId: String(userId) },
    { timeout: LONG_AI_TIMEOUT_MS }
  )
  return res.data
}

async function audioBlobFromResponse(blob, context = "") {
  const prefix = context ? `${context}: ` : ""
  if (blob.type && blob.type.includes("json")) {
    const raw = await blob.text()
    let msg = raw
    try {
      msg = JSON.parse(raw)?.message || JSON.parse(raw)?.detail || raw
    } catch {
      /* ignore */
    }
    throw new Error(`${prefix}${msg}`)
  }
  return blob
}

/**
 * Extrai mensagem do JSON ou blob JSON (rotas com responseType: blob) e lança Error.
 * @param {string} [context] — ex.: "Áudio", "PDF"
 */
export async function throwParsedClientError(err, context = "") {
  const prefix = context ? `${context}: ` : ""
  const d = err.response?.data

  if (d instanceof Blob) {
    const raw = await d.text()
    let msg = raw
    try {
      const j = JSON.parse(raw)
      msg = j.message || j.detail || j.error || raw
    } catch {
      /* ignore */
    }
    throw new Error(`${prefix}${msg}`)
  }

  if (d && typeof d === "object") {
    const msg =
      d.message ||
      d.detail ||
      (typeof d.error === "string" ? d.error : null) ||
      err.message
    throw new Error(`${prefix}${String(msg)}`)
  }

  const generic =
    err.message && !/^Request failed with status code \d+$/.test(err.message)
      ? err.message
      : "Não foi possível falar com o servidor."
  throw new Error(`${prefix}${generic}`)
}

/**
 * Áudio MP3 já salvo no BD para esta fonte (GET).
 * `null` só em 404 (ainda não existe). Não compara hash no cliente — se há linha
 * em SourceAudio, reutiliza o arquivo (evita TTS de novo ao reabrir o Studio).
 */
export async function getSourceAudioBlob(sourceId) {
  try {
    const res = await api.get(
      `/sources/${encodeURIComponent(sourceId)}/audio`,
      { responseType: "blob" }
    )
    return await audioBlobFromResponse(res.data, "Áudio")
  } catch (err) {
    if (err.response?.status === 404) return null
    await throwParsedClientError(err, "Áudio")
  }
}

/**
 * Gera ou reutiliza áudio por fonte (POST); persiste no BD quando gera.
 * Mesmo contrato de blob que `fetchGoogleTtsAudio`.
 */
export async function postSourceAudioForSource(sourceId, text, userId) {
  try {
    const res = await api.post(
      `/sources/${encodeURIComponent(sourceId)}/audio`,
      { text, userId: String(userId) },
      { responseType: "blob", timeout: 900_000 }
    )
    return await audioBlobFromResponse(res.data, "Áudio")
  } catch (err) {
    await throwParsedClientError(err, "Áudio")
  }
}

/** Áudio MP3 (Google Cloud TTS, Chirp 3 HD) para o texto da aula. */
export async function fetchGoogleTtsAudio(text, userId) {
  try {
    const res = await api.post(
      "/tts/google",
      { text, userId: String(userId) },
      {
        responseType: "blob",
        timeout: 900_000,
      }
    )
    return await audioBlobFromResponse(res.data, "Áudio")
  } catch (err) {
    await throwParsedClientError(err, "Áudio")
  }
}
