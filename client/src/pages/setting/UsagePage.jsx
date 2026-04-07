import { useState } from "react"
import { Link, useOutletContext } from "react-router-dom"
import { RefreshCw } from "lucide-react"
import { useBillingData } from "../../hooks/useBillingData"
import { notifyCreditsUpdated } from "../../lib/creditsEvents"
import {
  formatCreditDelta,
  formatDateTimePt,
  labelForCreditType,
} from "../../lib/creditUi"

function iconForType(type) {
  if (!type) return "•"
  if (type === "PDF_UPLOAD") return "📄"
  if (type === "TTS_AUDIO") return "🔊"
  if (type === "AI_QUIZ") return "❓"
  if (type === "AI_FLASHCARDS") return "🗂️"
  if (type === "AI_NOTES") return "📝"
  if (type === "AI_SUMMARY") return "📋"
  if (type === "PLAN_PERIOD_GRANT" || type === "PLAN_CHANGE_ADJUST")
    return "⚡"
  if (type === "REFUND") return "↩️"
  return "◆"
}

export default function UsagePage() {
    const { user } = useOutletContext()
    const userId = user?.id != null ? String(user.id).trim() : ""
    const { summary, transactions, loading, error, reload } =
        useBillingData(userId)
    const [refreshing, setRefreshing] = useState(false)

    async function handleRefreshCredits() {
        setRefreshing(true)
        try {
            await reload()
            notifyCreditsUpdated()
        } finally {
            setRefreshing(false)
        }
    }

    const remaining = summary?.usage?.remaining ?? 0
    const planLimit = summary?.usage?.planMonthlyCredits
    const usedThisPeriod = summary?.usage?.usedThisPeriod ?? 0

    const pct =
        planLimit != null && planLimit > 0
            ? Math.min(100, Math.round((remaining / planLimit) * 100))
            : remaining > 0
              ? 100
              : 0

    return (
        <div className="max-w-2xl space-y-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-violet-600 mb-1">
                        TeachAI Credits
                    </p>
                    <h1 className="text-2xl font-light text-neutral-900">Uso</h1>
                    <p className="text-sm text-neutral-500 mt-1">
                        Saldo e histórico vêm do banco (CreditWallet e
                        CreditTransaction).
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => void handleRefreshCredits()}
                    disabled={refreshing || loading || !userId}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
                    title="Recarregar saldo e lista de movimentações"
                >
                    <RefreshCw
                        className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                        aria-hidden
                    />
                    Atualizar saldo
                </button>
            </div>

            {error && (
                <p className="text-sm text-red-600 rounded-lg border border-red-100 bg-red-50 px-3 py-2">
                    {error}
                </p>
            )}

            {loading && !summary && (
                <p className="text-sm text-neutral-500">Carregando…</p>
            )}

            {summary && (
                <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                    <h2 className="text-sm font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                        <span>⚡</span> Seus créditos
                    </h2>
                    <div className="mb-2">
                        <div className="h-3 rounded-full bg-neutral-100 overflow-hidden flex">
                            <div
                                className="h-full rounded-l-full bg-linear-to-r from-amber-400 to-amber-500 transition-all"
                                style={{ width: `${pct}%` }}
                            />
                        </div>
                    </div>
                    <p className="text-lg font-semibold text-neutral-900 tabular-nums">
                        {remaining}
                        {planLimit != null
                            ? ` / ${planLimit}`
                            : " créditos disponíveis"}
                    </p>
                    <p className="text-sm text-neutral-500 mt-1">
                        Consumo no período atual:{" "}
                        <span className="font-medium text-neutral-700 tabular-nums">
                            {usedThisPeriod} crédito
                            {usedThisPeriod === 1 ? "" : "s"}
                        </span>
                    </p>
                    <Link
                        to="/configuracao/overview"
                        className="inline-flex mt-5 rounded-xl bg-neutral-900 text-white text-sm font-medium px-5 py-2.5 hover:bg-neutral-800"
                    >
                        Ver planos
                    </Link>
                </section>
            )}

            <div className="h-px bg-neutral-200" />

            <section>
                <h2 className="text-sm font-semibold text-neutral-800 mb-4">
                    Histórico de atividades
                </h2>
                {loading && transactions.length === 0 && (
                    <p className="text-sm text-neutral-500">Carregando…</p>
                )}
                {!loading && transactions.length === 0 && (
                    <p className="text-sm text-neutral-500 rounded-xl border border-neutral-200 bg-white px-4 py-6 text-center">
                        Nenhuma movimentação registrada ainda. Envie um PDF,
                        gere áudio ou use o Studio (quiz, flashcards, anotações)
                        para ver o histórico aqui.
                    </p>
                )}
                {transactions.length > 0 && (
                    <ul className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100 overflow-hidden">
                        {transactions.map((row) => {
                            const amount = Number(row.amount)
                            const isGain = amount > 0
                            return (
                                <li
                                    key={row.id}
                                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 px-4 py-3.5 text-sm"
                                >
                                    <div className="text-neutral-700 min-w-0">
                                        <span className="mr-2" aria-hidden>
                                            {iconForType(row.type)}
                                        </span>
                                        <span className="font-medium">
                                            {row.label?.trim() ||
                                                labelForCreditType(row.type)}
                                        </span>
                                        <span className="block text-xs text-neutral-400 mt-0.5 sm:inline sm:ml-2 sm:mt-0">
                                            {formatDateTimePt(row.createdAt)} ·{" "}
                                            {labelForCreditType(row.type)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <span
                                            className={
                                                isGain
                                                    ? "tabular-nums font-semibold text-emerald-700"
                                                    : "tabular-nums font-semibold text-neutral-800"
                                            }
                                        >
                                            {formatCreditDelta(amount)}
                                        </span>
                                        <span className="text-xs text-neutral-400 tabular-nums">
                                            saldo {row.balanceAfter}
                                        </span>
                                    </div>
                                </li>
                            )
                        })}
                    </ul>
                )}
            </section>
        </div>
    )
}
