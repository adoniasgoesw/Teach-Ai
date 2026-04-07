import Button from "../buttons/Button"
import { useNavigate } from "react-router-dom"
import { useState } from "react"
import { X } from "lucide-react"
import { createCourse } from "../../services/api"

export default function FormCourse({ onClose }) {
    const navigate = useNavigate()

    const [name, setName] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    async function handleSubmit(e) {
        e.preventDefault()
        setError("")
        setLoading(true)

        try {
            const rawUser = window.localStorage.getItem("teachai:user")
            const user = rawUser ? JSON.parse(rawUser) : null

            if (!user?.id) {
                setError("Usuário não encontrado. Faça login novamente.")
                setLoading(false)
                return
            }

            const data = await createCourse({
                name,
                userId: user.id,
            })

            const course = data.course || data

            setName("")

            onClose?.()
            navigate(`/course/${course.id}`)
        } catch (err) {
            console.error(err)
            const message =
                err?.response?.data?.message ||
                err?.message ||
                "Erro ao criar curso. Tente novamente."
            setError(message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <article className="absolute  top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-2 border-gray-200 w-full md:w-[60%] lg:w-1/3 flex flex-col items-start justify-center gap-5 p-4 rounded-lg bg-white shadow-lg">
            <div className="flex items-center justify-between w-full">
                <h2 className="text-2xl font-normal text-neutral-900">
                    Criar novo curso
                </h2>
                <Button
                    variant="ghost"
                    size="icon"
                    icon={<X className="w-4 h-4" />}
                    onClick={onClose}
                />
            </div>

            <form
                onSubmit={handleSubmit}
                className="flex flex-col items-start justify-center gap-4 w-full"
            >
                <div className="flex flex-col items-start justify-center gap-2 w-full">
                    <label className="text-sm font-medium text-neutral-700">
                        Nome do curso
                    </label>
                    <input
                        type="text"
                        placeholder="Ex.: JavaScript do zero"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                    />
                </div>

                {error && (
                    <p className="text-red-500 text-sm w-full">{error}</p>
                )}

                <div className="flex flex-col items-center justify-center gap-2 w-full">
                    <Button
                        text={loading ? "Criando…" : "Criar curso"}
                        variant="secondary"
                        size="md"
                        type="submit"
                        disabled={loading}
                    />
                </div>
            </form>
        </article>
    )
}
