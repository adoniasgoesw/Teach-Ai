import { Navigate, useLocation, useNavigate } from "react-router-dom"
import Button from "../components/buttons/Button"
import Data from "../data/db.json"
import CardCourse from "../components/cards/CardCourse"
import FormCourse from "../components/forms/FormCourse"
import { useState } from "react"
import Header from "../components/layouts/Header"
import { PlusIcon } from "lucide-react"

export default function HomePage() {
    const navigate = useNavigate()
    const { state } = useLocation()
    const [showFormCourse, setShowFormCourse] = useState(false)
    const user = state?.user

    const hasCourses = Array.isArray(Data.course) && Data.course.length > 0

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
                {
                    hasCourses ? (
                    <div className="grid grid-cols-3 gap-4">
                            {Data.course.map((course) => (
                                <CardCourse
                                    key={course.id}
                                    name={course.name}
                                    description={course.description}
                                    icon={course.icon}
                                    course={course}
                                />
                            ))}
                    </div>


                    ) : (
                    <div className="flex flex-col items-center justify-center">
                    <h2>Welcome, {user.name}</h2>
                    <p>You can add your first course here</p>
                    </div>
                    )
                }
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
