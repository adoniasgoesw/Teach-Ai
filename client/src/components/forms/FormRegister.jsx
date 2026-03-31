import Button from "../buttons/Button"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { registerUser } from "../../services/api"

export default function FormRegister({ onCick }) {
    const navigate = useNavigate()

    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [userPassword, setUserPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    async function handleSubmit(e) {
        e.preventDefault()

        setError("")
        setLoading(true)

        try {
            const data = await registerUser({
                name,
                email,
                password: userPassword,
            })

            const user = data.user || data

            setName("")
            setEmail("")
            setUserPassword("")

            // login automático: navega para home com o usuário
            navigate("/home", { state: { user } })
        } catch (err) {
            console.error(err)
            const message =
                err?.response?.data?.message || "Erro ao registrar usuário. Tente novamente."
            setError(message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <article className="border-2 border-gray-200 w-full md:w-[60%] lg:w-1/3 flex flex-col items-start justify-center gap-5 p-4 rounded-lg bg-white ">
            <div className="flex flex-col items-start justify-center gap-2 w-full">
                <h2 className="text-2xl font-normal">Create your account</h2>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col items-start justify-center gap-2 w-full">
                <div className="flex flex-col items-start justify-center gap-2 w-full">
                    <label>Name</label>
                    <input
                        type="text"
                        placeholder="Tell me your name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full"
                    />
                </div>

                <div className="flex flex-col items-start justify-center gap-2 w-full">
                    <label>Email</label>
                    <input
                        type="text"
                        placeholder="Tell me your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full"
                    />
                </div>

                <div className="flex flex-col items-start justify-center gap-2 w-full">
                    <label>Password</label>
                    <input
                        type="password"
                        placeholder="password"
                        value={userPassword}
                        onChange={(e) => setUserPassword(e.target.value)}
                        className="w-full"
                    />
                </div>

                {error && (
                    <p className="text-red-500 text-sm w-full">
                        {error}
                    </p>
                )}

                <div className="flex flex-col items-center justify-center gap-2 w-full">
                    <Button
                        text={loading ? "Registering..." : "Register"}
                        variant="secondary"
                        size="md"
                        type="submit"
                        disabled={loading}
                    />
                </div>
            </form>

            <div>
                <p onClick={onCick}>Have an account? <a href="#">Login</a></p>
            </div>
        </article>
    )
}