import { useOutletContext } from "react-router-dom"
import { useBillingData } from "../../hooks/useBillingData"
import { formatBrlFromCents, formatDatePt } from "../../lib/creditUi"

const STATUS_LABEL = {
  ACTIVE: "Ativa",
  PAST_DUE: "Em atraso",
  CANCELED: "Cancelada",
  TRIALING: "Período de teste",
  INCOMPLETE: "Incompleta",
}

export default function BillingPage() {
    const { user } = useOutletContext()
    const userId = user?.id != null ? String(user.id).trim() : ""
    const { summary, loading, error } = useBillingData(userId)

    const sub = summary?.subscription
    const plan = sub?.plan
    const priceCents = plan?.priceMonthlyCents ?? 0

    return (
        <div className="max-w-2xl space-y-8 pb-8">
            <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-violet-600 mb-1">
                    TeachAI Credits
                </p>
                <h1 className="text-2xl font-light text-neutral-900">Cobrança</h1>
                <p className="text-sm text-neutral-500 mt-1">
                    Dados do plano vinculados à sua conta no servidor.
                </p>
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
                <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm space-y-4">
                    <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                        Resumo
                    </h2>
                    <div className="grid sm:grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="text-neutral-500">Plano atual</p>
                            <p className="font-semibold text-neutral-900 mt-0.5">
                                {plan?.name ?? "Sem assinatura ativa"}
                            </p>
                            {plan?.slug && (
                                <p className="text-xs text-neutral-400 mt-1">
                                    {plan.slug}
                                </p>
                            )}
                        </div>
                        <div>
                            <p className="text-neutral-500">Valor mensal</p>
                            <p className="font-semibold text-neutral-900 mt-0.5">
                                {formatBrlFromCents(priceCents)}
                            </p>
                        </div>
                        <div>
                            <p className="text-neutral-500">Status</p>
                            <p className="font-medium text-neutral-800 mt-0.5">
                                {sub
                                    ? STATUS_LABEL[sub.status] || sub.status
                                    : "—"}
                            </p>
                        </div>
                        <div>
                            <p className="text-neutral-500">Fim do período</p>
                            <p className="font-medium text-neutral-800 mt-0.5">
                                {sub
                                    ? formatDatePt(sub.currentPeriodEnd)
                                    : "—"}
                            </p>
                        </div>
                        <div className="sm:col-span-2">
                            <p className="text-neutral-500">Saldo de créditos</p>
                            <p className="font-semibold text-neutral-900 mt-0.5 tabular-nums">
                                {summary.wallet?.balance ?? 0} créditos
                            </p>
                        </div>
                        <div className="sm:col-span-2">
                            <p className="text-neutral-500">Método de pagamento</p>
                            <p className="font-medium text-neutral-800 mt-0.5">
                                Integração de pagamento ainda não configurada —
                                plano Free ou manual.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        disabled
                        className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm font-medium text-neutral-400 cursor-not-allowed"
                    >
                        Adicionar pagamento (em breve)
                    </button>
                </section>
            )}

            <section className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/50 p-6">
                <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                    Faturas
                </h2>
                <p className="text-sm text-neutral-600">
                    Nenhuma fatura registrada no sistema para esta conta. Quando
                    houver cobrança recorrente, os registros de{" "}
                    <code className="text-xs bg-white px-1 rounded border">
                        Invoice
                    </code>{" "}
                    aparecerão aqui.
                </p>
            </section>
        </div>
    )
}
