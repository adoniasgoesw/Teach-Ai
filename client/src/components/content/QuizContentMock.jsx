import { ChevronLeft, ChevronRight } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

const letters = ["a", "b", "c", "d", "e", "f"]

const baseBtn =
    "w-full text-left rounded-xl border px-4 py-3 text-sm flex gap-3 items-start transition-colors"
const neutralBtn =
    `${baseBtn} border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300`
const disabledNeutral = `${baseBtn} border-gray-100 bg-gray-50/80 text-gray-500 cursor-default`
const correctBtn =
    `${baseBtn} border-emerald-500 bg-emerald-50 text-emerald-900 cursor-default ring-1 ring-emerald-500/30`
const wrongBtn =
    `${baseBtn} border-red-400 bg-red-50 text-red-900 cursor-default ring-1 ring-red-400/30`

function difficultyLabel(d) {
    if (d === "easy") return "Fácil"
    if (d === "hard") return "Difícil"
    if (d === "medium") return "Médio"
    return null
}

function QuizRunner({ quizzes }) {
    const total = quizzes.length
    const [index, setIndex] = useState(0)
    const [pickedByIndex, setPickedByIndex] = useState({})

    const quizzesKey = useMemo(
        () => quizzes.map((q) => q.id ?? q.question).join("|"),
        [quizzes]
    )

    useEffect(() => {
        setIndex(0)
        setPickedByIndex({})
    }, [quizzesKey])

    useEffect(() => {
        setIndex((i) =>
            Math.min(i, Math.max(0, total > 0 ? total - 1 : 0))
        )
    }, [total])

    const safeIndex = Math.min(Math.max(0, index), Math.max(0, total - 1))
    const q = quizzes[safeIndex]
    const options = Array.isArray(q?.alternatives) ? q.alternatives : []
    const rawCorrect = Number(q?.correctIndex)
    const correctIdx =
        options.length > 0 && Number.isInteger(rawCorrect)
            ? Math.min(Math.max(0, rawCorrect), options.length - 1)
            : 0
    const picked = pickedByIndex[safeIndex]
    const hasAnswered = picked !== undefined && picked !== null

    function selectOption(idx) {
        if (hasAnswered) return
        setPickedByIndex((prev) => ({ ...prev, [safeIndex]: idx }))
    }

    function optionButtonClass(idx) {
        if (!hasAnswered) return neutralBtn
        if (idx === correctIdx) return correctBtn
        if (idx === picked && idx !== correctIdx) return wrongBtn
        return disabledNeutral
    }

    const canPrev = safeIndex > 0
    const canNext = hasAnswered && safeIndex < total - 1
    const isLast = safeIndex === total - 1

    return (
        <div className="w-full max-w-xl mx-auto flex flex-col gap-6 py-2">
            <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
                <span className="tabular-nums font-medium text-gray-700">
                    Questão {safeIndex + 1} / {total}
                </span>
                {q?.difficulty && (
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {difficultyLabel(String(q.difficulty).toLowerCase())}
                    </span>
                )}
            </div>

            <div>
                <p className="mt-1 text-base text-gray-800 font-light leading-relaxed whitespace-pre-wrap">
                    {q?.question}
                </p>
            </div>

            <ul className="flex flex-col gap-2" role="list">
                {options.map((label, idx) => (
                    <li key={`${q.id}-${idx}`}>
                        <button
                            type="button"
                            onClick={() => selectOption(idx)}
                            disabled={hasAnswered}
                            className={optionButtonClass(idx)}
                            aria-pressed={picked === idx}
                        >
                            <span className="font-medium text-gray-500 w-6 shrink-0 pt-0.5">
                                {(letters[idx] ?? String(idx + 1)) + "."}
                            </span>
                            <span className="font-light">{label}</span>
                        </button>
                    </li>
                ))}
            </ul>

            {hasAnswered && (
                <p
                    className={
                        picked === correctIdx
                            ? "text-sm text-emerald-700"
                            : "text-sm text-red-700"
                    }
                >
                    {picked === correctIdx
                        ? "Correto."
                        : "Incorreto. A alternativa correta está em verde."}
                </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                    type="button"
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/50"
                    onClick={() => setIndex((i) => Math.max(0, i - 1))}
                    disabled={!canPrev}
                    aria-label="Questão anterior"
                >
                    <ChevronLeft className="w-5 h-5 shrink-0" />
                    Anterior
                </button>
                <button
                    type="button"
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/50"
                    onClick={() => {
                        if (canNext) setIndex((i) => i + 1)
                    }}
                    disabled={!canNext}
                    aria-label="Próxima questão"
                >
                    {isLast ? "Última questão" : "Próxima"}
                    <ChevronRight className="w-5 h-5 shrink-0" />
                </button>
            </div>

            {isLast && hasAnswered && (
                <p className="text-xs text-gray-500 text-center">
                    Fim do quiz. Use &quot;Anterior&quot; para revisar.
                </p>
            )}
        </div>
    )
}

const EXAMPLE_QUIZZES = [
    {
        id: "placeholder",
        question:
            "Qual afirmação melhor resume a ideia central deste tópico? (exemplo — substituído quando houver quiz da IA.)",
        alternatives: [
            "Primeira alternativa objetiva de exemplo.",
            "Segunda alternativa, para layout em coluna.",
            "Terceira alternativa possível.",
            "Quarta alternativa para fechar o bloco.",
        ],
        correctIndex: 1,
        difficulty: "medium",
    },
]

/**
 * Quiz interativo: uma questão por vez, feedback verde/vermelho, Anterior / Próxima.
 */
export default function QuizContentMock({ quizzes = [] }) {
    if (!quizzes.length) {
        return (
            <div className="w-full max-w-xl mx-auto flex flex-col gap-4 py-2">
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                    Nenhum quiz para esta fonte ainda. Exemplo interativo abaixo.
                </p>
                <QuizRunner quizzes={EXAMPLE_QUIZZES} />
            </div>
        )
    }

    return <QuizRunner quizzes={quizzes} />
}
