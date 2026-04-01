import Button from "../buttons/Button"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { loginUser } from "../../services/api"

export default function FormLogin({ onCick }) {
    const navigate = useNavigate()

    const [email, setEmail] = useState("")
    const [userPassword, setUserPassword] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e) {
        e.preventDefault()
        setError("")
        setLoading(true)

        try {
            const data = await loginUser({
                email,
                password: userPassword,
            })

            const user = data.user || data

            // persiste sessão no navegador
            try {
                window.localStorage.setItem("teachai:user", JSON.stringify(user))
            } catch (e) {
                console.warn("Não foi possível salvar o usuário no localStorage.", e)
            }

            setEmail("")
            setUserPassword("")

            navigate("/home", { state: { user } })
        } catch (err) {
            console.error(err)
            const message =
                err?.response?.data?.message || "Email ou senha não conferem."
            setError(message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <article className="border-2 border-gray-200 w-full md:w-[60%] lg:w-1/3 flex flex-col items-start justify-center gap-5 p-4 rounded-lg bg-white ">
            <div className="flex flex-col items-start justify-center gap-2 w-full">
                <h2 className="text-2xl font-normal">Welcome back!</h2>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col items-start justify-center gap-2 w-full">

                <div className="flex flex-col items-start justify-center gap-2 w-full">
                <label >Email</label>
                <input type="text" placeholder="Tell me your email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full"/>
                </div>

                <div className="flex flex-col items-start justify-center gap-2 w-full">
                    <label>Password</label>
                <input type="password" placeholder="password" value={userPassword}  onChange={(e) => setUserPassword(e.target.value)} className="w-full"/>
                </div>

                {error ? <p role="alert" className="text-red-500 text-sm">{error}</p> : null}

                <div className="flex flex-col items-center justify-center gap-2 w-full">
                <Button
                    text={loading ? "Logging in..." : "Login"}
                    variant="secondary"
                    size="md"
                    type="submit"
                    disabled={loading}
                />
                </div>

            </form>

            <div>
                <p onClick={onCick}>Don't have a account? <a href="#">Create a Account</a></p>
            </div>
        </article>
    )
}
