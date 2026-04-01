import Button from "../buttons/Button"
import { EllipsisVertical, Pencil, Trash } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"

export default function CardCourse({ name, description, icon, course, onClick }) {

    const [showMenu, setShowMenu] = useState(false)
    const containerRef = useRef(null)
    const navigate = useNavigate()

    useEffect(() => {
        function handleClickOutside(event) {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setShowMenu(false)
            }
        }

        if (showMenu) {
            document.addEventListener("mousedown", handleClickOutside)
        } else {
            document.removeEventListener("mousedown", handleClickOutside)
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [showMenu])
    return (
        <article
            className="bg-neutral-200 p-4 rounded-lg flex flex-col items-start justify-center gap-2 cursor-pointer"
            onClick={
                onClick
                    ? onClick
                    : () => {
                        if (course?.id != null) {
                            navigate(`/course/${course.id}`)
                        } else {
                            navigate("/course", { state: { course } })
                        }
                    }
            }
        >

            <div ref={containerRef} className="relative flex w-full items-center justify-between">
                <div>
                    {icon}
                </div>

                <div>
                    <Button
                        variant="icon"
                        icon={<EllipsisVertical />}
                        size="icon"
                        onClick={(e) => {
                            e.stopPropagation()
                            setShowMenu((prev) => !prev)
                        }}
                    />
                </div>

                {
                    showMenu && (
                        <div className="flex flex-col gap-2 p-4 rounded-lg bg-white absolute top-10 -right-20 shadow-lg">
                            <Button  icon={<Pencil className="w-3 h-3"/> } text="Edit" variant="dropdown" size="sm" />
                            <Button  icon={<Trash className="w-3 h-3"/> } text="Delete" variant="dropdown" size="sm" />
                        </div>
                    )
                }
            </div>

                    <h3>{name}</h3>
                    <p>{description}</p>
        </article>
    )
}