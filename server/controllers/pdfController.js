import fs from "fs/promises"
import {
  createPartFromBase64,
  createPartFromText,
  createUserContent,
} from "@google/genai"
import { PDFParse } from "pdf-parse"
import { getGeminiClient } from "../lib/gemini.js"
import { renderPdfPagesToPngBuffers } from "../lib/pdfPageImages.js"
import { prisma } from "../lib/prisma.js"
import { parsePositiveInt } from "../lib/parseId.js"
import { assertCourseOwnedByUser } from "../lib/courseAccess.js"
import {
  PDF_MAX_PAGES,
  pdfCreditsForPageCount,
} from "../lib/creditPricing.js"
import {
  consumeCreditsTx,
  getCreditBalance,
  isInsufficientCreditsError,
  jsonInsufficientCredits,
} from "../lib/creditService.js"
import { interactiveTxOptions } from "../lib/prismaInteractiveTx.js"
import { createSource } from "./sourceController.js"
import { createLessonsForSource } from "./lessonController.js"

/** Últimos uploads bem-sucedidos (debug). */
export const recentPdfAiResults = []

/** Abaixo disso, assume PDF escaneado (só imagem) e envia páginas ao Gemini em modo visão. */
const PDF_TEXT_MIN_CHARS_FOR_TEXT_MODE = 700
/** Máximo de páginas rasterizadas por pedido (limite prático da API multimodal). */
const PDF_VISION_MAX_PAGES = 28

const PDF_GEMINI_MODEL = "gemini-3-flash-preview"

async function callGeminiWithRetry(fn, retries = 3) {
  try {
    return await fn()
  } catch (err) {
    const rawMessage = err?.message || ""
    const statusFromSdk = err?.status || err?.error?.code
    const statusTextFromSdk = err?.error?.status
    const isUnavailable =
      statusFromSdk === 503 ||
      statusTextFromSdk === "UNAVAILABLE" ||
      /high demand/i.test(rawMessage)

    if (retries > 0 && isUnavailable) {
      console.log("🔁 [PDF][IA] Retry Gemini… restantes:", retries)
      await new Promise((res) => setTimeout(res, 2000))
      return callGeminiWithRetry(fn, retries - 1)
    }
    throw err
  }
}

function normalizeExtractedText(text) {
  if (Array.isArray(text)) return text.join("\n")
  if (typeof text === "string") return text
  return String(text ?? "")
}

function responseTextFromGemini(responseUnified) {
  if (typeof responseUnified?.text === "function") return responseUnified.text()
  if (typeof responseUnified?.text === "string") return responseUnified.text
  return ""
}

