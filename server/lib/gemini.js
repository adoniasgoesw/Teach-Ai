import { GoogleGenAI } from "@google/genai"

let cached = null

/**
 * Cliente Gemini (lazy). Não falha na importação do módulo — só ao chamar a IA.
 * Assim o servidor sobe em produção mesmo sem GEMINI_API_KEY (login/cursos/créditos funcionam).
 */
export function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    const err = new Error("GEMINI_API_KEY is not set")
    err.code = "GEMINI_NOT_CONFIGURED"
    throw err
  }
  if (!cached) {
    cached = new GoogleGenAI({ apiKey })
  }
  return cached
}

export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY?.trim())
}
