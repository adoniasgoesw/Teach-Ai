import Button from "../buttons/Button"
import { useNavigate } from "react-router-dom"
import { LogOutIcon, UserIcon } from "lucide-react"
import { useState, useEffect, useRef } from "react"

export default function Header() {

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
        <header className="flex justify-between items-center w-full">
            <div ref={containerRef} className="flex justify-between items-center w-full relative">
                <div>
                    <h4 className="text-2xl font-light">Teach AI</h4>
                </div>
                <div>
                    <Button
                        icon={<UserIcon />}
                        size="icon"
                        onClick={() => setShowMenu((prev) => !prev)}
                        variant="ghost"
                    />
                </div>

                {
                    showMenu && (
                        <div className="bg-red-500 absolute top-10 right-0">
                            <Button icon={<LogOutIcon />} text={"logout"} onClick={() => navigate("/")} variant="logout" />
                        </div>
                    )
                }
            </div>
        </header>
    )
}