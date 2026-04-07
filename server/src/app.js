import express from "express"
import cors from "cors"
import routes from "../routes/routes.js"
import { postStripeWebhook } from "../controllers/stripeWebhookController.js"

const app = express()

app.use(
  cors({
    exposedHeaders: [
      "X-Source-Audio-Hash",
      "X-Source-Audio-Cached",
      "X-Credits-Charged",
    ],
  })
)

app.post(
  "/api/billing/webhook",
  express.raw({ type: "application/json" }),
  postStripeWebhook
)

app.use(express.json({ limit: "12mb" }))

app.get("/api/version", (req, res) => {
  return res.status(200).json({
    commit: process.env.RENDER_GIT_COMMIT || null,
    branch: process.env.RENDER_GIT_BRANCH || null,
    service: process.env.RENDER_SERVICE_NAME || null,
    instance: process.env.RENDER_INSTANCE_ID || null,
    now: new Date().toISOString(),
  })
})

app.use("/api", routes)

export default app
