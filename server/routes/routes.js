import { Router } from "express"
import { health } from "../controllers/healthController.js"
import { register, login } from "../controllers/authController.js"

const router = Router()

router.get("/health", health)
router.post("/auth/register", register)
router.post("/auth/login", login)

export default router

