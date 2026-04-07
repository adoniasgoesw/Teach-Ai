import Button from "../buttons/Button"

const MODES = [
    { id: "read", label: "Aula" },
    { id: "audio", label: "Áudio" },
    { id: "quiz", label: "Quiz" },
    { id: "flashcard", label: "Flashcards" },
    { id: "notes", label: "Anotações" },
]

export default function StudioPanel({ studioMode, setStudioMode }) {
    return (
        <div className="bg-white w-1/3 rounded-2xl flex flex-col min-h-0">
            <div className="border-b border-gray-200 p-4 shrink-0">
                <p className="font-medium text-gray-800">Studio</p>
                <p className="text-xs text-gray-500 mt-1">
                    Modo de estudo do painel central
                </p>
            </div>

            <div className="grid grid-cols-1 gap-2 p-4">
                {MODES.map(({ id, label }) => (
                    <div
                        key={id}
                        className={
                            studioMode === id
                                ? "rounded-full ring-2 ring-gray-900 ring-offset-2"
                                : ""
                        }
                    >
                        <Button
                            text={label}
                            size="md"
                            variant="outline"
                            onClick={() => setStudioMode(id)}
                            aria-pressed={studioMode === id}
                            aria-label={`Modo ${label}`}
                        />
                    </div>
                ))}
            </div>
        </div>
    )
}
