import bcrypt from "bcrypt"
import { prisma } from "../lib/prisma.js"

function normalizeEmail(raw) {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
}

function isValidPassword(password) {
  // mínimo 8 caracteres, com minúscula, maiúscula, número e símbolo
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/
  return regex.test(password)
}

export async function register(req, res) {
  try {
    const { name, password } = req.body
    const email = normalizeEmail(req.body?.email)

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Nome, email e senha são obrigatórios." })
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({
        message:
          "A senha deve ter pelo menos 8 caracteres, com letra maiúscula, minúscula, número e símbolo.",
      })
    }

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })

    if (existing) {
      return res.status(409).json({ message: "Já existe um usuário com esse email." })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        creditWallet: {
          create: { balance: 20 },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    })

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
    const email = normalizeEmail(req.body?.email)
    const password = req.body?.password

    if (!email || typeof password !== "string" || !password) {
      return res.status(400).json({ message: "Email e senha são obrigatórios." })
    }

    const userRow = await prisma.user.findUnique({
      where: { email },
    })

    if (!userRow) {
      return res.status(401).json({ message: "Email ou senha inválidos." })
    }

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

