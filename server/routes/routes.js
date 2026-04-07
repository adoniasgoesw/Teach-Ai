import { Router } from "express"
import multer from "multer"
import { health } from "../controllers/healthController.js"
import { register, login } from "../controllers/authController.js"
import { createCourse, listCourses } from "../controllers/courseController.js"
import { listSourcesByCourse } from "../controllers/sourceController.js"
import {
  getSourceAudio,
  postSourceAudio,
} from "../controllers/sourceAudioController.js"
import {
  getSourceQuizzes,
  postGenerateSourceQuizzes,
} from "../controllers/sourceQuizController.js"
import {
  getSourceFlashcards,
  postGenerateSourceFlashcards,
} from "../controllers/sourceFlashcardController.js"
import {
  getSourceNote,
  postGenerateSourceNote,
} from "../controllers/sourceNoteController.js"
import { processPdf } from "../controllers/pdfController.js"
import { postGoogleTts } from "../controllers/googleTtsController.js"
import {
  getCreditsWallet,
  getCreditTransactions,
  getAccountSummary,
} from "../controllers/creditController.js"
import { listPlans } from "../controllers/planController.js"
import { getUserProfile } from "../controllers/userController.js"
import { postCreateSubscription } from "../controllers/billingController.js"

const router = Router()

// Configuração simples de upload para a pasta uploads/
const upload = multer({ dest: "uploads/" })

router.get("/health", health)
router.get("/credits/wallet", getCreditsWallet)
router.get("/credits/transactions", getCreditTransactions)
router.get("/account/summary", getAccountSummary)
router.get("/plans", listPlans)
router.post("/billing/create-subscription", postCreateSubscription)
router.get("/users/profile", getUserProfile)
router.post("/auth/register", register)
router.post("/auth/login", login)
router.post("/courses", createCourse)
router.get("/courses", listCourses)
router.get("/courses/:courseId/sources", listSourcesByCourse)
router.get("/sources/:sourceId/audio", getSourceAudio)
router.post("/sources/:sourceId/audio", postSourceAudio)
router.get("/sources/:sourceId/quizzes", getSourceQuizzes)
router.post("/sources/:sourceId/quizzes/generate", postGenerateSourceQuizzes)
router.get("/sources/:sourceId/flashcards", getSourceFlashcards)
router.post(
  "/sources/:sourceId/flashcards/generate",
  postGenerateSourceFlashcards
)
router.get("/sources/:sourceId/notes", getSourceNote)
router.post("/sources/:sourceId/notes/generate", postGenerateSourceNote)
router.post("/ai/pdf", upload.single("file"), processPdf)
router.post("/tts/google", postGoogleTts)

export default router