function buildUnifiedPrompt(excerpt) {
  return `Você é um professor especialista e também um professor BRINCALHÃO e MUITO AMIGÁVEL — leve, caloroso, sem ser infantil. Consegue explicar qualquer área (programação, medicina, física, biologia, matemática, português, etc.) de forma clara e fácil de ouvir.
Abaixo vou te dar o TEXTO COMPLETO de um material (extraído de um PDF que pode conter texto corrido, imagens, figuras, fluxogramas, tabelas, diagramas e qualquer outro tipo de conteúdo visual).

LEITURA DO MATERIAL — ANTES DE TUDO
Leia o PDF integralmente, incluindo:

Todo o texto corrido
Legendas e títulos de figuras (ex.: "Figura 1. Fluxo do processo empreendedor")
Conteúdo descrito dentro de fluxogramas, diagramas e infográficos
Dados e cabeçalhos de tabelas
Listas e bullets visuais
Qualquer texto embutido em imagens

Se uma figura ou fluxograma tiver uma legenda ou descrição no texto ao redor, use essa descrição para enriquecer a aula correspondente. Se o conteúdo visual não tiver descrição textual, interprete o que está representado e incorpore de forma natural na aula.

ETAPA 1 — IDENTIFICAR TÍTULOS, SUBTÍTULOS E TÓPICOS RELEVANTES
A partir de TODO o conteúdo lido (texto + visuais):

Identifique os TÍTULOS PRINCIPAIS de seções ou capítulos.
Para cada título principal, identifique os SUBTÍTULOS logo abaixo dele.
Se houver tópicos importantes que não possuem subtítulo formal mas desenvolvem conteúdo relevante (conceito explicado em um fluxograma, tabela comparativa, lista de características, etc.), crie um subtítulo descritivo para representá-los.

Regras importantes:

NÃO liste itens de capa, dedicatória, agradecimentos, resumo, abstract, sumário, índice ou referências bibliográficas.
NÃO liste números de página.
NÃO liste seções que não tenham conteúdo explicativo associado (texto, figura, tabela ou diagrama).
Foque em tópicos que introduzem ou desenvolvem conteúdo importante: conceitos, explicações, procedimentos, resultados, discussões, fluxos visuais, comparações em tabela, etc.


ETAPA 2 — GERAR UMA AULA PARA CADA TÍTULO/SUBTÍTULO/TÓPICO
Para CADA entrada identificada na Etapa 1, gere o campo "content" da lesson correspondente.

MÉTODO PARÁGRAFO A PARÁGRAFO E TÓPICOS (obrigatório)
Antes de escrever o "content", localize no material bruto TUDO o que pertence àquele título/subtítulo/tópico: parágrafos corridos, listas com marcadores, listas numeradas, itens de enumeração e blocos de texto separados.

Trate cada PARÁGRAFO do material como uma unidade: extraia as informações mais importantes e RESUMA esse parágrafo para ficar mais curto (menos linhas que o original), sem perder ideias centrais, dados e termos técnicos. Exemplo de lógica: se sob aquele título há três parágrafos “grandes” (ex.: equivalente a ~10, ~12 e ~8 linhas de conteúdo), produza três mini-blocos na aula (ex.: ~5, ~4 e ~6 linhas cada), na MESMA ORDEM do PDF.

Se a seção misturar TEXTO + TÓPICOS (bullets/números): faça o mesmo para o parágrafo introdutório e, em seguida, para CADA item da lista — resuma item a item, preservando ao máximo as PALAVRAS e formulações do próprio material (não troque sinônimos à toa).

Se um título tiver MUITOS parágrafos (ex.: 8 a 12), não pule: percorra TODOS, na ordem, cada um com seu próprio resumo curto dentro do mesmo "content" (vários parágrafos curtos na saída, um após o outro, como “deglutindo” o PDF).

Em CADA um desses mini-resumos (por parágrafo ou por item de lista), aplique a proporção abaixo no próprio mini-bloco — não só na aula inteira.

REGRA DE OURO — PROPORÇÃO 80% / 20% (obrigatória em cada mini-bloco e na aula como um todo)

Cerca de 80% de cada explicação deve vir do PRÓPRIO parágrafo (ou do próprio item de lista) que você está resumindo: mesmas palavras, termos técnicos e expressões sempre que possível; só condense e reordene para clareza.
Cerca de 20% é a SUA VOZ de professor naquele trecho: metáforas leves, um exemplo pontual, um gancho — sem criar fatos novos.

Para o conjunto da lesson (texto + visuais da seção): dados de tabelas, etapas de fluxogramas, itens de listas visuais e legendas de figuras entram nessa mesma lógica (trate como “blocos” a resumir com 80/20). Não invente fatos, dados nem conclusões que não estejam no material.

COMO TRATAR FIGURAS, FLUXOGRAMAS E TABELAS NA AULA:

Se o título/subtítulo tiver uma figura ou fluxograma associado, descreva o que ele representa em linguagem simples e incorpore as informações no texto da aula. Exemplo: "O material traz um fluxograma que mostra exatamente esse caminho: começa pela ideia, passa pelo capital disponível, depois pela alocação de mão de obra e tecnologias, e chega ao produto final."
Se houver uma tabela, explique o que ela compara ou organiza, citando os dados mais relevantes.
Nunca diga apenas "como mostra a Figura X" sem explicar o que a figura mostra — o aluno precisa entender o conteúdo, não só saber que existe uma figura.

TOM E ESTILO:

Português do Brasil. Objetivo: explicação FÁCIL e ritmo de conversa. A aula pode ter VÁRIOS parágrafos curtos na saída se o material tiver vários parágrafos/itens — o que importa é que cada parágrafo de saída seja ENXUTO (uma ideia clara) e corresponda a um pedaço real do PDF, na ordem.
Use com naturalidade ganchos e conectores: "Então,", "Imagine que...", "Por exemplo...", "Dessa maneira...", "Agora...", "Olha só...", "Resumindo:" — encaixe onde fizer sentido, sem forçar.

TRANSIÇÕES ENTRE AULAS (obrigatório):

Cada lesson (exceto a primeira) deve COMEÇAR com uma frase curta que amarre o que acabou de ser visto na aula anterior ao tema atual.
A primeira lesson abre com um convite caloroso ao tema.

ÚLTIMA AULA — DESPEDIDA (obrigatório):

No "content" da ÚLTIMA lesson, encerre com um parágrafo final em que você SE DESPEÇA do aluno: agradeça pela companhia, incentive a revisão do material e deixe um tom leve e afetuoso.

PROIBIÇÕES:

Não invente conteúdo além dos 20% de voz do professor (que só clarifica com exemplos e metáforas, sem criar fatos novos).
Não diga "a figura mostra X" sem explicar X.
Não seja prolixo: priorize clareza e ritmo de conversa.


FORMATO EXATO DA RESPOSTA
Responda APENAS com um JSON neste formato (sem comentários, sem Markdown, sem blocos de código):
{
  "titles": [
    {
      "title": "Título principal 1",
      "subtitles": [
        "Subtítulo 1.1",
        "Subtítulo 1.2"
      ]
    },
    {
      "title": "Título principal 2",
      "subtitles": [
        "Subtítulo 2.1"
      ]
    }
  ],
  "lessons": [
    {
      "title": "Título principal 1",
      "content": "Abertura convidativa; em seguida um parágrafo curto na saída para cada parágrafo do material (e um mini-bloco por item de lista), na ordem — cada mini-bloco ~80% palavras do trecho original, ~20% voz do professor."
    },
    {
      "title": "Subtítulo 1.1",
      "content": "Transição da aula anterior; parágrafo a parágrafo e tópico a tópico; figuras/fluxogramas como blocos explicados com 80/20."
    },
    {
      "title": "Subtítulo 1.2",
      "content": "Transição; mesmo método: cada parágrafo e cada bullet resumidos sem trocar termos do PDF; tabelas incorporadas com dados fielmente."
    },
    {
      "title": "Título principal 2",
      "content": "Transição; se houver muitos parágrafos na seção, todos resumidos em sequência. Se for a ÚLTIMA lesson, despedida ao aluno no final."
    }
  ]
}
TEXTO COMPLETO BASE:

"""${excerpt}"""
`.trim()
}

