import pool from "../../config/db.js"

export function hello(req, res) {
  res.json({ ok: true, message: "Ambiente de teste (server.js)", env: "teste" })
}

export async function pingDb(req, res) {
  try {
    const result = await pool.query("SELECT 1 AS ok, NOW() AS server_time")
    res.json({
      ok: true,
      db: true,
      row: result.rows[0],
    })
  } catch (err) {
    console.error("[teste] pingDb:", err)
    res.status(500).json({ ok: false, db: false, error: err.message })
  }
}
