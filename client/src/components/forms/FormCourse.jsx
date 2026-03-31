import Button from "../buttons/Button"
import { useNavigate } from "react-router-dom"
import { useState } from "react"
import { X } from "lucide-react"

export default function FormCourse({ onClose }) {
    const navigate = useNavigate()

    const [name, setName] = useState("")
    const [description, setDescription] = useState("")

    function handleSubmit(e) {
        e.preventDefault()
        // aqui futuramente podemos salvar no db / API
        navigate("/course")
    }

    return (
        <article className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-2 border-gray-200 w-full md:w-[60%] lg:w-1/3 flex flex-col items-start justify-center gap-5 p-4 rounded-lg bg-white shadow-lg">
            <div className="flex items-center justify-between w-full">
                <h2 className="text-2xl font-normal">Create a new course</h2>
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
                    <label>Course name</label>
                    <input
                        type="text"
                        placeholder="Tell me the course name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full"
                    />
                </div>

                <div className="flex flex-col items-start justify-center gap-2 w-full">
                    <label>Description</label>
                    <textarea
                        placeholder="Describe what this course is about"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full min-h-[80px] resize-none"
                    />
                </div>

                <div className="flex flex-col items-center justify-center gap-2 w-full">
                    <Button text="Create course" variant="secondary" size="md" type="submit" />
                </div>
            </form>
        </article>
    )
}