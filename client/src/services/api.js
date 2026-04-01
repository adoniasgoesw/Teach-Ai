import axios from "axios"

// Vite carrega automaticamente .env.development e .env.production
// e expõe apenas variáveis com prefixo VITE_.
const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV
    ? "http://localhost:3000/api"
    : "https://teach-ai-86fo.onrender.com/api")

export const api = axios.create({
  baseURL: API_BASE_URL,
})

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

