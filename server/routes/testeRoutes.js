import { Router } from "express"
import { pingDb, hello } from "../controllers/teste/testeController.js"
import { parsePdf } from "../controllers/teste/testePdfController.js"
import { uploadPdfTeste } from "./testeMulter.js"

const router = Router()

function uploadPdfMiddleware(req, res, next) {
  uploadPdfTeste.single("file")(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        ok: false,
        message: err.message || "Falha no upload do PDF.",
      })
    }
    next()
  })
}

router.get("/hello", hello)
router.get("/ping", pingDb)

router.post("/parse-pdf", uploadPdfMiddleware, parsePdf)

export default router
