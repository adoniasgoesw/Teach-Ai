/**
 * Insere quiz, flashcards e anotação na primeira fonte do curso id "1".
 * Rode: npm run seed:study
 * Repetir: FORCE_SEED_STUDY=1 remove materiais dessa fonte e recria.
 */
import "dotenv/config"
import { prisma } from "../lib/prisma.js"

const COURSE_ID = 1

async function main() {
    const course = await prisma.course.findUnique({
        where: { id: COURSE_ID },
        select: { id: true },
    })
    if (!course) {
        console.warn(
            `[seed:study] Curso "${COURSE_ID}" não existe. Crie o curso ou ajuste COURSE_ID.`
        )
        return
    }

    let source = await prisma.source.findFirst({
        where: { courseId: COURSE_ID },
        orderBy: { createdAt: "asc" },
    })

    if (!source) {
        source = await prisma.source.create({
            data: {
                courseId: COURSE_ID,
                filename: "material-seed-estudo.pdf",
                text: "Texto placeholder para seed de quiz e flashcards. Projeto: esforço temporário. Stakeholder: quem influencia ou é impactado.",
            },
        })
        for (let i = 0; i < 3; i++) {
            await prisma.lesson.create({
                data: {
                    sourceId: source.id,
                    title: `Aula ${i + 1} (seed)`,
                    content: "Conteúdo placeholder para materiais de estudo.",
                    order: i,
                },
            })
        }
        console.log("[seed:study] Criada fonte + 3 aulas seed no curso", COURSE_ID)
    }

    const sourceId = source.id

    if (process.env.FORCE_SEED_STUDY === "1") {
        await prisma.quiz.deleteMany({ where: { sourceId } })
        await prisma.flashcard.deleteMany({ where: { sourceId } })
        await prisma.sourceNote.deleteMany({ where: { sourceId } })
        console.log("[seed:study] Materiais anteriores removidos (FORCE_SEED_STUDY).")
    } else {
        const existing = await prisma.quiz.count({ where: { sourceId } })
        if (existing > 0) {
            console.log(
                "[seed:study] Fonte já tem quiz — use FORCE_SEED_STUDY=1 para recriar."
            )
            return
        }
    }

    await prisma.quiz.createMany({
        data: [
            {
                sourceId,
                question:
                    "O que caracteriza a gestão de projetos em relação à operação contínua?",
                alternatives: [
                    "É permanente e repetitiva",
                    "É temporária e busca um resultado único",
                    "Não tem prazo definido",
                    "Exclui stakeholders",
                ],
                correctIndex: 1,
                difficulty: "medium",
                order: 0,
            },
            {
                sourceId,
                question: "Stakeholders são:",
                alternatives: [
                    "Apenas o patrocinador",
                    "Pessoas ou grupos que influenciam ou são impactados pelo projeto",
                    "Somente a equipe interna",
                    "Somente clientes externos",
                ],
                correctIndex: 1,
                difficulty: "easy",
                order: 1,
            },
            {
                sourceId,
                question: "Liderança em projetos costuma estar mais associada a:",
                alternatives: [
                    "Burocracia e normas fixas",
                    "Mudança, visão e alinhamento de pessoas",
                    "Eliminar riscos por completo",
                    "Reduzir comunicação",
                ],
                correctIndex: 1,
                difficulty: "hard",
                order: 2,
            },
        ],
    })

    await prisma.flashcard.createMany({
        data: [
            {
                sourceId,
                term: "Projeto",
                definition:
                    "Esforço temporário empreendido para criar um produto, serviço ou resultado exclusivo.",
                order: 0,
            },
            {
                sourceId,
                term: "Stakeholder",
                definition:
                    "Indivíduo, grupo ou organização que pode afetar ou ser afetado pelo projeto.",
                order: 1,
            },
        ],
    })

    await prisma.sourceNote.upsert({
        where: { sourceId },
        create: {
            sourceId,
            content:
                "Anotação de exemplo: revisar o glossário do capítulo 1 antes da prova. " +
                "Aprofundar diferença entre escopo e cronograma.",
        },
        update: {
            content:
                "Anotação de exemplo: revisar o glossário do capítulo 1 antes da prova. " +
                "Aprofundar diferença entre escopo e cronograma.",
        },
    })

    console.log(
        "[seed:study] OK — quiz, flashcards e anotação na fonte",
        sourceId,
        "curso",
        COURSE_ID
    )
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
