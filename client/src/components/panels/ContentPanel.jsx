import Button from "../buttons/Button"
import { FileUp } from "lucide-react"
import CourseContent from "../content/CourseContent"

export default function ContentPanel({
    hasSources,
    sourcesLoading = false,
    selectedLesson,
    selectedContent,
    flatLessons = [],
    audioSourceId = null,
    lessonsForAudio = [],
    setSelectedLesson,
    studioMode = "read",
    onSelectFile,
    userId = null,
    onRefreshCredits,
}) {
    const handleClickUpload = () => {
        const input = document.getElementById("course-file-input")
        if (input) input.click()
    }

    return (
        <div className="bg-white w-1/2  rounded-2xl">
            <div className="border-b border-gray-200 p-4">
                <p className="font-medium text-gray-800">Conteúdo</p>
                <p className="text-xs text-gray-500 mt-0.5">
                    Texto da aula após o PDF; Studio: Aula, Áudio, Quiz,
                    Flashcards e Anotações (quiz/flash/anotações vão com a fonte
                    do PDF)
                </p>
            </div>

            <div className="p-4 flex items-center justify-center h-full w-full">
                {sourcesLoading && (
                    <p className="text-sm text-gray-500">Carregando conteúdo do curso…</p>
                )}

                {!sourcesLoading && !hasSources && (
                    <div className="flex flex-col items-center justify-center gap-2 text-center">
                        <Button icon={<FileUp />} size="icon" variant="icon" />
                        <p>Adcione uma fonte para o seu curso</p>
                        <Button
                            text={"Fazer o upload de um arquivo"}
                            variant="outline"
                            size="sm"
                            onClick={handleClickUpload}
                        />
                        {/* input de arquivo oculto (mesmo id usado no ClassPanel) */}
                        <input
                            id="course-file-input"
                            type="file"
                            accept="application/pdf"
                            className="hidden"
                            onChange={onSelectFile}
                        />
                    </div>
                )}

                {!sourcesLoading && hasSources && (
                    <CourseContent
                        selectedLesson={selectedLesson}
                        selectedContent={selectedContent}
                        flatLessons={flatLessons}
                        audioSourceId={audioSourceId}
                        lessonsForAudio={lessonsForAudio}
                        setSelectedLesson={setSelectedLesson}
                        studioMode={studioMode}
                        userId={userId}
                        onRefreshCredits={onRefreshCredits}
                    />
                )}
            </div>
        </div>
    )
}

