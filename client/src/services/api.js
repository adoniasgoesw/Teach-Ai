import axios from "axios"

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.development
    ? "http://localhost:3000/api"
    : "https://seu-dominio-de-producao/api")

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

