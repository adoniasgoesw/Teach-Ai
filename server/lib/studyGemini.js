import { ai } from "./gemini.js"

export async function callGeminiWithRetry(fn, retries = 3) {
  try {
    return await fn()
  } catch (err) {
    const rawMessage = err?.message || ""
    const statusFromSdk = err?.status || err?.error?.code
    const statusTextFromSdk = err?.error?.status
    const isUnavailable =
      statusFromSdk === 503 ||
      statusTextFromSdk === "UNAVAILABLE" ||
      /high demand/i.test(rawMessage)

    if (retries > 0 && isUnavailable) {
      console.log("🔁 [study][IA] Retry Gemini… restantes:", retries)
      await new Promise((res) => setTimeout(res, 2000))
      return callGeminiWithRetry(fn, retries - 1)
    }
    throw err
  }
}

export function responseTextFromGemini(responseUnified) {
  if (typeof responseUnified?.text === "function") return responseUnified.text()
  if (typeof responseUnified?.text === "string") return responseUnified.text
  return ""
}

export function parseJsonFromAi(raw) {
  const cleaned = String(raw ?? "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim()
  if (!cleaned) return null
  try {
    return JSON.parse(cleaned)
  } catch {
    return null
  }
}

export async function generateContent(prompt) {
  const responseUnified = await callGeminiWithRetry(() =>
    ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    })
  )
  return responseTextFromGemini(responseUnified)
}
