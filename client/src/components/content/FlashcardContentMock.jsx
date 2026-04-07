import { ChevronLeft, ChevronRight } from "lucide-react"
import Button from "../buttons/Button"
import { useState, useMemo } from "react"

/**
 * Flashcards da API (`cards`) ou placeholder.
 */
export default function FlashcardContentMock({ cards = [] }) {
    const [index, setIndex] = useState(0)
    const [flipped, setFlipped] = useState(false)

    const list = useMemo(
        () =>
            Array.isArray(cards) && cards.length > 0
                ? cards
                : [
                      {
                          id: "mock",
                          term: "Frente do card",
                          definition:
                              "Verso do card — resposta ou explicação curta",
                      },
                  ],
        [cards]
    )

    const total = list.length
    const current = list[Math.min(index, total - 1)] ?? list[0]
    const isMock = list.length === 1 && list[0].id === "mock"

    function prev() {
        setFlipped(false)
        setIndex((i) => (i <= 0 ? total - 1 : i - 1))
    }

    function next() {
        setFlipped(false)
        setIndex((i) => (i >= total - 1 ? 0 : i + 1))
    }

    return (
        <div className="w-full flex flex-col items-center gap-6 py-2">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 self-start w-full max-w-md">
                Flashcards
                {isMock && (
                    <span className="block text-amber-800 font-normal mt-1 normal-case">
                        Nenhum flashcard para esta fonte — exibindo exemplo.
                    </span>
                )}
            </p>

            <button
                type="button"
                onClick={() => setFlipped((f) => !f)}
                className="relative w-full max-w-md aspect-square max-h-[min(320px,50vh)] cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 rounded-2xl"
                style={{ perspective: "1000px" }}
                aria-label={flipped ? "Ver frente" : "Ver verso"}
            >
                <div
                    className="relative w-full h-full transition-transform duration-500 rounded-2xl shadow-md border border-gray-200"
                    style={{
                        transformStyle: "preserve-3d",
                        transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
                    }}
                >
                    <div
                        className="absolute inset-0 rounded-2xl bg-neutral-100 flex items-center justify-center p-6 border border-gray-200"
                        style={{ backfaceVisibility: "hidden" }}
                    >
                        <p className="text-center text-lg font-light text-gray-800 whitespace-pre-wrap">
                            {current.term}
                            <span className="block text-sm text-gray-500 mt-3">
                                (toque para ver o verso)
                            </span>
                        </p>
                    </div>
                    <div
                        className="absolute inset-0 rounded-2xl bg-gray-900 flex items-center justify-center p-6"
                        style={{
                            backfaceVisibility: "hidden",
                            transform: "rotateY(180deg)",
                        }}
                    >
                        <p className="text-center text-lg font-light text-white whitespace-pre-wrap">
                            {current.definition}
                        </p>
                    </div>
                </div>
            </button>

            <div className="flex items-center gap-4">
                <Button
                    icon={<ChevronLeft className="w-5 h-5" />}
                    variant="ghost"
                    size="icon"
                    onClick={prev}
                    aria-label="Flashcard anterior"
                    title="Anterior"
                />
                <span className="text-xs text-gray-500 tabular-nums">
                    {index + 1} / {total}
                </span>
                <Button
                    icon={<ChevronRight className="w-5 h-5" />}
                    variant="ghost"
                    size="icon"
                    onClick={next}
                    aria-label="Próximo flashcard"
                    title="Próximo"
                />
            </div>
        </div>
    )
}
