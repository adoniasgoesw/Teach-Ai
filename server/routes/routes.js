import { Router } from "express"
import { health } from "../controllers/healthController.js"
import { register, login } from "../controllers/authController.js"
import { createCourse, listCourses } from "../controllers/courseController.js"

const router = Router()

router.get("/health", health)
router.post("/auth/register", register)
router.post("/auth/login", login)
router.post("/courses", createCourse)
router.get("/courses", listCourses)

export default router

