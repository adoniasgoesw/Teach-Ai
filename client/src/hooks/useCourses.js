import { useEffect, useState } from "react"
import { getCourses } from "../services/api"

export function useCourses(userId) {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!userId) return

    let isMounted = true

    async function fetchCourses() {
      try {
        setError("")
        setLoading(true)

        const data = await getCourses(userId)
        if (!isMounted) return

        setCourses(data.courses || [])
      } catch (err) {
        console.error(err)
        if (!isMounted) return
        const message =
          err?.response?.data?.message || "Erro ao carregar cursos. Tente novamente."
        setError(message)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchCourses()

    return () => {
      isMounted = false
    }
  }, [userId])

  return { courses, loading, error }
}

