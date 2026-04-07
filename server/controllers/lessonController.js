import { prisma } from "../lib/prisma.js"

export function buildLessonRowsFromAi(sourceId, titles, lessons) {
  const subtitleSet = new Set()
  const parentTitleMap = {}

  if (Array.isArray(titles)) {
    for (const t of titles) {
      if (t && typeof t === "object" && Array.isArray(t.subtitles)) {
        for (const sub of t.subtitles) {
          subtitleSet.add(sub)
          parentTitleMap[sub] = t.title
        }
      }
    }
  }

  if (!Array.isArray(lessons) || lessons.length === 0) return []

  return lessons.map((lesson, index) => ({
    sourceId,
    title: lesson.title || "",
    content: lesson.content || "",
    isSubtitle: subtitleSet.has(lesson.title),
    parentTitle: parentTitleMap[lesson.title] || null,
    order: index + 1,
  }))
}

export async function createLessonsForSource({ tx = prisma, sourceId, titles, lessons }) {
  const data = buildLessonRowsFromAi(sourceId, titles, lessons)
  if (data.length === 0) return 0
  const result = await tx.lesson.createMany({ data })
  return result.count
}
