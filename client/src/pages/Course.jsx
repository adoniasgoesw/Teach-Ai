import Header from "../components/layouts/Header"
import { useLocation, useParams } from "react-router-dom"
import { useCallback, useEffect, useMemo, useState } from "react"
import ClassPanel from "../components/panels/ClassPanel"
import ContentPanel from "../components/panels/ContentPanel"
import StudioPanel from "../components/panels/StudioPanel"
import {
    uploadCoursePdf,
    getCourseSources,
    getCreditsWallet,
} from "../services/api"
import { notifyCreditsUpdated } from "../lib/creditsEvents"

export default function CoursePage() {
    const { state } = useLocation()
    const { id: routeCourseId } = useParams()

    const course = useMemo(() => {
        if (state?.course) return state.course
        if (routeCourseId != null && String(routeCourseId).trim() !== "") {
            return {
                id: String(routeCourseId).trim(),
                name: undefined,
                sources: [],
            }
        }
        return null
    }, [state?.course, routeCourseId])

    const [sources, setSources] = useState([])
    const [sourcesLoading, setSourcesLoading] = useState(false)
    const [sourcesError, setSourcesError] = useState(null)
    const [sessionUser, setSessionUser] = useState(null)
    const [creditBalance, setCreditBalance] = useState(null)
    const courseIdForApi = course?.id ?? routeCourseId ?? null

    useEffect(() => {
        try {
            const raw = window.localStorage.getItem("teachai:user")
            setSessionUser(raw ? JSON.parse(raw) : null)
        } catch {
            setSessionUser(null)
        }
    }, [])

    const refreshCredits = useCallback(async () => {
        const uid = sessionUser?.id
        if (uid == null || String(uid).trim() === "") {
            setCreditBalance(null)
            return
        }
        try {
            const d = await getCreditsWallet(String(uid).trim())
            if (typeof d?.balance === "number") setCreditBalance(d.balance)
            notifyCreditsUpdated()
        } catch {
            /* ignore */
        }
    }, [sessionUser?.id])

    useEffect(() => {
        void refreshCredits()
    }, [refreshCredits])

    useEffect(() => {
        if (!courseIdForApi) {
            setSources([])
            return
        }
        let cancelled = false
        setSourcesLoading(true)
        setSourcesError(null)
        getCourseSources(String(courseIdForApi).trim())
            .then((data) => {
                if (cancelled) return
                setSources(Array.isArray(data?.sources) ? data.sources : [])
            })
            .catch((err) => {
                if (cancelled) return
                const msg =
                    err?.response?.data?.message ||
                    err?.message ||
                    "Erro ao carregar fontes"
                setSourcesError(msg)
                setSources([])
            })
            .finally(() => {
                if (!cancelled) setSourcesLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [courseIdForApi])

    const hasSources = sources.length > 0

    const [openSourceId, setOpenSourceId] = useState(null)
    const [selectedLesson, setSelectedLesson] = useState(null)
    const [studioMode, setStudioMode] = useState("read")
    const flatLessons = useMemo(
        () =>
            sources.flatMap((s) =>
                Array.isArray(s.lessons) ? s.lessons : []
            ),
        [sources]
    )

    const audioSourceId = selectedLesson?.sourceId ?? null
    const lessonsForAudio = useMemo(() => {
        if (!audioSourceId) return []
        const src = sources.find((s) => s.id === audioSourceId)
        return Array.isArray(src?.lessons) ? src.lessons : []
    }, [sources, audioSourceId])

    const selectedContent = useMemo(() => {
        const text = selectedLesson?.content
        if (text == null || text === "") return null
        return { body: text }
    }, [selectedLesson])

    // Mantém seleção válida ou escolhe a primeira aula disponível
    useEffect(() => {
        if (!hasSources) {
            setSelectedLesson(null)
            return
        }

        const flat = sources.flatMap((s) =>
            Array.isArray(s.lessons) ? s.lessons : []
        )
        if (!flat.length) {
            setSelectedLesson(null)
            return
        }

        const stillValid =
            selectedLesson && flat.some((l) => l.id === selectedLesson.id)
        if (stillValid) return

        const firstSourceWithLessons = sources.find(
            (s) => Array.isArray(s.lessons) && s.lessons.length > 0
        )
        if (firstSourceWithLessons) {
            setSelectedLesson(firstSourceWithLessons.lessons[0])
            setOpenSourceId(firstSourceWithLessons.id)
        }
    }, [hasSources, sources, selectedLesson?.id])

    async function handleSelectFile(e) {
        const file = e.target.files?.[0]
        if (!file) return

        console.log("[Client] Arquivo selecionado:", {
            name: file.name,
            size: file.size,
            type: file.type,
        })

        try {
            const uid = sessionUser?.id
            if (uid == null || String(uid).trim() === "") {
                window.alert(
                    "Faça login para enviar PDFs. O upload consome créditos da sua conta."
                )
                return
            }

            const courseId =
                course?.id != null
                    ? String(course.id).trim()
                    : routeCourseId != null
                      ? String(routeCourseId).trim()
                      : ""
            if (!courseId) {
                console.warn(
                    "[Client] Sem id do curso na rota (/course/:id) ou no state — não é possível salvar o PDF."
                )
                return
            }

            console.log("[Client] Enviando PDF para /api/ai/pdf (pode levar vários minutos)...")
            const data = await uploadCoursePdf(file, courseId, String(uid).trim())
            console.log("[Client] Resposta /ai/pdf:", data)
            if (typeof data?.balanceAfter === "number") {
                setCreditBalance(data.balanceAfter)
                notifyCreditsUpdated()
            } else {
                void refreshCredits()
            }
            if (data?.saved && courseIdForApi) {
                console.log("[Client] Salvo — sourceId:", data.sourceId)
                try {
                    const refreshed = await getCourseSources(
                        String(courseIdForApi).trim()
                    )
                    setSources(
                        Array.isArray(refreshed?.sources) ? refreshed.sources : []
                    )
                    setSourcesError(null)
                } catch (refreshErr) {
                    console.warn("[Client] Não foi possível atualizar a lista de fontes:", refreshErr)
                }
            }
        } catch (err) {
            const msg =
                err?.message ||
                err?.response?.data?.message ||
                err?.response?.data?.error ||
                "Não foi possível processar o PDF."
            const line = msg.includes("PDF:") ? msg : `PDF: ${msg}`
            window.alert(line)
            if (
                err?.response?.status === 403 ||
                /insuficiente|créditos|INSUFFICIENT_CREDITS/i.test(line)
            ) {
                void refreshCredits()
            }
            console.error("[Client] Erro ao enviar PDF:", line, err?.response?.data)
        } finally {
            // limpa o input para permitir reupload do mesmo arquivo, se necessário
            e.target.value = ""
        }
    }

    return (
        <section className="flex flex-col gap-10 px-5 md:px-10 lg:px-20 py-6 min-h-screen bg-neutral-200/50">
            <div className=" w-full h-full  flex-1 flex flex-col gap-10 items-center justify-start overflow-hidden">
                <Header />

                {sessionUser && (
                    <div className="w-full max-w-4xl flex flex-col gap-1 text-sm text-gray-700 -mt-4 mb-1">
                        <p>
                            Créditos:{" "}
                            <span className="font-semibold tabular-nums text-gray-900">
                                {creditBalance === null ? "—" : creditBalance}
                            </span>
                            {creditBalance === 0 && (
                                <span className="ml-2 text-amber-800">
                                    Saldo zerado — recarregue ou faça upgrade para
                                    continuar usando IA, áudio e PDFs.
                                </span>
                            )}
                        </p>
                    </div>
                )}

                <div className="flex-1 flex gap-5 w-full   overflow-hidden">
                    <ClassPanel
                        sources={sources}
                        hasSources={hasSources}
                        sourcesLoading={sourcesLoading}
                        sourcesError={sourcesError}
                        openSourceId={openSourceId}
                        selectedLesson={selectedLesson}
                        setOpenSourceId={setOpenSourceId}
                        setSelectedLesson={setSelectedLesson}
                        onSelectFile={handleSelectFile}
                    />

                    <ContentPanel
                        hasSources={hasSources}
                        sourcesLoading={sourcesLoading}
                        selectedLesson={selectedLesson}
                        selectedContent={selectedContent}
                        flatLessons={flatLessons}
                        audioSourceId={audioSourceId}
                        lessonsForAudio={lessonsForAudio}
                        setSelectedLesson={setSelectedLesson}
                        studioMode={studioMode}
                        onSelectFile={handleSelectFile}
                        userId={sessionUser?.id ?? null}
                        onRefreshCredits={refreshCredits}
                    />

                    <StudioPanel
                        studioMode={studioMode}
                        setStudioMode={setStudioMode}
                    />
                </div>

            </div>
        </section>
    )
}