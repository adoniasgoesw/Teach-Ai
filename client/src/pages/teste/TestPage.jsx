import { useRef, useState } from "react"
import { uploadCoursePdf } from "../../services/api"

function defaultUserIdFromStorage() {
  try {
    const raw = window.localStorage.getItem("teachai:user")
    const u = raw ? JSON.parse(raw) : null
    return u?.id != null ? String(u.id) : ""
  } catch {
    return ""
  }
}

export default function TestPage() {
  const inputRef = useRef(null)
  const [courseId, setCourseId] = useState("1")
  const [userId, setUserId] = useState(defaultUserIdFromStorage)
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [lastError, setLastError] = useState(null)
  const [lastOk, setLastOk] = useState(null)

  function handlePickClick() {
    setLastError(null)
    setLastOk(null)
    inputRef.current?.click()
  }

  async function handleChange(e) {
    const picked = e.target.files?.[0]
    e.target.value = ""
    setLastError(null)
    setLastOk(null)
    if (!picked) {
      setFile(null)
      return
    }

    const cid = courseId.trim()
    if (!cid) {
      setLastError("Informe o ID do curso (courseId) antes de enviar o PDF.")
      return
    }
    const uid = userId.trim()
    if (!uid) {
      setLastError("Informe o userId (dono do curso) — ex.: id do teachai:user no localStorage.")
      return
    }

    setFile(picked)
    setLoading(true)
    try {
      const res = await uploadCoursePdf(picked, cid, uid)
      if (res?.ok && res?.saved) {
        setLastOk({ sourceId: res.sourceId, filename: res.filename })
        console.log("[teste][client] PDF:", res.filename)
        console.log("[teste][client] sourceId:", res.sourceId, "| courseId:", res.courseId)
        console.log("[teste][client] JSON da IA (data):", res.data)
      } else {
        console.warn("[teste][client] resposta:", res)
        setLastError(res?.message || "Resposta sem ok")
      }
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Erro ao enviar o PDF"
      setLastError(msg)
      console.error("[teste][client] erro:", msg, err?.response?.data)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        padding: "1rem",
        background: "#0f1419",
        color: "#e6edf3",
      }}
    >
      <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>
        Página de teste (PDF → IA → BD)
      </h1>
      <p style={{ margin: 0, opacity: 0.75, textAlign: "center", maxWidth: 28 * 16 }}>
        Usa a API principal (<code style={{ color: "#79c0ff" }}>node index.js</code>). PDF →{" "}
        <code style={{ color: "#79c0ff" }}>pdf-parse</code> → Gemini →{" "}
        <code style={{ color: "#79c0ff" }}>Source</code> + <code style={{ color: "#79c0ff" }}>Lesson</code>{" "}
        (mesma rota <code style={{ color: "#79c0ff" }}>/api/ai/pdf</code> do curso).
      </p>

      <label
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.35rem",
          fontSize: "0.9rem",
          width: "min(90vw, 20rem)",
        }}
      >
        Course ID (deve existir no banco)
        <input
          type="text"
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          disabled={loading}
          style={{
            padding: "0.5rem 0.75rem",
            borderRadius: 6,
            border: "1px solid #30363d",
            background: "#0d1117",
            color: "#e6edf3",
          }}
        />
      </label>

      <label
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.35rem",
          fontSize: "0.9rem",
          width: "min(90vw, 20rem)",
        }}
      >
        User ID (dono do curso — créditos)
        <input
          type="text"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          disabled={loading}
          style={{
            padding: "0.5rem 0.75rem",
            borderRadius: 6,
            border: "1px solid #30363d",
            background: "#0d1117",
            color: "#e6edf3",
          }}
        />
      </label>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleChange}
        style={{ display: "none" }}
      />
      <button
        type="button"
        onClick={handlePickClick}
        disabled={loading}
        style={{
          padding: "0.75rem 1.5rem",
          fontSize: "1rem",
          fontWeight: 600,
          borderRadius: 8,
          border: "none",
          cursor: loading ? "wait" : "pointer",
          background: loading ? "#388bfd66" : "#238636",
          color: "#fff",
        }}
      >
        {loading ? "Processando (IA + BD)…" : "Selecionar PDF e processar"}
      </button>

      {file && !loading && (
        <p style={{ margin: 0, fontSize: "0.9rem", opacity: 0.85 }}>
          Último arquivo: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
        </p>
      )}

      {lastOk && (
        <p
          style={{
            margin: 0,
            padding: "0.75rem 1rem",
            background: "#23863622",
            borderRadius: 8,
            color: "#3fb950",
            maxWidth: "min(90vw, 28rem)",
            fontSize: "0.9rem",
          }}
        >
          Salvo: sourceId <strong>{lastOk.sourceId}</strong> — {lastOk.filename}
          <br />
          Veja <code style={{ color: "#79c0ff" }}>data</code> no console do navegador.
        </p>
      )}

      {lastError && (
        <p
          style={{
            margin: 0,
            padding: "0.75rem 1rem",
            background: "#f851491a",
            borderRadius: 8,
            color: "#ff7b72",
            maxWidth: "min(90vw, 28rem)",
            fontSize: "0.9rem",
          }}
        >
          {lastError}
        </p>
      )}
    </div>
  )
}
