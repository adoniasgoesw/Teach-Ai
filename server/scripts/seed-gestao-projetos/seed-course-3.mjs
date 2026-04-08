/**
 * Cria o curso id "3" (Gestão de projetos), uma Source (filename: projetos) e as 12 lessons.
 *
 * Uso (pasta server/):
 *   node scripts/seed-gestao-projetos/seed-course-3.mjs
 *
 * Opcional no .env: SEED_USER_ID=<id de um User existente>
 * Se omitir, usa o primeiro usuário encontrado no banco.
 */
import "dotenv/config"
import { prisma } from "../../lib/prisma.js"
import { parsePositiveInt } from "../../lib/parseId.js"
import { buildLessonRowsFromAi } from "../../controllers/lessonController.js"
import { titles } from "./titles.mjs"
import { lessons } from "./lessons.mjs"

const COURSE_ID = 3
const SOURCE_FILENAME = "projetos"
const COURSE_NAME = "Gestão de projetos"

async function main() {
  const userIdEnv = parsePositiveInt(process.env.SEED_USER_ID)
  const user =
    userIdEnv != null
      ? await prisma.user.findUnique({ where: { id: userIdEnv } })
      : await prisma.user.findFirst()

  if (!user) {
    console.error(
      "Nenhum User encontrado. Crie um usuário (registro) ou defina SEED_USER_ID no .env."
    )
    process.exit(1)
  }

  await prisma.$transaction(async (tx) => {
    await tx.course.deleteMany({ where: { id: COURSE_ID } })

    await tx.course.create({
      data: {
        id: COURSE_ID,
        name: COURSE_NAME,
        userId: user.id,
      },
    })

    const source = await tx.source.create({
      data: {
        courseId: COURSE_ID,
        filename: SOURCE_FILENAME,
        text: null,
        titlesJson: titles,
      },
    })

    const rows = buildLessonRowsFromAi(source.id, titles, lessons)
    if (rows.length === 0) {
      throw new Error("Nenhuma lesson gerada a partir dos dados.")
    }

    await tx.lesson.createMany({ data: rows })

    console.log("Seed OK")
    console.log("  courseId:", COURSE_ID)
    console.log("  userId:", user.id)
    console.log("  sourceId:", source.id)
    console.log("  lessons:", rows.length)
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
