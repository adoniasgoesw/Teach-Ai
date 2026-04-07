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

app.use("/api", routes)

export default app
