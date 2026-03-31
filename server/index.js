import dotenv from "dotenv"
import app from "./src/app.js"
import pool from "./config/db.js"

dotenv.config()

const port = process.env.PORT || 3001

async function start() {
  try {
    await pool.query("SELECT 1")
    console.log("✅ Connected to database")

    app.listen(port, () => {
      console.log(`🚀 API running on http://localhost:${port}`)
    })
  } catch (err) {
    console.error("❌ Failed to connect to database", err)
    process.exit(1)
  }
}

start()