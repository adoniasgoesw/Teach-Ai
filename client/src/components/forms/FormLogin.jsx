import Button from "../buttons/Button"
import Data from "../../data/db.json"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { FaGoogle } from "react-icons/fa"

export default function FormLogin({onCick}) {
    const navigate = useNavigate()

    const [email, setEmail] = useState("")
    const [userPassword, setUserPassword] = useState("")
    const [error, setError] = useState("")

    function handleSubmit(e) {
        e.preventDefault()
        setError("")

        const match = Data.users.find(
            (u) =>
                u.email.trim().toLowerCase() === email.trim().toLowerCase() &&
                u.password === userPassword
        )

        if (match) {
            setEmail("")
            setUserPassword("")
            navigate("/home", { state: { user: match } })
        } else {
            setError("Email ou senha não conferem.")
        }
    }

    return (
        <article className="border-2 border-gray-200 w-full md:w-[60%] lg:w-1/3 flex flex-col items-start justify-center gap-5 p-4 rounded-lg bg-white ">
            <div className="flex flex-col items-start justify-center gap-2 w-full">
                <h2 className="text-2xl font-normal">Welcome back!</h2>
            </div>

            <div>
                <p>Login With</p>
                <Button icon={<FaGoogle />} text="Google" variant="secondary" size="md" type="submit" />
                
            </div>

            {/* divisor */}

            <div className="flex items-center justif-center gap-2 w-full">
            <div className="w-1/2 h-[1px] bg-gray-200"></div>
            <div className="w-1/2">
            <p>Or continue with</p>
            </div>
            <div className="w-1/2 h-[1px] bg-gray-200"></div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col items-start justify-center gap-2 w-full">

                <div className="flex flex-col items-start justify-center gap-2 w-full">
                <label >Email</label>
                <input type="text" placeholder="Tell me your email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full"/>
                </div>

                <div className="flex flex-col items-start justify-center gap-2 w-full">
                <label >Password</label>
                <input type="password" placeholder="password" value={userPassword}  onChange={(e) => setUserPassword(e.target.value)} className="w-full"/>
                </div>

                {error ? <p role="alert">{error}</p> : null}

                <div className="flex flex-col items-center justify-center gap-2 w-full">
                <Button text="Login" variant="secondary" size="md" type="submit" />
                </div>

            </form>

            <div>
                <p onClick={onCick}>Don't have a account? <a href="#">Create a Account</a></p>
            </div>
        </article>
    )
}
