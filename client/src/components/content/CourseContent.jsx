import Button from "../buttons/Button"
import { ChevronRightIcon, Play } from "lucide-react"
import { useState } from "react"

export default function CourseContent({
    course,
    selectedLesson,
    selectedContent,
    onNextLesson,
}) {
    if (!selectedContent) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 text-center">
                <p>Selecione uma aula para ver o conteúdo</p>
            </div>
        )
    }

    const [started, setStarted] = useState(false)

    return (
        <div className="w-full h-full flex flex-col gap-4 relative">
            {!started && (
                <div className="absolute bg-gray-500/20 inset-0 flex items-center justify-center">
                    <div className=" p-4 rounded-2xl">
                        <Button
                            icon={<Play />}
                            variant="ghost"
                            size="icon"
                            onClick={() => setStarted(true)}
                        />
                    </div>
                </div>
            )}

            {started && (
                <div className="w-full h-full flex flex-col gap-4">
                    <div className="flex items-center justify-between w-full">
                        <div>
                            {/* título da aula */}
                            <h2 className="text-xl font-light">
                                {selectedLesson?.title}
                            </h2>
                        </div>

                        <div>
                            {/* avançar para a próxima aula */}
                            <Button
                                icon={<ChevronRightIcon />}
                                variant="icon"
                                size="icon"
                                onClick={onNextLesson}
                            />
                        </div>
                    </div>

                    <div>
                        {/* conteúdo da aula */}
                        <p className="text-md text-start font-light text-gray-700">
                            {selectedContent.body}
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}

