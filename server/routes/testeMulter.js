import multer from "multer"

const storage = multer.memoryStorage()

export const uploadPdfTeste = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const ok =
      file.mimetype === "application/pdf" ||
      (file.originalname && file.originalname.toLowerCase().endsWith(".pdf"))
    if (ok) cb(null, true)
    else cb(new Error("Apenas arquivos PDF são aceitos."))
  },
})
