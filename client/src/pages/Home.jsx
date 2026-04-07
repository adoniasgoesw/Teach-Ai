import { Navigate, useLocation, useNavigate } from "react-router-dom"
import Button from "../components/buttons/Button"
import FormCourse from "../components/forms/FormCourse"
import { useState } from "react"
import Header from "../components/layouts/Header"
import { PlusIcon } from "lucide-react"
import ListCourses from "../components/lists/ListCourses"

export default function HomePage() {
    const navigate = useNavigate()
    const { state } = useLocation()
    const [showFormCourse, setShowFormCourse] = useState(false)

    // Recupera o usuário da navegação ou do localStorage
    const locationUser = state?.user
    const storedUser =
        typeof window !== "undefined"
            ? (() => {
                  try {
                      const raw = window.localStorage.getItem("teachai:user")
                      return raw ? JSON.parse(raw) : null
                  } catch {
                      return null
                  }
              })()
            : null

    const user = locationUser || storedUser

    if (!user) {
        return <Navigate to="/login" replace />
    }

    return (
        <section className="flex flex-col gap-10 px-5 md:px-10 lg:px-20 py-6 h-screen relative">
            <Header  />

            <main className="flex flex-col items-center  gap-20 justify-between h-full">
                <div className=" w-full   flex items-center justify-end">
                    <Button variant="tertiary" icon={<PlusIcon />} text={"New course"} onClick={() => setShowFormCourse(true)} />
                </div>
                <div className=" w-full h-full  flex flex-col gap-5 items-start justify-center">

                    <div>
                        <h4 className="text-2xl font-light">Your courses</h4>
                    </div>

                    <div className="w-full h-full">
                    <ListCourses user={user} />
                    </div>
                </div>

                {
                    showFormCourse && (
                        <FormCourse onClose={() => setShowFormCourse(false)} />
                    )
                }
            </main>
        </section>
    )
}
