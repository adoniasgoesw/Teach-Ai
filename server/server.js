import dotenv from "dotenv"
import testApp from "./src/appTest.js"
import pool from "./config/db.js"

dotenv.config()

const port = Number(process.env.PORT_TEST || 3002)

async function start() {
  try {
    await pool.query("SELECT 1")
    console.log("✅ [TEST server.js] Connected to database (pg)")

    const httpServer = testApp.listen(port, () => {
      console.log(`🧪 TEST API (server.js) running on http://localhost:${port}`)
      console.log(`   → GET http://localhost:${port}/api/teste/hello`)
      console.log(`   → GET http://localhost:${port}/api/teste/ping`)
      console.log(`   → POST http://localhost:${port}/api/teste/parse-pdf (multipart field: file)`)
    })

    // Node 18+ corta a requisição em ~5 min por padrão (PDF + IA demora mais → ERR_CONNECTION_RESET).
    const longMs = 900_000
    httpServer.requestTimeout = longMs
    httpServer.headersTimeout = longMs + 10_000
  } catch (err) {
    console.error("❌ [TEST server.js] Failed to connect to database", err)
    process.exit(1)
  }
}

start()
