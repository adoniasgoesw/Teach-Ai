import pool from "../config/db.js"
import bcrypt from "bcrypt"

function isValidPassword(password) {
  // mínimo 8 caracteres, com minúscula, maiúscula, número e símbolo
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/
  return regex.test(password)
}

export async function register(req, res) {
  try {
    const { name, email, password } = req.body

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Nome, email e senha são obrigatórios." })
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({
        message:
          "A senha deve ter pelo menos 8 caracteres, com letra maiúscula, minúscula, número e símbolo.",
      })
    }

    const existing = await pool.query('SELECT id FROM "User" WHERE email = $1', [email])

    if (existing.rowCount > 0) {
      return res.status(409).json({ message: "Já existe um usuário com esse email." })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const result = await pool.query(
      'INSERT INTO "User" (id, name, email, password, "createdAt", "updatedAt") VALUES (gen_random_uuid()::text, $1, $2, $3, NOW(), NOW()) RETURNING id, name, email, "createdAt"',
      [name, email, hashedPassword]
    )

    const user = result.rows[0]

    // "login automático": devolvemos o usuário como logado
    return res.status(201).json({
      user,
      message: "Usuário registrado e logado com sucesso.",
    })
  } catch (error) {
    console.error("Erro ao registrar usuário:", error)
    return res.status(500).json({ message: "Erro interno ao registrar usuário." })
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: "Email e senha são obrigatórios." })
    }

    const result = await pool.query(
      'SELECT id, name, email, password FROM "User" WHERE email = $1',
      [email]
    )

    if (result.rowCount === 0) {
      return res.status(401).json({ message: "Email ou senha inválidos." })
    }

    const userRow = result.rows[0]

    // Suporte a senhas antigas em texto puro (antes de usar bcrypt)
    let passwordOk = false
    const storedPassword = userRow.password

    if (typeof storedPassword === "string" && storedPassword.startsWith("$2")) {
      // hash bcrypt
      passwordOk = await bcrypt.compare(password, storedPassword)
    } else {
      // legacy: senha salva sem hash
      passwordOk = password === storedPassword
    }

    if (!passwordOk) {
      return res.status(401).json({ message: "Email ou senha inválidos." })
    }

    const { password: _pw, ...user } = userRow

    return res.status(200).json({
      user,
      message: "Login realizado com sucesso.",
    })
  } catch (error) {
    console.error("Erro ao fazer login:", error)
    return res.status(500).json({ message: "Erro interno ao fazer login." })
  }
}

