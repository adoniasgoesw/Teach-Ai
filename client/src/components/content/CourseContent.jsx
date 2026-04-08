import Button from "../buttons/Button"
import {
    Play,
    Pause,
    SkipForward,
    SkipBack,
    Square,
} from "lucide-react"
import { useEffect, useRef, useState, useMemo } from "react"
import {
    fetchGoogleTtsAudio,
    getSourceAudioBlob,
    postSourceAudioForSource,
    getSourceQuizzes,
    postGenerateSourceQuizzes,
    getSourceFlashcards,
    postGenerateSourceFlashcards,
    getSourceNote,
    postGenerateSourceNote,
} from "../../services/api"
import QuizContentMock from "./QuizContentMock.jsx"
import FlashcardContentMock from "./FlashcardContentMock.jsx"
import SourceNotesMarkdown from "./SourceNotesMarkdown.jsx"

function formatTime(sec) {
    if (!Number.isFinite(sec) || sec < 0) return "0:00"
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${String(s).padStart(2, "0")}`
}

function studyErrMessage(err, kind = "") {
    const prefix = kind ? `${kind}: ` : ""
    const d = err?.response?.data
    if (d && typeof d === "object" && d.code === "INSUFFICIENT_CREDITS") {
        return (
            prefix +
            (d.message ||
                "Seus créditos acabaram. Recarregue créditos ou faça upgrade do plano.")
        )
    }
    const m = d?.message
    let base =
        typeof m === "string" && m.trim()
            ? m
            : err?.message || "Erro ao carregar materiais de estudo."
    if (/^Request failed with status code \d+$/.test(String(base))) {
        base = `erro no servidor (HTTP ${err?.response?.status ?? "?"}).`
    }
    return `${prefix}${base}`
}

function revokeUrls(urls) {
    for (const u of urls) {
        try {
            URL.revokeObjectURL(u)
        } catch {
            /* ignore */
        }
    }
}

/**
 * Texto só para TTS: sem emojis/pictogramas (o narrador fala o nome do símbolo),
 * sem linhas de título Markdown (# título), sem # de hashtag antes de palavra.
 * Mantém símbolos de código (!user, operadores, etc.) — não remove # de #include/#define
 * (vira "include"/"define", aceitável; dígitos após # preservados).
 */
function sanitizeTextForTts(raw) {
    if (raw == null || typeof raw !== "string") return ""
    let s = raw

    const lines = s.split("\n")
    const kept = lines.filter((line) => {
        const t = line.trim()
        if (t === "") return true
        // ATX: "# Título", "## Seção" (há espaço após os #)
        if (/^#{1,6}\s+\S/.test(t)) return false
        // Linha só com #palavra (ex.: #projeto como título)
        if (/^#\w+$/.test(t)) return false
        return true
    })
    s = kept.join("\n")

    // #palavra no meio do texto → palavra (não lê "hashtag"); \p{L} cobre acentos
    s = s.replace(/(^|\s)#+(?=\p{L})/gu, "$1")

    s = s.replace(/\p{Extended_Pictographic}/gu, "")
    s = s.replace(/\uFE0F/g, "").replace(/\u200D/g, "")

    s = s.replace(/[ \t]+/g, " ")
    s = s.replace(/\n{3,}/g, "\n\n")

    return s.trim()
}

/** Junta só o `content` de cada aula para o TTS, já sanitizado. */
function buildCombinedTtsText(lessons) {
    return lessons
        .map((l) => sanitizeTextForTts(String(l.content ?? "")))
        .filter(Boolean)
        .join("\n\n")
}

export default function CourseContent({
    selectedLesson,
    selectedContent,
    flatLessons = [],
    audioSourceId = null,
    lessonsForAudio = [],
    setSelectedLesson: _setSelectedLesson,
    studioMode = "read",
    userId = null,
    onRefreshCredits,
}) {
    /**
     * Fonte onde o MP3 fica salvo e onde debitamos créditos (sempre POST /sources/:id/audio).
     * Sem isso, no primeiro render a aula ainda não está selecionada e o app caía em
     * /tts/google (“sem fonte”); ao selecionar a aula, gerava de novo na fonte — 2× créditos.
     */
    const ttsPersistSourceId = useMemo(() => {
        const a = audioSourceId != null ? String(audioSourceId).trim() : ""
        if (a) return a
        const sid = flatLessons.find((l) => l.sourceId)?.sourceId
        return sid != null ? String(sid).trim() : ""
    }, [audioSourceId, flatLessons])

    const lessonsForTts = useMemo(() => {
        const withText = (list) =>
            list.filter((l) => String(l.content ?? "").trim().length > 0)
        if (lessonsForAudio.length > 0) {
            return withText(lessonsForAudio)
        }
        if (ttsPersistSourceId) {
            return withText(
                flatLessons.filter(
                    (l) => String(l.sourceId) === ttsPersistSourceId
                )
            )
        }
        return withText(flatLessons)
    }, [lessonsForAudio, flatLessons, ttsPersistSourceId])

    const lessonsWithText = lessonsForTts

    const combinedTtsText = useMemo(
        () => buildCombinedTtsText(lessonsWithText),
        [lessonsWithText]
    )

    const lessonsKey = useMemo(
        () =>
            [ttsPersistSourceId, lessonsWithText.map((l) => l.id).join(",")].join(
                "|"
            ),
        [ttsPersistSourceId, lessonsWithText]
    )

    /** idle | loading (GET cache) | generating (TTS/POST) | ready | error — como quiz/flash/notes */
    const [audioPhase, setAudioPhase] = useState("idle")
    const [audioReloadNonce, setAudioReloadNonce] = useState(0)
    const [sessionError, setSessionError] = useState(null)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [isPlaying, setIsPlaying] = useState(false)

    const audioRef = useRef(null)
    const objectUrlsRef = useRef([])
    const manualStopRef = useRef(false)
    /** Evita GET/POST de novo ao trocar Aula↔Áudio se nada mudou na fonte */
    const audioReadyLessonsKeyRef = useRef(null)
    /** Invalida awaits após parar / trocar fonte / sair da aba */
    const audioRequestGenRef = useRef(0)
    const lessonsKeyRef = useRef(lessonsKey)
    lessonsKeyRef.current = lessonsKey
    const studioModeRef = useRef(studioMode)
    studioModeRef.current = studioMode

    const bodyText = selectedContent?.body ?? ""

    const studySourceId = audioSourceId != null ? String(audioSourceId).trim() : ""

    const [sourceQuizzes, setSourceQuizzes] = useState([])
    const [quizPhase, setQuizPhase] = useState("idle")
    const [quizError, setQuizError] = useState(null)

    const [sourceFlashcards, setSourceFlashcards] = useState([])
    const [flashPhase, setFlashPhase] = useState("idle")
    const [flashError, setFlashError] = useState(null)

    const [sourceNote, setSourceNote] = useState(null)
    const [notePhase, setNotePhase] = useState("idle")
    const [noteError, setNoteError] = useState(null)

    const quizGenRef = useRef(0)
    const flashGenRef = useRef(0)
    const noteGenRef = useRef(0)

    async function pollUntilQuizReady(sourceId, cancelledRef, maxMs = 120_000) {
        const start = Date.now()
        for (;;) {
            if (cancelledRef.current) return null
            if (Date.now() - start > maxMs) throw new Error("Quiz: demorou demais para finalizar. Tente novamente.")
            const data = await getSourceQuizzes(sourceId)
            const list = Array.isArray(data?.quizzes) ? data.quizzes : []
            if (list.length > 0) return list
            if (data?.status !== "IN_PROGRESS") return list
            await new Promise((r) => setTimeout(r, 1500))
        }
    }

    async function pollUntilFlashReady(sourceId, cancelledRef, maxMs = 120_000) {
        const start = Date.now()
        for (;;) {
            if (cancelledRef.current) return null
            if (Date.now() - start > maxMs)
                throw new Error(
                    "Flashcards: demorou demais para finalizar. Tente novamente."
                )
            const data = await getSourceFlashcards(sourceId)
            const list = Array.isArray(data?.flashcards) ? data.flashcards : []
            if (list.length > 0) return list
            if (data?.status !== "IN_PROGRESS") return list
            await new Promise((r) => setTimeout(r, 1500))
        }
    }

    async function pollUntilNoteReady(sourceId, cancelledRef, maxMs = 120_000) {
        const start = Date.now()
        for (;;) {
            if (cancelledRef.current) return null
            if (Date.now() - start > maxMs)
                throw new Error(
                    "Anotações: demorou demais para finalizar. Tente novamente."
                )
            const data = await getSourceNote(sourceId)
            const n = data?.note
            if (n && typeof n.content === "string" && n.content.trim()) return n
            if (data?.status !== "IN_PROGRESS") return null
            await new Promise((r) => setTimeout(r, 1500))
        }
    }

    useEffect(() => {
        if (studioMode !== "quiz") return
        if (!studySourceId) return
        const uid = userId != null ? String(userId).trim() : ""
        if (!uid) {
            setSourceQuizzes([])
            setQuizPhase("error")
            setQuizError(
                "Faça login para gerar o quiz. O uso consome créditos da sua conta."
            )
            return
        }
        let cancelled = false
        const cancelledRef = { get current() { return cancelled } }
        const reqId = (quizGenRef.current += 1)
        setSourceQuizzes([])
        setQuizPhase("loading")
        setQuizError(null)
        ;(async () => {
            try {
                const data = await getSourceQuizzes(studySourceId)
                if (cancelled || reqId !== quizGenRef.current) return
                const list = Array.isArray(data?.quizzes) ? data.quizzes : []
                if (list.length > 0) {
                    setSourceQuizzes(list)
                    setQuizPhase("ready")
                    return
                }
                // Se o servidor já está gerando, só aguarda/polla.
                if (data?.status === "IN_PROGRESS") {
                    setQuizPhase("generating")
                    const ready = await pollUntilQuizReady(
                        studySourceId,
                        cancelledRef
                    )
                    if (cancelled || reqId !== quizGenRef.current) return
                    setSourceQuizzes(ready || [])
                    setQuizPhase("ready")
                    return
                }
                setQuizPhase("generating")
                const gen = await postGenerateSourceQuizzes(studySourceId, uid)
                if (cancelled || reqId !== quizGenRef.current) return
                if (gen?.status === "IN_PROGRESS") {
                    const ready = await pollUntilQuizReady(
                        studySourceId,
                        cancelledRef
                    )
                    if (cancelled || reqId !== quizGenRef.current) return
                    setSourceQuizzes(ready || [])
                    setQuizPhase("ready")
                    return
                }
                setSourceQuizzes(Array.isArray(gen?.quizzes) ? gen.quizzes : [])
                setQuizPhase("ready")
                onRefreshCredits?.()
            } catch (err) {
                if (cancelled || reqId !== quizGenRef.current) return
                setQuizError(studyErrMessage(err, "Quiz"))
                setQuizPhase("error")
            }
        })()
        return () => {
            cancelled = true
        }
    }, [studioMode, studySourceId, userId, onRefreshCredits])

    useEffect(() => {
        if (studioMode !== "flashcard") return
        if (!studySourceId) return
        const uid = userId != null ? String(userId).trim() : ""
        if (!uid) {
            setSourceFlashcards([])
            setFlashPhase("error")
            setFlashError(
                "Faça login para gerar flashcards. O uso consome créditos da sua conta."
            )
            return
        }
        let cancelled = false
        const cancelledRef = { get current() { return cancelled } }
        const reqId = (flashGenRef.current += 1)
        setSourceFlashcards([])
        setFlashPhase("loading")
        setFlashError(null)
        ;(async () => {
            try {
                const data = await getSourceFlashcards(studySourceId)
                if (cancelled || reqId !== flashGenRef.current) return
                const list = Array.isArray(data?.flashcards)
                    ? data.flashcards
                    : []
                if (list.length > 0) {
                    setSourceFlashcards(list)
                    setFlashPhase("ready")
                    return
                }
                if (data?.status === "IN_PROGRESS") {
                    setFlashPhase("generating")
                    const ready = await pollUntilFlashReady(
                        studySourceId,
                        cancelledRef
                    )
                    if (cancelled || reqId !== flashGenRef.current) return
                    setSourceFlashcards(ready || [])
                    setFlashPhase("ready")
                    return
                }
                setFlashPhase("generating")
                const gen = await postGenerateSourceFlashcards(
                    studySourceId,
                    uid
                )
                if (cancelled || reqId !== flashGenRef.current) return
                if (gen?.status === "IN_PROGRESS") {
                    const ready = await pollUntilFlashReady(
                        studySourceId,
                        cancelledRef
                    )
                    if (cancelled || reqId !== flashGenRef.current) return
                    setSourceFlashcards(ready || [])
                    setFlashPhase("ready")
                    return
                }
                setSourceFlashcards(
                    Array.isArray(gen?.flashcards) ? gen.flashcards : []
                )
                setFlashPhase("ready")
                onRefreshCredits?.()
            } catch (err) {
                if (cancelled || reqId !== flashGenRef.current) return
                setFlashError(studyErrMessage(err, "Flashcards"))
                setFlashPhase("error")
            }
        })()
        return () => {
            cancelled = true
        }
    }, [studioMode, studySourceId, userId, onRefreshCredits])

    useEffect(() => {
        if (studioMode !== "notes") return
        if (!studySourceId) return
        const uid = userId != null ? String(userId).trim() : ""
        if (!uid) {
            setSourceNote(null)
            setNotePhase("error")
            setNoteError(
                "Faça login para gerar anotações. O uso consome créditos da sua conta."
            )
            return
        }
        let cancelled = false
        const cancelledRef = { get current() { return cancelled } }
        const reqId = (noteGenRef.current += 1)
        setSourceNote(null)
        setNotePhase("loading")
        setNoteError(null)
        ;(async () => {
            try {
                const data = await getSourceNote(studySourceId)
                if (cancelled || reqId !== noteGenRef.current) return
                const n = data?.note
                if (n && typeof n.content === "string" && n.content.trim()) {
                    setSourceNote(n)
                    setNotePhase("ready")
                    return
                }
                if (data?.status === "IN_PROGRESS") {
                    setNotePhase("generating")
                    const ready = await pollUntilNoteReady(
                        studySourceId,
                        cancelledRef
                    )
                    if (cancelled || reqId !== noteGenRef.current) return
                    setSourceNote(ready ?? null)
                    setNotePhase("ready")
                    return
                }
                setNotePhase("generating")
                const gen = await postGenerateSourceNote(studySourceId, uid)
                if (cancelled || reqId !== noteGenRef.current) return
                if (gen?.status === "IN_PROGRESS") {
                    const ready = await pollUntilNoteReady(
                        studySourceId,
                        cancelledRef
                    )
                    if (cancelled || reqId !== noteGenRef.current) return
                    setSourceNote(ready ?? null)
                    setNotePhase("ready")
                    return
                }
                setSourceNote(gen?.note ?? null)
                setNotePhase("ready")
                onRefreshCredits?.()
            } catch (err) {
                if (cancelled || reqId !== noteGenRef.current) return
                setNoteError(studyErrMessage(err, "Anotações"))
                setNotePhase("error")
            }
        })()
        return () => {
            cancelled = true
        }
    }, [studioMode, studySourceId, userId, onRefreshCredits])

    function cleanupAudioUrls() {
        revokeUrls(objectUrlsRef.current)
        objectUrlsRef.current = []
        const a = audioRef.current
        if (a) {
            a.pause()
            try {
                a.removeAttribute("src")
                a.load()
            } catch {
                /* ignore */
            }
        }
        setCurrentTime(0)
        setDuration(0)
        setIsPlaying(false)
    }

    useEffect(() => {
        audioRequestGenRef.current += 1
        cleanupAudioUrls()
        setAudioPhase("idle")
        setSessionError(null)
        manualStopRef.current = false
        audioReadyLessonsKeyRef.current = null
    }, [lessonsKey])

    useEffect(() => {
        return () => {
            revokeUrls(objectUrlsRef.current)
            objectUrlsRef.current = []
        }
    }, [])

    useEffect(() => {
        if (studioMode !== "audio") {
            audioRef.current?.pause()
            setIsPlaying(false)
        }
    }, [studioMode])

    useEffect(() => {
        if (studioMode !== "audio") return
        if (!lessonsWithText.length) return
        const text = combinedTtsText.trim()
        if (!text) return
        if (manualStopRef.current) return

        const keyNow = lessonsKeyRef.current
        const aEl = audioRef.current
        if (
            audioReadyLessonsKeyRef.current === keyNow &&
            objectUrlsRef.current.length > 0 &&
            aEl?.src
        ) {
            setAudioPhase("ready")
            return
        }

        const uid = userId != null ? String(userId).trim() : ""
        let cancelled = false
        const genAtStart = audioRequestGenRef.current

        function attachBlobAndReady(blob, charged) {
            if (cancelled || audioRequestGenRef.current !== genAtStart) return
            if (studioModeRef.current !== "audio") return
            if (lessonsKeyRef.current !== keyNow) return
            revokeUrls(objectUrlsRef.current)
            objectUrlsRef.current = []
            const url = URL.createObjectURL(blob)
            objectUrlsRef.current = [url]
            const a = audioRef.current
            if (!a) {
                setAudioPhase("idle")
                return
            }
            a.onended = () => setIsPlaying(false)
            a.src = url
            audioReadyLessonsKeyRef.current = keyNow
            setAudioPhase("ready")
            if (charged) onRefreshCredits?.()
            void a.play().then(() => setIsPlaying(true)).catch((err) => {
                console.warn("[CourseContent] autoplay bloqueado:", err)
                setIsPlaying(false)
            })
        }

        ;(async () => {
            setSessionError(null)
            setAudioPhase("loading")

            try {
                let blob = null
                if (ttsPersistSourceId) {
                    blob = await getSourceAudioBlob(ttsPersistSourceId)
                    if (cancelled || audioRequestGenRef.current !== genAtStart)
                        return
                    if (blob) {
                        attachBlobAndReady(blob, false)
                        return
                    }
                    if (!uid) {
                        setSessionError(
                            "Faça login para gerar áudio. A geração consome créditos."
                        )
                        setAudioPhase("error")
                        return
                    }
                    setAudioPhase("generating")
                    blob = await postSourceAudioForSource(
                        ttsPersistSourceId,
                        text,
                        uid
                    )
                    if (cancelled || audioRequestGenRef.current !== genAtStart)
                        return
                    attachBlobAndReady(blob, true)
                    return
                }

                if (!uid) {
                    setSessionError(
                        "Faça login para gerar áudio. A geração consome créditos."
                    )
                    setAudioPhase("error")
                    return
                }
                setAudioPhase("generating")
                blob = await fetchGoogleTtsAudio(text, uid)
                if (cancelled || audioRequestGenRef.current !== genAtStart)
                    return
                attachBlobAndReady(blob, true)
            } catch (err) {
                if (cancelled || audioRequestGenRef.current !== genAtStart)
                    return
                console.error("[CourseContent] TTS curso:", err)
                const raw = String(err?.message || "").trim()
                const msg =
                    raw && !raw.startsWith("Áudio:")
                        ? `Áudio: ${raw}`
                        : raw || "Áudio: erro ao gerar ou reproduzir o áudio."
                setSessionError(msg)
                cleanupAudioUrls()
                audioReadyLessonsKeyRef.current = null
                setAudioPhase("error")
            }
        })()

        return () => {
            cancelled = true
            audioRequestGenRef.current += 1
        }
    }, [
        studioMode,
        lessonsKey,
        audioReloadNonce,
        ttsPersistSourceId,
        lessonsWithText.length,
        combinedTtsText,
        userId,
        onRefreshCredits,
    ])

    function handleRetryPlay() {
        manualStopRef.current = false
        audioRequestGenRef.current += 1
        audioReadyLessonsKeyRef.current = null
        cleanupAudioUrls()
        setSessionError(null)
        setAudioPhase("idle")
        setAudioReloadNonce((n) => n + 1)
    }

    function togglePlayPause() {
        const a = audioRef.current
        if (!a?.src || audioPhase !== "ready") return
        if (a.paused) {
            void a.play().then(() => setIsPlaying(true))
        } else {
            a.pause()
            setIsPlaying(false)
        }
    }

    function skipForwardSeek() {
        const a = audioRef.current
        if (!a || !Number.isFinite(a.duration)) return
        const next = Math.min(a.duration, a.currentTime + 30)
        a.currentTime = next
        setCurrentTime(next)
    }

    function skipToStart() {
        const a = audioRef.current
        if (!a) return
        a.currentTime = 0
        setCurrentTime(0)
    }

    function endSession() {
        manualStopRef.current = true
        audioRequestGenRef.current += 1
        audioReadyLessonsKeyRef.current = null
        cleanupAudioUrls()
        setAudioPhase("idle")
        setSessionError(null)
    }

    useEffect(() => {
        const a = audioRef.current
        if (!a || audioPhase !== "ready") return

        function onTimeUpdate() {
            setCurrentTime(a.currentTime)
            if (Number.isFinite(a.duration) && a.duration > 0) {
                setDuration(a.duration)
            }
        }

        function onMeta() {
            if (Number.isFinite(a.duration) && a.duration > 0) {
                setDuration(a.duration)
            }
        }

        function onPlay() {
            setIsPlaying(true)
        }
        function onPause() {
            setIsPlaying(false)
        }

        a.addEventListener("timeupdate", onTimeUpdate)
        a.addEventListener("loadedmetadata", onMeta)
        a.addEventListener("durationchange", onMeta)
        a.addEventListener("play", onPlay)
        a.addEventListener("pause", onPause)

        return () => {
            a.removeEventListener("timeupdate", onTimeUpdate)
            a.removeEventListener("loadedmetadata", onMeta)
            a.removeEventListener("durationchange", onMeta)
            a.removeEventListener("play", onPlay)
            a.removeEventListener("pause", onPause)
        }
    }, [audioPhase])

    function seekTo(t) {
        const a = audioRef.current
        if (!a || !Number.isFinite(t)) return
        a.currentTime = t
        setCurrentTime(t)
    }

    if (!selectedLesson) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 text-center">
                <p>Selecione uma aula para ver o conteúdo</p>
            </div>
        )
    }

    if (studioMode === "read") {
        if (!String(bodyText).trim()) {
            return (
                <div className="w-full h-full flex flex-col gap-4 min-h-[200px]">
                    <h2 className="text-xl font-light shrink-0">
                        {selectedLesson?.title}
                    </h2>
                    <p className="text-sm text-gray-500">
                        Esta aula ainda não tem texto de conteúdo.
                    </p>
                </div>
            )
        }
        return (
            <div className="w-full h-full flex flex-col gap-4 min-h-[200px]">
                <h2 className="text-xl font-light shrink-0">
                    {selectedLesson?.title}
                </h2>
                <p className="text-md text-start font-light text-gray-700 whitespace-pre-wrap flex-1 min-h-0 overflow-y-auto">
                    {bodyText}
                </p>
            </div>
        )
    }

    if (studioMode === "quiz") {
        return (
            <div className="w-full h-full flex flex-col gap-4 min-h-[200px] overflow-y-auto">
                <h2 className="text-xl font-light text-gray-800 shrink-0">
                    {selectedLesson?.title}
                </h2>
                {quizPhase === "error" && (
                    <p className="text-sm text-red-600">{quizError}</p>
                )}
                {(quizPhase === "loading" || quizPhase === "generating") && (
                    <div className="rounded-xl border border-gray-200 bg-neutral-50 p-6 text-center space-y-2">
                        <p className="text-sm text-gray-700 font-medium">
                            {quizPhase === "generating"
                                ? "Gerando quiz com a IA a partir do texto do PDF…"
                                : "Carregando quiz…"}
                        </p>
                        {quizPhase === "generating" && (
                            <p className="text-xs text-gray-500">
                                Pode levar um minuto. Questões com quatro
                                alternativas (fácil, médio e difícil).
                            </p>
                        )}
                        <div className="w-full max-w-xs h-2 bg-gray-200 rounded-full overflow-hidden animate-pulse mx-auto" />
                    </div>
                )}
                {quizPhase === "ready" && sourceQuizzes.length > 0 && (
                    <QuizContentMock quizzes={sourceQuizzes} />
                )}
                {quizPhase === "ready" && sourceQuizzes.length === 0 && (
                    <p className="text-sm text-gray-500">
                        Nenhuma questão foi retornada. Tente outra vez pelo
                        Studio (sair e voltar em Quiz) ou verifique se o PDF tem
                        texto extraído.
                    </p>
                )}
            </div>
        )
    }

    if (studioMode === "flashcard") {
        return (
            <div className="w-full h-full flex flex-col gap-2 min-h-[200px] overflow-y-auto">
                <h2 className="text-xl font-light text-gray-800 shrink-0">
                    {selectedLesson?.title}
                </h2>
                {flashPhase === "error" && (
                    <p className="text-sm text-red-600">{flashError}</p>
                )}
                {(flashPhase === "loading" || flashPhase === "generating") && (
                    <div className="rounded-xl border border-gray-200 bg-neutral-50 p-6 text-center space-y-2">
                        <p className="text-sm text-gray-700 font-medium">
                            {flashPhase === "generating"
                                ? "Gerando flashcards com a IA…"
                                : "Carregando flashcards…"}
                        </p>
                        <div className="w-full max-w-xs h-2 bg-gray-200 rounded-full overflow-hidden animate-pulse mx-auto" />
                    </div>
                )}
                {flashPhase === "ready" && sourceFlashcards.length > 0 && (
                    <FlashcardContentMock cards={sourceFlashcards} />
                )}
                {flashPhase === "ready" && sourceFlashcards.length === 0 && (
                    <p className="text-sm text-gray-500">
                        Nenhum flashcard foi gerado para esta fonte.
                    </p>
                )}
            </div>
        )
    }

    if (studioMode === "notes") {
        return (
            <div className="w-full h-full flex flex-col gap-4 min-h-[200px] overflow-y-auto">
                <h2 className="text-xl font-light text-gray-800 shrink-0">
                    {selectedLesson?.title}
                </h2>
                {notePhase === "error" && (
                    <p className="text-sm text-red-600">{noteError}</p>
                )}
                {(notePhase === "loading" || notePhase === "generating") && (
                    <div className="rounded-xl border border-gray-200 bg-neutral-50 p-6 text-center space-y-2">
                        <p className="text-sm text-gray-700 font-medium">
                            {notePhase === "generating"
                                ? "Gerando anotações acadêmicas com a IA…"
                                : "Carregando anotações…"}
                        </p>
                        <div className="w-full max-w-xs h-2 bg-gray-200 rounded-full overflow-hidden animate-pulse mx-auto" />
                    </div>
                )}
                {notePhase === "ready" &&
                    sourceNote &&
                    String(sourceNote.content ?? "").trim() && (
                        <SourceNotesMarkdown content={sourceNote.content} />
                    )}
                {notePhase === "ready" &&
                    (!sourceNote ||
                        !String(sourceNote.content ?? "").trim()) && (
                        <p className="text-sm text-gray-500">
                            Nenhuma anotação disponível para esta fonte.
                        </p>
                    )}
            </div>
        )
    }

    const showIdleOverlay =
        audioPhase === "idle" &&
        manualStopRef.current &&
        lessonsWithText.length > 0
    const showLoadingAudio =
        audioPhase === "loading" &&
        lessonsWithText.length > 0 &&
        !sessionError
    const showGeneratingAudio =
        audioPhase === "generating" &&
        lessonsWithText.length > 0 &&
        !sessionError
    const showPlayer = audioPhase === "ready"

    return (
        <div className="w-full h-full flex flex-col gap-4 min-h-[200px]">
            <audio ref={audioRef} preload="auto" className="hidden" />

            <div className="shrink-0">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Áudio do curso
                </p>
                <h2 className="text-xl font-light text-gray-900">
                    {selectedLesson?.title}
                </h2>
            </div>

            <div className="flex flex-col flex-1 min-h-0">
                <div className="flex-1 relative rounded-xl border border-gray-200 bg-neutral-50 p-4 shadow-sm min-h-[200px]">
                    {sessionError && audioPhase !== "error" && (
                        <p className="text-xs text-red-600 mb-2">{sessionError}</p>
                    )}

                    {showIdleOverlay && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-neutral-50/95">
                            <div className="p-4 rounded-2xl flex flex-col items-center gap-2">
                                <Button
                                    icon={<Play />}
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleRetryPlay}
                                    aria-label="Gerar áudio do curso novamente"
                                    title="Gerar novamente"
                                />
                                <p className="text-xs text-gray-600 text-center max-w-xs">
                                    Toque para gerar o áudio contínuo (só o texto
                                    das aulas, sem títulos).
                                </p>
                            </div>
                        </div>
                    )}

                    {showLoadingAudio && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl bg-white/95 gap-3 p-4">
                            <p className="text-sm text-gray-700 font-medium text-center">
                                Carregando áudio…
                            </p>
                            <p className="text-xs text-gray-500 text-center max-w-sm">
                                Verificando se já existe áudio salvo para esta
                                fonte (como quiz e flashcards).
                            </p>
                            <div className="w-full max-w-xs h-2 bg-gray-200 rounded-full overflow-hidden animate-pulse" />
                        </div>
                    )}

                    {showGeneratingAudio && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl bg-white/95 gap-3 p-4">
                            <p className="text-sm text-gray-700 font-medium text-center">
                                Gerando áudio do curso…
                            </p>
                            <p className="text-xs text-gray-500 text-center max-w-sm">
                                Conteúdo das aulas em sequência, sem ler
                                títulos. Pode levar alguns minutos.
                            </p>
                            <div className="w-full max-w-xs h-2 bg-gray-200 rounded-full overflow-hidden animate-pulse" />
                        </div>
                    )}

                    {audioPhase === "error" && sessionError && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl bg-neutral-50/95 gap-3 p-4">
                            <p className="text-xs text-red-600 text-center max-w-sm">
                                {sessionError}
                            </p>
                            <Button
                                text="Tentar novamente"
                                variant="outline"
                                size="sm"
                                onClick={handleRetryPlay}
                            />
                        </div>
                    )}

                    {showPlayer && (
                        <div className="space-y-3 relative z-0">
                            <div className="flex items-center justify-between gap-2 text-xs text-gray-600">
                                <span className="truncate font-medium text-gray-800">
                                    Reprodução contínua
                                </span>
                                <span className="tabular-nums shrink-0">
                                    {formatTime(currentTime)} /{" "}
                                    {formatTime(duration)}
                                </span>
                            </div>

                            <input
                                type="range"
                                min={0}
                                max={duration > 0 ? duration : 0}
                                step={0.05}
                                value={
                                    duration > 0
                                        ? Math.min(currentTime, duration)
                                        : 0
                                }
                                onChange={(e) =>
                                    seekTo(Number(e.target.value))
                                }
                                className="w-full h-2 accent-gray-800 cursor-pointer"
                                aria-label="Posição no áudio"
                            />

                            <div className="flex items-center justify-center gap-2 flex-wrap">
                                <Button
                                    icon={<SkipBack className="w-5 h-5" />}
                                    variant="ghost"
                                    size="icon"
                                    onClick={skipToStart}
                                    title="Voltar ao início"
                                    aria-label="Início do áudio"
                                />
                                <Button
                                    icon={
                                        isPlaying ? (
                                            <Pause className="w-6 h-6" />
                                        ) : (
                                            <Play className="w-6 h-6" />
                                        )
                                    }
                                    variant="ghost"
                                    size="icon"
                                    onClick={togglePlayPause}
                                    aria-label={
                                        isPlaying ? "Pausar" : "Continuar"
                                    }
                                />
                                <Button
                                    icon={<SkipForward className="w-5 h-5" />}
                                    variant="ghost"
                                    size="icon"
                                    onClick={skipForwardSeek}
                                    title="Avançar 30 segundos"
                                    aria-label="Avançar 30 segundos"
                                />
                                <Button
                                    icon={<Square className="w-4 h-4" />}
                                    variant="ghost"
                                    size="icon"
                                    onClick={endSession}
                                    title="Parar e liberar áudio"
                                    aria-label="Encerrar"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
