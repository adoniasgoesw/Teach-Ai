import { GoogleGenAI } from "@google/genai"

const apiKey = process.env.GEMINI_API_KEY

if (!apiKey) {
  throw new Error("GEMINI_API_KEY is not set")
}

// Cliente oficial da API Gemini (v2+), pega a key da env
export const ai = new GoogleGenAI({ apiKey })

