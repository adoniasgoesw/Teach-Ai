import Button from "../buttons/Button"
import { ChevronRightIcon, FileUp, Plus } from "lucide-react"

export default function ClassPanel({
    sources,
    hasSources,
    sourcesLoading = false,
    sourcesError = null,
    openSourceId,
    setOpenSourceId,
    selectedLesson,
    setSelectedLesson,
    onSelectFile,
}) {
    const handleClickAddSource = () => {
        const input = document.getElementById("course-file-input")
        if (input) input.click()
    }

    return (
        <div className="bg-white w-1/3  rounded-2xl border-2 border-white/80">
            <div className="border-b border-gray-200 p-4">
                <p>Class</p>
            </div>

            <div className="p-4 flex flex-col gap-2 w-full  h-full">
                <div className="flex items-center justify-center gap-2 w-full ">
                    <Button
                        text={"Adicionar uma fonte"}
                        icon={<Plus />}
                        variant="outline"
                        size="sm"
                        onClick={handleClickAddSource}
                    />
                    {/* input de arquivo oculto, compartilhado com o ContentPanel */}
                    <input
                        id="course-file-input"
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={onSelectFile}
                    />
                </div>

                {sourcesLoading && (
                    <p className="text-sm text-gray-500 text-center mt-4">
                        Carregando fontes…
                    </p>
                )}

                {sourcesError && !sourcesLoading && (
                    <p className="text-sm text-red-600 text-center mt-4">
                        {sourcesError}
                    </p>
                )}

                {!sourcesLoading && !hasSources && !sourcesError && (
                    <div className="flex flex-col items-center justify-center gap-2 text-center mt-4">
                        <p>As fontes serão exibidas aqui</p>
                    </div>
                )}

                {hasSources && (
                    <div className="mt-4 flex flex-col gap-2  border  border-gray-200 p-4 rounded-2xl ">
                        {sources.map((source) => {
                            const isOpen = openSourceId === source.id

                            return (
                                <div key={source.id} className="w-full">
                                    <button
                                        type="button"
                                        className="flex w-full items-center justify-between gap-2 text-left"
                                        onClick={() =>
                                            setOpenSourceId((prev) =>
                                                prev === source.id ? null : source.id
                                            )
                                        }
                                    >
                                        <p className="text-sm text-gray-900">
                                            {source.title ?? source.filename ?? "Fonte"}
                                        </p>
                                        <ChevronRightIcon
                                            className={`h-4 w-4 transition-transform text-gray-900 ${
                                                isOpen ? "rotate-90" : ""
                                            }`}
                                        />
                                    </button>

                                    {isOpen && Array.isArray(source.lessons) && (
                                        <div className="mt-2 ml-4 flex flex-col gap-1">
                                            {source.lessons.map((lesson) => {
                                                const isActive =
                                                    selectedLesson &&
                                                    selectedLesson.id === lesson.id

                                                return (
                                                    <button
                                                        key={lesson.id}
                                                        type="button"
                                                        className={`text-sm font-light text-left px-2 py-1 rounded ${
                                                            isActive
                                                                ? "bg-gray-200 text-gray-900 rounded-md"
                                                                : "text-gray-700 hover:text-black hover:bg-gray-100"
                                                        }`}
                                                        onClick={() => setSelectedLesson(lesson)}
                                                    >
                                                        {lesson.title}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}

