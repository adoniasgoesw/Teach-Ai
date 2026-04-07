import { useState } from "react"
import { uploadCoursePdf } from "../services/api"

function defaultUserIdFromStorage() {
  try {
    const raw = window.localStorage.getItem("teachai:user")
    const u = raw ? JSON.parse(raw) : null
    return u?.id != null ? String(u.id) : ""
  } catch {
    return ""
  }
}

export default function PdfTestPage() {
  const [file, setFile] = useState(null)
  const [courseId, setCourseId] = useState("1")
  const [userId, setUserId] = useState(defaultUserIdFromStorage)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [text, setText] = useState("")
  const [titles, setTitles] = useState([])
  const [lessons, setLessons] = useState([])
  const [rawResponse, setRawResponse] = useState(null)

  function handleFileChange(e) {
    const f = e.target.files?.[0]
    setFile(f || null)
    setText("")
    setError("")
    setTitles([])
    setLessons([])
  }

  async function handleUpload() {
    if (!file) {
      setError("Selecione um arquivo PDF primeiro.")
      return
    }

    try {
      setLoading(true)
      setError("")
      setText("")
      setTitles([])
      setLessons([])
      setRawResponse(null)

      const cid = courseId.trim()
      if (!cid) {
        setError("Informe o ID do curso (courseId).")
        setLoading(false)
        return
      }
      const uid = userId.trim()
      if (!uid) {
        setError("Informe o userId (dono do curso) para debitar créditos.")
        setLoading(false)
        return
      }

      const data = await uploadCoursePdf(file, cid, uid)
      if (!data?.saved && !data?.ok) {
        throw new Error(data?.message || "Falha ao processar PDF.")
      }

      setText(data.text || "")
      setTitles(Array.isArray(data.titles) ? data.titles : [])
      setLessons(Array.isArray(data.lessons) ? data.lessons : [])
      setRawResponse(data)
    } catch (err) {
      console.error("[PdfTest] Erro ao enviar PDF:", err)
      const backend = err?.response?.data
      setError(
        backend?.message || backend?.hint || err.message || "Erro ao enviar PDF."
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="min-h-screen flex flex-col items-center justify-start gap-6 p-6 bg-neutral-100">
      <h1 className="text-2xl font-semibold">Teste de leitura de PDF + aulas da IA</h1>

      <div className="flex flex-col gap-3 w-full max-w-2xl">
        <label className="flex flex-col gap-1 text-sm">
          <span>Course ID (obrigatório para salvar no BD)</span>
          <input
            type="text"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="border rounded px-2 py-1"
            placeholder="ex: 1"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>User ID (dono do curso — debita créditos)</span>
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="border rounded px-2 py-1"
            placeholder="id do usuário logado"
          />
        </label>
        <input
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
        />

        <button
          type="button"
          onClick={handleUpload}
          disabled={loading || !file}
          className="px-4 py-2 rounded bg-blue-600 text-white disabled:bg-gray-400"
        >
          {loading ? "Processando..." : "Enviar PDF e ver aulas"}
        </button>

        {error && (
          <p className="text-sm text-red-600">
            {error}
          </p>
        )}
      </div>

      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-medium mb-2">Texto extraído (bruto)</h2>
          <div className="border border-gray-300 rounded p-3 bg-white h-96 overflow-auto whitespace-pre-wrap text-sm">
            {text || "Nenhum texto carregado ainda."}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-medium mb-2">Títulos e aulas geradas pela IA</h2>
          {/* Títulos (com possível estrutura de subtítulos) */}
          <div className="mb-4 border border-gray-300 rounded p-3 bg-white max-h-48 overflow-auto text-sm">
            {titles.length === 0 && (
              <p className="text-gray-600">
                Nenhum título identificado ainda.
              </p>
            )}

            {titles.length > 0 && (
              <div className="space-y-2">
                {titles.map((t, idx) => {
                  const isObject = t && typeof t === "object"
                  const titleText = isObject ? t.title : String(t)
                  const subtitles = isObject && Array.isArray(t.subtitles) ? t.subtitles : []

                  return (
                    <div key={idx}>
                      <p className="font-semibold">
                        {idx + 1}. {titleText}
                      </p>
                      {subtitles.length > 0 && (
                        <ul className="ml-4 list-disc text-xs text-gray-700">
                          {subtitles.map((sub, sIdx) => (
                            <li key={sIdx}>{sub}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Aulas */}
          <div className="border border-gray-300 rounded p-3 bg-white h-96 overflow-auto text-sm space-y-4">
            {lessons.length === 0 && (
              <p className="text-gray-600">
                Nenhuma aula gerada ainda. Envie um PDF para ver o resultado.
              </p>
            )}

            {lessons.map((lesson, index) => (
              <div key={index} className="border-b border-gray-200 pb-3 last:border-b-0">
                <h3 className="font-semibold mb-1">
                  {index + 1}. {lesson.title}
                </h3>
                <p className="whitespace-pre-wrap leading-relaxed">
                  {lesson.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bloco opcional para depuração: resposta bruta da IA */}
      <div className="w-full max-w-4xl mt-6">
        <h2 className="text-lg font-medium mb-2">Resposta completa (JSON)</h2>
        <div className="border border-gray-300 rounded p-3 bg-white h-64 overflow-auto text-xs whitespace-pre-wrap">
          {rawResponse ? JSON.stringify(rawResponse, null, 2) : "Nenhuma resposta carregada ainda."}
        </div>
      </div>
    </section>
  )
}

