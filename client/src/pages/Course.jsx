import Header from "../components/layouts/Header"
import { useLocation, useNavigate } from "react-router-dom"
import { useEffect, useMemo, useState } from "react"
import ClassPanel from "../components/panels/ClassPanel"
import ContentPanel from "../components/panels/ContentPanel"
import StudioPanel from "../components/panels/StudioPanel"

export default function CoursePage() {
    const navigate = useNavigate()
    const { state } = useLocation()

    const course = state?.course
    const sources = Array.isArray(course?.sources) ? course.sources : []
    const hasSources = sources.length > 0

    const [openSourceId, setOpenSourceId] = useState(null)
    const [selectedLesson, setSelectedLesson] = useState(null)
    const flatLessons = useMemo(
        () =>
            sources.flatMap((s) =>
                Array.isArray(s.lessons) ? s.lessons : []
            ),
        [sources]
    )

    const selectedContent = useMemo(
        () => selectedLesson?.content ?? null,
        [selectedLesson]
    )

    // sempre seleciona automaticamente a primeira lesson disponível
    useEffect(() => {
        if (!hasSources || selectedLesson) return

        const firstSourceWithLessons = sources.find(
            (s) => Array.isArray(s.lessons) && s.lessons.length > 0
        )

        if (firstSourceWithLessons) {
            setSelectedLesson(firstSourceWithLessons.lessons[0])
            setOpenSourceId(firstSourceWithLessons.id)
        }
    }, [hasSources, sources, selectedLesson])

    function handleNextLesson() {
        if (!flatLessons.length || !selectedLesson) return

        const currentIndex = flatLessons.findIndex(
            (lesson) => lesson.id === selectedLesson.id
        )

        if (currentIndex === -1) return

        const nextIndex = (currentIndex + 1) % flatLessons.length
        setSelectedLesson(flatLessons[nextIndex])
    }

    return (
        <section className="flex flex-col gap-10 px-5 md:px-10 lg:px-20 py-6 min-h-screen bg-neutral-200/50">
            <div className=" w-full h-full  flex-1 flex flex-col gap-10 items-center justify-start overflow-hidden">
                <Header />

                <div className="flex-1 flex gap-5 w-full   overflow-hidden">
                    <ClassPanel
                        sources={sources}
                        hasSources={hasSources}
                        openSourceId={openSourceId}
                        selectedLesson={selectedLesson}
                        setOpenSourceId={setOpenSourceId}
                        setSelectedLesson={setSelectedLesson}
                    />

                    <ContentPanel
                        hasSources={hasSources}
                        course={course}
                        selectedLesson={selectedLesson}
                        selectedContent={selectedContent}
                        onNextLesson={handleNextLesson}
                    />

                    <StudioPanel />
                </div>

            </div>
        </section>
    )
}