function buildVisionUnifiedPrompt(imagesSent, totalPdfPages) {
  const rest =
    totalPdfPages > imagesSent
      ? `O PDF tem ${totalPdfPages} páginas no total; você está vendo apenas as primeiras ${imagesSent} (imagens nesta ordem). Estruture o conteúdo com base no que for legível nelas.`
      : `Você está vendo todas as ${imagesSent} páginas do PDF (imagens nesta ordem, página 1 à esquerda/topo da sequência).`

  return `Você é um professor especialista e também BRINCALHÃO e MUITO AMIGÁVEL — leve, caloroso, sem ser infantil.

MODO VISÃO — PDF COMO IMAGEM (escaneado ou texto só dentro da figura)
-----------------------------------------------------------------------
${rest}
Leia TODO o texto visível nas imagens (português ou outro idioma). Não espere texto fora das figuras: extraia títulos, parágrafos, listas e rótulos diretamente dos pixels.

Seu trabalho — DUAS ETAPAS em UMA ÚNICA RESPOSTA (igual ao fluxo com PDF textual):

ETAPA 1 — IDENTIFICAR TÍTULOS E SUBTÍTULOS RELEVANTES (a partir do que leu nas imagens)
ETAPA 2 — GERAR UMA AULA PARA CADA TÍTULO/SUBTÍTULO

Mesmas regras do material textual, inclusive MÉTODO PARÁGRAFO A PARÁGRAFO E TÓPICOS: para cada lesson, percorra na ordem cada parágrafo e cada item de lista legível naquela seção; resuma cada unidade deixando ~80% do vocabulário do trecho original e ~20% de voz de professor, sem inventar fatos.

REGRA 80% / 20% em cada mini-bloco e na aula inteira (obrigatória).

TRANSIÇÕES entre aulas e DESPEDIDA na última lesson — mesmas regras do material textual.

PROIBIÇÕES: não inventar fatos que não estejam nas imagens (além da camada 20% de clarificação).

FORMATO EXATO — responda APENAS com um JSON válido (sem Markdown, sem \`\`\`):
{
  "extractedText": "OBRIGATÓRIO: transcrição completa em texto corrido de tudo que conseguiu ler nas imagens enviadas, na ordem das páginas, para guardar como base do material (quiz, busca, etc.).",
  "titles": [
    { "title": "Título principal 1", "subtitles": ["Subtítulo 1.1"] }
  ],
  "lessons": [
    { "title": "Título principal 1", "content": "Aula com 80/20, transição se não for a primeira." }
  ]
}
`.trim()
}

