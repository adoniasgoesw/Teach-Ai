import { PDFParse } from "pdf-parse"

function titleFromFilename(originalname) {
  if (!originalname || typeof originalname !== "string") return "documento"
  const base = originalname.replace(/\.pdf$/i, "").trim()
  return base || "documento"
}

/**
 * POST multipart field "file" — extrai texto com pdf-parse (ambiente de teste apenas).
 */
export async function parsePdf(req, res) {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ ok: false, message: "Envie um PDF no campo file." })
    }

    const filename = req.file.originalname || "documento.pdf"
    const title = titleFromFilename(filename)

    const parser = new PDFParse({ data: req.file.buffer })
    let body
    try {
      const result = await parser.getText()
      body = typeof result?.text === "string" ? result.text : String(result?.text ?? "")
    } finally {
      try {
        await parser.destroy()
      } catch {
        /* ignore */
      }
    }

    console.log("[teste][pdf] nome do arquivo:", filename)
    console.log("[teste][pdf] título (derivado do nome):", title)
    console.log("[teste][pdf] texto extraído (completo):\n", body)

    return res.json({
      ok: true,
      filename,
      title,
      text: body,
      length: body.length,
    })
  } catch (err) {
    console.error("[teste][pdf] erro ao ler PDF:", err)
    return res.status(500).json({
      ok: false,
      message: "Erro ao processar o PDF.",
      error: err.message,
    })
  }
}
