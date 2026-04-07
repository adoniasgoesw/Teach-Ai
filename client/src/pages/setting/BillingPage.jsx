import { useEffect, useState } from "react"
import { useOutletContext } from "react-router-dom"
import { useBillingData } from "../../hooks/useBillingData"
import {
  cancelStripeSubscription,
  resumeStripeSubscription,
  getBillingInvoices,
} from "../../services/api"
import { formatBrlFromCents, formatDatePt } from "../../lib/creditUi"

const STATUS_LABEL = {
  ACTIVE: "Ativa",
  PAST_DUE: "Em atraso",
  CANCELED: "Cancelada",
  TRIALING: "Período de teste",
  INCOMPLETE: "Incompleta",
}

const INVOICE_STATUS_LABEL = {
  DRAFT: "Rascunho",
  PENDING: "Pendente",
  PAID: "Paga",
  FAILED: "Falhou",
  VOID: "Cancelada",
}

export default function BillingPage() {
    const { user } = useOutletContext()
    const userId = user?.id != null ? String(user.id).trim() : ""
    const { summary, loading, error, reload: reloadBilling } = useBillingData(
        userId
    )
    const [invoices, setInvoices] = useState([])
    const [invoicesLoading, setInvoicesLoading] = useState(true)
    const [invoicesError, setInvoicesError] = useState(null)

    const sub = summary?.subscription
    const plan = sub?.plan
    const priceCents = plan?.priceMonthlyCents ?? 0
    const canCancel = Boolean(sub?.externalSubscriptionId)
    const cancelAtPeriodEnd = Boolean(sub?.cancelAtPeriodEnd)
    const [cancelLoading, setCancelLoading] = useState(false)

    useEffect(() => {
        let cancelled = false
        if (!userId) {
            setInvoices([])
            setInvoicesLoading(false)
            setInvoicesError(null)
            return
        }
        setInvoicesLoading(true)
        setInvoicesError(null)
        getBillingInvoices(userId, 50)
            .then((data) => {
                if (cancelled) return
                setInvoices(Array.isArray(data?.invoices) ? data.invoices : [])
            })
            .catch((e) => {
                if (cancelled) return
                setInvoices([])
                setInvoicesError(
                    e?.response?.data?.message ||
                        e?.message ||
                        "Erro ao carregar faturas."
                )
            })
            .finally(() => {
                if (!cancelled) setInvoicesLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [userId])

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
                            <p className="text-neutral-500">
                                {cancelAtPeriodEnd
                                    ? "Assinatura expira em"
                                    : "Próxima renovação"}
                            </p>
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

                    {canCancel && cancelAtPeriodEnd && (
                        <button
                            type="button"
                            disabled={cancelLoading}
                            onClick={() => {
                                const ok = window.confirm(
                                    "Manter assinatura?\n\nA renovação automática será ligada novamente."
                                )
                                if (!ok) return
                                setCancelLoading(true)
                                resumeStripeSubscription(userId)
                                    .then(() => {
                                        void reloadBilling()
                                        window.alert(
                                            "Renovação automática reativada."
                                        )
                                    })
                                    .catch((e) => {
                                        const msg =
                                            e?.response?.data?.message ||
                                            e?.message ||
                                            "Erro ao reativar assinatura."
                                        window.alert(msg)
                                    })
                                    .finally(() => setCancelLoading(false))
                            }}
                            className="rounded-lg border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
                        >
                            {cancelLoading ? "Salvando…" : "Manter assinatura"}
                        </button>
                    )}
                    {canCancel && !cancelAtPeriodEnd && (
                        <button
                            type="button"
                            disabled={cancelLoading}
                            onClick={() => {
                                const ok = window.confirm(
                                    "Cancelar ao fim do período?\n\n- Você mantém o plano até a data acima.\n- Depois disso, volta para Free (créditos atuais permanecem)."
                                )
                                if (!ok) return
                                setCancelLoading(true)
                                cancelStripeSubscription(userId)
                                    .then(() => {
                                        void reloadBilling()
                                        window.alert(
                                            "Cancelamento agendado para o fim do período."
                                        )
                                    })
                                    .catch((e) => {
                                        const msg =
                                            e?.response?.data?.message ||
                                            e?.message ||
                                            "Erro ao cancelar assinatura."
                                        window.alert(msg)
                                    })
                                    .finally(() => setCancelLoading(false))
                            }}
                            className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                            {cancelLoading ? "Cancelando…" : "Cancelar assinatura"}
                        </button>
                    )}
                </section>
            )}

            <section className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/50 p-6">
                <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                    Faturas
                </h2>
                {invoicesError && (
                    <p className="text-sm text-red-600 rounded-lg border border-red-100 bg-red-50 px-3 py-2 mb-3">
                        {invoicesError}
                    </p>
                )}

                {invoicesLoading ? (
                    <p className="text-sm text-neutral-600">Carregando faturas…</p>
                ) : invoices.length === 0 ? (
                    <p className="text-sm text-neutral-600">
                        Nenhuma fatura registrada no sistema para esta conta.
                    </p>
                ) : (
                    <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
                        <table className="w-full text-sm text-left min-w-[560px]">
                            <thead>
                                <tr className="bg-neutral-50 border-b border-neutral-100">
                                    <th className="px-4 py-2.5 font-medium text-neutral-600">
                                        Data
                                    </th>
                                    <th className="px-4 py-2.5 font-medium text-neutral-600">
                                        Descrição
                                    </th>
                                    <th className="px-4 py-2.5 font-medium text-neutral-600">
                                        Vencimento
                                    </th>
                                    <th className="px-4 py-2.5 font-medium text-neutral-600">
                                        Valor
                                    </th>
                                    <th className="px-4 py-2.5 font-medium text-neutral-600">
                                        Status
                                    </th>
                                    <th className="px-4 py-2.5 font-medium text-neutral-600">
                                        Link
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoices.map((inv) => (
                                    <tr
                                        key={inv.id}
                                        className="border-b border-neutral-100 last:border-b-0"
                                    >
                                        <td className="px-4 py-2.5 text-neutral-800">
                                            {inv.paidAt
                                                ? formatDatePt(inv.paidAt)
                                                : formatDatePt(inv.createdAt)}
                                        </td>
                                        <td className="px-4 py-2.5 text-neutral-700">
                                            {inv.description || "—"}
                                        </td>
                                        <td className="px-4 py-2.5 text-neutral-700">
                                            {inv.dueAt ? formatDatePt(inv.dueAt) : "—"}
                                        </td>
                                        <td className="px-4 py-2.5 text-neutral-900 tabular-nums">
                                            {formatBrlFromCents(inv.amountCents ?? 0)}
                                        </td>
                                        <td className="px-4 py-2.5 text-neutral-800">
                                            {INVOICE_STATUS_LABEL[inv.status] ||
                                                inv.status ||
                                                "—"}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            {inv.hostedInvoiceUrl ? (
                                                <a
                                                    href={inv.hostedInvoiceUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-violet-700 hover:underline"
                                                >
                                                    Abrir
                                                </a>
                                            ) : (
                                                <span className="text-neutral-400">—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    )
}