function isAiPayloadValid(titles, lessons) {
  if (!Array.isArray(titles) || titles.length === 0) return false
  if (!Array.isArray(lessons) || lessons.length === 0) return false
  return lessons.every(
    (l) =>
      l &&
      typeof l === "object" &&
      String(l.title ?? "").trim().length > 0 &&
      String(l.content ?? "").trim().length > 0
  )
}

async function safeUnlink(filePath) {
  if (!filePath) return
  try {
    await fs.unlink(filePath)
  } catch {
    /* ignore */
  }
}

/**
 * POST /api/ai/pdf — multer disk (req.file.path). Só persiste no BD se a IA responder JSON válido.
 */
export async function processPdf(req, res) {
  const filePath = req.file?.path
  try {
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        saved: false,
        message: "Arquivo PDF é obrigatório.",
      })
    }

    const courseId = parsePositiveInt(req.body?.courseId)
    if (courseId == null) {
      await safeUnlink(filePath)
      return res.status(400).json({
        ok: false,
        saved: false,
        message: "courseId é obrigatório (número).",
      })
    }

    const course = await prisma.course.findUnique({ where: { id: courseId } })
    if (!course) {
      await safeUnlink(filePath)
      return res.status(404).json({
        ok: false,
        saved: false,
        message: `Curso não encontrado: ${courseId}`,
      })
    }

    const userId = parsePositiveInt(req.body?.userId)
    if (userId == null) {
      await safeUnlink(filePath)
      return res.status(400).json({
        ok: false,
        saved: false,
        message: "userId é obrigatório para debitar créditos do upload.",
      })
    }

    const access = await assertCourseOwnedByUser(courseId, userId)
    if (!access.ok) {
      await safeUnlink(filePath)
      return res.status(access.status).json({
        ok: false,
        saved: false,
        message: access.message,
      })
    }

    const filename = req.file.originalname || "documento.pdf"
    console.log("[PDF] Arquivo:", filename, "| path:", filePath)

    const buffer = await fs.readFile(filePath)
    const parser = new PDFParse({ data: buffer })

    let pageCount
    let pdfCost
    let balanceBefore
    let extractedPdfText = ""
    try {
      let info
      try {
        info = await parser.getInfo()
      } catch (pcErr) {
        console.warn("[PDF] Falha ao ler metadados/páginas:", pcErr)
        await safeUnlink(filePath)
        return res.status(400).json({
          ok: false,
          saved: false,
          message: "Não foi possível ler o PDF (arquivo inválido ou corrompido).",
        })
      }

      pageCount = Math.max(1, Number(info.total) || 1)

      pdfCost = pdfCreditsForPageCount(pageCount)
      if (pdfCost == null) {
        await safeUnlink(filePath)
        return res.status(400).json({
          ok: false,
          saved: false,
          message: `PDF com mais de ${PDF_MAX_PAGES} páginas não é aceito. Divida o arquivo e tente novamente.`,
          pageCount,
        })
      }

      balanceBefore = await getCreditBalance(userId)
      if (balanceBefore < pdfCost) {
        await safeUnlink(filePath)
        return res.status(403).json({
          ok: false,
          saved: false,
          ...jsonInsufficientCredits({
            message:
              "Seus créditos acabaram ou são insuficientes para este PDF. Compre créditos ou faça upgrade do plano.",
            balance: balanceBefore,
            required: pdfCost,
          }),
          pageCount,
          creditsRequired: pdfCost,
        })
      }

      let textResult
      try {
        textResult = await parser.getText()
      } catch (txErr) {
        console.warn("[PDF] Falha ao extrair texto:", txErr)
        await safeUnlink(filePath)
        return res.status(400).json({
          ok: false,
          saved: false,
          message: "Não foi possível extrair texto deste PDF.",
        })
      }

      extractedPdfText = normalizeExtractedText(textResult?.text)
    } finally {
      try {
        await parser.destroy()
      } catch {
        /* ignore */
      }
    }

    await safeUnlink(filePath)

    let sourceText = extractedPdfText
    const trimmedPdfText = extractedPdfText.trim()
    const useVision =
      trimmedPdfText.length < PDF_TEXT_MIN_CHARS_FOR_TEXT_MODE && pageCount >= 1

    console.log(
      "[PDF] Texto na camada do PDF:",
      trimmedPdfText.length,
      "chars;",
      useVision ? "modo VISÃO (páginas como imagens)" : "modo texto"
    )

    let titles = []
    let lessons = []
    let iaErrorMessage = null

    try {
      if (useVision) {
        const maxImg = Math.min(pageCount, PDF_VISION_MAX_PAGES)
        let pngBuffers
        try {
          pngBuffers = await renderPdfPagesToPngBuffers(buffer, {
            maxPages: maxImg,
            scale: 2,
          })
        } catch (rasterErr) {
          console.error("[PDF] raster páginas:", rasterErr)
          iaErrorMessage =
            "Não foi possível converter o PDF em imagens para leitura pela IA. Tente outro arquivo ou um PDF com texto selecionável."
        }
        if (!iaErrorMessage && (!pngBuffers || pngBuffers.length === 0)) {
          iaErrorMessage = "Nenhuma página pôde ser renderizada como imagem."
        }
        if (!iaErrorMessage) {
          const visionPrompt = buildVisionUnifiedPrompt(
            pngBuffers.length,
            pageCount
          )
          const parts = [
            createPartFromText(visionPrompt),
            ...pngBuffers.map((b) =>
              createPartFromBase64(b.toString("base64"), "image/png")
            ),
          ]
          console.log(
            "[PDF][IA] Enviando para Gemini (visão),",
            pngBuffers.length,
            "página(s)…"
          )
          const responseUnified = await callGeminiWithRetry(() =>
            getGeminiClient().models.generateContent({
              model: PDF_GEMINI_MODEL,
              contents: createUserContent(parts),
            })
          )
          const rawUnified = responseTextFromGemini(responseUnified)
          console.log(
            "[PDF][IA] resposta (500 chars):",
            String(rawUnified).slice(0, 500)
          )
          if (!String(rawUnified).trim()) {
            iaErrorMessage = "Resposta vazia da IA (visão)."
          } else {
            const cleaned = String(rawUnified)
              .replace(/```json/gi, "")
              .replace(/```/g, "")
              .trim()
            const parsed = JSON.parse(cleaned)
            if (Array.isArray(parsed.titles)) titles = parsed.titles
            if (Array.isArray(parsed.lessons)) lessons = parsed.lessons
            const ext = parsed.extractedText
            if (typeof ext === "string" && ext.trim().length > 120) {
              sourceText = ext.trim()
            } else if (lessons.length > 0) {
              sourceText = lessons
                .map((l) => String(l.content ?? "").trim())
                .filter(Boolean)
                .join("\n\n---\n\n")
            }
          }
        }
      } else {
        const excerpt = extractedPdfText.slice(0, 15000)
        const unifiedPrompt = buildUnifiedPrompt(excerpt)
        console.log("[PDF][IA] Enviando para Gemini (texto)…")
        const responseUnified = await callGeminiWithRetry(() =>
          getGeminiClient().models.generateContent({
            model: PDF_GEMINI_MODEL,
            contents: unifiedPrompt,
          })
        )

        const rawUnified = responseTextFromGemini(responseUnified)
        console.log(
          "[PDF][IA] resposta (500 chars):",
          String(rawUnified).slice(0, 500)
        )

        if (!String(rawUnified).trim()) {
          iaErrorMessage = "Resposta vazia da IA."
        } else {
          const cleaned = String(rawUnified)
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim()
          const parsed = JSON.parse(cleaned)
          if (Array.isArray(parsed.titles)) titles = parsed.titles
          if (Array.isArray(parsed.lessons)) lessons = parsed.lessons
        }
      }
    } catch (iaError) {
      console.error("[PDF][IA] erro:", iaError)
      iaErrorMessage = iaError?.message || "Erro ao chamar ou interpretar a IA."
    }

    if (iaErrorMessage || !isAiPayloadValid(titles, lessons)) {
      const message = iaErrorMessage
        ? iaErrorMessage
        : "A IA não retornou titles/lessons válidos. Nada foi salvo no banco."
      console.warn("[PDF][DB] persistência ignorada:", message)
      return res.status(503).json({
        ok: false,
        saved: false,
        message,
        hint: useVision
          ? "Modo escaneado: use páginas nítidas; no máximo 28 páginas são enviadas por vez. Tente de novo ou um PDF com menos páginas."
          : "Tente novamente em instantes se o modelo estiver sobrecarregado.",
        filename,
        length: sourceText.length,
        vision: useVision,
      })
    }

    const data = { titles, lessons }

    let source
    let creditsCharged = 0
    let balanceAfter = balanceBefore
    try {
      source = await prisma.$transaction(
        async (tx) => {
          const s = await createSource({
            tx,
            courseId,
            filename,
            text: sourceText,
            titlesJson: titles,
          })
          await createLessonsForSource({
            tx,
            sourceId: s.id,
            titles,
            lessons,
          })
          const spent = await consumeCreditsTx(tx, {
            userId,
            amount: pdfCost,
            type: "PDF_UPLOAD",
            label: `Upload PDF (${pageCount} pág.)`,
            metadata: { pageCount, filename, courseId },
          })
          creditsCharged = spent.consumed
          balanceAfter = spent.balanceAfter
          return s
        },
        interactiveTxOptions
      )
    } catch (dbError) {
      if (isInsufficientCreditsError(dbError)) {
        return res.status(403).json({
          ok: false,
          saved: false,
          ...jsonInsufficientCredits(dbError),
          pageCount,
          creditsRequired: pdfCost,
        })
      }
      console.error("[PDF][DB] transação:", dbError)
      return res.status(500).json({
        ok: false,
        saved: false,
        message: "Erro ao salvar no banco.",
        error: dbError.message,
      })
    }

    recentPdfAiResults.push({
      at: new Date().toISOString(),
      sourceId: source.id,
      courseId,
      filename,
      data,
    })
    if (recentPdfAiResults.length > 50) recentPdfAiResults.shift()

    console.log("[PDF][DB] OK sourceId:", source.id)

    return res.status(200).json({
      ok: true,
      saved: true,
      message: "PDF processado e dados salvos.",
      sourceId: source.id,
      courseId,
      filename,
      length: sourceText.length,
      pageCount,
      creditsCharged,
      balanceAfter,
      data,
      text: sourceText,
      vision: useVision,
      titles,
      lessons,
    })
  } catch (error) {
    await safeUnlink(filePath)
    console.error("[PDF] erro:", error)
    return res.status(500).json({
      ok: false,
      saved: false,
      message: "Erro ao processar PDF.",
      error: error.message,
    })
  }
}
