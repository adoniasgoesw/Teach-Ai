import pool from "../config/db.js"

export async function health(req, res) {
  try {
    const result = await pool.query("SELECT 1")
    res.json({
      status: "ok",
      db: result.rows[0],
    })
  } catch (err) {
    console.error("Healthcheck error:", err)
    res
      .status(500)
      .json({ status: "error", message: "Database not reachable" })
  }
}

